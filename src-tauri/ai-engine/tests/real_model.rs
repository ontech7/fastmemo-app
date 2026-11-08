//! The engine on a real model, through its C ABI. Every test is ignored: run them with
//! `FASTMEMO_AI_MODEL=<a Qwen3.5 GGUF> cargo test --release -- --ignored` from `src-tauri/ai-engine`.

use std::ffi::{c_char, c_void, CStr, CString};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

use fastmemo_ai::ffi::{fm_ai_abi_version, fm_ai_call, fm_ai_free};
use fastmemo_ai::json::Json;
use fastmemo_ai::prompt::chat_prompt;

/// The engine holds one model per process: the tests take turns.
static SERIAL: Mutex<()> = Mutex::new(());

fn serial() -> MutexGuard<'static, ()> {
    SERIAL.lock().unwrap_or_else(|e| e.into_inner())
}

fn model_path() -> String {
    std::env::var("FASTMEMO_AI_MODEL").expect("FASTMEMO_AI_MODEL is the path of a Qwen3.5 GGUF")
}

/// What the streaming callback received.
#[derive(Default)]
struct Streamed {
    text: Mutex<String>,
    pieces: AtomicUsize,
}

impl Streamed {
    fn text(&self) -> String {
        self.text.lock().map(|t| t.clone()).unwrap_or_default()
    }
}

/// No panic may cross this `extern "C"` boundary: nothing in it unwraps.
extern "C" fn collect(token: *const c_char, user: *mut c_void) {
    let streamed = unsafe { &*(user as *const Streamed) };
    let piece = unsafe { CStr::from_ptr(token) }.to_string_lossy();
    if let Ok(mut text) = streamed.text.lock() {
        text.push_str(&piece);
    }
    streamed.pieces.fetch_add(1, Ordering::SeqCst);
}

fn call_with(request: &Json, streamed: Option<&Streamed>, stop: Option<&AtomicBool>) -> Json {
    let request = CString::new(request.to_string()).unwrap();
    let on_token: Option<extern "C" fn(*const c_char, *mut c_void)> = match streamed {
        Some(_) => Some(collect),
        None => None,
    };
    let user = streamed.map_or(std::ptr::null_mut(), |s| {
        s as *const Streamed as *mut c_void
    });
    let stop = stop.map_or(std::ptr::null(), |s| s as *const AtomicBool);
    let response = fm_ai_call(request.as_ptr(), on_token, user, stop);
    assert!(!response.is_null());
    let text = unsafe { CStr::from_ptr(response) }
        .to_str()
        .unwrap()
        .to_string();
    fm_ai_free(response);
    Json::parse(&text).unwrap_or_else(|e| panic!("not JSON ({e}): {text}"))
}

fn call(request: &Json) -> Json {
    call_with(request, None, None)
}

fn ok(response: Json) -> Json {
    if let Some(error) = response.get("error") {
        panic!("the engine answered an error: {error}");
    }
    response.get("ok").cloned().expect("an ok answer")
}

fn load(n_ctx: u32) -> Json {
    let info = ok(call(&Json::object([
        ("op", "load".into()),
        ("path", model_path().into()),
        ("n_ctx", n_ctx.into()),
        ("n_gpu_layers", 99.into()),
        ("n_threads", 4.into()),
    ])));
    eprintln!("loaded: {info}");
    info
}

fn tokens(text: &str) -> usize {
    let tokens = ok(call(&Json::object([
        ("op", "tokenize".into()),
        ("text", text.into()),
    ])));
    tokens.as_array().map_or(0, <[Json]>::len)
}

const STOP_WORDS: [&str; 9] = [
    "</s>",
    "<|end|>",
    "<|eot_id|>",
    "<|end_of_text|>",
    "<|im_end|>",
    "<|EOT|>",
    "<|END_OF_TURN_TOKEN|>",
    "<|end_of_turn|>",
    "<|endoftext|>",
];

