# On-Device AI Upgrade: Qwen 2.5 → Qwen 3.5 + AI Feature Rework

> **Audience:** the agent implementing this upgrade (Claude Code). Read the whole document before touching code, then read
> `CLAUDE.md`, `.claude/knowledge/CONVENTIONS.md`, `.claude/knowledge/LESSONS_LEARNED.md` and load the `redux-toolkit` and
> `vercel-react-native-skills` skills (plus `frontend-design` for any UI work).
>
> **Status:** proposal, not started. Written 2026-10-19 against `dev` @ `32f6c3a`.
>
> **Scope:** model catalog swap, legacy model cleanup, runtime/inference fixes, and a product-level rework of the AI features
> so they feel fast and worth using. Gemma 4 and other model families are explicitly **out of scope**.

---

## 1. Why

The local AI exists (ADR-004) but nobody is excited about it: it is **slow** and **does nothing exceptional**. The one feature
that clearly earns its place is **voice dictation + AI cleanup** (`clean_transcript`). Everything else (title, category,
summary, grammar, shorten, translate, suggest items, explain code, add comments, help search) works but is forgettable.

Two levers fix this:

1. **Better models per byte.** Qwen 2.5 (late 2024) is two generations old. Qwen 3.5 Small (released 2026-03-02, Apache-2.0)
   is much stronger at the same size and covers 201 languages, which matters for the app's 7 locales (incl. ja/zh).
2. **Better runtime + UX.** Most of the "slow" feeling is self-inflicted: cold model load on first tap, no streaming in the UI,
   sampling settings that fight the task. These are fixable regardless of the model.

The model swap alone is not enough. Phase 2 and 3 (speed UX and voice-first features) are where the perceived value comes
from.

---

## 2. Current state (what exists today)

| Area | Location | Notes |
| --- | --- | --- |
| Model catalog | `src/libs/ai/constants.ts` (`AI_MODELS`, `DEFAULT_MODEL_ID`, `MODEL_SIZE_ORDER`, `MODEL_SHORT_LABEL`) | 4 Qwen2.5 Instruct Q4_K_M: 0.5B / 1.5B / 3B / 7B (7B split into 2 files via `parts`). URLs point to `resolve/main` (unpinned). |
| Model id type | `src/libs/ai/types.ts` (`AIModelId`) **and** `src/types/settings.ts` (`AIAssistantSettings.selectedModel`, duplicated literal union) | Both must change together. |
| Settings defaults | `src/slicers/settingsSlice.ts` (`DEFAULT_AI_ASSISTANT`, initial state) | `selectedModel: "qwen-0.5b"`. Persisted in AsyncStorage (`root_settings`). |
| Runtime | `src/libs/ai/context.ts` | Singleton `LlamaContext`. `initLlama({ n_ctx, n_gpu_layers: 99, use_mlock: true })`. No `jinja`, no `enable_thinking`. Sampling: `temperature 0.05–0.15`, `top_p 0.9`, `penalty_repeat 1.2` for **every** action. |
| Download/delete | `src/libs/ai/context.ts` (`downloadModel`, `deleteModel`, `cancelDownload`) | `downloadModel` deletes the files of **other catalog models** before downloading. Files not in the catalog are never touched → once Qwen2.5 leaves the catalog its files become invisible orphans. |
| Web stubs | `src/libs/ai/index.web.ts` | Must keep the same export surface. |
| Settings screen | `app/settings/ai-assistant.tsx` | Model cards gated by `Device.totalMemory >= minRamBytes`. Download / cancel / delete for the selected model only. |
| Editor actions | `src/components/ai/AIEditorActions.tsx` | Per note-type action lists, gating via `minModelId` + `isModelSufficient`. `initContext()` is fired on tap (cold load happens while the user waits). `generateEditorContent` is called **without** `onToken`: no streaming in the UI. Results are staged as before/after preview. |
| Voice | `src/components/buttons/VoiceRecognitionButton.tsx` | `handleConfirmWithAI` → `initContext` → `generateEditorContent("clean_transcript")`. Model load starts only after the user taps "AI". `aiCleanup` is only passed in `NoteTextEditor.tsx`; the todo editor uses `voiceTextToLines` with no AI. |
| Help search | `app/settings/help.tsx` → `searchHelpByIntent` | GBNF-constrained int array. Works fine, low priority. |
| i18n | `src/libs/i18n/locales/*.ts` → `ai.model_light/powerful/advanced/pro`, `ai.model_unavailable`, `ai.editor.*` | 7 locales. |
| Unused setting | `aiAssistant.voiceOnly` (+ `ai.voice_only*` strings) | Persisted but not read anywhere. **Leave it alone** (store structure rule, see §9). |

