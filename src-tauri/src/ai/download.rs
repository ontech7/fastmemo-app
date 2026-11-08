//! The model download: Hugging Face only, to `<file>.part`, resumed with a `Range` request, then the size and the
//! SHA-256 checked before the file takes its name.
//!
//! Blocking for its caller (`download` runs on the blocking pool), with the transfer itself async on Tauri's runtime:
//! reqwest has no blocking client here. A cancel is looked at before the request, between chunks and every
//! `CANCEL_POLL` while one is awaited, so a stalled connection doesn't hold it.

use std::fs::{self, File, OpenOptions};
use std::future::Future;
use std::io::{self, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use reqwest::header::{ACCEPT_ENCODING, CONTENT_RANGE, RANGE};
use reqwest::redirect::Policy;
use reqwest::{Client, Url};
use ring::digest::{Context, SHA256};
use serde::{Deserialize, Serialize};

use super::{is_bare_file_name, log};
use crate::net;

const HOST: &str = "https://huggingface.co/";
/// The least time between two progress events (the first and the last are always sent).
const PROGRESS_EVERY: Duration = Duration::from_millis(250);
/// How often a cancel is looked for while a request or a chunk is awaited.
const CANCEL_POLL: Duration = Duration::from_millis(250);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// Silence on a connection that long fails the download (the `.part` is kept, a new attempt resumes it).
const READ_TIMEOUT: Duration = Duration::from_secs(60);
/// Hugging Face answers a 302 to its CDN.
const MAX_REDIRECTS: usize = 10;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadFile {
    /// A bare file name, in the models folder.
    pub file_name: String,
    pub url: String,
    /// In bytes.
    pub size: u64,
    /// Hex.
    pub sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub received: u64,
    pub total: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub enum DownloadError {
    Cancelled,
    NoSpace,
    Failed,
}

impl DownloadError {
    /// What the page reads.
    pub fn code(&self) -> &'static str {
        match self {
            Self::Cancelled => "cancelled",
            Self::NoSpace => "no_space",
            Self::Failed => "failed",
        }
    }
}

/// How a transfer ended, when it did not: a corrupt one has its `.part` deleted, as a cancel does; the others keep it.
enum Ending {
    Error(DownloadError),
    Corrupt,
}

impl From<DownloadError> for Ending {
    fn from(err: DownloadError) -> Self {
        Self::Error(err)
    }
}

/// Only Hugging Face (the models' URLs are pinned there); a local test server in the tests.
fn allowed(url: &str) -> bool {
    url.starts_with(HOST) || (cfg!(test) && url.starts_with("http://127.0.0.1:"))
}

fn failed(why: impl std::fmt::Display) -> DownloadError {
    log(format_args!("the model download failed: {why}"));
    DownloadError::Failed
}

/// Whether the disk (or the user's quota) is full: the portable kind, and the raw codes of each system, where the kind
/// may not have been mapped.
fn io_error(err: io::Error) -> DownloadError {
    #[cfg(unix)]
    let raw_full = matches!(err.raw_os_error(), Some(code) if code == libc::ENOSPC || code == libc::EDQUOT);
    // ERROR_DISK_FULL, ERROR_HANDLE_DISK_FULL
    #[cfg(windows)]
    let raw_full = matches!(err.raw_os_error(), Some(112 | 39));
    #[cfg(not(any(unix, windows)))]
    let raw_full = false;
    if err.kind() == io::ErrorKind::StorageFull || raw_full {
        DownloadError::NoSpace
    } else {
        failed(err)
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// `progress` is called at most every 250 ms, with the bytes there are (those of a resumed `.part` included) and the
/// total: once as the download starts, once at its end.
pub fn download(
    file: &DownloadFile,
    dir: &Path,
    cancel: &AtomicBool,
    progress: impl FnMut(u64, u64),
) -> Result<(), DownloadError> {
    if !allowed(&file.url) {
        return Err(failed("an address that is not Hugging Face's"));
    }
    if !is_bare_file_name(&file.file_name) {
        return Err(failed("a file name that is not bare"));
    }
    let expected = file.sha256.to_ascii_lowercase();
    if expected.len() != 64 || !expected.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(failed("a SHA-256 that is not 64 hex digits"));
    }
    let url = Url::parse(&file.url).map_err(failed)?;
    fs::create_dir_all(dir).map_err(io_error)?;
    let target = dir.join(&file.file_name);
    let part = dir.join(format!("{}.part", file.file_name));
    let mut meter = Meter { progress, total: file.size, last: None };

    let transfer = tauri::async_runtime::block_on(transfer(&url, file, &expected, &part, cancel, &mut meter));
    match transfer {
        Ok(()) => {}
        Err(Ending::Error(DownloadError::Cancelled)) => {
            let _ = fs::remove_file(&part);
            return Err(DownloadError::Cancelled);
        }
        Err(Ending::Error(err)) => return Err(err),
        Err(Ending::Corrupt) => {
            let _ = fs::remove_file(&part);
            return Err(DownloadError::Failed);
        }
    }
    // the file is closed: renamed over a model of the same name, if there is one
    fs::rename(&part, &target).map_err(io_error)?;
    meter.send(file.size);
    Ok(())
}

struct Meter<F> {
    progress: F,
    total: u64,
    last: Option<Instant>,
}

impl<F: FnMut(u64, u64)> Meter<F> {
    /// Sent now.
    fn send(&mut self, received: u64) {
        self.last = Some(Instant::now());
        (self.progress)(received, self.total);
    }

    /// Sent unless one went less than PROGRESS_EVERY ago.
    fn tick(&mut self, received: u64) {
        if self.last.is_none_or(|last| last.elapsed() >= PROGRESS_EVERY) {
            self.send(received);
        }
    }
}

/// `future`'s output, or `None` once `cancel` is set (the future is dropped).
async fn unless_cancelled<T>(cancel: &AtomicBool, future: impl Future<Output = T>) -> Option<T> {
    let mut future = Box::pin(future);
    loop {
        if cancel.load(Ordering::SeqCst) {
            return None;
        }
        if let Ok(output) = tokio::time::timeout(CANCEL_POLL, &mut future).await {
            return Some(output);
        }
    }
}

fn client(url: &Url) -> Result<Client, DownloadError> {
    // reqwest's rustls needs a crypto provider: ring, the one the rest of the app uses.
    let _ = rustls::crypto::ring::default_provider().install_default();
    let builder = Client::builder()
        .user_agent(net::USER_AGENT)
        // no total timeout: a model takes as long as the connection needs
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(READ_TIMEOUT)
        .no_gzip()
        // to the CDN, over https only
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= MAX_REDIRECTS {
                attempt.error("too many redirects")
            } else if attempt.url().scheme() == "https" {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }));
    // through the system proxy, as the rest of the app, unless the server is on this machine or its network
    let builder = if net::is_local(url) { builder.no_proxy() } else { builder };
    builder.build().map_err(failed)
}

