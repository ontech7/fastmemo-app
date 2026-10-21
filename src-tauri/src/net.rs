//! The FastMemo server and webhooks, called from Rust (`src/libs/net.web.ts`). The webview's fetch can't do it
//! everywhere: Windows serves the page over https and blocks a plain http:// address as mixed content, and a server or a
//! webhook that doesn't answer CORS is refused.
//!
//! Clients built on first use and kept, so connections are reused: a pair for the server, a pair for webhooks (each pair:
//! one through the system proxy, one direct for local addresses). Certificates are checked by rustls-platform-verifier:
//! the OS's own verifier on macOS and Windows, the system's CA certificates on Linux. The server's requests don't follow
//! redirects: on the way to another host a redirect drops the device's token, and the server's refusal would read as
//! "this device was removed". Webhooks follow a few, as the browser did.
//!
//! The page may call only the server's API (`/v1/` paths, a guard against mistakes: any page code can still reach any host
//! with such a path) and POST to webhooks, whose answer it never sees.

use std::collections::HashMap;
use std::error::Error;
use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use reqwest::redirect::Policy;
use reqwest::{Client, Method, RequestBuilder, Url};
use tauri::async_runtime::JoinHandle;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::State;

const USER_AGENT: &str = concat!("FastMemo-desktop/", env!("CARGO_PKG_VERSION"));
/// The longest any request may take; the page's own timeouts cancel sooner.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const WEBHOOK_TIMEOUT: Duration = Duration::from_secs(5);
/// Under the idle timeout of the usual proxies and NATs (60 s), which drop a connection without a word.
const POOL_IDLE_TIMEOUT: Duration = Duration::from_secs(55);
const WEBHOOK_REDIRECTS: usize = 5;
/// The least time between two builds of the same clients after a connection failed.
const REBUILD_AFTER: Duration = Duration::from_secs(30);
/// How long a cancel waits for its request.
const CANCEL_KEPT: Duration = Duration::from_secs(60);
/// The request headers the page may set, each sent as an `x-fm-h-<name>` invoke header.
const FORWARDED_HEADERS: [&str; 4] = ["accept", "authorization", "content-type", "x-access-key"];
const CANCELLED: &str = "cancelled";

struct Built {
    /// Through the system proxy, for the internet.
    proxied: Client,
    /// Direct, for this machine and the local network: a system proxy has no business there (and on macOS reqwest doesn't
    /// read the proxy's bypass list).
    direct: Client,
    at: Instant,
}

/// The system proxy is read when a client is built: after a connection failed (another network, a proxy turned on or
/// off), the clients are built again. A build that failed isn't kept: the next request tries again.
struct Clients {
    follow_redirects: bool,
    built: Mutex<Option<Built>>,
    failed: AtomicBool,
}

impl Clients {
    const fn new(follow_redirects: bool) -> Self {
        Self { follow_redirects, built: Mutex::new(None), failed: AtomicBool::new(false) }
    }

    fn build(&self) -> Result<Built, String> {
        // reqwest's rustls needs a crypto provider: ring, the one the updater uses.
        let _ = rustls::crypto::ring::default_provider().install_default();
        let builder = || {
            Client::builder()
                .user_agent(USER_AGENT)
                .redirect(if self.follow_redirects { Policy::limited(WEBHOOK_REDIRECTS) } else { Policy::none() })
                .connect_timeout(CONNECT_TIMEOUT)
                .timeout(REQUEST_TIMEOUT)
                .pool_idle_timeout(POOL_IDLE_TIMEOUT)
        };
        Ok(Built {
            proxied: builder().build().map_err(describe)?,
            direct: builder().no_proxy().build().map_err(describe)?,
            at: Instant::now(),
        })
    }