`llama.rn` is pinned at `0.12.0-rc.8`. Its bundled llama.cpp already includes `LLM_ARCH_QWEN35` and `LLM_ARCH_QWEN35MOE`
(`node_modules/llama.rn/cpp/llama-arch.h`) and exposes `jinja`, `enable_thinking`, `reasoning_format`, `top_k`, `min_p`,
`penalty_present`, `thinking_budget_tokens`, `bench()`, `getFormattedChat()`, `getBackendDevicesInfo()`. **No dependency
upgrade is required.** (`0.13.0-rc.x` exists; do not upgrade without explicit developer approval — NEVER rule #1.)

---

## 3. Target model catalog

Qwen does not publish official GGUFs for 3.5 (Qwen 2.5 came from `Qwen/*-GGUF`). Use **Unsloth** GGUFs, **pinned to a
commit SHA** instead of `main`, so a repo update can never silently change what users download.

| New id | Model | File (Q4_K_M) | Exact bytes | Size label | Repo @ pinned revision |
| --- | --- | --- | --- | --- | --- |
| `qwen3.5-0.8b` | Qwen3.5 0.8B | `Qwen3.5-0.8B-Q4_K_M.gguf` | 532,517,120 | ~530 MB | `unsloth/Qwen3.5-0.8B-GGUF` @ `6ab461498e2023f6e3c1baea90a8f0fe38ab64d0` |
| `qwen3.5-2b` | Qwen3.5 2B | `Qwen3.5-2B-Q4_K_M.gguf` | 1,280,835,840 | ~1.3 GB | `unsloth/Qwen3.5-2B-GGUF` @ `f6d5376be1edb4d416d56da11e5397a961aca8ae` |
| `qwen3.5-4b` | Qwen3.5 4B | `Qwen3.5-4B-Q4_K_M.gguf` | 2,740,937,888 | ~2.7 GB | `unsloth/Qwen3.5-4B-GGUF` @ `e87f176479d0855a907a41277aca2f8ee7a09523` |

**The catalog goes from 4 tiers to 3. There is no 9B.** Why:

- **The 7B tier had one exclusive job, and it is gone.** The only actions gated to 7B were `explain_code` and
  `add_comments`, and those are being removed (§7.4). Every remaining action is gated at 1.5B or 3B today.
- **The 4B covers the old 7B.** In the Qwen3 technical report, Qwen3-4B-Base already matched Qwen2.5-7B-Base: slightly
  behind on MMLU (72.99 vs 74.16), ahead on GSM8K and MATH. The Qwen3.5 model card shows Qwen3.5 small models improving
  further on Qwen3 at the same size. For short note tasks (title, category, grammar, summary, translation), the 4B is
  expected to equal or beat the old 7B. The eval (§8) confirms this before shipping.
- **The 9B costs too much on a phone.** The Q4_K_M file is 5.68 GB, it needs a 12 GB class phone, prefill and generation are
  roughly 2× slower than the 4B, and it would serve a very small share of users.

If the eval shows the 4B is clearly not enough for something important, the 9B can be added back later as an extra tier:
`unsloth/Qwen3.5-9B-GGUF` @ `3885219b6810b007914f3a7950a8d1b469d598a5`, `Qwen3.5-9B-Q4_K_M.gguf`, 5,680,522,464 bytes, RAM
gate of a 12 GB class device, `useMlock: false`.

URL pattern: `https://huggingface.co/<repo>/resolve/<sha>/<file>`.

SHA-256 of each file (from the HF LFS metadata, for reference / future integrity check):

```
Qwen3.5-0.8B-Q4_K_M.gguf  bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517
Qwen3.5-2B-Q4_K_M.gguf    aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223
Qwen3.5-4B-Q4_K_M.gguf    00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4
```

Re-check these values against the Hugging Face API before shipping
(`https://huggingface.co/api/models/unsloth/Qwen3.5-2B-GGUF/tree/main`).

Notes:

- **All three are single files.** The `parts` mechanism is no longer needed by any model. Keep the `parts?` field in
  `AIModelInfo` and the multi-file loop (cheap, future-proof); just don't use it.
- **Text-only.** Qwen3.5 Small is natively multimodal, but the `mmproj-*.gguf` vision projector is a separate file. Do **not**
  download it. Vision (e.g. OCR of images) is a possible future feature, not part of this work.
- **Model IDs** use the `qwen3.5-*` prefix so they can never collide with the legacy `qwen-*` ids. This makes legacy detection
  trivial (§5).
- **Integrity.** `expo-file-system/legacy` can't compute SHA-256. Do at least an **exact byte-size check** after download
  (`getInfoAsync(path).size === expectedBytes`). Store the expected bytes in the catalog (`sizeBytes`). On a mismatch, delete
  the file and report a download error. This also catches truncated downloads, which today pass as "downloaded".

### Tiers, RAM gates and context

| Tier | Replaces | `minRamBytes` (proposal) | `contextSize` (proposal) | i18n description key |
| --- | --- | --- | --- | --- |
| 0.8B | 0.5B | 3 GB | 4096 | `ai.model_light` |
| 2B | 1.5B | 4 GB | 8192 | `ai.model_powerful` |
| 4B | 3B **and** 7B | 6 GB | 8192 | `ai.model_advanced` |

- The `ai.model_pro` key is no longer used by the catalog. Remove it from all 7 locales together with the code actions'
  strings (§7.4).
- **Verify the RAM math on a real device.** `Device.totalMemory` on Android reports usable RAM, which is lower than the
  marketing figure (an "8 GB" phone typically reports ~7.2–7.6 GB). With the current `8 * GB` gate, the top tier may already
  be wrongly disabled on 8 GB phones. Log `Device.totalMemory` on a few devices and set gates with a margin (e.g. "12 GB
  class" → `11 * GB`). Same check for the other tiers.
- Qwen3.5 is a hybrid architecture: 3 of every 4 layers are Gated DeltaNet (fixed-size state), and only 1 in 4 is full
  attention. The KV cache is therefore ~4× smaller than in a classic transformer of the same size, so larger contexts are
  cheap in memory. Prefill **time** is still the main latency on long notes, so keep the per-action input caps (§6.4).
- Update the descriptions in all 7 locales so they reflect the new RAM requirements. Keep the keys, change the text (e.g.
  `ai.model_advanced`: "Best quality. 6GB+ RAM required.").

### Default model

`DEFAULT_MODEL_ID` becomes `qwen3.5-0.8b` (it's the safe fallback everywhere `|| DEFAULT_MODEL_ID` is used). In the settings
screen, **recommend** a tier based on device RAM (highlight "Recommended" on the 2B card when RAM ≥ 6 GB, else 0.8B). The
2B is likely the sweet spot for this app's tasks, but the eval (§8) decides.

---

## 4. Critical runtime changes (do these or the new models will break)

### 4.1 Disable thinking — mandatory

According to the official model cards, **Qwen3.5-0.8B and 2B default to non-thinking mode, but 4B (and 9B) default to
thinking mode**: they start generating `<think>\n…`. With `n_predict: 30` for titles and categories, a thinking block burns
the whole budget and the output parser returns garbage or nothing.

Today `context.ts` calls `completion({ messages, … })` **without `jinja`**. In llama.rn, `enable_thinking` only applies when
`jinja: true`. Required change for **every** `completion` call (editor actions and help search):

```ts
jinja: true,
enable_thinking: false,
reasoning_format: "none", // verify: keeps any stray reasoning visible to our own stripper below
```

Defense in depth: before any post-processing, strip a leading `<think>…</think>` block from `result.text` (and from
streamed tokens, see §6.2). Verify on device with `context.getFormattedChat(messages, null, { jinja: true, enable_thinking:
false })`: the formatted prompt must end with the empty-think prefill used by the Qwen3.5 template.

### 4.2 Sampling: stop fighting the task

`penalty_repeat: 1.2` is applied to every action. For copy-heavy tasks (`fix_grammar`, `clean_transcript`, `translate`,
`shorten`) the correct output **repeats most of the input**, so the penalty pushes the model to change words
it should keep. This hurts the flagship voice feature most. Replace the one-size-fits-all sampling with a per-action table
in `constants.ts`:

| Action group | Actions | temperature | top_p | top_k | min_p | penalty_repeat | penalty_present |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Faithful transform | `clean_transcript`, `fix_grammar`, `translate`, `shorten` | 0.2 | 0.8 | 20 | 0 | 1.0 | 0 |
| Short label | `generate_title`, `suggest_category` | 0.2 | 0.8 | 20 | 0 | 1.0 | 0 |
| Generative | `summarize`, `suggest_items` | 0.7 | 0.8 | 20 | 0 | 1.0 | 1.0–1.5 |
| Constrained pick | help search | 0.1 | 0.8 | 20 | 0 | 1.0 | 0 |

Qwen's recommended non-thinking settings are `temperature 0.7, top_p 0.8, top_k 20, presence_penalty 1.5` for general use
and `temperature 1.0, top_p 1.0, top_k 20, presence_penalty 2.0` for open-ended text. Those target open-ended chat, which is
why the transform rows above are much colder. Treat the table as **starting points** and tune with the eval harness (§8).
The llama.rn param names are `penalty_present`, `penalty_repeat`, `top_k`, `min_p`.

### 4.3 Stop words and output cleanup

`<|im_end|>` (ChatML) is already in `STOP_WORDS`. With `jinja: true`, llama.rn also stops on the template's EOS. Keep the
list as is. Keep the multilingual prefix-stripping regex but run it **after** the think-block stripper.

### 4.4 `use_mlock` and GPU offload

- `use_mlock: true` with the 4B (2.7 GB pinned) can fail or trigger the OOM killer on borderline 6 GB devices. Make it
  per-model (`useMlock?: boolean` in the catalog) and decide the 4B value from the device test.
- `n_gpu_layers: 99` assumes the GPU backend handles every op. The Gated DeltaNet ops are newer than the classic attention
  path, and Android GPU backends (OpenCL/Vulkan) may run them slower or fall back to CPU. On at least one mid-range and one
  flagship Android device, measure `n_gpu_layers: 99` against `0` with `context.bench()`. Also call
  `getBackendDevicesInfo()` to see which backend is active. Pick the faster setting per device class. If CPU wins, set
  `n_threads` explicitly (performance cores only, typically 4).

---

## 5. Migration and legacy model cleanup

Hard rule from the developer: after this update the **old Qwen 2.5 models are discontinued**. They leave the catalog and
the app deletes them. The user must get a **clear option to remove the old downloaded files** (empty the old models out of
the models folder), because they are now dead weight (0.4–4.7 GB).

### 5.1 Persisted settings (`aiAssistant.selectedModel`)

Existing users have `selectedModel ∈ {"qwen-0.5b","qwen-1.5b","qwen-3b","qwen-7b"}` in AsyncStorage. NEVER rule #10: this
must keep working after the update.

- Add a **pure** mapping in `src/libs/ai/constants.ts`:
  ```ts
  export const LEGACY_MODEL_MAP: Record<string, AIModelId> = {
    "qwen-0.5b": "qwen3.5-0.8b",
    "qwen-1.5b": "qwen3.5-2b",
    "qwen-3b": "qwen3.5-4b",
    "qwen-7b": "qwen3.5-4b", // no 9B tier; the 4B covers the old 7B (§3)
  };
  export function normalizeModelId(id: string | undefined): AIModelId { /* catalog id → itself, legacy → mapped, else DEFAULT_MODEL_ID */ }
  ```
- **Do not** add a redux-persist `version`/`migrate` to `root_settings` and do not change the slice shape (NEVER rule #2,
  ADR-003, LL-003/LL-022). The field keeps its name and type (`string` union, updated to the new ids). Normalise on **read**
  (`selectorAIAssistant` returns `selectedModel: normalizeModelId(...)`; the selector stays pure, no `Platform.OS`). Fix the
  state on **write** with a one-time `setAIAssistant` dispatch from the AI settings screen / app startup when the stored id
  is legacy.
- Every place that does `aiSettings.selectedModel as AIModelId` (`AIEditorActions.tsx`, `VoiceRecognitionButton.tsx`,
  `context.ts` ×2) must go through the normalised value. A legacy id must never reach `AI_MODELS[...]` (it would be
  `undefined` and crash `getModel`).
- A user who had a legacy model has `modelDownloaded: true` but **no** file for the mapped new model. On startup or when the
  settings screen opens, `isModelDownloaded(newId)` returns false. Set `modelDownloaded: false` and keep `enabled` as the user
  left it, so the feature comes back automatically after the download. Gate all AI entry points on
  `enabled && modelDownloaded` (already true for voice via `aiAvailable`; check `AIEditorActions` and the help screen).

### 5.2 Legacy file cleanup — user-facing option

Model files live in `${FileSystem.documentDirectory}models/`.

1. Add `getOrphanedModelFiles(): Promise<{ fileName: string; size: number }[]>` in `context.ts`. It reads the `models/`
   directory and returns every entry that is **not** a file of a model in the current `AI_MODELS` catalog. This covers the
   legacy `qwen2.5-*.gguf` files, the 7B's two parts, and leftover partial downloads. Do not hardcode a list of legacy
   filenames: anything outside the catalog is garbage by definition.
2. Add `deleteOrphanedModelFiles(): Promise<number>` (returns bytes freed). Call `releaseContext()` first.
3. Add a web stub for both in `index.web.ts` (return `[]` / `0`).
4. **Settings UI** (`app/settings/ai-assistant.tsx`): when orphaned files exist, show a card at the top:
   *"Old AI models found (X GB). They are no longer used by FastMemo."* → button *"Delete old models"* → confirmation via
   `@ontech7/react-native-dialog` (**never `Alert.alert`**). After deletion, show a toast with the freed space. All new strings
   go into all 7 locales.
5. **Automatic deletion.** The developer said old models "will be deleted by the app". Two steps:
   - **On download**: when the user downloads a new model, `downloadModel` already deletes other catalog models. Extend it
     to also delete orphaned files, so the old ones never sit next to the new one. That download replaces the old model, so
     no extra confirmation is needed.
   - **Upgrade prompt**: for users who had a legacy model, show a one-time prompt in AI settings (and optionally a small
     badge on the AI settings row): *"New AI models are available — faster and smarter. Download Qwen3.5 2B (1.3 GB)?"*. The
     download deletes the old files. **Never** auto-start a multi-GB download without consent.
   - **Decision for the developer**: should the app also auto-delete orphans silently on the first launch after the update,
     without asking? It is safe (the files are unusable), but it happens without the user knowing. The recommendation: keep
     the explicit button plus delete-on-download, and do not delete silently.
6. `cancelDownload` currently deletes catalog files < 1 MB. Make it use the same orphan logic plus the in-progress file.

---

## 6. Making the AI feel fast (the real UX problem)

### 6.1 Pre-warm the model

Model load (mmap + mlock + GPU upload) takes seconds, and today it always happens **after** the user taps an action.

- **Voice:** when the dictation sheet opens and `aiAvailable` is true, call `initContext(modelId)` immediately and don't
  await it. The user talks for 5–30 s, so the model is ready before they tap "AI". This alone should remove most of the
  perceived wait on the flagship feature.
- **Editor menu:** start `initContext` when the AI menu **opens** (`toggleMenu`), not on action tap.
- **Release policy:** keep the context alive with an idle timer (e.g. release after 3 min of no AI use). Also release on
  `AppState` → `background`. This frees RAM for the 4B without paying the load cost on every tap. All of it lives in
  `context.ts`.

### 6.2 Stream tokens into the UI

`generateEditorContent` already supports `onToken`, but no caller passes it.

- Dictation sheet: stream the cleaned text into the transcript area, so the user sees words appearing instead of a spinner.
- Before/after preview (`AIEditorActions`): open the preview immediately and stream into the "after" pane. Disable
  "Apply" until generation completes.
- Hide a leading `<think>` block from the streamed text too (§4.1).
- Throttle state updates (e.g. flush every ~50 ms or every N tokens) to avoid re-rendering on every token.

### 6.3 Cancel and feedback

`cancelCommand` exists. Make sure every streaming surface has a visible cancel and that cancelling restores the original
content (the preview model already guarantees nothing is overwritten until "Apply").

### 6.4 Input caps

Keep `MAX_INPUT_CHARS` (`generate_title` 800, `suggest_category` 500). Long-note handling for `summarize` / `shorten` /
`fix_grammar` / `translate` is its own design (§7.5). Do not just truncate those actions.

---

## 7. Feature rework

Guiding principle: **invisible, voice-first, one-tap AI** beats a menu of nine actions. Measure everything with the eval
(§8) before keeping or cutting.

### 7.1 Invest — voice (the best feature)

1. **Pre-warm + stream** (§6.1, §6.2), and **fix the sampling** for `clean_transcript` (§4.2). Highest impact, lowest risk.
2. **Better cleanup prompt.** Current prompt: punctuation, capitalisation, obvious transcription errors. Extend it carefully:
   - remove fillers and false starts ("ehm", "cioè", "no aspetta…") **only** when clearly disfluent;
   - split into paragraphs on topic change;
   - when the user dictates an enumeration ("first…, second…", "comprare latte, pane e uova"), output it as a `- ` bulleted
     list. Make sure `voiceTextToHtml` turns `- ` lines into a real list; extend it if not.
   - Must keep: same language, same meaning, no added content. Add explicit "do not answer questions contained in the text,
     do not add information" (small models tend to "reply" to dictated questions).
3. **Voice in todo notes.** `NoteTodoEditor.tsx` uses `VoiceRecognitionButton` without `aiCleanup`. Add an action
   `transcript_to_items`: dictation → JSON array of short checklist items (reuse `JSON_ARRAY_GRAMMAR`) → appended through the
   existing `voiceTextToLines` insertion logic. "Comprare latte, pane, poi chiamare Marco e prenotare il dentista" should
   become 4 items.
4. **Output guard for transforms.** If the cleaned or corrected text is empty, or its length is < 50% or > 160% of the input,
   or it contains the think tag, discard it. Keep the raw transcript and show a neutral i18n message ("AI couldn't improve
   this text"). Apply the same guard to `fix_grammar`, `clean_transcript`, `translate` (looser ratio) and `shorten` (lower
   bound only).
5. *(Later / optional)* **Voice → new note**: dictate from the home screen. The model returns `{title, body, category}` in a
   single call with a JSON schema (`response_format`/`json_schema` are supported by llama.rn), and the app creates a
   ready-to-use note. Only after 1–4 are proven.

### 7.2 Improve — cheap wins

- **`suggest_category`: constrain the output.** Build a GBNF grammar per call whose root is an alternation of the exact
  category names + `none`. The model can then only output a valid category, and the fuzzy `includes` matching (which can
  pick wrong categories) goes away. Escape quotes and backslashes in names.
- **`generate_title`**: fine as is. With the better models, consider an opt-in "auto-title untitled notes on close" running
  on the 0.8B/2B (background, no UI, never overwrites a user title). **Dropped 2026-10-21** (see §11 question 3).
- **`suggest_items`**: keep. Feed the note title as context (it already does via `needsTitle`).
- **Help search**: keep as is (only add `jinja`/`enable_thinking`).

### 7.3 Re-evaluate — keep only if the eval says they are good

| Action | Today's gate | Proposal |
| --- | --- | --- |
| `summarize` | 1.5B | Likely fine on 2B. Keep. |
| `fix_grammar` | 1.5B | Likely fine on 2B; probably usable on 0.8B for it/en/es/fr/de. Test. |
| `shorten` | 1.5B | Overlaps with `summarize`. Candidate to **merge or drop**. Decision for the developer. |
| `translate` | 3B | Qwen3.5 is much stronger multilingually. Test on 2B; lower the gate if quality holds. |

The gating uses `MODEL_SIZE_ORDER` / `MODEL_SHORT_LABEL` / `minModelId` in `AIEditorActions.tsx`: update the ids there.

### 7.4 Remove — code actions (developer decision)

Code notes are used to **store snippets**, not to program. `explain_code` and `add_comments` add weight and are the only
reason the top tier existed. Remove them completely:

- `src/libs/ai/types.ts`: drop `"explain_code"` and `"add_comments"` from `EditorAction`.
- `src/libs/ai/constants.ts`: drop their `EDITOR_SYSTEM_PROMPTS` entries. Update the "optimized for small models" comment.
- `src/libs/ai/context.ts`: drop their `nPredict` / `temperature` branches and the `add_comments` code-fence stripping and
  `explain_code` early return in `generateEditorContent`.
- `src/components/ai/AIEditorActions.tsx`: `CODE_ACTIONS` becomes `generate_title` + `suggest_category` only. Remove the
  `onCodeCommented` prop and its `switch` cases. Remove the `outputText` state, its overlay and its styles: they exist only
  for `explain_code`. Clean the `needsTitle` condition. Remove now-unused icon imports.
- `src/components/notes/NoteCodeEditor.tsx`: remove the `onCodeCommented` handler (~line 315).
- i18n: remove `ai.editor.explain_code`, `ai.editor.add_comments` and any related keys in all 7 locales.
- No persisted data is involved (actions are not stored), so this is not a breaking change.

### 7.5 Long notes: `summarize`, `shorten`, `fix_grammar`, `translate`

These are the most useful actions after voice, but today they break down on long notes in three ways:

1. **Slow.** The whole note is prefilled in one go. On a phone, prefill runs at roughly tens to low hundreds of tokens per
   second depending on model and device (measure it, §8). A 2,000-word note is ~3,000 tokens, so it can take tens of seconds
   before the first word appears, with only a spinner on screen.
2. **They overflow the context.** `n_ctx` is 2048–8192 and input + output must both fit.
3. **They destroy the note.** Rich-text content goes through `stripHtml`, and the result is written back with
   `setContentHTML` (`NoteTextEditor.tsx` ~line 346 and ~354). Headings, lists, bold and checklists are flattened into plain
   paragraphs. `summarize` **replaces the whole note** with the summary, so the original is gone once the user taps Apply.

Proposed design: work **per block**, not per note.

- **Split by structure.** Parse the note HTML into its top-level blocks (`p`, `h1–h6`, `li`, `blockquote`; reuse or extend
  the helpers in `src/utils/html.ts`). Group consecutive small blocks into chunks of ~800–1,200 tokens (use
  `context.tokenize` for an accurate count). Never split inside a block.
- **Local actions (`fix_grammar`, `shorten`, `translate`) run chunk by chunk.** Each chunk is processed independently and
  written back **into its own block(s)**, so the note structure survives. Rewriting one paragraph at a time is the natural
  unit for these tasks anyway. Inline formatting inside a rewritten paragraph is lost; block structure is kept. This is a
  big improvement over today.
- **`summarize` is global: map → reduce.** Summarise each chunk into 1–2 sentences, then (only if there are several chunks)
  make one final short call that merges the partial summaries. Total time is similar to today, but the first output arrives
  after the first chunk, and the context limit stops mattering.
- **`summarize` must not replace the note.** Insert the summary as a block **at the top** of the note (e.g. a short
  paragraph headed by a localised "Summary" label), keeping the original below it. The other option is to show it read-only
  with a "Copy" button. **Decision for the developer**; recommendation: insert at top.
- **Progressive UX.** The preview fills chunk by chunk with streaming, and a progress label ("Part 2 of 5") shows where it
  is. Apply is enabled at the end, and Cancel keeps whatever was not applied untouched. The user sees continuous progress
  instead of a long freeze.
- **Hard ceiling.** Above a maximum length (e.g. ~6,000 words on 0.8B/2B, ~10,000 on 4B; tune with the eval), disable the
  action with a clear message instead of making the user wait minutes.
- **Selection first (if feasible).** If the rich text editor can return the current selection, apply `shorten`, `fix_grammar`
  and `translate` to the selection only. That is the fastest path and the most common real-world need. Check the editor API
  before committing to it.
- **Same-note cache.** Keep the last result in memory, keyed by a hash of the chunk text and the action. Re-running after a
  cancel, or on unchanged paragraphs, is then instant. Memory only: nothing persisted, nothing synced (NEVER rules #10/#11).

Todo and kanban notes do not use these actions; no change there.

**As built (2026-10-21, branch `feat/ai-long-notes`):** `libs/ai/blocks.ts` splits the HTML into lines (a `<br>` or an image
inside a block ends a line too: dictation and pasted text join lines with `<br>`), and `libs/ai/longNote.ts` runs one completion
per line rather than per group of lines (nothing to map back; ~0.5 s overhead per line on the 2B). A paragraph over 600 tokens
goes a few sentences at a time. The summary reads parts of 1,500 tokens (one call for most notes) and goes on top under a label
marked `data-fm="summary"`. The ceiling is a time estimate (5 minutes) from the speed measured on the device, not a word count.
Selection-first is not done: pell's public API has no call that returns the selected text (it would take injected JavaScript
and a message back), so it is its own piece of work.

### 7.6 Do not do (now)

- No thinking mode for any action (too slow on phones for what it buys here).
- No vision/mmproj.
- No cloud fallback (contradicts ADR-004).
- No dependency changes without approval.

---

## 8. Evaluation harness (do this first)

Without numbers, "is it faster/better?" is a vibe. Build a small **dev-only** screen, visible only with
`developerMode.enabled` (follow existing patterns for developer-mode-only UI):

- A fixed set of inputs per action × language (en, it at minimum; plus one of ja/zh). Example: 3 dictated transcripts with
  fillers, 3 texts with grammar mistakes, 2 notes to summarise, 2 todo seeds, 2 code snippets, 1 category set + 4 notes.
  Keep the fixtures in a dev-only module (not shipped strings; do not run them through i18n).
- For each run, record: model id, load time, prefill ms, tokens/s (from the `completion` result `timings`), and the output.
- "Run all" button + copy-results-to-clipboard (JSON) so results can be pasted into the PR.
- Run it with the **current Qwen2.5 build first** (baseline), then with Qwen3.5. Do it on at least one mid-range (6–8 GB)
  and one high-end (12 GB+) Android device, and on desktop if relevant.

Acceptance criteria to ship:

- `clean_transcript` on the 2B: output ready ≤ 1 s after tapping "AI" (thanks to pre-warm), with first streamed token
  visible immediately. Quality equal or better than the baseline 3B.
- No action returns a `<think>` block on any tier.
- `suggest_category` returns only valid categories or `none` (enforced by the grammar).
- 4B ≥ baseline 7B on every remaining action (otherwise reconsider the 9B, §3).
- `summarize` / `fix_grammar` on a long formatted note (headings + lists, ~2,000 words): first output visible within a few
  seconds, block structure preserved after Apply, original note kept when summarising.
- Legacy user path verified: install the current release, download a Qwen2.5 model, update to the new build → settings
  show the upgrade prompt + "Delete old models (X GB)", no crash anywhere, AI resumes after downloading the new model.

---

## 9. Constraints checklist (from CLAUDE.md, applied to this work)

- No new dependencies (llama.rn 0.12.0-rc.8 is enough).
- No change to the persisted store structure. `aiAssistant` keeps its shape. Legacy ids are normalised on read and fixed
  on write (§5.1). Leave `voiceOnly` untouched.
- No `Platform.OS` in selectors/reducers. `normalizeModelId` is pure.
- No side effects in reducers. File deletion/download lives in `context.ts` and is called from components or thunks.
- Never `Alert.alert`. Use `@ontech7/react-native-dialog`.
- All new UI strings via `t()` in **all 7 locales**.
- `@/` imports, `interface Props`, `StyleSheet.create` at the bottom, `COLOR`/`FONTSIZE`/... tokens. Follow the
  `frontend-design` skill for the legacy-cleanup card and the upgrade prompt.
- Keep `index.web.ts` in sync with every new export from `context.ts`.
- Test native (Android) and web (web must still show the "not available" state and not crash on the new exports).

---

## 10. Implementation phases

Each phase should be a reviewable PR into `dev`.

1. **Eval harness + baseline** (§8) on the current Qwen2.5 build.
2. **Model swap + runtime fixes**: catalog (§3), `jinja`/`enable_thinking: false` + think stripper (§4.1), per-action sampling
   (§4.2), per-model mlock and GPU decision (§4.4), size verification, RAM gates, locale descriptions.
3. **Migration + legacy cleanup**: `normalizeModelId`, startup/settings fix-up, orphan scan/delete, cleanup card, upgrade
   prompt, delete-on-download (§5).
4. **Speed UX**: pre-warm, idle/background release, streaming in the dictation sheet and preview (§6).
5. **Voice features**: improved cleanup prompt + bullet lists, `transcript_to_items` for todo, output guards (§7.1).
6. **Remove code actions** (§7.4). Small and independent; can land any time, even first.
7. **Long notes**: block-based chunking, map-reduce summary inserted at top, progressive preview, ceilings (§7.5).
8. **Action re-evaluation**: grammar-constrained `suggest_category`, gate changes, merge or drop decisions (§7.2–7.3).
9. **Knowledge sync**: update ADR-004 in `DECISIONS.md` (Qwen 3.5, Unsloth pinned GGUFs, thinking disabled, rationale), the
   AI section in `ARCHITECTURE.md`, `CLAUDE.md` tech stack line ("Qwen 2.5 GGUF" → "Qwen 3.5 GGUF"), `CONVENTIONS.md` if new
   rules emerge (e.g. "always pass `jinja: true, enable_thinking: false` to llama.rn completions"), and an `LL-NNN` entry if
   anything breaks along the way. Changelogs via the `release` skill.

---

## 11. Open decisions for the developer

1. Delete legacy model files **silently** on first launch, or only via the explicit button + on new-model download?
   (Recommendation: explicit + on download.)
2. Merge or drop `shorten`? Where does the summary go: inserted at the top of the note (recommended) or shown read-only
   with "Copy"? (Code actions: **decided, removed**. 9B: **decided, not included** unless the eval says otherwise.)
   **Decided 2026-10-21:** `shorten` kept, run per paragraph; the summary is inserted at the top.
3. Opt-in **auto-title** for untitled notes? **Decided 2026-10-21:** yes, opt-in, off by default (after long notes).
   **Revised the same day: dropped.** The time doesn't grow with the note (`generate_title` reads only the first 800
   characters), but every close of an untitled note would load the model (seconds, RAM, battery) and sync the title as a
   second revision a few seconds later. An untitled note already shows its first line as the title placeholder, and
   "Generate title" stays in the AI menu for when it's wanted.
4. Default recommended tier: 2B for ≥ 6 GB RAM devices? **Decided 2026-10-21:** 2B from 5 GB.
5. Ship **Voice → new note** (§7.1.5) in this cycle or the next? **Decided 2026-10-21:** after 4.0.0.

---

## Sources

- Qwen3.5 model cards: https://huggingface.co/Qwen/Qwen3.5-2B, https://huggingface.co/Qwen/Qwen3.5-4B,
  https://huggingface.co/Qwen/Qwen3.5-9B (thinking defaults, recommended sampling, 201 languages, 262K context, hybrid
  Gated DeltaNet layout)
- Unsloth GGUFs: https://huggingface.co/collections/unsloth/qwen35, run guide https://unsloth.ai/docs/models/qwen3.5
- llama.rn API: `node_modules/llama.rn/src/types.ts`, `node_modules/llama.rn/src/index.ts` (v0.12.0-rc.8)
- Qwen3 Technical Report (Qwen3-4B-Base vs Qwen2.5-7B-Base comparison table): https://arxiv.org/abs/2505.09388
