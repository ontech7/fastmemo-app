//! The engine library (`src-tauri/ai-engine`), opened at run time and never linked: the app and the `--mcp` bridge start
//! without it, and a missing, older or stub library, or a CPU it can't run on, only means no AI.
//!
//! Its C ABI (`ai-engine/src/ffi.rs`): `fm_ai_abi_version`, `fm_ai_call` (a JSON request in, `{"ok": …}` or
//! `{"error": "…"}` out, the streamed text through a callback, a stop flag), `fm_ai_free`.

use std::ffi::{c_char, c_void, CStr, CString};
use std::mem::ManuallyDrop;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use libloading::Library;
use serde_json::Value;

use super::system;

/// The library's file, as `scripts/build-ai-engine.mjs` names it and the bundle places it.
#[cfg(windows)]
pub const LIBRARY_FILE: &str = "fastmemo_ai.dll";
#[cfg(target_os = "macos")]
pub const LIBRARY_FILE: &str = "libfastmemo_ai.dylib";
#[cfg(not(any(windows, target_os = "macos")))]
pub const LIBRARY_FILE: &str = "libfastmemo_ai.so";

/// The engine's ABI this app speaks. The stub library, built for a platform without AI, answers 0.
const ABI_VERSION: u32 = 1;

type AbiVersionFn = unsafe extern "C" fn() -> u32;
type OnTokenFn = extern "C" fn(*const c_char, *mut c_void);
type CallFn = unsafe extern "C" fn(*const c_char, Option<OnTokenFn>, *mut c_void, *const AtomicBool) -> *mut c_char;
type FreeFn = unsafe extern "C" fn(*mut c_char);

/// Why there is no engine.
#[derive(Debug, PartialEq, Eq)]
pub enum Unavailable {
    /// An x86_64 CPU without AVX2, FMA and F16C, which the library is built for.
    Cpu,
    /// No library, or the empty file `build.rs` leaves when it wasn't built.
    Missing,
    /// Not this app's engine: the stub, another ABI version, or a symbol missing.
    Abi,
    /// The system wouldn't load it (its error).
    Error(String),
}

impl Unavailable {
    /// As the page reads it (`EngineSupport.reason`).
    pub fn reason(&self) -> &'static str {
        match self {
            Unavailable::Cpu => "cpu",
            Unavailable::Missing => "missing",
            Unavailable::Abi => "abi",
            Unavailable::Error(_) => "error",
        }
    }
}

/// The library, open, its ABI checked.
pub struct Engine {
    call: CallFn,
    free: FreeFn,
    /// Never closed: the engine registers an exit handler inside it (it frees the model as the process ends).
    _library: ManuallyDrop<Library>,
}

impl Engine {
    /// Opens the library in `dir`. The CPU is checked first: loading the library could already run its instructions.
    pub fn open(dir: &Path) -> Result<Engine, Unavailable> {
        if !system::cpu_supported() {
            return Err(Unavailable::Cpu);
        }
        let path = dir.join(LIBRARY_FILE);
        if !std::fs::metadata(&path).is_ok_and(|meta| meta.is_file() && meta.len() > 0) {
            return Err(Unavailable::Missing);
        }
        // SAFETY: loading runs the library's initialisers: the engine's, built with the app.
        let library = unsafe { Library::new(&path) }.map_err(|err| Unavailable::Error(err.to_string()))?;
        // SAFETY: the types are those of the engine's C ABI (`ai-engine/src/ffi.rs`); the pointers are used only while
        // the library stays open, which it does for good once this returns an engine.
        let symbols = unsafe {
            (
                library.get::<AbiVersionFn>(b"fm_ai_abi_version\0").map(|symbol| *symbol),
                library.get::<CallFn>(b"fm_ai_call\0").map(|symbol| *symbol),
                library.get::<FreeFn>(b"fm_ai_free\0").map(|symbol| *symbol),
            )
        };
        let (Ok(abi_version), Ok(call), Ok(free)) = symbols else {
            return Err(Unavailable::Abi);
        };
        // SAFETY: as declared by the engine; it never unwinds.
        if unsafe { abi_version() } != ABI_VERSION {
            return Err(Unavailable::Abi);
        }
        Ok(Engine { call, free, _library: ManuallyDrop::new(library) })
    }

