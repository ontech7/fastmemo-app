//! Where the local socket lives and how to reach it: a Unix domain socket in a user-only directory, or a named pipe only the
//! current user can open, whose name each start publishes in a file. No TCP, so web pages can't reach it and there's no port
//! to clash.

use std::io::{Read, Write};

#[cfg(unix)]
use self::unix as platform;
#[cfg(windows)]
use self::windows as platform;

pub use platform::{connect, endpoint_for};
pub(super) use platform::{connect_to, remove, Closer, Listener};

/// What a connection does, whatever the platform's socket is.
pub trait Stream: Read + Write + Send {}
impl<T: Read + Write + Send> Stream for T {}

pub type Connection = Box<dyn Stream>;

#[cfg(any(windows, test))]
const PIPE_PREFIX: &str = r"\\.\pipe\";

/// A name no start has used. A pipe's name stays alive for as long as a client holds a handle to it, even with the app gone, so
/// a fixed name couldn't be created again while an idle bridge is connected.
#[cfg(any(windows, test))]
fn unique_pipe_name(identifier: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static COUNT: AtomicU64 = AtomicU64::new(0);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_nanos());
    // The clock may not have ticked between two calls.
    let nanos = now + u128::from(COUNT.fetch_add(1, Ordering::Relaxed));
    format!(
        "{PIPE_PREFIX}{identifier}-mcp-{}-{nanos}",
        std::process::id()
    )
}

/// What the published file says, if it's a local pipe's name at all.
#[cfg(any(windows, test))]
fn published_pipe_name(contents: &str) -> Option<&str> {
    Some(contents.trim()).filter(|name| name.starts_with(PIPE_PREFIX))
}

#[cfg(unix)]
mod unix {
    use super::Connection;
    use std::fs;
    use std::io;
    use std::net::Shutdown;
    use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
    use std::os::unix::net::{UnixListener, UnixStream};
    use std::path::{Path, PathBuf};
    use std::thread::JoinHandle;

    /// The longest path `sun_path` holds, leaving room for its final NUL.
    #[cfg(target_os = "macos")]
    const MAX_PATH_BYTES: usize = 103;
    #[cfg(not(target_os = "macos"))]
    const MAX_PATH_BYTES: usize = 107;

    /// Under `$HOME`, since the bridge has to find the app's socket and clients pass on few variables: the official SDK's stdio
    /// client gives its child only HOME, LOGNAME, PATH, SHELL, TERM and USER.
    #[cfg(target_os = "macos")]
    const BASE_DIR: &str = "Library/Application Support";
    #[cfg(not(target_os = "macos"))]
    const BASE_DIR: &str = ".local/share";

    pub fn endpoint_for(identifier: &str) -> Result<PathBuf, String> {
        let home = std::env::var_os("HOME")
            .filter(|home| !home.is_empty())
            .ok_or_else(|| "HOME isn't set".to_string())?;
        let path = PathBuf::from(home)
            .join(BASE_DIR)
            .join(identifier)
            .join("mcp")
            .join("sock");
        if path.as_os_str().len() > MAX_PATH_BYTES {
            return Err(format!(
                "The socket path is longer than {MAX_PATH_BYTES} bytes: {}",
                path.display()
            ));
        }
        Ok(path)
    }

    pub fn connect(endpoint: &Path) -> io::Result<Connection> {
        connect_to(endpoint)
    }

    pub fn connect_to(address: &Path) -> io::Result<Connection> {
        Ok(Box::new(UnixStream::connect(address)?))
    }

    pub struct Listener(UnixListener);

    impl Listener {
        /// The directory is user-only before the socket exists in it, and a socket left by a crash goes first. Also returns the
        /// address of this very server, for `connect_to`: here, the socket's path.
        pub fn bind(endpoint: &Path) -> io::Result<(Listener, PathBuf)> {
            let dir = endpoint
                .parent()
                .ok_or_else(|| io::Error::other("The socket path has no directory"))?;
            if let Some(parent) = dir.parent() {
                fs::create_dir_all(parent)?;
            }
            except(
                io::ErrorKind::AlreadyExists,
                fs::DirBuilder::new().mode(0o700).create(dir),
            )?;
            fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
            remove_file(endpoint)?;
            let listener = UnixListener::bind(endpoint)?;
            Ok((Listener(listener), endpoint.to_path_buf()))
        }

        pub fn accept(&mut self) -> io::Result<(Connection, Closer)> {
            let (stream, _) = self.0.accept()?;
            let closer = Closer(stream.try_clone()?);
            Ok((Box::new(stream), closer))
        }
    }

    /// Ends a connection from another thread, its blocked read included.
    pub struct Closer(UnixStream);

    impl Closer {
        pub fn close(&self, _reader: &JoinHandle<()>) {
            let _ = self.0.shutdown(Shutdown::Both);
        }
    }

