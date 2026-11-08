//! Qwen3.5's chat prompt, with thinking off.

/// Builds the prompt as `(prefix, rest)`.
///
/// The prefix (the system turn) is the same for every request that shares a system prompt, so its
/// evaluated state can be cached. The rest ends with an empty think block, which turns thinking off.
/// Each content is trimmed, as the model's template does (`|trim`).
pub fn chat_prompt(system: &str, user: &str) -> (String, String) {
    let (system, user) = (template_trim(system), template_trim(user));
    (
        format!("<|im_start|>system\n{system}<|im_end|>\n"),
        format!(
            "<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
        ),
    )
}

/// The template engine's `trim`: C `isspace` at both ends, nothing else (llama.cpp's jinja runtime).
fn template_trim(s: &str) -> &str {
    s.trim_matches(|c| matches!(c, ' ' | '\t' | '\n' | '\r' | '\u{0b}' | '\u{0c}'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_is_qwen35_with_thinking_off() {
        let (prefix, rest) = chat_prompt("S", "U");
        assert_eq!(prefix, "<|im_start|>system\nS<|im_end|>\n");
        assert_eq!(
            rest,
            "<|im_start|>user\nU<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
        );
    }

    #[test]
    fn content_is_trimmed_as_the_template_does() {
        // the template's `|trim` strips C `isspace` only: a no-break space stays
        let (prefix, rest) = chat_prompt(" \t\r\n S \u{0b}\u{0c}", "\n\u{a0}U\n\n");
        assert_eq!(prefix, "<|im_start|>system\nS<|im_end|>\n");
        assert!(rest.starts_with("<|im_start|>user\n\u{a0}U<|im_end|>\n"));
    }
}
