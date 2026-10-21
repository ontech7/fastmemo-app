//! The FastMemo server and webhooks, called from Rust (`src/libs/net.web.ts`). The webview's fetch can't do it
//! everywhere: Windows serves the page over https and blocks a plain http:// address as mixed content, and a server or a
//! webhook that doesn't answer CORS is refused.
//!
//! One client for the whole app, built on first use: connections are reused and the OS checks the certificates, as for
//! the webview. Redirects are not followed: on the way to another host a redirect drops the device's token, and the
//! server's refusal would read as "this device was removed". The page reaches only the server's API (`/v1/` paths) and
//! webhook POSTs, whose answer it never sees.

use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use reqwest::{Client, Method, RequestBuilder, Url};
use tauri::async_runtime::JoinHandle;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::State;

/// The longest any request may take; the page's own timeouts cancel sooner.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const WEBHOOK_TIMEOUT: Duration = Duration::from_secs(5);
/// The request headers the page may set, each sent as an `x-fm-h-<name>` invoke header.
const FORWARDED_HEADERS: [&str; 4] = ["accept", "authorization", "content-type", "x-access-key"];

struct Clients {
    /// Through the system proxy, for the internet.
    proxied: Client,
    /// Direct, for this machine and the local network: a system proxy has no business there (and reqwest doesn't read
    /// the proxy's bypass list).
    direct: Client,
}

#[derive(Default)]
struct Inflight {
    tasks: HashMap<u32, JoinHandle<()>>,
    /// Cancelled before their request got here.
    cancelled: HashSet<u32>,
}

#[derive(Default)]
pub struct Net {
    clients: OnceLock<Result<Clients, String>>,
    inflight: Mutex<Inflight>,
}

impl Net {
    fn clients(&self) -> Result<&Clients, String> {
        self.clients
            .get_or_init(|| {
                // reqwest's rustls needs a crypto provider: ring, the one the updater uses.
                let _ = rustls::crypto::ring::default_provider().install_default();
                let builder = || {
                    Client::builder()
                        .redirect(reqwest::redirect::Policy::none())
                        .connect_timeout(CONNECT_TIMEOUT)
                        .timeout(REQUEST_TIMEOUT)
                };
                Ok(Clients {
                    proxied: builder().build().map_err(|e| e.to_string())?,
                    direct: builder().no_proxy().build().map_err(|e| e.to_string())?,
                })
            })
            .as_ref()
            .map_err(Clone::clone)
    }

    fn client(&self, url: &Url) -> Result<&Client, String> {
        let clients = self.clients()?;
        Ok(if is_local(url) { &clients.direct } else { &clients.proxied })
    }
}

/// This machine, a private or link-local address, Tailscale (100.64.0.0/10, `*.ts.net`) or a local name.
fn is_local(url: &Url) -> bool {
    let local_ip = |ip: IpAddr| match ip {
        IpAddr::V4(v4) => {
            let [a, b, ..] = v4.octets();
            v4.is_loopback() || v4.is_private() || v4.is_link_local() || (a == 100 && (64..128).contains(&b))
        }
        IpAddr::V6(v6) => {
            let first = v6.segments()[0];
            v6.is_loopback() || (first & 0xfe00) == 0xfc00 || (first & 0xffc0) == 0xfe80
        }
    };
    let Some(host) = url.host_str() else { return false };
    // IPv6 hosts come in brackets.
    if let Ok(ip) = host.trim_start_matches('[').trim_end_matches(']').parse::<IpAddr>() {
        return local_ip(ip);
    }
    let name = host.trim_end_matches('.').to_ascii_lowercase();
    !name.contains('.') || [".local", ".lan", ".home.arpa", ".internal", ".ts.net"].iter().any(|suffix| name.ends_with(suffix))
}

/// An http(s) address; `api`: one of the FastMemo server's API paths.
fn target(url: &str, api: bool) -> Result<Url, String> {
    let url = Url::parse(url).map_err(|e| e.to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("only http and https addresses".into());
    }
    if api && !url.path().contains("/v1/") {
        return Err("not a FastMemo server address".into());
    }
    Ok(url)
}

/// The answer as the page reads it: the status (2 bytes, big endian), then the body.
async fn send(request: RequestBuilder) -> Result<Vec<u8>, String> {
    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let body = response.bytes().await.map_err(|e| e.to_string())?;
    let mut answer = Vec::with_capacity(body.len() + 2);
    answer.extend_from_slice(&status.to_be_bytes());
    answer.extend_from_slice(&body);
    Ok(answer)
}

/// One request to the FastMemo server. The body comes raw; the request id, method, address and headers come as invoke
/// headers (`x-fm-id`, `x-fm-method`, `x-fm-url`, `x-fm-h-<name>`). `net_cancel` with the same id aborts it.
#[tauri::command]
pub async fn net_request(request: Request<'_>, net: State<'_, Net>) -> Result<Response, String> {
    let header = |name: &str| request.headers().get(name).and_then(|v| v.to_str().ok()).map(str::to_owned);
    let id: u32 = header("x-fm-id").and_then(|v| v.parse().ok()).ok_or("no request id")?;
    let method = Method::from_bytes(header("x-fm-method").as_deref().unwrap_or("GET").as_bytes()).map_err(|e| e.to_string())?;
    let url = target(&header("x-fm-url").ok_or("no address")?, true)?;

    let mut builder = net.client(&url)?.request(method, url);
    for name in FORWARDED_HEADERS {
        if let Some(value) = header(&format!("x-fm-h-{name}")) {
            builder = builder.header(name, value);
        }
    }
    if let InvokeBody::Raw(body) = request.body() {
        if !body.is_empty() {
            builder = builder.body(body.clone());
        }
    }

    let (answer, answered) = tokio::sync::oneshot::channel();
    let task = tauri::async_runtime::spawn(async move {
        let _ = answer.send(send(builder).await);
    });
    {
        let mut inflight = net.inflight.lock().unwrap();
        if inflight.cancelled.remove(&id) {
            task.abort();
        } else {
            inflight.tasks.insert(id, task);
        }
    }
    let result = answered.await;
    net.inflight.lock().unwrap().tasks.remove(&id);
    match result {
        Ok(answer) => answer.map(Response::new),
        Err(_) => Err("cancelled".into()),
    }
}

/// Aborts `net_request` `id` (the connection closes), even one that hasn't arrived yet.
#[tauri::command]
pub fn net_cancel(id: u32, net: State<'_, Net>) {
    let mut inflight = net.inflight.lock().unwrap();
    match inflight.tasks.remove(&id) {
        Some(task) => task.abort(),
        None => {
            inflight.cancelled.insert(id);
        }
    }
}

/// A webhook: POSTs the JSON `body` to `url`, gives back only the status.
#[tauri::command]
pub async fn net_webhook(url: String, body: String, net: State<'_, Net>) -> Result<u16, String> {
    let url = target(&url, false)?;
    let response = net
        .client(&url)?
        .post(url)
        .timeout(WEBHOOK_TIMEOUT)
        .header("accept", "application/json")
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.status().as_u16())
}