    /// Takes the socket's name away once nothing listens on it.
    pub fn remove(endpoint: &Path, _address: &Path) {
        let _ = remove_file(endpoint);
    }

    fn remove_file(path: &Path) -> io::Result<()> {
        except(io::ErrorKind::NotFound, fs::remove_file(path))
    }

    fn except(kind: io::ErrorKind, result: io::Result<()>) -> io::Result<()> {
        match result {
            Err(err) if err.kind() == kind => Ok(()),
            other => other,
        }
    }
}

#[cfg(windows)]
mod windows {
    use super::{published_pipe_name, unique_pipe_name, Connection};
    use std::fs::{self, File, OpenOptions};
    use std::io;
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::{AsRawHandle, FromRawHandle};
    use std::path::{Path, PathBuf};
    use std::ptr;
    use std::thread::JoinHandle;
    use std::time::Duration;
    use windows_sys::Win32::Foundation::{LocalFree, ERROR_PIPE_CONNECTED, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Security::Authorization::{
        ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX, SECURITY_IDENTIFICATION,
    };
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
        PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
    };
    use windows_sys::Win32::System::IO::CancelSynchronousIo;

    /// Full access for the pipe's owner, nobody else: the default pipe security is too open.
    const OWNER_ONLY: &str = "D:P(A;;GA;;;OW)";
    const BUFFER_BYTES: u32 = 64 * 1024;
    const CANCEL_TRIES: usize = 20;
    const CANCEL_PAUSE: Duration = Duration::from_millis(5);

    /// Not the pipe but the file that names it, since the name changes with each start.
    pub fn endpoint_for(identifier: &str) -> Result<PathBuf, String> {
        let app_data = std::env::var_os("APPDATA")
            .filter(|dir| !dir.is_empty())
            .ok_or_else(|| "APPDATA isn't set".to_string())?;
        Ok(PathBuf::from(app_data)
            .join(identifier)
            .join("mcp")
            .join("pipe-name"))
    }

