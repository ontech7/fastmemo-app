//! Streamed text: whole characters only, with stop words held back.

/// What `Holdback::push` hands back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pushed {
    /// Text that is safe to show now.
    pub emit: String,
    /// A whole stop word was seen: the text before it is in `emit`, and the generation should end.
    pub stopped: bool,
}

/// Turns the raw bytes of generated tokens into text for the page.
///
/// - It emits whole UTF-8 characters only: the bytes of a character may arrive across several
///   pieces, and the incomplete tail waits for the next one.
/// - It holds back any tail of the text that is a prefix of a stop word, until the next piece shows
///   whether the stop word completes. Stop words need not sit on token boundaries.
/// - Bytes that can never be UTF-8 become U+FFFD.
pub struct Holdback {
    stops: Vec<String>,
    /// Bytes of an incomplete UTF-8 character, waiting for the rest.
    pending: Vec<u8>,
    /// Decoded text not emitted yet: it ends with a prefix of a stop word.
    held: String,
    stopped: bool,
}

impl Holdback {
    /// Empty stop words are ignored.
    pub fn new(stops: Vec<String>) -> Self {
        Self {
            stops: stops.into_iter().filter(|s| !s.is_empty()).collect(),
            pending: Vec::new(),
            held: String::new(),
            stopped: false,
        }
    }

    pub fn push(&mut self, piece: &[u8]) -> Pushed {
        if self.stopped {
            return Pushed {
                emit: String::new(),
                stopped: true,
            };
        }
        self.pending.extend_from_slice(piece);
        self.decode_pending();

        // The earliest whole stop word wins.
        let found = self
            .stops
            .iter()
            .filter_map(|stop| self.held.find(stop.as_str()))
            .min();
        if let Some(at) = found {
            let emit = self.held[..at].to_string();
            self.held.clear();
            self.pending.clear();
            self.stopped = true;
            return Pushed {
                emit,
                stopped: true,
            };
        }

        let keep = self.held_suffix_len();
        let cut = self.held.len() - keep;
        let emit = self.held[..cut].to_string();
        self.held.drain(..cut);
        Pushed {
            emit,
            stopped: false,
        }
    }

    /// The end of the generation: whatever is still held back, since no stop word completed.
    ///
    /// An incomplete UTF-8 tail is dropped, not emitted as U+FFFD.
    pub fn finish(self) -> String {
        self.held
    }

    /// Moves the valid UTF-8 of `pending` into `held`, keeping an incomplete tail in `pending`.
    fn decode_pending(&mut self) {
        let mut start = 0;
        loop {
            match std::str::from_utf8(&self.pending[start..]) {
                Ok(valid) => {
                    self.held.push_str(valid);
                    start = self.pending.len();
                    break;
                }
                Err(e) => {
                    let valid_end = start + e.valid_up_to();
                    if let Ok(valid) = std::str::from_utf8(&self.pending[start..valid_end]) {
                        self.held.push_str(valid);
                    }
                    match e.error_len() {
                        // Bytes that are not UTF-8 whatever follows.
                        Some(bad) => {
                            self.held.push('\u{FFFD}');
                            start = valid_end + bad;
                        }
                        // A character cut short at the end: wait for its other bytes.
                        None => {
                            start = valid_end;
                            break;
                        }
                    }
                }
            }
        }
        self.pending.drain(..start);
    }

