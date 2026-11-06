//! Where the local socket lives and how to reach it: a Unix domain socket in a user-only directory, or a named pipe only the
//! current user can open. No TCP, so web pages can't reach it and there's no port to clash.

use std::io::{Read, Write};

#[cfg(unix)]
use self::unix as platform;
#[cfg(windows)]
use self::windows as platform;

pub use platform::{connect, endpoint_for};
pub(super) use platform::{remove, Closer, Listener};

/// What a connection does, whatever the platform's socket is.
pub trait Stream: Read + Write + Send {}
impl<T: Read + Write + Send> Stream for T {}

pub type Connection = Box<dyn Stream>;

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

    pub fn endpoint_for(identifier: &str) -> Result<PathBuf, String> {
        let path = base_dir()?.join(identifier).join("mcp").join("sock");
        if path.as_os_str().len() > MAX_PATH_BYTES {
            return Err(format!(
                "The socket path is longer than {MAX_PATH_BYTES} bytes: {}",
                path.display()
            ));
        }
        Ok(path)
    }

    #[cfg(target_os = "macos")]
    fn base_dir() -> Result<PathBuf, String> {
        Ok(home()?.join("Library/Application Support"))
    }

    #[cfg(not(target_os = "macos"))]
    fn base_dir() -> Result<PathBuf, String> {
        match std::env::var_os("XDG_RUNTIME_DIR") {
            Some(dir) if !dir.is_empty() => Ok(PathBuf::from(dir)),
            _ => Ok(home()?.join(".local/share")),
        }
    }

    fn home() -> Result<PathBuf, String> {
        std::env::var_os("HOME")
            .filter(|home| !home.is_empty())
            .map(PathBuf::from)
            .ok_or_else(|| "HOME isn't set".to_string())
    }

    pub fn connect(endpoint: &Path) -> io::Result<Connection> {
        Ok(Box::new(UnixStream::connect(endpoint)?))
    }

    pub struct Listener(UnixListener);

    impl Listener {
        /// The directory is user-only before the socket exists in it, and a socket left by a crash goes first.
        pub fn bind(endpoint: &Path) -> io::Result<Listener> {
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
            UnixListener::bind(endpoint).map(Listener)
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
    pub fn remove(endpoint: &Path) {
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
    use super::Connection;
    use std::fs::{File, OpenOptions};
    use std::io;
    use std::os::windows::ffi::OsStrExt;
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

    pub fn endpoint_for(identifier: &str) -> Result<PathBuf, String> {
        let user = std::env::var("USERNAME").map_err(|_| "USERNAME isn't set".to_string())?;
        Ok(PathBuf::from(format!(r"\\.\pipe\{identifier}-mcp-{user}")))
    }

    pub fn connect(endpoint: &Path) -> io::Result<Connection> {
        let pipe = OpenOptions::new()
            .read(true)
            .write(true)
            // Whoever holds the name can see who connected, but can't act as them.
            .security_qos_flags(SECURITY_IDENTIFICATION)
            .open(endpoint)?;
        Ok(Box::new(pipe))
    }

    pub struct Listener {
        name: Vec<u16>,
        /// The instance the next client connects to.
        waiting: File,
    }

    impl Listener {
        pub fn bind(endpoint: &Path) -> io::Result<Listener> {
            let name: Vec<u16> = endpoint.as_os_str().encode_wide().chain(Some(0)).collect();
            let waiting = create_instance(&name, true)?;
            Ok(Listener { name, waiting })
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

    /// `first`: fails if anyone else already holds the name, so nobody can sit in front of the app.
    fn create_instance(name: &[u16], first: bool) -> io::Result<File> {
        let sddl: Vec<u16> = OWNER_ONLY.encode_utf16().chain(Some(0)).collect();
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

    /// A pipe's name goes with its last handle.
    pub fn remove(_endpoint: &Path) {}
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(target_os = "macos")]
    use std::path::PathBuf;

    #[test]
    fn path_comes_from_the_identifier() {
        let real = endpoint_for("com.ontech7.fastmemo").unwrap();
        let test = endpoint_for("com.ontech7.fastmemo.test").unwrap();
        assert_ne!(real, test);

        #[cfg(target_os = "macos")]
        assert_eq!(
            real,
            PathBuf::from(std::env::var("HOME").unwrap())
                .join("Library/Application Support/com.ontech7.fastmemo/mcp/sock")
        );
        #[cfg(windows)]
        assert!(real
            .to_string_lossy()
            .starts_with(r"\\.\pipe\com.ontech7.fastmemo-mcp-"));
    }

    #[cfg(unix)]
    #[test]
    fn a_path_too_long_is_an_error() {
        let error = endpoint_for(&"x".repeat(200)).unwrap_err();
        assert!(error.contains("bytes"), "{error}");
    }
}