    pub fn connect(endpoint: &Path) -> io::Result<Connection> {
        let contents = fs::read_to_string(endpoint)?;
        let name = published_pipe_name(&contents).ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                "The pipe-name file doesn't hold a local pipe's name",
            )
        })?;
        connect_to(Path::new(name))
    }

    pub fn connect_to(address: &Path) -> io::Result<Connection> {
        let pipe = OpenOptions::new()
            .read(true)
            .write(true)
            // Whoever holds the name can see who connected, but can't act as them.
            .security_qos_flags(SECURITY_IDENTIFICATION)
            .open(address)?;
        Ok(Box::new(pipe))
    }

    pub struct Listener {
        name: Vec<u16>,
        /// The instance the next client connects to.
        waiting: File,
    }

    impl Listener {
        /// The pipe exists before its name is published, so whoever reads the name finds it. Also returns the address of this
        /// very server, for `connect_to`: here, the pipe's name.
        pub fn bind(endpoint: &Path) -> io::Result<(Listener, PathBuf)> {
            let identifier = endpoint
                .parent()
                .and_then(Path::parent)
                .and_then(Path::file_name)
                .ok_or_else(|| io::Error::other("The pipe-name path has no identifier"))?
                .to_string_lossy();
            let mut address = unique_pipe_name(&identifier);
            let waiting = match create_instance(&wide(&address), true) {
                Ok(instance) => instance,
                // Someone else holds this name: take another.
                Err(_) => {
                    address = unique_pipe_name(&identifier);
                    create_instance(&wide(&address), true)?
                }
            };
            publish(endpoint, &address)?;
            let listener = Listener {
                name: wide(&address),
                waiting,
            };
            Ok((listener, PathBuf::from(address)))
        }

        pub fn accept(&mut self) -> io::Result<(Connection, Closer)> {
            // SAFETY: `waiting` is an open pipe handle, and it wasn't opened for overlapped I/O, so no OVERLAPPED is needed.
            let connected =
                unsafe { ConnectNamedPipe(self.waiting.as_raw_handle(), ptr::null_mut()) };
            let outcome = if connected != 0 {
                Ok(())
            } else {
                let err = io::Error::last_os_error();
                // A client that got in just before this call is a success.
                if err.raw_os_error() == Some(ERROR_PIPE_CONNECTED as i32) {
                    Ok(())
                } else {
                    Err(err)
                }
            };
            // Either way this instance is spent: a client has it, or it's broken and would fail again.
            let next = create_instance(&self.name, false)?;
            let spent = std::mem::replace(&mut self.waiting, next);
            outcome.map(|()| (Box::new(spent) as Connection, Closer))
        }
    }

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(Some(0)).collect()
    }

    /// A temp file and a rename, so a client never reads half a name.
    fn publish(endpoint: &Path, address: &str) -> io::Result<()> {
        let dir = endpoint
            .parent()
            .ok_or_else(|| io::Error::other("The pipe-name path has no directory"))?;
        fs::create_dir_all(dir)?;
        let temp = endpoint.with_extension("tmp");
        fs::write(&temp, address)?;
        fs::rename(&temp, endpoint).inspect_err(|_| {
            let _ = fs::remove_file(&temp);
        })
    }

    /// `first`: fails if anyone else already holds the name, so nobody can sit in front of the app.
    fn create_instance(name: &[u16], first: bool) -> io::Result<File> {
        let sddl = wide(OWNER_ONLY);
        let mut descriptor = ptr::null_mut();
        // SAFETY: `sddl` ends in a NUL and `descriptor` is a place to write to; the size is optional.
        let converted = unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut descriptor,
                ptr::null_mut(),
            )
        };
        if converted == 0 {
            return Err(io::Error::last_os_error());
        }

        let attributes = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor,
            bInheritHandle: 0,
        };
        let open_mode = if first {
            PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE
        } else {
            PIPE_ACCESS_DUPLEX
        };
        // SAFETY: `name` ends in a NUL; `attributes` and the descriptor it points to outlive the call.
        let handle = unsafe {
            CreateNamedPipeW(
                name.as_ptr(),
                open_mode,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                PIPE_UNLIMITED_INSTANCES,
                BUFFER_BYTES,
                BUFFER_BYTES,
                0,
                &attributes,
            )
        };
        let created = if handle == INVALID_HANDLE_VALUE {
            Err(io::Error::last_os_error())
        } else {
            Ok(handle)
        };
        // SAFETY: the conversion above allocated `descriptor` for LocalFree, and the pipe keeps its own copy.
        unsafe { LocalFree(descriptor) };
        // SAFETY: the handle is valid and nothing else owns it; the File closes it.
        created.map(|handle| unsafe { File::from_raw_handle(handle) })
    }

    /// Ends a connection from another thread. Only cancelling reaches a synchronous read on a pipe: a call that touches the
    /// same handle would wait behind that read.
    pub struct Closer;

    impl Closer {
        pub fn close(&self, reader: &JoinHandle<()>) {
            // A thread just about to read misses one cancel, so try for a moment.
            for _ in 0..CANCEL_TRIES {
                if reader.is_finished() {
                    return;
                }
                // SAFETY: the JoinHandle keeps the thread's handle open during the call.
                unsafe { CancelSynchronousIo(reader.as_raw_handle()) };
                std::thread::sleep(CANCEL_PAUSE);
            }
        }
    }

    /// Takes the file away if it still names this server, not a newer one. The pipe's name goes with its last handle.
    pub fn remove(endpoint: &Path, address: &Path) {
        let names_this_server = fs::read_to_string(endpoint).is_ok_and(|contents| {
            published_pipe_name(&contents).is_some_and(|name| Path::new(name) == address)
        });
        if names_this_server {
            let _ = fs::remove_file(endpoint);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn path_comes_from_the_identifier() {
        let real = endpoint_for("com.ontech7.fastmemo").unwrap();
        let test = endpoint_for("com.ontech7.fastmemo.test").unwrap();
        assert_ne!(real, test);

        #[cfg(target_os = "macos")]
        let expected = PathBuf::from(std::env::var("HOME").unwrap())
            .join("Library/Application Support/com.ontech7.fastmemo/mcp/sock");
        #[cfg(not(any(target_os = "macos", windows)))]
        let expected = PathBuf::from(std::env::var("HOME").unwrap())
            .join(".local/share/com.ontech7.fastmemo/mcp/sock");
        #[cfg(windows)]
        let expected = PathBuf::from(std::env::var("APPDATA").unwrap())
            .join(r"com.ontech7.fastmemo\mcp\pipe-name");
        assert_eq!(real, expected);
    }

    #[cfg(unix)]
    #[test]
    fn a_path_too_long_is_an_error() {
        let error = endpoint_for(&"x".repeat(200)).unwrap_err();
        assert!(error.contains("bytes"), "{error}");
    }

    #[test]
    fn a_pipe_name_is_new_every_time_and_carries_the_identifier() {
        let first = unique_pipe_name("com.ontech7.fastmemo.test");
        let second = unique_pipe_name("com.ontech7.fastmemo.test");
        assert_ne!(first, second);
        for name in [first, second] {
            let start = format!(
                r"\\.\pipe\com.ontech7.fastmemo.test-mcp-{}-",
                std::process::id()
            );
            assert!(name.starts_with(&start), "{name}");
        }
    }

    #[test]
    fn only_a_local_pipe_counts_as_a_published_name() {
        assert_eq!(
            published_pipe_name("\u{20}\\\\.\\pipe\\fastmemo-mcp-1-2\r\n"),
            Some(r"\\.\pipe\fastmemo-mcp-1-2")
        );
        assert_eq!(published_pipe_name(r"C:\Windows\notepad.exe"), None);
        assert_eq!(published_pipe_name(r"\\server\pipe\fastmemo"), None);
        assert_eq!(published_pipe_name(""), None);
    }
}
