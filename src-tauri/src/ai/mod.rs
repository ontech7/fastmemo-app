//! On-device AI on the desktop: the engine library (`library.rs`) and the model commands of the page
//! (`src/libs/ai/engine.web.ts`).
//!
//! The library is opened on the first command that needs it, never at start: the app and the `--mcp` bridge (the same
//! executable) start whatever its state. The commands are async (off the main thread), and those that call the engine
//! run on the blocking pool.
//!
//! One call at a time, as in the engine: a call that comes while another runs (a completion, a load) answers `busy` at
//! once, and never waits. The stop flag is cleared as a call starts, so that a stop meant for the last one can't end the
//! next one (the engine reads it during a load too); only `ai_stop` sets it, and the app's quit.

mod library;
mod system;

use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock, TryLockError};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use library::{Engine, Unavailable};

/// The engine's answer while another call runs; the same here.
const BUSY: &str = "busy";

/// What the AI keeps while the app runs.
#[derive(Default)]
pub struct Ai {
    /// Opened once, on first use; a library that wasn't there stays so until the app starts again.
    engine: OnceLock<Result<Engine, Unavailable>>,
    /// Held for each call. Inside: the page that loaded the model last (`ai_load`'s `page_id`), `None` once released.
    calls: Mutex<Option<String>>,
    /// The engine reads it through a pointer for the whole of a call: each call holds its own reference.
    stop: Arc<AtomicBool>,
}

impl Ai {
    /// The library, opened by the first call that needs it.
    fn opened(&self, app: &AppHandle) -> &Result<Engine, Unavailable> {
        self.engine.get_or_init(|| {
            let opened = library::open_first(&library::library_dirs(app.path().resource_dir().ok().as_deref()));
            if let Err(Unavailable::Error(err)) = &opened {
                log(format_args!("the engine library didn't load: {err}"));
            }
            opened
        })
    }

    fn engine(&self, app: &AppHandle) -> Result<&Engine, String> {
        self.opened(app).as_ref().map_err(|unavailable| format!("no_engine: {}", unavailable.reason()))
    }

    /// The right to call the engine, or `busy` at once; clears the stop flag.
    fn begin(&self) -> Result<(MutexGuard<'_, Option<String>>, Arc<AtomicBool>), String> {
        let guard = match self.calls.try_lock() {
            Ok(guard) => guard,
            Err(TryLockError::Poisoned(poisoned)) => poisoned.into_inner(),
            Err(TryLockError::WouldBlock) => return Err(BUSY.to_string()),
        };
        self.stop.store(false, Ordering::SeqCst);
        Ok((guard, Arc::clone(&self.stop)))
    }

    /// The app is quitting (`RunEvent::Exit`): the model is freed now, before the GPU backend's own teardown, so the
    /// engine's exit handler finds nothing left. A call still running is asked to stop instead: the engine's handler
    /// frees the model once it has.
    pub fn release_at_quit(&self) {
        let Some(Ok(engine)) = self.engine.get() else {
            return;
        };
        match self.calls.try_lock() {
            Ok(mut loaded_by) => {
                *loaded_by = None;
                let _ = engine.call(&json!({ "op": "release" }), None, &self.stop);
            }
            Err(_) => self.stop.store(true, Ordering::SeqCst),
        }
    }
}

/// To stderr, which a release build on Windows has nowhere to show. Not `eprintln!`, which panics when stderr is closed.
fn log(message: std::fmt::Arguments) {
    let _ = writeln!(std::io::stderr(), "fastmemo ai: {message}");
}

/// Runs `work` on the blocking pool, with the app's `Ai`.
async fn off_main<T: Send + 'static>(
    app: AppHandle,
    work: impl FnOnce(&AppHandle, &Ai) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || work(&app, &app.state::<Ai>())).await.map_err(|err| err.to_string())?
}

