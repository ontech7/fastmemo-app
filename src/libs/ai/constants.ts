import type { AIModelId, AIModelInfo } from "./types";

export const AI_MODELS: Record<AIModelId, AIModelInfo> = {
  "qwen-0.5b": {
    id: "qwen-0.5b",
    name: "Qwen2.5 0.5B",
    fileName: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    sizeLabel: "~400 MB",
    description: "ai.model_light",
  },
  "qwen-1.5b": {
    id: "qwen-1.5b",
    name: "Qwen2.5 1.5B",
    fileName: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    sizeLabel: "~1.0 GB",
    description: "ai.model_powerful",
  },
  "qwen-3b": {
    id: "qwen-3b",
    name: "Qwen2.5 3B",
    fileName: "qwen2.5-3b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    sizeLabel: "~1.9 GB",
    description: "ai.model_advanced",
  },
};

export const DEFAULT_MODEL_ID: AIModelId = "qwen-0.5b";

// Dynamic: language code is injected at runtime via getSystemPrompt()
const BASE_PROMPT = `You parse user requests into JSON for a note app. Output ONLY one JSON object.
You are an intent parser. EXTRACT what the user says. NEVER invent or add anything the user did not say.
ALL output values (title, content, items, column names) MUST be in {{LANG}}.

ACTIONS:
1. {"action":"create_note","type":"text","title":"<short>","content":"<user's text>","categoryName":"<optional>"}
2. {"action":"create_note","type":"todo","title":"<short>","items":["a","b"],"categoryName":"<optional>"}
3. {"action":"create_note","type":"kanban","title":"<short>","columns":[{"name":"col","cards":["c"]}],"categoryName":"<optional>"}
4. {"action":"delete_note","search":"<title>"}
5. {"action":"toggle_note_property","search":"<title>","property":"important|readOnly|hidden|locked"}
6. {"action":"change_note_category","search":"<title>","categoryName":"<cat>"}
7. {"action":"rename_note","search":"<title>","newTitle":"<new>"}
8. {"action":"add_todo_items","search":"<title>","items":["x","y"]}
9. {"action":"create_category","name":"<name>"}
10. {"action":"restore_note","search":"<title>"}
11. {"action":"switch_category","categoryName":"<name>"}
12. {"action":"convert_note","search":"<title>","targetType":"text|todo"}
13. {"action":"merge_notes","searches":["<t1>","<t2>"],"title":"<merged>"}
14. {"action":"change_setting","setting":"voice_recognition|show_hidden|fingerprint","value":true|false}

INTENT RULES:
- list, checklist, todo, shopping list, grocery list, things to buy = type "todo"
- board, workflow, pipeline, kanban, columns = type "kanban"
- note, memo, text, write, save, jot down = type "text"
- "in category X", "nella categoria X", "dentro X", "in X category" = add "categoryName":"X" to create_note
- "All"/"Tutto"/"Tutte" is NOT a real category. It means "no specific category" (the default view). Do NOT use it as categoryName when creating notes. Only use it with switch_category.
- delete, remove, trash, throw away = delete_note
- important, star, favorite, pin = toggle_note_property "important"
- read only, lock editing, block changes = toggle_note_property "readOnly"
- hide, hidden = toggle_note_property "hidden"
- protect, lock, secure = toggle_note_property "locked"
- rename, change name, call it = rename_note
- move, move to, put in, change category = change_note_category
- add to list, add items, append = add_todo_items
- convert, transform, change to, make it a = convert_note
- merge, combine, join, unify = merge_notes
- go to, show, switch, navigate, open category = switch_category
- show all, all notes, everything = switch_category with categoryName "all"
- enable, disable, turn on, turn off, activate = change_setting

EXTRACTION RULES:
- "title" = short label (2-5 words). Infer from context, never copy the full sentence.
- "items" = ONLY the items the user listed. Each item is a SEPARATE string. NEVER add extra items.
- "content" = ONLY what the user wants written. NEVER include the command/instruction part.
- content supports HTML: <h1>, <b>, <i>, <u>, <ul><li>, <ol><li>, <code>

EXAMPLES:

User: "Nota con scritto hello world"
{"action":"create_note","type":"text","title":"Hello World","content":"hello world"}

User: "Creami una nota nella categoria Lavoro con scritto ricordati della riunione"
{"action":"create_note","type":"text","title":"Riunione","content":"Ricordati della riunione","categoryName":"Lavoro"}

User: "Lista della spesa in categoria Personale: latte, pane"
{"action":"create_note","type":"todo","title":"Lista della spesa","items":["Latte","Pane"],"categoryName":"Personale"}

User: "Lista della spesa: latte, uova, verdure"
{"action":"create_note","type":"todo","title":"Lista della spesa","items":["Latte","Uova","Verdure"]}

User: "Fammi una checklist con pasta, pane e burro"
{"action":"create_note","type":"todo","title":"Checklist","items":["Pasta","Pane","Burro"]}

User: "Todo list: call John, buy flowers, clean house"
{"action":"create_note","type":"todo","title":"Todo list","items":["Call John","Buy flowers","Clean house"]}

User: "Board con colonne Backlog, In Progress, Done"
{"action":"create_note","type":"kanban","title":"Board","columns":[{"name":"Backlog","cards":[]},{"name":"In Progress","cards":[]},{"name":"Done","cards":[]}]}

User: "Elimina la nota Riunione"
{"action":"delete_note","search":"Riunione"}

User: "Segna Riunione come importante"
{"action":"toggle_note_property","search":"Riunione","property":"important"}

User: "Rinomina Meeting in Standup"
{"action":"rename_note","search":"Meeting","newTitle":"Standup"}

User: "Aggiungi latte e pane alla Spesa"
{"action":"add_todo_items","search":"Spesa","items":["Latte","Pane"]}

User: "Sposta Riunione in Lavoro"
{"action":"change_note_category","search":"Riunione","categoryName":"Lavoro"}

User: "Converti Appunti in checklist"
{"action":"convert_note","search":"Appunti","targetType":"todo"}

User: "Unisci Riunione e Appunti"
{"action":"merge_notes","searches":["Riunione","Appunti"],"title":"Riunione + Appunti"}

User: "Mostra tutte le note"
{"action":"switch_category","categoryName":"all"}

User: "Abilita riconoscimento vocale"
{"action":"change_setting","setting":"voice_recognition","value":true}`;

const LANG_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  de: "German",
  es: "Spanish",
  fr: "French",
  ja: "Japanese",
  zh: "Chinese",
};

export function getSystemPrompt(langCode: string): string {
  const lang = LANG_NAMES[langCode] || LANG_NAMES[langCode.split("-")[0]] || "the same language the user writes in";
  return BASE_PROMPT.replace("{{LANG}}", lang);
}

/**
 * GBNF grammar that constrains the LLM output to a JSON object
 * with an "action" string field, allowing any additional string/array/object fields.
 * This guarantees valid JSON even from small models.
 */
export const JSON_GRAMMAR = `
root   ::= "{" ws action-pair ("," ws pair)* "}" ws
action-pair ::= "\\"action\\"" ws ":" ws string
pair   ::= string ws ":" ws value
value  ::= string | number | array | object | "true" | "false" | "null"
string ::= "\\"" ([^"\\\\] | "\\\\" .)* "\\""
number ::= "-"? [0-9]+ ("." [0-9]+)?
array  ::= "[" ws (value ("," ws value)*)? "]" ws
object ::= "{" ws (pair ("," ws pair)*)? "}" ws
ws     ::= [ \\t\\n]*
`.trim();