    fn get(&self, url: &Url) -> Result<Client, String> {
        let mut built = self.built.lock().unwrap();
        let stale = match &*built {
            None => true,
            Some(current) => self.failed.load(Ordering::Relaxed) && current.at.elapsed() >= REBUILD_AFTER,
        };
        if stale {
            match self.build() {
                Ok(fresh) => {
                    *built = Some(fresh);
                    self.failed.store(false, Ordering::Relaxed);
                }
                Err(e) if built.is_none() => return Err(e),
                // The clients in use still reach what they reached.
                Err(_) => {}
            }
        }
        let Some(current) = &*built else { return Err("no client".into()) };
        Ok(if is_local(url) { current.direct.clone() } else { current.proxied.clone() })
    }

    /// Notes a request's failure: one that couldn't connect has the clients built again.
    fn failed(&self, e: reqwest::Error) -> String {
        if e.is_connect() {
            self.failed.store(true, Ordering::Relaxed);
        }
        describe(e)
    }
}

#[derive(Default)]
struct Inflight {
    serial: u64,
    /// By the page's request id, with a serial number of their own: a request removes only its own entry.
    tasks: HashMap<String, (u64, JoinHandle<()>)>,
    /// Cancelled before their request got here.
    cancelled: HashMap<String, Instant>,
}

pub struct Net {
    server: Clients,
    webhooks: Clients,
    inflight: Mutex<Inflight>,
}

impl Default for Net {
    fn default() -> Self {
        Self { server: Clients::new(false), webhooks: Clients::new(true), inflight: Mutex::default() }
    }
}

/// An error with its causes ("error sending request: client error (Connect): Connection refused"), without the address.
fn describe(e: reqwest::Error) -> String {
    let e = e.without_url();
    let mut text = e.to_string();
    let mut source = e.source();
    while let Some(cause) = source {
        text.push_str(": ");
        text.push_str(&cause.to_string());
        source = cause.source();
    }
    text
}

fn is_local_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let [a, b, ..] = v4.octets();
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                || (a == 100 && (64..128).contains(&b))
        }
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => is_local_ip(IpAddr::V4(v4)),
            None => {
                let first = v6.segments()[0];
                v6.is_loopback() || v6.is_unspecified() || (first & 0xfe00) == 0xfc00 || (first & 0xffc0) == 0xfe80
            }
        },
    }
}

/// This machine, a private or link-local address, Tailscale (100.64.0.0/10, `*.ts.net`) or a local name.
fn is_local(url: &Url) -> bool {
    let Some(host) = url.host_str() else { return false };
    // IPv6 hosts come in brackets; IPv4 ones already written out in full (`127.1` is `127.0.0.1`).
    if let Ok(ip) = host.trim_start_matches('[').trim_end_matches(']').parse::<IpAddr>() {
        return is_local_ip(ip);
    }
    let name = host.trim_end_matches('.').to_ascii_lowercase();
    !name.contains('.')
        || [".localhost", ".local", ".lan", ".home.arpa", ".internal", ".ts.net"].iter().any(|suffix| name.ends_with(suffix))
}

/// An http(s) address; `api`: one of the FastMemo server's API paths.
fn target(url: &str, api: bool) -> Result<Url, String> {
    let url = Url::parse(url).map_err(|e| e.to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("only http and https addresses".into());
    }
    // As fetch: credentials go in the headers, never in the address.
    if !url.username().is_empty() || url.password().is_some() {
        return Err("an address with credentials".into());
    }
    if api && !url.path().contains("/v1/") {
        return Err("not a FastMemo server address".into());
    }
    Ok(url)
}

/// The answer as the page reads it: the status (2 bytes, big endian), then the body.
async fn send(request: RequestBuilder) -> Result<Vec<u8>, reqwest::Error> {
    let response = request.send().await?;
    let status = response.status().as_u16();
    let body = response.bytes().await?;
    let mut answer = Vec::with_capacity(body.len() + 2);
    answer.extend_from_slice(&status.to_be_bytes());
    answer.extend_from_slice(&body);
    Ok(answer)
}

