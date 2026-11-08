//! The engine's speed and memory on one model, through its C ABI (a developer tool).
//!
//! ```text
//! cd src-tauri/ai-engine
//! cargo run --release --example bench -- --model <gguf> --ctx 8192 --gpu-layers 99 --threads 4
//! ```
//!
//! It runs a 500-token prompt with 200 tokens out, then a 30-line rewrite (one completion per line,
//! the same system prompt) with the prompt prefix reused and without. It prints
//! `{ prefill_tps, generate_tps, max_rss_bytes, rewrite_ms_reuse, rewrite_ms_no_reuse }` on stdout,
//! and the details on stderr.

use std::ffi::{CStr, CString};
use std::process::ExitCode;
use std::time::Instant;

use fastmemo_ai::ffi::{fm_ai_call, fm_ai_free};
use fastmemo_ai::json::Json;
use fastmemo_ai::prompt::chat_prompt;

const FIX_GRAMMAR: &str = "You correct spelling, grammar and punctuation. Output ONLY the corrected text in the SAME language as the input, preserving the original meaning and wording as much as possible. No explanation, no quotes.";

const LINES: [&str; 30] = [
    "Their going to the store tomorow, but they dont know if its open.",
    "Me and him has decided to wait untill the weather get better.",
    "The meeting have been moved to thursday becuase of the strike.",
    "I recieved you're message but i didnt had time to answer.",
    "She dont like when people talks during the movie.",
    "We was planning to leave early, but the car brokes down.",
    "Can you buy some egg's and milk on you're way home?",
    "The report need to be finish before friday afternoon.",
    "He said he will called back after lunch, but he never did.",
    "There is to many people in this small room.",
    "Domani andiamo al mare se non piove, speriamo che c'e il sole.",
    "Ho comprato il pane ma mi sono dimenticato del latte.",
    "La riunione e stata spostata a lunedi pomeriggio.",
    "Devo chiamare il dentista per prenotare un apuntamento.",
    "Non ho capito cosa voleva dire con quella frase.",
    "I think its going to rain, so take you're umbrella.",
    "The kids was playing in the garden all the afternoon.",
    "Please send me the file's before the end of the day.",
    "Our neighbour have a new dog who bark all night.",
    "I has finished the book you gave me last week.",
    "Mia sorella arriva sabato e resta fino a mercoledi.",
    "Abbiamo prenotato un tavolo per otto persone alle venti.",
    "Il treno e partito in ritardo di quaranta minuti.",
    "Ricordati di pagare la bolletta della luce entro venerdi.",
    "Ho perso le chiavi di casa e non so dove cercarle.",
    "The restaurant were closed so we eat at home.",
    "Its the third time this week that the bus is late.",
    "He dont know how to fix the printer in the office.",
    "We needs more chairs for the party on saturday.",
    "Could you remind me to call grandma tomorow morning?",
];

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("bench: {e}");
            ExitCode::FAILURE
        }
    }
}

struct Args {
    model: String,
    ctx: u32,
    gpu_layers: i32,
    threads: i32,
}

fn args() -> Result<Args, String> {
    let mut args = Args {
        model: String::new(),
        ctx: 8192,
        gpu_layers: 99,
        threads: std::thread::available_parallelism()
            .map_or(1, |n| (n.get() / 2).max(1))
            .try_into()
            .unwrap_or(1),
    };
    let mut it = std::env::args().skip(1);
    while let Some(flag) = it.next() {
        let value = it.next().ok_or(format!("{flag} needs a value"))?;
        let bad = |_| format!("bad {flag}: {value}");
        match flag.as_str() {
            "--model" => args.model = value.clone(),
            "--ctx" => args.ctx = value.parse().map_err(bad)?,
            "--gpu-layers" => args.gpu_layers = value.parse().map_err(bad)?,
            "--threads" => args.threads = value.parse().map_err(bad)?,
            _ => return Err(format!("unknown flag {flag}")),
        }
    }
    if args.model.is_empty() {
        return Err("usage: --model <gguf> [--ctx n] [--gpu-layers n] [--threads n]".into());
    }
    Ok(args)
}

fn call(request: &Json) -> Result<Json, String> {
    let request = CString::new(request.to_string()).map_err(|e| e.to_string())?;
    let answer = fm_ai_call(
        request.as_ptr(),
        None,
        std::ptr::null_mut(),
        std::ptr::null(),
    );
    let text = unsafe { CStr::from_ptr(answer) }
        .to_string_lossy()
        .into_owned();
    fm_ai_free(answer);
    let answer = Json::parse(&text)?;
    match answer.get("ok") {
        Some(ok) => Ok(ok.clone()),
        None => Err(format!("the engine answered {text}")),
    }
}

fn tokens(text: &str) -> Result<usize, String> {
    let request = Json::object([("op", "tokenize".into()), ("text", text.into())]);
    Ok(call(&request)?.as_array().map_or(0, <[Json]>::len))
}

fn completion(
    system: &str,
    user: &str,
    n_predict: u32,
    cache_prompt: bool,
    temperature: f64,
) -> Json {
    Json::object([
        ("op", "complete".into()),
        (
            "messages",
            Json::Arr(vec![
                Json::object([("role", "system".into()), ("content", system.into())]),
                Json::object([("role", "user".into()), ("content", user.into())]),
            ]),
        ),
        ("n_predict", n_predict.into()),
        ("stop", Json::Arr(vec!["<|im_end|>".into()])),
        ("temperature", temperature.into()),
        ("top_p", 0.8.into()),
        ("top_k", 20.into()),
        ("min_p", 0.0.into()),
        ("penalty_repeat", 1.0.into()),
        ("penalty_present", 0.0.into()),
        ("seed", 42.into()),
        ("cache_prompt", cache_prompt.into()),
    ])
}

