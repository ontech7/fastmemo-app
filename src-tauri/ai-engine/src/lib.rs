//! Fast Memo's on-device AI engine: llama.cpp behind a C ABI, loaded at run time by the app.

#[cfg(feature = "llama")]
pub mod engine;
pub mod ffi;
pub mod json;
pub mod prompt;
pub mod sampling;
pub mod stream;
#[cfg(not(feature = "llama"))]
mod stub;