    /// Runs one request (`{"op": …}`) and returns its `ok`, or its `error` as the error. `on_token` gets each piece of
    /// a completion's text, on this thread, as it comes. `stop`, when set, ends a load or a completion early.
    pub fn call(
        &self,
        request: &Value,
        on_token: Option<&mut dyn FnMut(&str)>,
        stop: &AtomicBool,
    ) -> Result<Value, String> {
        // serde_json escapes every control character: the text holds no NUL
        let request = CString::new(request.to_string()).map_err(|_| "bad_request: NUL".to_string())?;
        let mut on_token = on_token;
        let (callback, user): (Option<OnTokenFn>, *mut c_void) = match on_token.as_mut() {
            Some(on_token) => (Some(forward), (on_token as *mut &mut dyn FnMut(&str)).cast()),
            None => (None, std::ptr::null_mut()),
        };
        // SAFETY: a NUL-terminated request; `user` (read by `forward` only) and `stop` outlive the call, which returns
        // when the operation is over.
        let answer = unsafe { (self.call)(request.as_ptr(), callback, user, stop) };
        if answer.is_null() {
            return Err("engine: no answer".to_string());
        }
        // SAFETY: the engine's answer, a NUL-terminated string, freed once, by the engine
        let text = unsafe { CStr::from_ptr(answer) }.to_string_lossy().into_owned();
        unsafe { (self.free)(answer) };
        parse_answer(&text)
    }
}

/// Hands a piece of streamed text to the closure of the `call` running (`user`).
extern "C" fn forward(piece: *const c_char, user: *mut c_void) {
    if piece.is_null() || user.is_null() {
        return;
    }
    // never unwinds into the engine
    let _ = catch_unwind(AssertUnwindSafe(|| {
        // SAFETY: `user` is the `&mut dyn FnMut(&str)` that `call` lent for its own duration, and `piece` a
        // NUL-terminated string valid during this callback.
        let on_token = unsafe { &mut *user.cast::<&mut dyn FnMut(&str)>() };
        let piece = unsafe { CStr::from_ptr(piece) }.to_string_lossy();
        on_token(&piece);
    }));
}

/// `{"ok": value}` → value; `{"error": "…"}` → the error.
fn parse_answer(text: &str) -> Result<Value, String> {
    let Ok(Value::Object(mut answer)) = serde_json::from_str::<Value>(text) else {
        return Err("engine: bad answer".to_string());
    };
    if let Some(ok) = answer.remove("ok") {
        return Ok(ok);
    }
    Err(answer.get("error").and_then(Value::as_str).unwrap_or("engine: bad answer").to_string())
}

/// Where the library may be, in order, from the app's resource directory (Tauri's `resource_dir()`):
/// - macOS: the bundle's `Contents/Frameworks` (`tauri.macos.conf.json`); in a dev build, `target/Frameworks`, where
///   tauri-build copies it;
/// - Windows and Linux: the resources' `ai/` (`tauri.windows.conf.json`, `tauri.linux.conf.json`): next to the
///   executable on Windows, `/usr/lib/<product name>/ai` for a deb or rpm, the same under the AppImage's mount;
/// - a debug build also tries `src-tauri/ai-engine/dist`, where the build script writes it.
pub fn library_dirs(resource_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(resources) = resource_dir {
        #[cfg(target_os = "macos")]
        dirs.push(resources.join("../Frameworks"));
        #[cfg(not(target_os = "macos"))]
        dirs.push(resources.join("ai"));
    }
    #[cfg(debug_assertions)]
    dirs.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("ai-engine/dist"));
    dirs
}