/// Whether `name` is a file name alone: no directory, no way out of the models folder.
fn is_bare_file_name(name: &str) -> bool {
    !name.is_empty()
        && !name.contains(['/', '\\', ':', '\0'])
        && !name.contains("..")
        && matches!(Path::new(name).components().collect::<Vec<_>>()[..], [Component::Normal(_)])
}

/// Where the model files are: the app's local data folder, `models/`.
pub(crate) fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_local_data_dir().map_err(|err| err.to_string())?.join("models"))
}

/// A model file's path, from its bare name.
pub(crate) fn model_path(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    if !is_bare_file_name(file_name) {
        return Err("bad_request: file name".to_string());
    }
    Ok(models_dir(app)?.join(file_name))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiInfo {
    available: bool,
    /// Why not: `cpu`, `missing`, `abi` or `error`. Left out when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    /// In bytes.
    total_memory: Option<u64>,
}

/// The engine's answer to a load (`gpu`, `reason_no_gpu`, `devices`), as the page reads it.
#[derive(Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct LoadInfo {
    gpu: bool,
    reason_no_gpu: String,
    devices: Vec<String>,
}

/// Whether the AI can run here, and the computer's memory. Opens the library (once), loads no model.
#[tauri::command]
pub async fn ai_info(app: AppHandle) -> AiInfo {
    let info = off_main(app, |app, ai| {
        let unavailable = ai.opened(app).as_ref().err();
        Ok(AiInfo {
            available: unavailable.is_none(),
            reason: unavailable.map(|unavailable| unavailable.reason().to_string()),
            total_memory: system::total_memory(),
        })
    })
    .await;
    info.unwrap_or(AiInfo { available: false, reason: Some("error".to_string()), total_memory: None })
}

/// Loads a model of the models folder (a bare file name), replacing the one loaded. A model loaded by a page that has
/// since reloaded (development) is released first: the new page never knew about it.
#[tauri::command]
pub async fn ai_load(
    app: AppHandle,
    file_name: String,
    n_ctx: u32,
    n_gpu_layers: i32,
    page_id: String,
) -> Result<LoadInfo, String> {
    let path = model_path(&app, &file_name)?;
    let path = path.to_str().ok_or("load_failed: the models folder's path is not UTF-8")?.to_string();
    off_main(app, move |app, ai| {
        let engine = ai.engine(app)?;
        let (mut loaded_by, stop) = ai.begin()?;
        if loaded_by.as_ref().is_some_and(|id| *id != page_id) {
            engine.call(&json!({ "op": "release" }), None, &stop)?;
        }
        // this page's, whatever the outcome: a failed load may have left the previous model or none
        *loaded_by = Some(page_id);
        let request = json!({
            "op": "load",
            "path": path,
            "n_ctx": n_ctx,
            "n_gpu_layers": n_gpu_layers,
            "n_threads": system::inference_threads(),
        });
        let answer = engine.call(&request, None, &stop)?;
        serde_json::from_value(answer).map_err(|err| format!("engine: {err}"))
    })
    .await
}

#[tauri::command]
pub async fn ai_tokenize(app: AppHandle, text: String) -> Result<Vec<i32>, String> {
    off_main(app, move |app, ai| {
        let engine = ai.engine(app)?;
        let (_calls, stop) = ai.begin()?;
        let answer = engine.call(&json!({ "op": "tokenize", "text": text }), None, &stop)?;
        serde_json::from_value(answer).map_err(|err| format!("engine: {err}"))
    })
    .await
}

/// A completion with llama.rn's parameters, passed to the engine as they are, and its result as the engine gives it.
/// The text streams to `on_token` as it comes.
#[tauri::command]
pub async fn ai_complete(app: AppHandle, params: Value, on_token: Channel<String>) -> Result<Value, String> {
    let Value::Object(mut request) = params else {
        return Err("bad_request: params".to_string());
    };
    request.insert("op".to_string(), "complete".into());
    let request = Value::Object(request);
    off_main(app, move |app, ai| {
        let engine = ai.engine(app)?;
        let (_calls, stop) = ai.begin()?;
        // never blocks: the channel hands the text to the webview's event loop
        let mut send = |piece: &str| {
            let _ = on_token.send(piece.to_string());
        };
        engine.call(&request, Some(&mut send), &stop)
    })
    .await
}

