use std::path::Path;

fn main() {
    ai_engine_placeholder();
    tauri_build::build()
}

/// tauri-build copies the AI engine library into a dev build (macOS frameworks, Windows and Linux resources), and stops
/// if it isn't there. `scripts/build-ai-engine.mjs` makes it before every `tauri build` and `tauri dev`; for a plain
/// `cargo build` or `cargo test` without it, an empty file takes its place, and the app runs without AI (an empty
/// library is a missing one: `src/ai/library.rs`). A release can't ship it: the script replaces it before cargo runs.
fn ai_engine_placeholder() {
    let file = match std::env::var("CARGO_CFG_TARGET_OS").as_deref() {
        Ok("windows") => "fastmemo_ai.dll",
        Ok("macos") => "libfastmemo_ai.dylib",
        _ => "libfastmemo_ai.so",
    };
    let dist = Path::new("ai-engine/dist");
    let library = dist.join(file);
    // the real library built later: copied again
    println!("cargo:rerun-if-changed={}", library.display());
    let built = std::fs::metadata(&library).is_ok_and(|meta| meta.len() > 0);
    if !built {
        std::fs::create_dir_all(dist).expect("can't create src-tauri/ai-engine/dist");
        // only if there is no file: a library the script is putting there meanwhile is never truncated
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&library) {
            Ok(_) => {}
            Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(err) => panic!("can't write the AI engine library's placeholder: {err}"),
        }
        println!(
            "cargo:warning=AI engine library not built: the AI is unavailable in this build (run node scripts/build-ai-engine.mjs)"
        );
    }
}