/// The first of `dirs` whose library opens. Otherwise why the first library found didn't, or `Missing` if none was.
pub fn open_first(dirs: &[PathBuf]) -> Result<Engine, Unavailable> {
    let mut first_failure = None;
    for dir in dirs {
        match Engine::open(dir) {
            Ok(engine) => return Ok(engine),
            Err(Unavailable::Missing) => {}
            Err(Unavailable::Cpu) => return Err(Unavailable::Cpu),
            Err(failure) => {
                first_failure.get_or_insert(failure);
            }
        }
    }
    Err(first_failure.unwrap_or(Unavailable::Missing))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// An empty directory of its own, removed at the end of the test.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> TempDir {
            let dir = std::env::temp_dir().join(format!("fastmemo-ai-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// Where `scripts/build-ai-engine.mjs` (or Task 6's command) leaves the stub built for this machine.
    fn stub_dir() -> Option<PathBuf> {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("ai-engine/target/stub");
        let os = match std::env::consts::OS {
            "macos" => "darwin",
            os => os,
        };
        // built without --target, or with this machine's triple
        let mut dirs = vec![root.join("release")];
        if let Ok(entries) = std::fs::read_dir(&root) {
            dirs.extend(
                entries
                    .flatten()
                    .map(|entry| entry.file_name().to_string_lossy().into_owned())
                    .filter(|triple| triple.starts_with(std::env::consts::ARCH) && triple.contains(os))
                    .map(|triple| root.join(triple).join("release")),
            );
        }
        dirs.into_iter().find(|dir| dir.join(LIBRARY_FILE).is_file())
    }

    #[test]
    fn missing_library_is_unavailable() {
        let dir = TempDir::new("missing");
        assert_eq!(Engine::open(&dir.0).err(), Some(Unavailable::Missing));
    }

    #[test]
    fn stub_library_is_unavailable() {
        let Some(dir) = stub_dir() else {
            eprintln!(
                "skipped: no stub library (cargo build --release --no-default-features --target-dir target/stub)"
            );
            return;
        };
        assert_eq!(Engine::open(&dir).err(), Some(Unavailable::Abi));
    }

    #[test]
    fn placeholder_is_missing() {
        let dir = TempDir::new("placeholder");
        std::fs::write(dir.0.join(LIBRARY_FILE), []).unwrap();
        assert_eq!(Engine::open(&dir.0).err(), Some(Unavailable::Missing));
    }

    #[test]
    fn not_a_library_is_an_error() {
        let dir = TempDir::new("garbage");
        std::fs::write(dir.0.join(LIBRARY_FILE), b"not a library").unwrap();
        assert!(matches!(Engine::open(&dir.0).err(), Some(Unavailable::Error(_))));
        // the first library found says why, a later directory without one doesn't hide it
        let empty = TempDir::new("garbage-then-empty");
        assert!(matches!(open_first(&[dir.0.clone(), empty.0.clone()]).err(), Some(Unavailable::Error(_))));
        assert_eq!(open_first(std::slice::from_ref(&empty.0)).err(), Some(Unavailable::Missing));
    }

    /// `ai-engine/dist`, when the build script has put the real library there (not build.rs's placeholder).
    fn built_engine() -> Option<Engine> {
        Engine::open(&Path::new(env!("CARGO_MANIFEST_DIR")).join("ai-engine/dist")).ok()
    }

    #[test]
    fn built_library_answers() {
        let Some(engine) = built_engine() else {
            eprintln!("skipped: no engine library in ai-engine/dist (node scripts/build-ai-engine.mjs)");
            return;
        };
        let stop = AtomicBool::new(false);
        let info = engine.call(&serde_json::json!({ "op": "info" }), None, &stop).unwrap();
        assert!(info.get("gpu").is_some_and(Value::is_boolean), "{info}");
        let refused = engine.call(&serde_json::json!({ "op": "fly" }), None, &stop).unwrap_err();
        assert!(refused.starts_with("bad_request"), "{refused}");
    }

    /// `FASTMEMO_AI_MODEL=<a Qwen3.5 GGUF> cargo test -- --ignored`, with the library built.
    #[test]
    #[ignore]
    fn streams_a_completion_and_stops() {
        use std::sync::atomic::Ordering;
        let engine = built_engine().expect("no engine library in ai-engine/dist");
        let model = std::env::var("FASTMEMO_AI_MODEL").expect("FASTMEMO_AI_MODEL is the path of a Qwen3.5 GGUF");
        let stop = AtomicBool::new(false);
        let load =
            serde_json::json!({ "op": "load", "path": model, "n_ctx": 2048, "n_threads": system::inference_threads() });
        engine.call(&load, None, &stop).unwrap();
        let complete = serde_json::json!({
            "op": "complete",
            "messages": [
                { "role": "system", "content": "Answer in one short sentence." },
                { "role": "user", "content": "What colour is the sky on a clear day?" },
            ],
            "n_predict": 24,
            "temperature": 0,
        });
        let mut streamed = String::new();
        let mut on_token = |piece: &str| streamed.push_str(piece);
        let answer = engine.call(&complete, Some(&mut on_token), &stop).unwrap();
        let text = answer["text"].as_str().unwrap();
        assert!(!text.is_empty());
        assert_eq!(streamed, text);
        assert_eq!(answer["interrupted"], false);
        // the flag reaches the engine: set before the call, the completion ends at once
        stop.store(true, Ordering::SeqCst);
        let stopped = engine.call(&complete, None, &stop).unwrap();
        assert_eq!(stopped["interrupted"], true, "{stopped}");
        stop.store(false, Ordering::SeqCst);
        engine.call(&serde_json::json!({ "op": "release" }), None, &stop).unwrap();
    }

    #[test]
    fn answers_are_unwrapped() {
        assert_eq!(parse_answer(r#"{"ok":[1,2]}"#), Ok(serde_json::json!([1, 2])));
        assert_eq!(parse_answer(r#"{"error":"busy"}"#), Err("busy".to_string()));
        assert_eq!(parse_answer("nope"), Err("engine: bad answer".to_string()));
        assert_eq!(parse_answer(r#"{"other":1}"#), Err("engine: bad answer".to_string()));
    }
}