    /// The length in bytes of the longest tail of `held` that is a proper prefix of a stop word.
    fn held_suffix_len(&self) -> usize {
        let mut longest = 0;
        for stop in &self.stops {
            for len in (longest + 1..stop.len()).rev() {
                if let Some(prefix) = stop.get(..len) {
                    if self.held.ends_with(prefix) {
                        longest = len;
                        break;
                    }
                }
            }
        }
        longest
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf8_split_across_pieces() {
        let mut h = Holdback::new(vec![]);
        let a = h.push(&[0xe6]);
        assert_eq!((a.emit.as_str(), a.stopped), ("", false));
        let b = h.push(&[0x97, 0xa5]);
        assert_eq!((b.emit.as_str(), b.stopped), ("日", false));
    }

    #[test]
    fn stop_word_across_pieces() {
        let mut h = Holdback::new(vec!["<|im_end|>".to_string()]);
        let a = h.push(b"ciao<|im");
        assert_eq!((a.emit.as_str(), a.stopped), ("ciao", false));
        let b = h.push(b"_end|>dopo");
        assert_eq!((b.emit.as_str(), b.stopped), ("", true));
    }

    #[test]
    fn false_stop_prefix_released() {
        let mut h = Holdback::new(vec!["<|im_end|>".to_string()]);
        assert_eq!(h.push(b"a<|").emit, "a");
        assert_eq!(h.push(b"b").emit, "<|b");
    }

    #[test]
    fn finish_returns_what_is_held_and_drops_an_incomplete_character() {
        let mut h = Holdback::new(vec!["<|im_end|>".to_string()]);
        assert_eq!(h.push(b"ok<|im").emit, "ok");
        h.push(&[0xe6]);
        assert_eq!(h.finish(), "<|im");
    }

    #[test]
    fn character_split_byte_by_byte_and_stop_after_multibyte_text() {
        let mut h = Holdback::new(vec!["fine".to_string()]);
        let mut out = String::new();
        for b in "日本fi".as_bytes() {
            out.push_str(&h.push(&[*b]).emit);
        }
        assert_eq!(out, "日本");
        let end = h.push(b"ne!");
        assert_eq!((end.emit.as_str(), end.stopped), ("", true));
        assert_eq!(h.push(b"more").emit, "");
    }

    #[test]
    fn invalid_bytes_become_replacement_characters() {
        let mut h = Holdback::new(vec![]);
        assert_eq!(h.push(&[b'a', 0xff, b'b']).emit, "a\u{FFFD}b");
    }

    #[test]
    fn a_repeated_stop_prefix_releases_the_first_one() {
        let mut h = Holdback::new(vec!["<|im_end|>".to_string()]);
        let a = h.push(b"<|im");
        assert_eq!((a.emit.as_str(), a.stopped), ("", false));
        let b = h.push(b"<|im_end|>");
        assert_eq!((b.emit.as_str(), b.stopped), ("<|im", true));

        let mut one = Holdback::new(vec!["<|im_end|>".to_string()]);
        let c = one.push(b"<|im<|im_end|>x");
        assert_eq!((c.emit.as_str(), c.stopped), ("<|im", true));
    }

    #[test]
    fn a_stop_word_over_three_pieces() {
        let mut h = Holdback::new(vec!["<|im_end|>".to_string()]);
        let mut out = String::new();
        let mut stopped = false;
        for piece in ["a<|i", "m_e", "nd|>z"] {
            let p = h.push(piece.as_bytes());
            out.push_str(&p.emit);
            stopped = p.stopped;
        }
        assert_eq!((out.as_str(), stopped), ("a", true));
    }

    #[test]
    fn multibyte_text_around_a_held_prefix() {
        let mut h = Holdback::new(vec!["<|im_end|>".to_string()]);
        assert_eq!(h.push("日<|".as_bytes()).emit, "日");
        // the held prefix grows while a character's first byte waits
        assert_eq!(h.push(&[b'i', 0xe6]).emit, "");
        let end = h.push(&[0x9c, 0xac]);
        assert_eq!((end.emit.as_str(), end.stopped), ("<|i本", false));
    }

    #[test]
    fn several_stop_words_at_once() {
        let stops = || {
            vec![
                "END".to_string(),
                "<|im_end|>".to_string(),
                "\n\n".to_string(),
            ]
        };
        // the earliest one wins
        let mut h = Holdback::new(stops());
        let a = h.push(b"abc\n\nEND<|im_end|>");
        assert_eq!((a.emit.as_str(), a.stopped), ("abc", true));

        // a prefix of any of them waits ("E" may start "END", not "<|im_end|>")
        let mut h = Holdback::new(stops());
        assert_eq!(h.push(b"x<|im_E").emit, "x<|im_");
        assert_eq!(h.push(b"N").emit, "");
        let b = h.push(b"D!");
        assert_eq!((b.emit.as_str(), b.stopped), ("", true));

        // one stop's prefix is released when another one's starts after it
        let mut h = Holdback::new(stops());
        assert_eq!(h.push(b"a\n").emit, "a");
        assert_eq!(h.push(b"<|im").emit, "\n");
        let c = h.push(b"_end|>");
        assert_eq!((c.emit.as_str(), c.stopped), ("", true));
    }
}
