//! A small JSON value, parser and writer for the C ABI (the crate takes no serde).

use std::fmt::{self, Write as _};

/// How deep arrays and objects may nest: the parser recurses, and a stack overflow would abort.
const MAX_DEPTH: usize = 64;

#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    /// Keys in their order. A duplicate key is kept; `get` finds the last one.
    Obj(Vec<(String, Json)>),
}

impl Json {
    pub fn parse(text: &str) -> Result<Json, String> {
        let mut p = Parser {
            s: text.as_bytes(),
            at: 0,
        };
        let value = p.value(0)?;
        p.ws();
        if p.at != p.s.len() {
            return Err(format!("unexpected text at byte {}", p.at));
        }
        Ok(value)
    }

    pub fn object<'a>(pairs: impl IntoIterator<Item = (&'a str, Json)>) -> Json {
        Json::Obj(pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
    }

    /// An object's value for `key` (the last one if the key repeats, as `JSON.parse` keeps).
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Obj(pairs) => pairs.iter().rev().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Json::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Json::Num(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Json::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&[Json]> {
        match self {
            Json::Arr(items) => Some(items),
            _ => None,
        }
    }
}

impl From<&str> for Json {
    fn from(s: &str) -> Self {
        Json::Str(s.to_string())
    }
}

impl From<String> for Json {
    fn from(s: String) -> Self {
        Json::Str(s)
    }
}

impl From<bool> for Json {
    fn from(b: bool) -> Self {
        Json::Bool(b)
    }
}

impl From<f64> for Json {
    fn from(n: f64) -> Self {
        Json::Num(n)
    }
}

impl From<i32> for Json {
    fn from(n: i32) -> Self {
        Json::Num(f64::from(n))
    }
}

impl From<u32> for Json {
    fn from(n: u32) -> Self {
        Json::Num(f64::from(n))
    }
}

impl From<usize> for Json {
    fn from(n: usize) -> Self {
        Json::Num(n as f64)
    }
}

impl From<Vec<Json>> for Json {
    fn from(items: Vec<Json>) -> Self {
        Json::Arr(items)
    }
}

/// Compact JSON. A number that isn't finite is written as `null`.
impl fmt::Display for Json {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Json::Null => f.write_str("null"),
            Json::Bool(b) => f.write_str(if *b { "true" } else { "false" }),
            Json::Num(n) => write_number(f, *n),
            Json::Str(s) => write_string(f, s),
            Json::Arr(items) => {
                f.write_char('[')?;
                for (i, item) in items.iter().enumerate() {
                    if i > 0 {
                        f.write_char(',')?;
                    }
                    write!(f, "{item}")?;
                }
                f.write_char(']')
            }
            Json::Obj(pairs) => {
                f.write_char('{')?;
                for (i, (k, v)) in pairs.iter().enumerate() {
                    if i > 0 {
                        f.write_char(',')?;
                    }
                    write_string(f, k)?;
                    write!(f, ":{v}")?;
                }
                f.write_char('}')
            }
        }
    }
}

fn write_number(f: &mut fmt::Formatter<'_>, n: f64) -> fmt::Result {
    if !n.is_finite() {
        f.write_str("null")
    } else if n.fract() == 0.0 && n.abs() < 1e15 {
        write!(f, "{}", n as i64)
    } else {
        // Rust writes the shortest decimal that reads back the same, never with an exponent.
        write!(f, "{n}")
    }
}

fn write_string(f: &mut fmt::Formatter<'_>, s: &str) -> fmt::Result {
    f.write_char('"')?;
    for c in s.chars() {
        match c {
            '"' => f.write_str("\\\"")?,
            '\\' => f.write_str("\\\\")?,
            '\n' => f.write_str("\\n")?,
            '\r' => f.write_str("\\r")?,
            '\t' => f.write_str("\\t")?,
            c if u32::from(c) < 0x20 => write!(f, "\\u{:04x}", u32::from(c))?,
            c => f.write_char(c)?,
        }
    }
    f.write_char('"')
}

struct Parser<'a> {
    s: &'a [u8],
    at: usize,
}