const JSON_ARRAY_GRAMMAR: &str = r#"root   ::= "[" ws string (ws "," ws string)* ws "]" ws
string ::= "\"" ([^"\\] | "\\" .)* "\""
ws     ::= [ \t\n]*"#;

/// A completion request as the page sends it (the jinja keys included), with the faithful
/// sampling and a fixed seed; `extra` keys replace or add to it.
fn completion(system: &str, user: &str, n_predict: u32, extra: Vec<(&str, Json)>) -> Json {
    let mut pairs: Vec<(&str, Json)> = vec![
        ("op", "complete".into()),
        (
            "messages",
            Json::Arr(vec![
                Json::object([("role", "system".into()), ("content", system.into())]),
                Json::object([("role", "user".into()), ("content", user.into())]),
            ]),
        ),
        ("jinja", true.into()),
        ("enable_thinking", false.into()),
        ("reasoning_format", "none".into()),
        ("n_predict", n_predict.into()),
        (
            "stop",
            Json::Arr(STOP_WORDS.iter().map(|s| (*s).into()).collect()),
        ),
        ("temperature", 0.2.into()),
        ("top_p", 0.8.into()),
        ("top_k", 20.into()),
        ("min_p", 0.0.into()),
        ("penalty_repeat", 1.0.into()),
        ("penalty_present", 0.0.into()),
        ("seed", 42.into()),
    ];
    for (key, value) in extra {
        pairs.retain(|(k, _)| *k != key);
        pairs.push((key, value));
    }
    Json::object(pairs)
}

fn text_of(result: &Json) -> String {
    result
        .get("text")
        .and_then(Json::as_str)
        .expect("a text")
        .to_string()
}

fn flag(result: &Json, key: &str) -> bool {
    result
        .get(key)
        .and_then(Json::as_bool)
        .unwrap_or_else(|| panic!("no flag {key} in {result}"))
}

fn timing(result: &Json, key: &str) -> f64 {
    result
        .get("timings")
        .and_then(|t| t.get(key))
        .and_then(Json::as_f64)
        .unwrap_or_else(|| panic!("no timing {key} in {result}"))
}

const TITLE_SYSTEM: &str = "You generate short note titles. Given note content, output ONLY a concise title (2-5 words) in Italian. No quotes, no explanation, just the title.";
const ITALIAN_NOTE: &str = "Domani mattina devo portare la macchina dal meccanico per il tagliando, poi passare in farmacia a ritirare le medicine della nonna e infine comprare il pane e il latte al supermercato.";

fn a_short_completion_works() {
    let result = ok(call(&completion(TITLE_SYSTEM, ITALIAN_NOTE, 30, vec![])));
    assert!(!flag(&result, "interrupted"), "{result}");
    assert!(!text_of(&result).trim().is_empty(), "{result}");
}

/// About `n` tokens of plain Italian text.
fn long_text(n: usize) -> String {
    let sentence = "La riunione di lunedì è stata spostata a martedì pomeriggio per via dello sciopero dei treni. ";
    let per_sentence = tokens(sentence).max(1);
    sentence.repeat(n / per_sentence + 1)
}

#[test]
#[ignore]
fn loads_and_writes_a_title() {
    let _turn = serial();
    assert_eq!(fm_ai_abi_version(), 1);
    load(8192);
    let result = ok(call(&completion(TITLE_SYSTEM, ITALIAN_NOTE, 30, vec![])));
    eprintln!("title: {result}");
    assert!(!text_of(&result).trim().is_empty());
    assert!(!flag(&result, "stopped_limit"));
    assert!(!flag(&result, "interrupted"));
    assert!(!flag(&result, "truncated"));
    assert!(!flag(&result, "context_full"));
    assert!(timing(&result, "prompt_n") > 0.0);
    assert!(timing(&result, "predicted_n") > 0.0);
}

#[test]
#[ignore]
fn json_grammar_gives_an_array() {
    let _turn = serial();
    load(8192);
    // Without the grammar the 0.8B answers this in prose (a numbered list): the array is the
    // grammar's doing.
    let request = completion(
        "You are a helpful assistant.",
        "List three fruits.",
        100,
        vec![("grammar", JSON_ARRAY_GRAMMAR.into())],
    );
    let result = ok(call(&request));
    eprintln!("items: {result}");
    assert!(!flag(&result, "stopped_limit"));
    let text = text_of(&result);
    assert!(
        text.starts_with('['),
        "the grammar's first character: {text:?}"
    );
    let parsed = Json::parse(text.trim()).unwrap_or_else(|e| panic!("{e}: {text:?}"));
    let items = parsed.as_array().expect("an array");
    assert!(!items.is_empty());
    assert!(items.iter().all(|item| item.as_str().is_some()), "{text}");
}

/// The app's dictation-to-items action on the 0.8B (the evaluation's `voice-items-en`): it writes the
/// array one item per line and wants "\n]" to close it. The grammar must let it, or it goes on listing.
#[test]
#[ignore]
fn a_list_written_one_item_per_line_closes() {
    let _turn = serial();
    load(8192);
    let system = "You turn a dictated to-do list into checklist items. Output ONLY a JSON array of strings: one short item per task or thing to buy, in the order spoken, in the same language as the input. Keep the speaker's words without fillers, start each item with a capital letter, and never add an item that was not said.";
    let user = "um I need to pick up the dry cleaning buy dog food and uh call the plumber about the kitchen sink";
    let request = completion(
        system,
        user,
        300,
        vec![("grammar", JSON_ARRAY_GRAMMAR.into())],
    );
    let result = ok(call(&request));
    let text = text_of(&result);
    eprintln!("items: {text:?}");
    assert!(
        !flag(&result, "stopped_limit"),
        "still listing at n_predict: {text:?}"
    );
    let parsed = Json::parse(text.trim()).unwrap_or_else(|e| panic!("{e}: {text:?}"));
    let items = parsed.as_array().expect("an array");
    assert!((2..=4).contains(&items.len()), "{text}");
}

#[test]
#[ignore]
fn n_probs_lists_candidates() {
    let _turn = serial();
    load(8192);
    let system = "You assign notes to categories based on their title and content. Either alone is enough to decide. Output ONLY the exact category name from the list that matches. If none fits, output: none";
    let user = "Categories: Work, Travel, Cooking, Health\n\nNote:\nFlight to Tokyo on Monday at 9:40, hotel booked near Shinjuku station.";
    let request = completion(
        system,
        user,
        30,
        vec![
            (
                "grammar",
                r#"root ::= "Work" | "Travel" | "Cooking" | "Health" | "none""#.into(),
            ),
            ("n_probs", 10.into()),
        ],
    );
    let result = ok(call(&request));
    eprintln!("category: {result}");
    let text = text_of(&result);
    assert!(
        ["Work", "Travel", "Cooking", "Health", "none"].contains(&text.as_str()),
        "{text:?}"
    );
    let steps = result
        .get("completion_probabilities")
        .and_then(Json::as_array)
        .expect("completion_probabilities");
    assert!(!steps.is_empty());
    for step in steps {
        let content = step.get("content").and_then(Json::as_str).expect("content");
        let probs = step.get("probs").and_then(Json::as_array).expect("probs");
        assert!(!probs.is_empty() && probs.len() <= 10, "{step}");
        let mut sum = 0.0;
        let mut found = false;
        for candidate in probs {
            let tok_str = candidate
                .get("tok_str")
                .and_then(Json::as_str)
                .expect("tok_str");
            let prob = candidate.get("prob").and_then(Json::as_f64).expect("prob");
            assert!((0.0..=1.0).contains(&prob), "{step}");
            sum += prob;
            found |= tok_str == content;
        }
        assert!(sum <= 1.0 + 1e-4, "{step}");
        assert!(found, "{content:?} is not among its candidates: {step}");
    }
}

#[test]
#[ignore]
fn stop_word_ends_the_answer() {
    let _turn = serial();
    load(8192);
    let request = completion(
        "You follow the instructions exactly.",
        "List three fruits, one per line, no numbering.",
        60,
        vec![("stop", Json::Arr(vec!["\n".into()]))],
    );
    let streamed = Streamed::default();
    let result = ok(call_with(&request, Some(&streamed), None));
    eprintln!("first line: {result}");
    let text = text_of(&result);
    assert!(!text.trim().is_empty(), "{result}");
    assert!(!text.contains('\n'), "{text:?}");
    assert_eq!(streamed.text(), text);
    assert!(!flag(&result, "stopped_limit"));
}

#[test]
#[ignore]
fn context_fills_up() {
    let _turn = serial();
    load(256);
    let request = completion(
        "You are a writer.",
        "Write a very long story about a dragon, at least two thousand words.",
        0,
        vec![("n_predict", (-1).into())],
    );
    let result = ok(call(&request));
    eprintln!("context fills up: {result}");
    assert!(flag(&result, "context_full"), "{result}");
    assert!(!text_of(&result).is_empty());
    // still alive: a short one fits
    a_short_completion_works();
}

#[test]
#[ignore]
fn a_bad_path_keeps_the_loaded_model() {
    let _turn = serial();
    load(2048);
    let response = call(&Json::object([
        ("op", "load".into()),
        ("path", "/no/such/model.gguf".into()),
        ("n_ctx", 2048.into()),
    ]));
    assert!(response.get("error").is_some(), "{response}");
    a_short_completion_works();
}

#[test]
#[ignore]
fn japanese_translation_is_whole() {
    let _turn = serial();
    load(8192);
    let request = completion(
        "You translate text into Japanese. Output ONLY the translation, nothing else. No quotes, no explanation.",
        "The weather is beautiful today, so we will have lunch in the park near the station with my grandmother.",
        200,
        vec![],
    );
    let streamed = Streamed::default();
    let result = ok(call_with(&request, Some(&streamed), None));
    eprintln!(
        "japanese: {result} in {} pieces",
        streamed.pieces.load(Ordering::SeqCst)
    );
    let text = text_of(&result);
    assert_eq!(streamed.text(), text);
    assert!(!text.contains('\u{FFFD}'));
    assert!(
        text.chars()
            .any(|c| matches!(u32::from(c), 0x3040..=0x30FF | 0x4E00..=0x9FFF)),
        "no Japanese in {text:?}"
    );
}

#[test]
#[ignore]
fn cancel_mid_prompt() {
    let _turn = serial();
    load(8192);
    let user = long_text(6000);
    let (prefix, rest) = chat_prompt(TITLE_SYSTEM, &user);
    let total = tokens(&format!("{prefix}{rest}"));
    let stop = AtomicBool::new(false);
    let (result, elapsed) = thread::scope(|s| {
        s.spawn(|| {
            thread::sleep(Duration::from_millis(50));
            stop.store(true, Ordering::SeqCst);
        });
        let start = Instant::now();
        let result = call_with(
            &completion(TITLE_SYSTEM, &user, 30, vec![]),
            None,
            Some(&stop),
        );
        (ok(result), start.elapsed())
    });
    eprintln!("cancelled prompt after {elapsed:?} of {total} tokens: {result}");
    assert!(flag(&result, "interrupted"));
    assert_eq!(timing(&result, "predicted_n"), 0.0);
    assert!((timing(&result, "prompt_n") as usize) < total);
    a_short_completion_works();
}

#[test]
#[ignore]
fn cancel_mid_answer() {
    let _turn = serial();
    load(8192);
    let request = completion(
        "You are a novelist.",
        "Write a very long story about a lighthouse keeper and his cat, at least two thousand words.",
        2000,
        vec![("temperature", 0.7.into())],
    );
    let streamed = Streamed::default();
    let stop = AtomicBool::new(false);
    let result = thread::scope(|s| {
        s.spawn(|| {
            // 50 ms into the answer
            while streamed.pieces.load(Ordering::SeqCst) == 0 {
                thread::sleep(Duration::from_millis(1));
            }
            thread::sleep(Duration::from_millis(50));
            stop.store(true, Ordering::SeqCst);
        });
        ok(call_with(&request, Some(&streamed), Some(&stop)))
    });
    eprintln!("cancelled answer: {result}");
    assert!(flag(&result, "interrupted"));
    let predicted = timing(&result, "predicted_n");
    assert!(predicted > 0.0 && predicted < 2000.0);
    assert_eq!(streamed.text(), text_of(&result));
    a_short_completion_works();
}

#[test]
#[ignore]
fn prompt_over_context_is_refused() {
    let _turn = serial();
    load(512);
    let user = long_text(2000);
    let result = ok(call(&completion(TITLE_SYSTEM, &user, 30, vec![])));
    eprintln!("over the context: {result}");
    assert!(flag(&result, "truncated"));
    assert_eq!(text_of(&result), "");
    assert_eq!(timing(&result, "predicted_n"), 0.0);
    // still alive: a short one fits
    a_short_completion_works();
}

#[test]
#[ignore]
fn prefix_reuse_same_output() {
    let _turn = serial();
    load(8192);
    let (prefix, rest) = chat_prompt(TITLE_SYSTEM, ITALIAN_NOTE);
    let request = completion(TITLE_SYSTEM, ITALIAN_NOTE, 30, vec![]);
    let first = ok(call(&request));
    let second = ok(call(&request));
    eprintln!("first: {first}\nsecond: {second}");
    assert_eq!(text_of(&first), text_of(&second));
    assert_eq!(
        timing(&first, "prompt_n") as usize,
        tokens(&format!("{prefix}{rest}"))
    );
    assert_eq!(timing(&second, "prompt_n") as usize, tokens(&rest));
}

#[test]
#[ignore]
fn a_second_call_while_one_runs_is_busy() {
    let _turn = serial();
    load(8192);
    let request = completion(
        "You are a novelist.",
        "Write a very long story about a lighthouse keeper.",
        2000,
        vec![("temperature", 0.7.into())],
    );
    let streamed = Streamed::default();
    let stop = AtomicBool::new(false);
    let result = thread::scope(|s| {
        let running = s.spawn(|| call_with(&request, Some(&streamed), Some(&stop)));
        while streamed.pieces.load(Ordering::SeqCst) == 0 {
            thread::sleep(Duration::from_millis(1));
        }
        let busy = call(&completion(TITLE_SYSTEM, ITALIAN_NOTE, 30, vec![]));
        assert_eq!(busy.get("error").and_then(Json::as_str), Some("busy"));
        stop.store(true, Ordering::SeqCst);
        running.join().unwrap()
    });
    assert!(flag(&ok(result), "interrupted"));
    a_short_completion_works();
}

#[test]
#[ignore]
fn gguf_template_matches_prompt() {
    let template = fastmemo_ai::engine::gguf_chat_template(&model_path()).unwrap();
    // The template's own string literals (`\n` is written as a backslash and an n).
    let system_block = r"'<|im_start|>system\n' + content + '<|im_end|>\n'";
    let message_block = r"'<|im_start|>' + message.role + '\n' + content + '<|im_end|>' + '\n'";
    let assistant = r"{{- '<|im_start|>assistant\n' }}";
    let thinking = "enable_thinking is defined and enable_thinking is true";
    let no_thinking = r"{{- '<think>\n\n</think>\n\n' }}";
    for piece in [
        system_block,
        message_block,
        assistant,
        thinking,
        no_thinking,
    ] {
        assert!(template.contains(piece), "{piece} is not in the template");
    }
    // the contents are trimmed, as chat_prompt does
    assert!(template.contains("render_content(messages[0].content, false, true)|trim"));
    assert!(template.contains("render_content(message.content, true)|trim"));
    // the generation prompt, then the empty think block when thinking isn't on
    let at = |piece: &str, from: usize| {
        template[from..]
            .find(piece)
            .map(|i| i + from)
            .unwrap_or_else(|| panic!("{piece} out of order"))
    };
    let generation = at("{%- if add_generation_prompt %}", 0);
    let after_assistant = at(assistant, generation);
    let if_thinking = at(thinking, after_assistant);
    let otherwise = at("{%- else %}", if_thinking);
    at(no_thinking, otherwise);

    // What those pieces render for S and U is what chat_prompt builds.
    let unescape = |s: &str| s.replace(r"\n", "\n");
    let (prefix, rest) = chat_prompt("S", "U");
    assert_eq!(
        prefix,
        unescape("<|im_start|>system\\n") + "S" + &unescape("<|im_end|>\\n")
    );
    assert_eq!(
        rest,
        unescape(
            "<|im_start|>user\\nU<|im_end|>\\n<|im_start|>assistant\\n<think>\\n\\n</think>\\n\\n"
        )
    );
}