/// Ends the running load or completion: a completion returns what it has, `interrupted`.
#[tauri::command]
pub async fn ai_stop(app: AppHandle) {
    app.state::<Ai>().stop.store(true, Ordering::SeqCst);
}

/// Frees the model.
#[tauri::command]
pub async fn ai_release(app: AppHandle) -> Result<(), String> {
    off_main(app, |_app, ai| {
        // never opened: nothing loaded
        let Some(Ok(engine)) = ai.engine.get() else {
            return Ok(());
        };
        let (mut loaded_by, stop) = ai.begin()?;
        engine.call(&json!({ "op": "release" }), None, &stop)?;
        *loaded_by = None;
        Ok(())
    })
    .await
}

/// `--ai-selftest [model.gguf]`: whether this executable opens its engine library, found as the app finds it (from the
/// executable's place: no Tauri app runs in this mode). Prints one JSON line, `{"available": …, "reason": …}` (with
/// `detail` when the system refused the library), and returns the exit code, 0. With a model, it also loads it and
/// writes a few words in this process (`completion`: `{"gpu", "text"}` or `{"error"}`), then frees it. For the build
/// checks (CI, a bundled app by hand).
pub fn selftest(model: Option<&Path>) -> i32 {
    let context = crate::context();
    let resources = tauri::utils::platform::resource_dir(context.package_info(), &tauri::Env::default()).ok();
    let line = match library::open_first(&library::library_dirs(resources.as_deref())) {
        Ok(engine) => {
            let mut line = json!({ "available": true, "reason": null });
            if let Some(model) = model {
                line["completion"] = match selftest_completion(&engine, model) {
                    Ok(completion) => completion,
                    Err(err) => json!({ "error": err }),
                };
            }
            line
        }
        Err(unavailable) => {
            let mut line = json!({ "available": false, "reason": unavailable.reason() });
            if let Unavailable::Error(detail) = unavailable {
                line["detail"] = detail.into();
            }
            line
        }
    };
    let _ = writeln!(std::io::stdout(), "{line}");
    0
}

/// Loads `model` as the app does (all layers on the GPU there is, half the cores), writes a few words, frees it.
fn selftest_completion(engine: &Engine, model: &Path) -> Result<Value, String> {
    let stop = AtomicBool::new(false);
    let path = model.to_str().ok_or("the model's path is not UTF-8")?;
    let load = json!({
        "op": "load",
        "path": path,
        "n_ctx": 512,
        "n_gpu_layers": -1,
        "n_threads": system::inference_threads(),
    });
    let loaded = engine.call(&load, None, &stop)?;
    let complete = json!({
        "op": "complete",
        "messages": [
            { "role": "system", "content": "Answer in a few words." },
            { "role": "user", "content": "Say hello." },
        ],
        "n_predict": 8,
        "temperature": 0,
    });
    let answer = engine.call(&complete, None, &stop);
    // freed before the process exits: the GPU backend's teardown asserts that no model is left
    engine.call(&json!({ "op": "release" }), None, &stop)?;
    Ok(json!({ "gpu": loaded["gpu"], "text": answer?["text"] }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_are_bare() {
        assert!(is_bare_file_name("a.gguf"));
        for name in ["../a.gguf", "a/b.gguf", "a\\b.gguf", "", "."] {
            assert!(!is_bare_file_name(name), "{name:?} was accepted");
        }
        for name in ["..", "/a.gguf", "C:a.gguf", "a\0.gguf"] {
            assert!(!is_bare_file_name(name), "{name:?} was accepted");
        }
    }
}