/// Feeds the bytes the `.part` already holds to `hasher`.
fn hash_part(part: &Path, hasher: &mut Context, cancel: &AtomicBool) -> Result<(), Ending> {
    let mut file = File::open(part).map_err(io_error)?;
    let mut buffer = vec![0u8; 1 << 20];
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err(DownloadError::Cancelled.into());
        }
        match file.read(&mut buffer).map_err(io_error)? {
            0 => return Ok(()),
            read => hasher.update(&buffer[..read]),
        }
    }
}

/// Everything between the first progress and the file complete and verified in `part`: it ends with `part` closed.
async fn transfer<F: FnMut(u64, u64)>(
    url: &Url,
    file: &DownloadFile,
    expected: &str,
    part: &Path,
    cancel: &AtomicBool,
    meter: &mut Meter<F>,
) -> Result<(), Ending> {
    let total = file.size;
    let mut have = fs::metadata(part).map_or(0, |meta| if meta.is_file() { meta.len() } else { 0 });
    if have > total {
        // not a part of this file
        let _ = fs::remove_file(part);
        have = 0;
    }
    meter.send(have);

    let mut hasher = Context::new(&SHA256);
    let mut received = have;
    if have < total {
        let client = client(url)?;
        let mut request = client.get(url.clone()).header(ACCEPT_ENCODING, "identity");
        if have > 0 {
            request = request.header(RANGE, format!("bytes={have}-"));
        }
        let mut response = unless_cancelled(cancel, request.send())
            .await
            .ok_or(DownloadError::Cancelled)?
            .map_err(|err| failed(net_error(err)))?;
        let mut out = match (response.status().as_u16(), have) {
            (206, 1..) => {
                let starts_right = response
                    .headers()
                    .get(CONTENT_RANGE)
                    .and_then(|value| value.to_str().ok())
                    .is_some_and(|value| value.starts_with(&format!("bytes {have}-")));
                if !starts_right || response.content_length().is_some_and(|len| len != total - have) {
                    return Err(failed("a range that is not the one asked for").into());
                }
                hash_part(part, &mut hasher, cancel)?;
                OpenOptions::new().append(true).open(part).map_err(io_error)?
            }
            (200, _) => {
                if response.content_length().is_some_and(|len| len != total) {
                    return Err(failed("a file that is not the size expected").into());
                }
                // the server doesn't resume (or there was nothing to resume): from the start
                received = 0;
                File::create(part).map_err(io_error)?
            }
            (416, _) => {
                // the part doesn't fit the file
                let _ = fs::remove_file(part);
                return Err(failed("a range that can't be satisfied").into());
            }
            (status, _) => return Err(failed(format!("the answer {status}")).into()),
        };
        loop {
            let chunk = match unless_cancelled(cancel, response.chunk()).await {
                None => return Err(DownloadError::Cancelled.into()),
                Some(Err(err)) => return Err(failed(net_error(err)).into()),
                Some(Ok(None)) => break,
                Some(Ok(Some(chunk))) => chunk,
            };
            received += chunk.len() as u64;
            if received > total {
                return Err(Ending::Corrupt);
            }
            hasher.update(&chunk);
            out.write_all(&chunk).map_err(io_error)?;
            meter.tick(received);
        }
        out.sync_all().map_err(io_error)?;
    } else {
        // a download that ended before its rename
        hash_part(part, &mut hasher, cancel)?;
    }
    if received != total {
        // the server ended it early: kept, to resume
        return Err(failed(format!("{received} bytes of {total}")).into());
    }
    if hex(hasher.finish().as_ref()) != expected {
        log(format_args!("the model download's SHA-256 is not the expected one"));
        return Err(Ending::Corrupt);
    }
    Ok(())
}