fn timing(answer: &Json, key: &str) -> f64 {
    answer
        .get("timings")
        .and_then(|t| t.get(key))
        .and_then(Json::as_f64)
        .unwrap_or(0.0)
}

fn per_second(n: f64, ms: f64) -> f64 {
    if ms > 0.0 {
        (n / ms * 1000.0 * 10.0).round() / 10.0
    } else {
        0.0
    }
}

/// The 30 lines, one completion each; the total time, the prompt tokens decoded and the answers.
fn rewrite(cache_prompt: bool) -> Result<(f64, f64, Vec<String>), String> {
    let started = Instant::now();
    let mut prompt_n = 0.0;
    let mut answers = Vec::new();
    for line in LINES {
        let answer = call(&completion(FIX_GRAMMAR, line, 800, cache_prompt, 0.2))?;
        prompt_n += timing(&answer, "prompt_n");
        answers.push(
            answer
                .get("text")
                .and_then(Json::as_str)
                .unwrap_or("")
                .to_string(),
        );
    }
    Ok((started.elapsed().as_secs_f64() * 1000.0, prompt_n, answers))
}

fn run() -> Result<(), String> {
    let args = args()?;
    let loading = Instant::now();
    let loaded = call(&Json::object([
        ("op", "load".into()),
        ("path", args.model.as_str().into()),
        ("n_ctx", args.ctx.into()),
        ("n_gpu_layers", args.gpu_layers.into()),
        ("n_threads", args.threads.into()),
    ]))?;
    eprintln!(
        "loaded in {:.0} ms: {loaded} (ctx {}, threads {})",
        loading.elapsed().as_secs_f64() * 1000.0,
        args.ctx,
        args.threads
    );

    // The GPU's first run compiles its kernels: not counted.
    call(&completion("You are terse.", "Say hi.", 8, false, 0.2))?;

    // A 500-token prompt (all of it decoded), 200 tokens out.
    let system = "You are a business analyst. You write long, detailed reports.";
    let sentence = "In the northern region sales grew by four percent this quarter, while the cost of shipping stayed flat and two new stores opened near the coast. ";
    let mut user = String::from("Notes for the quarterly report:\n");
    let ask = "\nWrite the full report from these notes, as long and detailed as you can.";
    loop {
        let (prefix, rest) = chat_prompt(system, &format!("{user}{ask}"));
        if tokens(&format!("{prefix}{rest}"))? >= 500 {
            break;
        }
        user.push_str(sentence);
    }
    user.push_str(ask);
    let long = call(&completion(system, &user, 200, false, 0.7))?;
    eprintln!(
        "500-token prompt: {}",
        long.get("timings").map_or(String::new(), Json::to_string)
    );
    let prefill_tps = per_second(timing(&long, "prompt_n"), timing(&long, "prompt_ms"));
    let generate_tps = per_second(timing(&long, "predicted_n"), timing(&long, "predicted_ms"));

    // The rewrite: the system prompt's state reused, then decoded every time.
    let (reuse_ms, reuse_prompt_n, reuse_answers) = rewrite(true)?;
    let (no_reuse_ms, no_reuse_prompt_n, no_reuse_answers) = rewrite(false)?;
    let same = reuse_answers
        .iter()
        .zip(&no_reuse_answers)
        .filter(|(a, b)| a == b)
        .count();
    eprintln!(
        "rewrite of {} lines: reuse {reuse_ms:.0} ms ({reuse_prompt_n} prompt tokens), no reuse {no_reuse_ms:.0} ms ({no_reuse_prompt_n}); {same} answers the same both ways",
        LINES.len()
    );

    let report = Json::object([
        ("prefill_tps", prefill_tps.into()),
        ("generate_tps", generate_tps.into()),
        (
            "max_rss_bytes",
            max_rss_bytes().map_or(Json::Null, |n| Json::Num(n as f64)),
        ),
        ("rewrite_ms_reuse", reuse_ms.round().into()),
        ("rewrite_ms_no_reuse", no_reuse_ms.round().into()),
    ]);
    println!("{report}");
    Ok(())
}

/// The process's peak resident memory, from `getrusage` (declared here: the crate takes no libc).
#[cfg(unix)]
fn max_rss_bytes() -> Option<u64> {
    use std::ffi::{c_int, c_long};
    #[repr(C)]
    struct Rusage {
        // two `struct timeval`s: 16 bytes each on 64-bit macOS and Linux
        times: [i64; 4],
        maxrss: c_long,
        rest: [c_long; 13],
    }
    extern "C" {
        fn getrusage(who: c_int, usage: *mut Rusage) -> c_int;
    }
    let mut usage = Rusage {
        times: [0; 4],
        maxrss: 0,
        rest: [0; 13],
    };
    // RUSAGE_SELF is 0
    if unsafe { getrusage(0, &mut usage) } != 0 {
        return None;
    }
    let maxrss = u64::try_from(usage.maxrss).ok()?;
    // bytes on macOS, kilobytes on Linux
    Some(if cfg!(target_os = "macos") {
        maxrss
    } else {
        maxrss * 1024
    })
}

#[cfg(not(unix))]
fn max_rss_bytes() -> Option<u64> {
    None
}
