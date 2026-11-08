//! Qwen3.5's chat prompt, with thinking off.

/// Builds the prompt as `(prefix, rest)`.
///
/// The prefix (the system turn) is the same for every request that shares a system prompt, so its
/// evaluated state can be cached. The rest ends with an empty think block, which turns thinking off.
pub fn chat_prompt(system: &str, user: &str) -> (String, String) {
    (
        format!("<|im_start|>system\n{system}<|im_end|>\n"),
        format!(
            "<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
        ),
    )
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
}
