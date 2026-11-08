//! On-device AI on the desktop: the engine library (`library.rs`) and the model commands of the page
//! (`src/libs/ai/engine.web.ts`).
//!
//! The library is opened on the first command that needs it, never at start: the app and the `--mcp` bridge (the same
//! executable) start whatever its state. The commands are async (off the main thread), and those that call the engine
//! run on the blocking pool.
//!
//! One call at a time, as in the engine: a call that comes while another runs (a completion, a load) answers `busy` at
//! once, and never waits. The stop flag is set as a call reaches the engine from the stops counted since the call came
//! in: a stop sent right after a start (while the call waits for a worker, or for the library to open) still ends it,
//! and one meant for an earlier call can't end the next one (the engine reads the flag during a load too). Only
//! `ai_stop` sets it, and the app's quit. While the app quits, no call starts.
//!
//! The model download (`download.rs`) is apart from the engine's calls: one at a time too (`busy`), on the blocking
//! pool, its own cancel flag counted the same way (`Downloads`). The page's file commands (`ai_model_files`,
//! `ai_delete_files`) take bare names only, as every command that reaches the models folder.

mod download;
mod library;
mod system;

use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock, TryLockError};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use download::{DownloadFile, Progress};
use library::{Engine, Unavailable};

/// The engine's answer while another call runs; the same here.
const BUSY: &str = "busy";
/// The answer to a call that comes while the app quits.
const EXITING: &str = "exiting";
/// How long the quit waits for a call it stopped (a load ends within its next step, a completion within a batch).
const QUIT_WAIT: Duration = Duration::from_secs(2);

/// What the AI keeps while the app runs.
#[derive(Default)]
pub struct Ai {
    /// Opened once, on first use; a library that wasn't there stays so until the app starts again.
    engine: OnceLock<Result<Engine, Unavailable>>,
    /// Held for each call. Inside: the page that loaded the model last (`ai_load`'s `page_id`), `None` once released.
    calls: Mutex<Option<String>>,
    /// The engine reads it through a pointer for the whole of a call: each call holds its own reference.
    stop: Arc<AtomicBool>,
    /// The stops sent so far (`request_stop`): a call reads it as it comes in (`stops_now`), and is stopped if it moved.
    stops: AtomicU64,
    /// Set as the app quits: nothing starts from then on.
    exiting: AtomicBool,
    downloads: Downloads,
}

/// The model download that runs, if any, and its cancel flag. As the engine's stop flag: `ai_download_cancel` counts
/// its cancels, and a download is cancelled if one came since the command came in (`begin`), so a cancel sent right
/// after a start isn't lost to the flag's reset as the download begins, and one meant for an earlier download can't end
/// the next.
#[derive(Default)]
struct Downloads {
    /// The file being downloaded.
    running: Mutex<Option<String>>,
    cancel: AtomicBool,
    cancels: AtomicU64,
}

/// A download's place, freed when it ends.
struct Running<'a>(&'a Downloads);

impl Drop for Running<'_> {
    fn drop(&mut self) {
        *self.0.lock() = None;
    }
}

impl Downloads {
    fn lock(&self) -> MutexGuard<'_, Option<String>> {
        self.running.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// The cancels sent so far: what `ai_download` reads as it comes in.
    fn cancels_now(&self) -> u64 {
        self.cancels.load(Ordering::SeqCst)
    }

    /// Ends the download running, or the one on its way (`ai_download_cancel`). Counted first, flag second.
    fn request_cancel(&self) {
        self.cancels.fetch_add(1, Ordering::SeqCst);
        self.cancel.store(true, Ordering::SeqCst);
    }