impl Parser<'_> {
    fn peek(&self) -> Option<u8> {
        self.s.get(self.at).copied()
    }

    fn ws(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\t' | b'\n' | b'\r')) {
            self.at += 1;
        }
    }

    fn fail<T>(&self, what: &str) -> Result<T, String> {
        Err(format!("{what} at byte {}", self.at))
    }

    fn eat(&mut self, byte: u8) -> Result<(), String> {
        if self.peek() == Some(byte) {
            self.at += 1;
            Ok(())
        } else {
            self.fail(&format!("expected '{}'", char::from(byte)))
        }
    }

    fn literal(&mut self, word: &str, value: Json) -> Result<Json, String> {
        if self.s[self.at..].starts_with(word.as_bytes()) {
            self.at += word.len();
            Ok(value)
        } else {
            self.fail("unexpected word")
        }
    }

    fn value(&mut self, depth: usize) -> Result<Json, String> {
        if depth > MAX_DEPTH {
            return self.fail("nested too deep");
        }
        self.ws();
        match self.peek() {
            None => self.fail("unexpected end"),
            Some(b'{') => self.object(depth),
            Some(b'[') => self.array(depth),
            Some(b'"') => self.string().map(Json::Str),
            Some(b't') => self.literal("true", Json::Bool(true)),
            Some(b'f') => self.literal("false", Json::Bool(false)),
            Some(b'n') => self.literal("null", Json::Null),
            Some(b'-' | b'0'..=b'9') => self.number(),
            Some(_) => self.fail("unexpected character"),
        }
    }

    fn object(&mut self, depth: usize) -> Result<Json, String> {
        self.eat(b'{')?;
        let mut pairs = Vec::new();
        self.ws();
        if self.peek() == Some(b'}') {
            self.at += 1;
            return Ok(Json::Obj(pairs));
        }
        loop {
            self.ws();
            if self.peek() != Some(b'"') {
                return self.fail("expected a key");
            }
            let key = self.string()?;
            self.ws();
            self.eat(b':')?;
            let value = self.value(depth + 1)?;
            pairs.push((key, value));
            self.ws();
            match self.peek() {
                Some(b',') => self.at += 1,
                Some(b'}') => {
                    self.at += 1;
                    return Ok(Json::Obj(pairs));
                }
                _ => return self.fail("expected ',' or '}'"),
            }
        }
    }

    fn array(&mut self, depth: usize) -> Result<Json, String> {
        self.eat(b'[')?;
        let mut items = Vec::new();
        self.ws();
        if self.peek() == Some(b']') {
            self.at += 1;
            return Ok(Json::Arr(items));
        }
        loop {
            items.push(self.value(depth + 1)?);
            self.ws();
            match self.peek() {
                Some(b',') => self.at += 1,
                Some(b']') => {
                    self.at += 1;
                    return Ok(Json::Arr(items));
                }
                _ => return self.fail("expected ',' or ']'"),
            }
        }
    }

    fn digits(&mut self) -> usize {
        let start = self.at;
        while matches!(self.peek(), Some(b'0'..=b'9')) {
            self.at += 1;
        }
        self.at - start
    }

    fn number(&mut self) -> Result<Json, String> {
        let start = self.at;
        if self.peek() == Some(b'-') {
            self.at += 1;
        }
        match self.peek() {
            Some(b'0') => self.at += 1,
            Some(b'1'..=b'9') => {
                self.digits();
            }
            _ => return self.fail("expected a digit"),
        }
        if self.peek() == Some(b'.') {
            self.at += 1;
            if self.digits() == 0 {
                return self.fail("expected a digit");
            }
        }
        if matches!(self.peek(), Some(b'e' | b'E')) {
            self.at += 1;
            if matches!(self.peek(), Some(b'+' | b'-')) {
                self.at += 1;
            }
            if self.digits() == 0 {
                return self.fail("expected a digit");
            }
        }
        let text = std::str::from_utf8(&self.s[start..self.at]).map_err(|e| e.to_string())?;
        text.parse::<f64>()
            .map(Json::Num)
            .map_err(|e| format!("{e} at byte {start}"))
    }

    fn hex4(&mut self) -> Result<u32, String> {
        let mut n = 0;
        for _ in 0..4 {
            let digit = match self.peek() {
                Some(b) => char::from(b).to_digit(16),
                None => None,
            };
            match digit {
                Some(d) => {
                    n = n * 16 + d;
                    self.at += 1;
                }
                None => return self.fail("expected 4 hex digits"),
            }
        }
        Ok(n)
    }

    fn string(&mut self) -> Result<String, String> {
        self.eat(b'"')?;
        let mut out: Vec<u8> = Vec::new();
        loop {
            match self.peek() {
                None => return self.fail("unterminated string"),
                Some(b'"') => {
                    self.at += 1;
                    // The input is a `&str` and escapes add whole characters: always UTF-8.
                    return String::from_utf8(out).map_err(|e| e.to_string());
                }
                Some(b'\\') => {
                    self.at += 1;
                    let c = match self.peek() {
                        Some(b'"') => '"',
                        Some(b'\\') => '\\',
                        Some(b'/') => '/',
                        Some(b'b') => '\u{8}',
                        Some(b'f') => '\u{c}',
                        Some(b'n') => '\n',
                        Some(b'r') => '\r',
                        Some(b't') => '\t',
                        Some(b'u') => {
                            self.at += 1;
                            let c = self.unicode_escape()?;
                            let mut buf = [0; 4];
                            out.extend_from_slice(c.encode_utf8(&mut buf).as_bytes());
                            continue;
                        }
                        _ => return self.fail("bad escape"),
                    };
                    self.at += 1;
                    let mut buf = [0; 4];
                    out.extend_from_slice(c.encode_utf8(&mut buf).as_bytes());
                }
                Some(b) if b < 0x20 => return self.fail("control character in a string"),
                Some(b) => {
                    out.push(b);
                    self.at += 1;
                }
            }
        }
    }

    /// After `\u`: one character, from a surrogate pair if it is one. A lone surrogate is U+FFFD.
    fn unicode_escape(&mut self) -> Result<char, String> {
        let first = self.hex4()?;
        if (0xD800..0xDC00).contains(&first) && self.s[self.at..].starts_with(b"\\u") {
            let save = self.at;
            self.at += 2;
            let second = self.hex4()?;
            if (0xDC00..0xE000).contains(&second) {
                let code = 0x10000 + ((first - 0xD800) << 10) + (second - 0xDC00);
                return Ok(char::from_u32(code).unwrap_or('\u{FFFD}'));
            }
            // not a pair: the second escape is read on its own
            self.at = save;
        }
        Ok(char::from_u32(first).unwrap_or('\u{FFFD}'))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_request() {
        let v = Json::parse(
            r#" {"op":"complete","n":-12.5e1,"ok":true,"no":null,"a":[1,"x",{"k":false}]} "#,
        )
        .unwrap();
        assert_eq!(v.get("op").and_then(Json::as_str), Some("complete"));
        assert_eq!(v.get("n").and_then(Json::as_f64), Some(-125.0));
        assert_eq!(v.get("ok").and_then(Json::as_bool), Some(true));
        assert_eq!(v.get("no"), Some(&Json::Null));
        let a = v.get("a").and_then(Json::as_array).unwrap();
        assert_eq!(a.len(), 3);
        assert_eq!(a[2].get("k"), Some(&Json::Bool(false)));
        assert_eq!(v.get("missing"), None);
    }

    #[test]
    fn string_escapes_and_surrogate_pairs() {
        let v = Json::parse(r#""a\"b\\c\/d\n\t\u00e8\ud83d\ude00\u65e5""#).unwrap();
        assert_eq!(v.as_str(), Some("a\"b\\c/d\n\tè😀日"));
        // a lone surrogate is not a character
        let lone = Json::parse(r#""\ud83dx""#).unwrap();
        assert_eq!(lone.as_str(), Some("\u{FFFD}x"));
    }

    #[test]
    fn refuses_what_is_not_json() {
        for bad in [
            "",
            "{",
            "[1,]",
            "{\"a\":1,}",
            "01",
            "1.",
            "-",
            "\"\u{1}\"",
            "\"abc",
            "tru",
            "{} x",
            "{\"a\" 1}",
            "\"\\x\"",
            "nan",
        ] {
            assert!(Json::parse(bad).is_err(), "{bad:?} parsed");
        }
    }

    #[test]
    fn deep_nesting_is_refused_not_a_stack_overflow() {
        let deep = "[".repeat(100_000);
        assert!(Json::parse(&deep).is_err());
        let ok = format!("{}{}", "[".repeat(50), "]".repeat(50));
        assert!(Json::parse(&ok).is_ok());
    }

    #[test]
    fn writes_compact_json() {
        let v = Json::object([
            ("text", Json::from("a\"\n\u{1}日")),
            ("n", Json::from(3_i32)),
            ("ms", Json::from(1.5)),
            ("bad", Json::from(f64::NAN)),
            ("flag", Json::from(false)),
            ("list", Json::Arr(vec![Json::Null, Json::from(-2_i32)])),
        ]);
        assert_eq!(
            v.to_string(),
            r#"{"text":"a\"\n\u0001日","n":3,"ms":1.5,"bad":null,"flag":false,"list":[null,-2]}"#
        );
    }

    #[test]
    fn round_trips() {
        let text = r#"{"a":[1,2.25,"\\\"",{"b":null}],"c":"日本"}"#;
        assert_eq!(Json::parse(text).unwrap().to_string(), text);
    }

    #[test]
    fn the_last_duplicate_key_wins_as_in_javascript() {
        let v = Json::parse(r#"{"a":1,"a":2}"#).unwrap();
        assert_eq!(v.get("a").and_then(Json::as_f64), Some(2.0));
    }
}
