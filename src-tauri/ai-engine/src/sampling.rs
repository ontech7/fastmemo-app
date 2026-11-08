//! The order of the sampler chain, as llama.cpp's own default chain applies it.

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::time::{SystemTime, UNIX_EPOCH};

/// How many of the latest tokens the repetition and presence penalties look at.
const PENALTY_LAST_N: i32 = 64;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SamplingParams {
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: i32,
    pub min_p: f32,
    pub penalty_repeat: f32,
    pub penalty_present: f32,
    /// `None` is a random seed, picked each time `steps` is called.
    pub seed: Option<u32>,
}

/// One link of the sampler chain.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Step {
    Penalties {
        last_n: i32,
        repeat: f32,
        present: f32,
    },
    TopK(i32),
    TopP(f32),
    MinP(f32),
    Temp(f32),
    Dist(u32),
}

/// The chain, in order: penalties, top-k, top-p, min-p, temperature, then the pick.
///
/// The grammar is not a step: it is applied to the candidates before the chain, and the picked
/// token is accepted by both the grammar and the chain.
pub fn steps(p: &SamplingParams) -> Vec<Step> {
    vec![
        Step::Penalties {
            last_n: PENALTY_LAST_N,
            repeat: p.penalty_repeat,
            present: p.penalty_present,
        },
        Step::TopK(p.top_k),
        Step::TopP(p.top_p),
        Step::MinP(p.min_p),
        Step::Temp(p.temperature),
        Step::Dist(p.seed.unwrap_or_else(random_seed)),
    ]
}

/// A seed from the process's random hasher keys and the clock (no random-number crate needed).
fn random_seed() -> u32 {
    let mut hasher = RandomState::new().build_hasher();
    if let Ok(since_epoch) = SystemTime::now().duration_since(UNIX_EPOCH) {
        hasher.write_u128(since_epoch.as_nanos());
    }
    let h = hasher.finish();
    (h ^ (h >> 32)) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    const FAITHFUL: SamplingParams = SamplingParams {
        temperature: 0.2,
        top_p: 0.8,
        top_k: 20,
        min_p: 0.0,
        penalty_repeat: 1.0,
        penalty_present: 0.0,
        seed: Some(42),
    };

    #[test]
    fn steps_in_llama_cpp_order() {
        assert_eq!(
            steps(&FAITHFUL),
            vec![
                Step::Penalties {
                    last_n: 64,
                    repeat: 1.0,
                    present: 0.0
                },
                Step::TopK(20),
                Step::TopP(0.8),
                Step::MinP(0.0),
                Step::Temp(0.2),
                Step::Dist(42),
            ]
        );
    }

    #[test]
    fn no_seed_is_a_new_random_one_each_time() {
        let random = SamplingParams {
            seed: None,
            ..FAITHFUL
        };
        let seeds: Vec<u32> = (0..3)
            .map(|_| match steps(&random).last() {
                Some(Step::Dist(seed)) => *seed,
                other => panic!("the chain ends with {other:?}"),
            })
            .collect();
        assert!(
            seeds.windows(2).any(|w| w[0] != w[1]),
            "the same seed three times: {seeds:?}"
        );
        assert!(seeds.iter().any(|&s| s != 0));
    }
}