    /// The place for downloading `file_name`, for a command that came in when `cancels_now` was `entry`: `busy` while
    /// another download runs (the flag untouched). The flag is cleared, then set again if a cancel was sent since
    /// `entry`: one landing between the two steps is never wiped.
    fn begin(&self, entry: u64, file_name: &str) -> Result<Running<'_>, String> {
        let mut running = self.lock();
        if running.is_some() {
            return Err(BUSY.to_string());
        }
        *running = Some(file_name.to_string());
        self.cancel.store(false, Ordering::SeqCst);
        if self.cancels_now() != entry {
            self.cancel.store(true, Ordering::SeqCst);
        }
        Ok(Running(self))
    }

    /// Whether `file_name`, or its `.part`, is being written.
    fn is_writing(&self, file_name: &str) -> bool {
        self.lock().as_deref().is_some_and(|running| file_name == running || file_name == format!("{running}.part"))
    }
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

    /// The stops sent so far: what a command reads as it comes in, before anything else, for `begin`.
    fn stops_now(&self) -> u64 {
        self.stops.load(Ordering::SeqCst)
    }

    /// Ends the call running, or the one on its way to the engine (`ai_stop`). Counted first, flag second: a `begin`
    /// in between sets the flag itself.
    fn request_stop(&self) {
        self.stops.fetch_add(1, Ordering::SeqCst);
        self.stop.store(true, Ordering::SeqCst);
    }

    /// The right to call the engine, for a call that came in when `stops_now` was `entry`: `busy` at once while another
    /// runs, leaving the flag alone; `exiting` once the app quits. The flag is then set if a stop was sent since `entry`,
    /// cleared otherwise.
    fn begin(&self, entry: u64) -> Result<(MutexGuard<'_, Option<String>>, Arc<AtomicBool>), String> {
        let guard = match self.calls.try_lock() {
            Ok(guard) => guard,
            Err(TryLockError::Poisoned(poisoned)) => poisoned.into_inner(),
            Err(TryLockError::WouldBlock) => return Err(BUSY.to_string()),
        };
        if self.exiting.load(Ordering::SeqCst) {
            return Err(EXITING.to_string());
        }
        // cleared, then set again if a stop was sent since `entry`: a `request_stop` landing between the two steps is
        // never wiped (it moves the count, or sets the flag after the clear). A quit just after the check above stops
        // this call the same way.
        self.stop.store(false, Ordering::SeqCst);
        if self.stops_now() != entry {
            self.stop.store(true, Ordering::SeqCst);
        }
        Ok((guard, Arc::clone(&self.stop)))
    }

    /// The app is quitting (`RunEvent::Exit`, on the main thread): nothing starts from now on, and the model is freed
    /// before the GPU backend's own teardown. A call still running (a load, the session's first included, or a
    /// completion) is stopped, and waited for up to QUIT_WAIT; past that, the engine's exit handler is what's left.
    pub fn release_at_quit(&self) {
        self.exiting.store(true, Ordering::SeqCst);
        let Some(Ok(engine)) = self.engine.get() else {
            return;
        };
        let deadline = Instant::now() + QUIT_WAIT;
        let mut stopped = false;
        let mut loaded_by = loop {
            match self.calls.try_lock() {
                Ok(guard) => break guard,
                Err(TryLockError::Poisoned(poisoned)) => break poisoned.into_inner(),
                Err(TryLockError::WouldBlock) if Instant::now() < deadline => {
                    if !stopped {
                        self.request_stop();
                        stopped = true;
                    }
                    std::thread::sleep(Duration::from_millis(5));
                }
                Err(TryLockError::WouldBlock) => return,
            }
        };
        *loaded_by = None;
        let _ = engine.call(&json!({ "op": "release" }), None, &self.stop);
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

/// Whether `name` can be loaded as a model: a bare file name, never a download's unfinished `.part`.
fn is_model_name(name: &str) -> bool {
    is_bare_file_name(name) && !name.ends_with(".part")
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

/// Loads a model of the models folder (a bare file name, never a `.part`), replacing the one loaded. A model loaded by a page that has
/// since reloaded (development) is released first: the new page never knew about it. A load that fails, whatever the
/// reason (a bad name or path included, where the engine would keep the previous model), leaves no model: the page
/// takes it as not loaded.
#[tauri::command]
pub async fn ai_load(
    app: AppHandle,
    file_name: String,
    n_ctx: u32,
    n_gpu_layers: i32,
    page_id: String,
) -> Result<LoadInfo, String> {
    let entry = app.state::<Ai>().stops_now();
    off_main(app, move |app, ai| {
        let engine = ai.engine(app)?;
        let (mut loaded_by, stop) = ai.begin(entry)?;
        let loaded = (|| {
            if !is_model_name(&file_name) {
                return Err("bad_request: file name".to_string());
            }
            let path = model_path(app, &file_name)?;
            let path = path.to_str().ok_or("load_failed: the models folder's path is not UTF-8")?;
            if loaded_by.as_ref().is_some_and(|id| *id != page_id) {
                engine.call(&json!({ "op": "release" }), None, &stop)?;
            }
            *loaded_by = Some(page_id);
            let request = json!({
                "op": "load",
                "path": path,
                "n_ctx": n_ctx,
                "n_gpu_layers": n_gpu_layers,
                "n_threads": system::inference_threads(),
            });
            let answer = engine.call(&request, None, &stop)?;
            serde_json::from_value::<LoadInfo>(answer).map_err(|err| format!("engine: {err}"))
        })();
        if loaded.is_err() {
            *loaded_by = None;
            let _ = engine.call(&json!({ "op": "release" }), None, &stop);
        }
        loaded
    })
    .await
}

#[tauri::command]
pub async fn ai_tokenize(app: AppHandle, text: String) -> Result<Vec<i32>, String> {
    let entry = app.state::<Ai>().stops_now();
    off_main(app, move |app, ai| {
        let engine = ai.engine(app)?;
        let (_calls, stop) = ai.begin(entry)?;
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
    let entry = app.state::<Ai>().stops_now();
    off_main(app, move |app, ai| {
        let engine = ai.engine(app)?;
        let (_calls, stop) = ai.begin(entry)?;
        // never blocks: the channel hands the text to the webview's event loop
        let mut send = |piece: &str| {
            let _ = on_token.send(piece.to_string());
        };
        engine.call(&request, Some(&mut send), &stop)
    })
    .await
}

/// Ends the running load or completion (a completion returns what it has, `interrupted`), or the one sent just before
/// that hasn't reached the engine yet.
#[tauri::command]
pub async fn ai_stop(app: AppHandle) {
    app.state::<Ai>().request_stop();
}

/// Frees the model.
#[tauri::command]
pub async fn ai_release(app: AppHandle) -> Result<(), String> {
    let entry = app.state::<Ai>().stops_now();
    off_main(app, move |_app, ai| {
        // never opened: nothing loaded
        let Some(Ok(engine)) = ai.engine.get() else {
            return Ok(());
        };
        let (mut loaded_by, stop) = ai.begin(entry)?;
        engine.call(&json!({ "op": "release" }), None, &stop)?;
        *loaded_by = None;
        Ok(())
    })
    .await
}

/// A file of the models folder.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelFileInfo {
    file_name: String,
    /// In bytes.
    size: u64,
}

/// The files of the models folder, the downloads under way or cut (`.part`) included. None if there is no folder yet.
#[tauri::command]
pub async fn ai_model_files(app: AppHandle) -> Result<Vec<ModelFileInfo>, String> {
    off_main(app, |app, _ai| {
        let entries = match std::fs::read_dir(models_dir(app)?) {
            Ok(entries) => entries,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(err) => return Err(format!("failed: {err}")),
        };
        let mut files = Vec::new();
        for entry in entries.flatten() {
            let (Ok(meta), Ok(file_name)) = (entry.metadata(), entry.file_name().into_string()) else {
                continue;
            };
            if meta.is_file() {
                files.push(ModelFileInfo { file_name, size: meta.len() });
            }
        }
        files.sort_by(|a, b| a.file_name.cmp(&b.file_name));
        Ok(files)
    })
    .await
}

/// Downloads a model file into the models folder (see `download.rs`), its progress on `on_progress`. Answers `busy`
/// while another download runs, and `cancelled`, `no_space` or `failed`.
#[tauri::command]
pub async fn ai_download(app: AppHandle, file: DownloadFile, on_progress: Channel<Progress>) -> Result<(), String> {
    let entry = app.state::<Ai>().downloads.cancels_now();
    off_main(app, move |app, ai| {
        if !is_bare_file_name(&file.file_name) {
            return Err("bad_request: file name".to_string());
        }
        if ai.exiting.load(Ordering::SeqCst) {
            return Err(EXITING.to_string());
        }
        let dir = models_dir(app)?;
        let _running = ai.downloads.begin(entry, &file.file_name)?;
        // never blocks: the channel hands the event to the webview's event loop
        download::download(&file, &dir, &ai.downloads.cancel, |received, total| {
            let _ = on_progress.send(Progress { received, total });
        })
        .map_err(|err| err.code().to_string())
    })
    .await
}

/// Ends the download running (its `.part` is deleted), or the one just sent that hasn't begun.
#[tauri::command]
pub async fn ai_download_cancel(app: AppHandle) {
    app.state::<Ai>().downloads.request_cancel();
}

/// Deletes files of the models folder (bare names; one that is already gone is no error). Nothing is deleted if a name
/// is bad, or is the file a download is writing.
#[tauri::command]
pub async fn ai_delete_files(app: AppHandle, file_names: Vec<String>) -> Result<(), String> {
    off_main(app, move |app, ai| {
        let paths = file_names.iter().map(|name| model_path(app, name)).collect::<Result<Vec<_>, _>>()?;
        if file_names.iter().any(|name| ai.downloads.is_writing(name)) {
            return Err(BUSY.to_string());
        }
        for path in paths {
            match std::fs::remove_file(&path) {
                Ok(()) => {}
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
                Err(err) => return Err(format!("failed: {err}")),
            }
        }
        Ok(())
    })
    .await
}

/// Whether `name` can be an evaluation report's file: a bare name that ends in `.json`, with something before it.
fn is_eval_report_name(name: &str) -> bool {
    is_bare_file_name(name) && name.len() > ".json".len() && name.ends_with(".json")
}

/// Saves an evaluation report (the page's JSON) as `ai-eval/<file_name>` in the app's local data folder, and answers the
/// file's full path. The folder is the app's own: the page needs no file-system scope for it.
#[tauri::command]
pub async fn ai_save_eval_report(app: AppHandle, file_name: String, json: String) -> Result<String, String> {
    off_main(app, move |app, _ai| {
        if !is_eval_report_name(&file_name) {
            return Err("bad_request: file name".to_string());
        }
        let dir = app.path().app_local_data_dir().map_err(|err| err.to_string())?.join("ai-eval");
        std::fs::create_dir_all(&dir).map_err(|err| format!("failed: {err}"))?;
        let path = dir.join(&file_name);
        std::fs::write(&path, json).map_err(|err| format!("failed: {err}"))?;
        Ok(path.to_string_lossy().into_owned())
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

    #[test]
    fn a_partial_download_is_never_a_model() {
        assert!(is_model_name("a.gguf"));
        for name in ["a.gguf.part", ".part", "../a.gguf"] {
            assert!(!is_model_name(name), "{name:?} was accepted");
        }
    }

    #[test]
    fn an_evaluation_report_is_a_bare_json_name() {
        assert!(is_eval_report_name("qwen3.5-2b-2026-11-08T10-00-00-000Z.json"));
        for name in [".json", "report", "report.json.part", "report.JSON", "../a.json", "a/b.json", "a\\b.json", "C:a.json", ""] {
            assert!(!is_eval_report_name(name), "{name:?} was accepted");
        }
    }

    #[test]
    fn a_stop_counts_from_the_call_s_entry() {
        let ai = Ai::default();
        // sent between the call's entry and its turn at the engine: the call is stopped
        let entry = ai.stops_now();
        ai.request_stop();
        let (calls, stop) = ai.begin(entry).unwrap();
        assert!(stop.load(Ordering::SeqCst));
        drop(calls);
        // sent before a later call came in: that call runs
        ai.request_stop();
        let (calls, stop) = ai.begin(ai.stops_now()).unwrap();
        assert!(!stop.load(Ordering::SeqCst));
        // sent while it runs: it stops
        ai.request_stop();
        assert!(stop.load(Ordering::SeqCst));
        drop(calls);
    }

    #[test]
    fn busy_leaves_the_stop_flag_alone() {
        let ai = Ai::default();
        let (_running, stop) = ai.begin(ai.stops_now()).unwrap();
        // a busy call that saw a stop since its entry (it would set the flag if it went on) doesn't stop the running one
        let entry = ai.stops_now();
        ai.request_stop();
        ai.stop.store(false, Ordering::SeqCst);
        assert_eq!(ai.begin(entry).err().as_deref(), Some(BUSY));
        assert!(!stop.load(Ordering::SeqCst));
        // the running call stopped: a busy call doesn't clear it
        ai.request_stop();
        assert_eq!(ai.begin(ai.stops_now()).err().as_deref(), Some(BUSY));
        assert!(stop.load(Ordering::SeqCst));
    }

    #[test]
    fn a_cancel_counts_from_the_download_s_entry() {
        let downloads = Downloads::default();
        // sent between the command's entry and the download's start: the download is cancelled
        let entry = downloads.cancels_now();
        downloads.request_cancel();
        let running = downloads.begin(entry, "a.gguf").unwrap();
        assert!(downloads.cancel.load(Ordering::SeqCst));
        // a second download is busy, and leaves the flag alone
        assert_eq!(downloads.begin(downloads.cancels_now(), "b.gguf").err().as_deref(), Some(BUSY));
        assert!(downloads.cancel.load(Ordering::SeqCst));
        assert!(downloads.is_writing("a.gguf") && downloads.is_writing("a.gguf.part") && !downloads.is_writing("b.gguf"));
        drop(running);
        assert!(!downloads.is_writing("a.gguf"));
        // sent before a later command came in: that one runs
        downloads.request_cancel();
        let running = downloads.begin(downloads.cancels_now(), "b.gguf").unwrap();
        assert!(!downloads.cancel.load(Ordering::SeqCst));
        // sent while it runs: it is cancelled
        downloads.request_cancel();
        assert!(downloads.cancel.load(Ordering::SeqCst));
        drop(running);
    }

    #[test]
    fn nothing_starts_while_quitting() {
        let ai = Ai::default();
        ai.release_at_quit();
        assert_eq!(ai.begin(ai.stops_now()).err().as_deref(), Some(EXITING));
    }

    #[test]
    fn the_quit_stops_the_running_call_and_waits_for_it() {
        let Ok(engine) = library::open_first(&library::library_dirs(None)) else {
            eprintln!("skipped: no engine library in ai-engine/dist (node scripts/build-ai-engine.mjs)");
            return;
        };
        let ai = Ai::default();
        let _ = ai.engine.set(Ok(engine));
        let ended = AtomicBool::new(false);
        let (started, running) = std::sync::mpsc::channel();
        std::thread::scope(|scope| {
            scope.spawn(|| {
                // a call that runs until stopped, as a load or a completion would
                let (mut loaded_by, stop) = ai.begin(ai.stops_now()).unwrap();
                *loaded_by = Some("page".to_string());
                started.send(()).unwrap();
                let deadline = Instant::now() + Duration::from_secs(5);
                while !stop.load(Ordering::SeqCst) && Instant::now() < deadline {
                    std::thread::sleep(Duration::from_millis(1));
                }
                std::thread::sleep(Duration::from_millis(50));
                ended.store(true, Ordering::SeqCst);
            });
            running.recv().unwrap();
            ai.release_at_quit();
            // it returned once the call had ended, and released after it
            assert!(ended.load(Ordering::SeqCst));
            assert!(ai.calls.lock().unwrap().is_none());
        });
        assert_eq!(ai.begin(ai.stops_now()).err().as_deref(), Some(EXITING));
    }
}