fn invoke_header<'a>(request: &'a Request<'_>, name: &str) -> Result<&'a str, String> {
    let value = request.headers().get(name).ok_or_else(|| format!("no {name}"))?;
    value.to_str().map_err(|_| format!("bad {name}"))
}

/// The request's body: raw bytes, or, when the IPC fell back to `postMessage` (seen on Linux), a number array.
fn request_body(request: &Request<'_>) -> Result<Vec<u8>, String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes.clone()),
        InvokeBody::Json(serde_json::Value::Array(items)) => items
            .iter()
            .map(|item| item.as_u64().and_then(|n| u8::try_from(n).ok()).ok_or_else(|| "bad body".to_string()))
            .collect(),
        InvokeBody::Json(serde_json::Value::Null) => Ok(Vec::new()),
        InvokeBody::Json(_) => Err("bad body".into()),
    }
}

/// One request to the FastMemo server. The body comes raw; the request id, method, address and headers come as invoke
/// headers (`x-fm-id`, `x-fm-method`, `x-fm-url`, `x-fm-h-<name>`). `net_cancel` with the same id aborts it.
#[tauri::command]
pub async fn net_request(request: Request<'_>, net: State<'_, Net>) -> Result<Response, String> {
    let id = invoke_header(&request, "x-fm-id")?.to_owned();
    let method = Method::from_bytes(invoke_header(&request, "x-fm-method")?.as_bytes()).map_err(|e| e.to_string())?;
    let url = target(invoke_header(&request, "x-fm-url")?, true)?;
    let body = request_body(&request)?;

    let mut builder = net.server.get(&url)?.request(method, url);
    for name in FORWARDED_HEADERS {
        // As the page set it: fetch lets through any Latin-1 text.
        if let Some(value) = request.headers().get(format!("x-fm-h-{name}")) {
            builder = builder.header(name, value.clone());
        }
    }
    if !body.is_empty() {
        builder = builder.body(body);
    }

    let (answer, answered) = tokio::sync::oneshot::channel();
    let serial = {
        let mut inflight = net.inflight.lock().unwrap();
        if inflight.cancelled.remove(&id).is_some() {
            return Err(CANCELLED.into());
        }
        inflight.serial += 1;
        let serial = inflight.serial;
        let task = tauri::async_runtime::spawn(async move {
            let _ = answer.send(send(builder).await);
        });
        if let Some((_, replaced)) = inflight.tasks.insert(id.clone(), (serial, task)) {
            replaced.abort();
        }
        serial
    };
    let result = answered.await;
    {
        let mut inflight = net.inflight.lock().unwrap();
        if inflight.tasks.get(&id).is_some_and(|(own, _)| *own == serial) {
            inflight.tasks.remove(&id);
        }
    }
    match result {
        Ok(Ok(answer)) => Ok(Response::new(answer)),
        Ok(Err(e)) => Err(net.server.failed(e)),
        Err(_) => Err(CANCELLED.into()),
    }
}

/// Aborts `net_request` `id` (the connection closes), even one that hasn't arrived yet.
#[tauri::command(async)]
pub fn net_cancel(id: String, net: State<'_, Net>) {
    let mut inflight = net.inflight.lock().unwrap();
    match inflight.tasks.remove(&id) {
        Some((_, task)) => task.abort(),
        None => {
            // Ids aren't reused: one whose request already finished is dropped after a while.
            inflight.cancelled.retain(|_, at| at.elapsed() < CANCEL_KEPT);
            inflight.cancelled.insert(id, Instant::now());
        }
    }
}

/// A webhook: POSTs the JSON `body` to `url`, gives back only the status.
#[tauri::command]
pub async fn net_webhook(url: String, body: String, net: State<'_, Net>) -> Result<u16, String> {
    let url = target(&url, false)?;
    let response = net
        .webhooks
        .get(&url)?
        .post(url)
        .timeout(WEBHOOK_TIMEOUT)
        .header("accept", "application/json")
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| net.webhooks.failed(e))?;
    Ok(response.status().as_u16())
}
