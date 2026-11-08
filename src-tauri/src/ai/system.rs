//! What the computer has for the AI: its memory, its cores, and whether its CPU runs the engine.

/// The most threads the engine accepts (`n_threads` in `ai-engine/src/engine.rs`).
const MAX_THREADS: usize = 1024;

/// The installed memory, in bytes.
#[cfg(target_os = "macos")]
pub fn total_memory() -> Option<u64> {
    let mut bytes: u64 = 0;
    let mut size = std::mem::size_of::<u64>();
    // SAFETY: `hw.memsize` is a 64-bit integer, and the buffer is one, of the size given.
    let status = unsafe {
        libc::sysctlbyname(c"hw.memsize".as_ptr(), (&raw mut bytes).cast(), &mut size, std::ptr::null_mut(), 0)
    };
    (status == 0 && size == std::mem::size_of::<u64>() && bytes > 0).then_some(bytes)
}

/// The installed memory, in bytes.
#[cfg(windows)]
pub fn total_memory() -> Option<u64> {
    use windows_sys::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};

    let mut status = MEMORYSTATUSEX { dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
    // SAFETY: a MEMORYSTATUSEX with its dwLength set, as the call requires.
    let ok = unsafe { GlobalMemoryStatusEx(&mut status) };
    (ok != 0 && status.ullTotalPhys > 0).then_some(status.ullTotalPhys)
}

/// The installed memory, in bytes.
#[cfg(target_os = "linux")]
pub fn total_memory() -> Option<u64> {
    parse_meminfo(&std::fs::read_to_string("/proc/meminfo").ok()?)
}

/// The installed memory, in bytes.
#[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
pub fn total_memory() -> Option<u64> {
    None
}

/// `MemTotal` of `/proc/meminfo`, in bytes (the file counts in KiB, written `kB`).
#[cfg(any(target_os = "linux", test))]
fn parse_meminfo(text: &str) -> Option<u64> {
    let mut fields = text.lines().find_map(|line| line.strip_prefix("MemTotal:"))?.split_whitespace();
    let kib: u64 = fields.next()?.parse().ok()?;
    match fields.next() {
        Some("kB") => kib.checked_mul(1024).filter(|&bytes| bytes > 0),
        _ => None,
    }
}

/// The threads llama.cpp gets: half the logical cores, at least one. Writing stays fast and the computer usable meanwhile.
pub fn inference_threads() -> i32 {
    let cores = std::thread::available_parallelism().map_or(1, usize::from);
    // at most MAX_THREADS, so the conversion can't fail
    i32::try_from((cores / 2).clamp(1, MAX_THREADS)).unwrap_or(1)
}

/// Whether the CPU runs the engine: on x86_64 it is built for AVX2, FMA and F16C (`ai-engine/.cargo/config.toml`), and
/// would stop at its first such instruction anywhere else.
pub fn cpu_supported() -> bool {
    #[cfg(target_arch = "x86_64")]
    {
        std::arch::is_x86_feature_detected!("avx2")
            && std::arch::is_x86_feature_detected!("fma")
            && std::arch::is_x86_feature_detected!("f16c")
    }
    #[cfg(not(target_arch = "x86_64"))]
    {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meminfo_parses_mem_total() {
        let text = "MemTotal:       16318444 kB\nMemFree:         1234567 kB\nMemAvailable:    8765432 kB\n";
        assert_eq!(parse_meminfo(text), Some(16318444 * 1024));
    }

    #[test]
    fn threads_are_half() {
        let n = std::thread::available_parallelism().map_or(1, usize::from);
        assert_eq!(inference_threads(), (n / 2).max(1) as i32);
    }
}