/// A request's error with its causes, without the address.
fn net_error(err: reqwest::Error) -> String {
    use std::error::Error;
    let err = err.without_url();
    let mut text = err.to_string();
    let mut source = err.source();
    while let Some(cause) = source {
        text.push_str(": ");
        text.push_str(&cause.to_string());
        source = cause.source();
    }
    text
}

#[cfg(test)]
mod tests {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::path::PathBuf;
    use std::sync::atomic::Ordering;
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};

    use super::*;

    #[derive(Clone, Copy)]
    enum Mode {
        /// Honours `Range`.
        Normal,
        /// Answers 200 with the whole body, whatever the range.
        IgnoreRange,
        /// Sends this many bytes of the body it declared, then closes.
        CutAt(usize),
        /// Sends this many bytes, then holds the connection open and silent.
        StallAt(usize),
    }

    struct Server {
        url: String,
        ranges: Arc<Mutex<Vec<Option<String>>>>,
    }

    fn body(len: usize) -> Vec<u8> {
        (0..len).map(|i| (i * 31 % 251) as u8).collect()
    }

    fn hash(bytes: &[u8]) -> String {
        ring::digest::digest(&ring::digest::SHA256, bytes).as_ref().iter().map(|b| format!("{b:02x}")).collect()
    }

    fn request_range(stream: &mut TcpStream) -> Option<Option<String>> {
        let mut head = Vec::new();
        let mut byte = [0u8; 1];
        while !head.ends_with(b"\r\n\r\n") {
            stream.read_exact(&mut byte).ok()?;
            head.push(byte[0]);
        }
        let head = String::from_utf8_lossy(&head).to_string();
        Some(head.lines().find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("range").then(|| value.trim().to_string())
        }))
    }

    fn serve(content: Vec<u8>, mode: Mode) -> Server {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://127.0.0.1:{}/model.gguf", listener.local_addr().unwrap().port());
        let ranges = Arc::new(Mutex::new(Vec::new()));
        let seen = Arc::clone(&ranges);
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                let (content, seen) = (content.clone(), Arc::clone(&seen));
                std::thread::spawn(move || {
                    let Some(range) = request_range(&mut stream) else { return };
                    seen.lock().unwrap().push(range.clone());
                    let start = match (mode, &range) {
                        (Mode::IgnoreRange, _) | (_, None) => None,
                        (_, Some(range)) => {
                            range.strip_prefix("bytes=").and_then(|r| r.strip_suffix('-')).and_then(|r| r.parse().ok())
                        }
                    };
                    let from = start.unwrap_or(0);
                    let mut head = match start {
                        Some(from) => format!(
                            "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes {from}-{}/{}\r\n",
                            content.len() - 1,
                            content.len()
                        ),
                        None => "HTTP/1.1 200 OK\r\n".to_string(),
                    };
                    head.push_str(&format!("Content-Length: {}\r\nConnection: close\r\n\r\n", content.len() - from));
                    let _ = stream.write_all(head.as_bytes());
                    let rest = &content[from..];
                    match mode {
                        Mode::CutAt(n) => {
                            let _ = stream.write_all(&rest[..n.min(rest.len())]);
                        }
                        Mode::StallAt(n) => {
                            let _ = stream.write_all(&rest[..n.min(rest.len())]);
                            let _ = stream.flush();
                            std::thread::sleep(Duration::from_secs(20));
                        }
                        _ => {
                            let _ = stream.write_all(rest);
                        }
                    }
                });
            }
        });
        Server { url, ranges }
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fastmemo-download-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn file(url: &str, content: &[u8]) -> DownloadFile {
        DownloadFile { file_name: "model.gguf".into(), url: url.into(), size: content.len() as u64, sha256: hash(content) }
    }

    #[test]
    fn downloads_and_verifies() {
        let content = body(64 * 1024);
        let server = serve(content.clone(), Mode::Normal);
        let dir = scratch("ok");
        let mut last = (0, 0);
        let cancel = AtomicBool::new(false);
        download(&file(&server.url, &content), &dir, &cancel, |received, total| last = (received, total)).unwrap();
        assert_eq!(std::fs::read(dir.join("model.gguf")).unwrap(), content);
        assert!(!dir.join("model.gguf.part").exists());
        assert_eq!(last, (content.len() as u64, content.len() as u64));
        assert_eq!(server.ranges.lock().unwrap().as_slice(), &[None]);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn creates_the_folder() {
        let content = body(1024);
        let server = serve(content.clone(), Mode::Normal);
        let dir = scratch("mkdir").join("models");
        let cancel = AtomicBool::new(false);
        download(&file(&server.url, &content), &dir, &cancel, |_, _| {}).unwrap();
        assert!(dir.join("model.gguf").exists());
        let _ = std::fs::remove_dir_all(dir.parent().unwrap());
    }

    #[test]
    fn wrong_hash_is_deleted() {
        let content = body(64 * 1024);
        let server = serve(content.clone(), Mode::Normal);
        let dir = scratch("hash");
        let mut wrong = file(&server.url, &content);
        wrong.sha256 = hash(b"something else");
        let cancel = AtomicBool::new(false);
        assert_eq!(download(&wrong, &dir, &cancel, |_, _| {}), Err(DownloadError::Failed));
        assert!(!dir.join("model.gguf").exists());
        assert!(!dir.join("model.gguf.part").exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn wrong_size_is_failed() {
        let content = body(8 * 1024);
        let server = serve(content.clone(), Mode::Normal);
        let dir = scratch("size");
        let mut wrong = file(&server.url, &content);
        wrong.size += 1;
        let cancel = AtomicBool::new(false);
        assert_eq!(download(&wrong, &dir, &cancel, |_, _| {}), Err(DownloadError::Failed));
        assert!(!dir.join("model.gguf").exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn resumes_with_range() {
        let content = body(64 * 1024);
        let server = serve(content.clone(), Mode::Normal);
        let dir = scratch("resume");
        std::fs::write(dir.join("model.gguf.part"), &content[..20480]).unwrap();
        let cancel = AtomicBool::new(false);
        let mut first = None;
        download(&file(&server.url, &content), &dir, &cancel, |received, _| {
            first.get_or_insert(received);
        })
        .unwrap();
        assert_eq!(server.ranges.lock().unwrap().as_slice(), &[Some("bytes=20480-".to_string())]);
        assert_eq!(first, Some(20480));
        assert_eq!(std::fs::read(dir.join("model.gguf")).unwrap(), content);
        assert!(!dir.join("model.gguf.part").exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn ignored_range_restarts() {
        let content = body(64 * 1024);
        let server = serve(content.clone(), Mode::IgnoreRange);
        let dir = scratch("ignored");
        std::fs::write(dir.join("model.gguf.part"), &content[..20480]).unwrap();
        let cancel = AtomicBool::new(false);
        download(&file(&server.url, &content), &dir, &cancel, |_, _| {}).unwrap();
        assert_eq!(server.ranges.lock().unwrap().as_slice(), &[Some("bytes=20480-".to_string())]);
        assert_eq!(std::fs::read(dir.join("model.gguf")).unwrap(), content);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_complete_part_needs_no_request() {
        let content = body(4096);
        let server = serve(content.clone(), Mode::Normal);
        let dir = scratch("complete");
        std::fs::write(dir.join("model.gguf.part"), &content).unwrap();
        let cancel = AtomicBool::new(false);
        download(&file(&server.url, &content), &dir, &cancel, |_, _| {}).unwrap();
        assert!(server.ranges.lock().unwrap().is_empty());
        assert_eq!(std::fs::read(dir.join("model.gguf")).unwrap(), content);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_part_longer_than_the_file_starts_over() {
        let content = body(4096);
        let server = serve(content.clone(), Mode::Normal);
        let dir = scratch("longer");
        std::fs::write(dir.join("model.gguf.part"), body(9000)).unwrap();
        let cancel = AtomicBool::new(false);
        download(&file(&server.url, &content), &dir, &cancel, |_, _| {}).unwrap();
        assert_eq!(server.ranges.lock().unwrap().as_slice(), &[None]);
        assert_eq!(std::fs::read(dir.join("model.gguf")).unwrap(), content);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn cancel_deletes_part() {
        let content = body(64 * 1024);
        let server = serve(content.clone(), Mode::Normal);
        let dir = scratch("cancel");
        std::fs::write(dir.join("model.gguf.part"), &content[..1024]).unwrap();
        let cancel = AtomicBool::new(false);
        // at the first progress
        let result = download(&file(&server.url, &content), &dir, &cancel, |_, _| cancel.store(true, Ordering::SeqCst));
        assert_eq!(result, Err(DownloadError::Cancelled));
        assert!(!dir.join("model.gguf.part").exists());
        assert!(!dir.join("model.gguf").exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn cancel_ends_a_stalled_download() {
        let content = body(64 * 1024);
        let server = serve(content.clone(), Mode::StallAt(10_000));
        let dir = scratch("stalled");
        let cancel = AtomicBool::new(false);
        let started = Instant::now();
        let result = std::thread::scope(|scope| {
            scope.spawn(|| {
                // once some bytes are on the disk
                let deadline = Instant::now() + Duration::from_secs(10);
                while Instant::now() < deadline
                    && std::fs::metadata(dir.join("model.gguf.part")).map_or(0, |meta| meta.len()) < 10_000
                {
                    std::thread::sleep(Duration::from_millis(10));
                }
                cancel.store(true, Ordering::SeqCst);
            });
            download(&file(&server.url, &content), &dir, &cancel, |_, _| {})
        });
        assert_eq!(result, Err(DownloadError::Cancelled));
        assert!(started.elapsed() < Duration::from_secs(8), "the cancel waited for the connection");
        assert!(!dir.join("model.gguf.part").exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn cut_connection_keeps_part() {
        let content = body(64 * 1024);
        let server = serve(content.clone(), Mode::CutAt(30_000));
        let dir = scratch("cut");
        let cancel = AtomicBool::new(false);
        assert_eq!(download(&file(&server.url, &content), &dir, &cancel, |_, _| {}), Err(DownloadError::Failed));
        assert_eq!(std::fs::read(dir.join("model.gguf.part")).unwrap(), content[..30_000]);
        assert!(!dir.join("model.gguf").exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn only_huggingface() {
        let dir = scratch("host");
        let cancel = AtomicBool::new(false);
        let mut calls = 0;
        for url in [
            "https://example.com/x.gguf",
            "http://huggingface.co/x.gguf",
            "https://huggingface.co.example.com/x.gguf",
            "https://huggingface.co@example.com/x.gguf",
            "file:///etc/passwd",
        ] {
            let file = DownloadFile { file_name: "x.gguf".into(), url: url.into(), size: 1, sha256: hash(b"x") };
            assert_eq!(download(&file, &dir, &cancel, |_, _| calls += 1), Err(DownloadError::Failed), "{url}");
        }
        assert_eq!(calls, 0);
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 0);
        assert!(allowed("https://huggingface.co/unsloth/x/resolve/main/x.gguf"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_full_disk_is_no_space() {
        assert_eq!(io_error(std::io::ErrorKind::StorageFull.into()), DownloadError::NoSpace);
        #[cfg(unix)]
        assert_eq!(io_error(std::io::Error::from_raw_os_error(libc::ENOSPC)), DownloadError::NoSpace);
        #[cfg(windows)]
        for code in [112, 39] {
            assert_eq!(io_error(std::io::Error::from_raw_os_error(code)), DownloadError::NoSpace);
        }
        assert_eq!(io_error(std::io::ErrorKind::PermissionDenied.into()), DownloadError::Failed);
    }
}
