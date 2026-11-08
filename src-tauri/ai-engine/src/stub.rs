//! The library built without llama.cpp (no `llama` feature), for a platform that ships without AI:
//! its ABI version is 0, which the app reads as "no engine", and every operation says so.

use crate::ffi::Io;
use crate::json::Json;

pub const ABI_VERSION: u32 = 0;

pub fn handle(_request: &Json, _io: &mut Io) -> Result<Json, String> {
    Err("no_engine".to_string())
}
