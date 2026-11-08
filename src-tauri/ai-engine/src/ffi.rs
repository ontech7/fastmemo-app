//! The C ABI the app loads at run time: a JSON request in, a JSON answer out.
//!
//! A request is an object with an `"op"`; the answer is `{"ok": …}` or `{"error": "…"}`. No call
//! can unwind into the caller: a panic becomes `{"error":"panic"}`. The engine checks every request
//! before llama.cpp sees it, so that no input reaches one of its asserts (an abort would close the
//! app).

use std::ffi::{c_char, c_void, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(feature = "llama")]
use crate::engine as backend;
use crate::json::Json;
#[cfg(not(feature = "llama"))]
use crate::stub as backend;

/// Receives each piece of streamed text (NUL-terminated UTF-8, whole characters only) and the
/// caller's `user` pointer.
pub type OnToken = extern "C" fn(*const c_char, *mut c_void);

/// What an operation may do while it runs: hand text to the caller, and see whether to stop.
pub struct Io<'a> {
    pub on_token: Option<&'a mut dyn FnMut(&str)>,
    /// Set by the caller to cancel: a model load, or a completion between prompt batches and after
    /// each token. The caller clears it before a call.
    pub stop: Option<&'a AtomicBool>,
}

impl Io<'_> {
    pub fn stopped(&self) -> bool {
        self.stop.is_some_and(|s| s.load(Ordering::Relaxed))
    }

    /// Streams `piece` to the caller (an empty piece is not sent).
    pub fn send(&mut self, piece: &str) {
        if piece.is_empty() {
            return;
        }
        if let Some(on_token) = self.on_token.as_mut() {
            on_token(piece);
        }
    }
}

/// 1 when the library runs llama.cpp, 0 for the stub (built without it).
#[no_mangle]
pub extern "C" fn fm_ai_abi_version() -> u32 {
    catch_unwind(|| backend::ABI_VERSION).unwrap_or(0)
}

/// Runs one request.
///
/// `request` is a NUL-terminated UTF-8 JSON object. `on_token` (may be `None`) gets the streamed
/// text of a completion, with `user`. `stop` (may be null) must stay valid for the whole call. The
/// answer is never null, and is freed with [`fm_ai_free`].
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)] // the pointers' contract is the C caller's, as documented
pub extern "C" fn fm_ai_call(
    request: *const c_char,
    on_token: Option<extern "C" fn(*const c_char, *mut c_void)>,
    user: *mut c_void,
    stop: *const AtomicBool,
) -> *mut c_char {
    let answer = catch_unwind(AssertUnwindSafe(|| {
        // SAFETY: the caller passes a NUL-terminated string or null, and a flag that outlives the
        // call or null.
        let request = (!request.is_null()).then(|| unsafe { CStr::from_ptr(request) });
        let stop = unsafe { stop.as_ref() };
        respond(request, on_token, user, stop)
    }))
    .unwrap_or_else(|_| error("panic"));
    // The JSON writer escapes every control character: an answer never holds a NUL.
    CString::new(answer)
        .unwrap_or_else(|_| CString::from(c"{\"error\":\"panic\"}"))
        .into_raw()
}

/// Frees an answer of [`fm_ai_call`]. Null is ignored.
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)] // the pointer comes from fm_ai_call, as documented
pub extern "C" fn fm_ai_free(response: *mut c_char) {
    if response.is_null() {
        return;
    }
    // SAFETY: `response` was made by `CString::into_raw` in `fm_ai_call`, and is freed once.
    let _ = catch_unwind(AssertUnwindSafe(|| {
        drop(unsafe { CString::from_raw(response) })
    }));
}

fn respond(
    request: Option<&CStr>,
    on_token: Option<OnToken>,
    user: *mut c_void,
    stop: Option<&AtomicBool>,
) -> String {
    let Some(request) = request else {
        return error("bad_request: null");
    };
    let Ok(text) = request.to_str() else {
        return error("bad_request: not UTF-8");
    };
    let request = match Json::parse(text) {
        Ok(request) => request,
        Err(e) => return error(&format!("bad_request: {e}")),
    };
    let mut send = |piece: &str| {
        if let Some(on_token) = on_token {
            // a NUL inside the text would end the C string early: it is left out of the stream
            let bytes: Vec<u8> = piece.bytes().filter(|&b| b != 0).collect();
            if let Ok(piece) = CString::new(bytes) {
                on_token(piece.as_ptr(), user);
            }
        }
    };
    let mut io = Io {
        on_token: on_token
            .is_some()
            .then_some(&mut send as &mut dyn FnMut(&str)),
        stop,
    };
    match backend::handle(&request, &mut io) {
        Ok(value) => Json::object([("ok", value)]).to_string(),
        Err(e) => error(&e),
    }
}

fn error(message: &str) -> String {
    Json::object([("error", message.into())]).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn call(request: &str) -> Json {
        let request = CString::new(request).unwrap();
        let answer = fm_ai_call(
            request.as_ptr(),
            None,
            std::ptr::null_mut(),
            std::ptr::null(),
        );
        let text = unsafe { CStr::from_ptr(answer) }
            .to_str()
            .unwrap()
            .to_string();
        fm_ai_free(answer);
        Json::parse(&text).unwrap()
    }

    #[test]
    fn bad_requests_are_errors_not_crashes() {
        for request in [
            "",
            "not json",
            "[1,2]",
            "{}",
            r#"{"op":"fly"}"#,
            r#"{"op":3}"#,
        ] {
            let answer = call(request);
            assert!(
                answer.get("error").and_then(Json::as_str).is_some(),
                "{request:?} → {answer}"
            );
        }
        let null = fm_ai_call(
            std::ptr::null(),
            None,
            std::ptr::null_mut(),
            std::ptr::null(),
        );
        assert!(!null.is_null());
        fm_ai_free(null);
        fm_ai_free(std::ptr::null_mut());
    }

    #[test]
    fn abi_version_matches_the_build() {
        assert_eq!(fm_ai_abi_version(), u32::from(cfg!(feature = "llama")));
    }

    #[test]
    fn requests_that_need_a_model_say_so() {
        let answer = call(r#"{"op":"complete","messages":[]}"#);
        assert!(answer.get("error").is_some(), "{answer}");
    }
}
