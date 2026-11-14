//! The system's own windows the frontend opens (`src/libs/print.web.ts`), and the system's version for a report
//! (`src/libs/diagnostics/facts.web.ts`).

/// Opens the system's print dialog on the main window. The page has laid the note out for print beforehand (a print-only
/// copy in the top document): the dialog prints the window as it is, and its "Save as PDF" writes text, not a picture.
/// One path for the three systems, which each implement `print`; no capability, as it is the app's own command.
#[tauri::command]
pub fn print_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}

/// The system and its version, for a report (spec C.7): "macOS 15.6", "Windows 11, build 26100", "Linux, Ubuntu 24.04.1
/// LTS"; the bare system's name when the version can't be read. Nothing else is read: no host name, no user name.
#[tauri::command]
pub fn system_version() -> String {
    #[cfg(target_os = "macos")]
    {
        match macos_version() {
            Some(version) => format!("macOS {version}"),
            None => "macOS".to_string(),
        }
    }
    #[cfg(windows)]
    {
        let version = windows_version::OsVersion::current();
        if version.major == 0 {
            return "Windows".to_string();
        }
        windows_label(version.major, version.build)
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        linux_label(&std::fs::read_to_string("/etc/os-release").unwrap_or_default())
    }
}

/// `kern.osproductversion` ("15.6"), as `ai/system.rs` reads `hw.memsize`.
#[cfg(target_os = "macos")]
fn macos_version() -> Option<String> {
    let mut buffer = [0u8; 64];
    let mut size = buffer.len();
    // SAFETY: a byte buffer of the size given; the call writes at most `size` bytes and sets `size` to what it wrote.
    let status = unsafe {
        libc::sysctlbyname(
            c"kern.osproductversion".as_ptr(),
            buffer.as_mut_ptr().cast(),
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    if status != 0 || size == 0 || size > buffer.len() {
        return None;
    }
    let text = String::from_utf8_lossy(&buffer[..size]).trim_end_matches('\0').trim().to_string();
    (!text.is_empty()).then_some(text)
}

/// Windows 11 still reports 10.0: its builds start at 22000.
#[cfg_attr(not(windows), allow(dead_code))]
fn windows_label(major: u32, build: u32) -> String {
    let name = if major == 10 && build >= 22000 { 11 } else { major };
    format!("Windows {name}, build {build}")
}

/// `PRETTY_NAME` of `/etc/os-release`, its quotes removed; "Linux" alone without one.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn linux_label(os_release: &str) -> String {
    let pretty = os_release
        .lines()
        .find_map(|line| line.strip_prefix("PRETTY_NAME="))
        .map(|value| value.trim().trim_matches(|c| c == '"' || c == '\'').trim())
        .filter(|value| !value.is_empty());
    match pretty {
        Some(name) => format!("Linux, {name}"),
        None => "Linux".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_10_and_11_by_build() {
        assert_eq!(windows_label(10, 19045), "Windows 10, build 19045");
        assert_eq!(windows_label(10, 26100), "Windows 11, build 26100");
    }

    #[test]
    fn linux_from_pretty_name() {
        assert_eq!(linux_label("NAME=\"Ubuntu\"\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\n"), "Linux, Ubuntu 24.04.1 LTS");
        assert_eq!(linux_label(""), "Linux");
        assert_eq!(linux_label("PRETTY_NAME=Arch Linux\n"), "Linux, Arch Linux");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_reads_its_version() {
        let label = system_version();
        assert!(label.starts_with("macOS 1") || label.starts_with("macOS 2"), "{label}");
    }
}
