import type { EditorAction } from "./types";

/*
 * Fixed inputs for the developer-only AI evaluation (Settings -> Developer options -> AI evaluation), shaped as the editors
 * build them (AIEditorActions: "Title: ...\nContent: ..." for a category, the title then the items for suggestions). Not
 * user-facing text: never translated, never shipped as UI. The same set runs on every model, so outputs and timings compare.
 */

export interface EvalFixture {
  id: string;
  action: EditorAction;
  /** The app language the action answers in (translate's target, title's language). */
  lang: string;
  input: string;
  /** For suggest_category: the categories to pick from. */
  categories?: string[];
  /** What a good answer looks like, for whoever reads the results. */
  expect: string;
}

const CATEGORIES = ["Lavoro", "Casa", "Salute", "Viaggi", "Ricette"];

export const EVAL_FIXTURES: EvalFixture[] = [
  // Dictation cleanup: the flagship. Fillers, false starts, an enumeration, a question that must not be answered.
  {
    id: "transcript-it-shopping",
    action: "clean_transcript",
    lang: "it",
    input:
      "allora ehm devo ricordarmi di comprare il latte il pane e le uova poi cioè no aspetta prima devo passare in farmacia per le medicine di mamma e poi chiamare marco per la cena di sabato secondo te è meglio prenotare per le otto o per le nove",
    expect: "Punctuation and capitals, fillers gone, same words, the question kept as a question (not answered).",
  },
  {
    id: "transcript-en-meeting",
    action: "clean_transcript",
    lang: "en",
    input:
      "okay so um the meeting with the design team is moved to thursday at three we need to finalize the color palette and uh the onboarding screens also remind sarah to send the invoices before the end of the month",
    expect: "Two or three clean sentences, nothing added.",
  },
  {
    id: "transcript-ja-plan",
    action: "clean_transcript",
    lang: "ja",
    input: "えっと明日は朝九時に歯医者に行ってそのあと銀行で振込をしてお昼は田中さんとランチの予定です",
    expect: "Japanese punctuation (、。), same content.",
  },
  // Grammar.
  {
    id: "grammar-en",
    action: "fix_grammar",
    lang: "en",
    input:
      "Their going to the store tomorow, but they dont know if its open. Me and him has decided to wait untill the weather get better.",
    expect: "They're / tomorrow / don't / it's / He and I have / until / gets. Nothing else changed.",
  },
  {
    id: "grammar-it",
    action: "fix_grammar",
    lang: "it",
    input:
      "Ieri sono andato al mare con i miei amici, ci siamo divertiti molto anche se l'acqua era fredda. Se avrei saputo che pioveva sarei rimasto a casa, pero non me ne pento.",
    expect: "avessi saputo / però. Nothing else changed.",
  },
  {
    id: "grammar-de",
    action: "fix_grammar",
    lang: "de",
    input: "Ich habe gestern mit mein Bruder telefoniert und er hat gesagt das er nächste Woche kommt.",
    expect: "meinem Bruder / dass.",
  },
  // Summary and shortening.
  {
    id: "summary-en",
    action: "summarize",
    lang: "en",
    input:
      "Project kickoff notes. The client wants a mobile app for booking tennis courts in three clubs around the city. Users should see free slots in real time, book and pay in the app, and get a reminder an hour before. Club managers need a web dashboard to block courts for tournaments and maintenance, and to see weekly revenue. The first release must be ready for the spring season, so we have ten weeks. Payments go through Stripe; the client already has an account. Open questions: whether to support group bookings, how refunds work when it rains, and whether coaches can book recurring slots. Next steps: Anna drafts the screens by Friday, Luca estimates the backend, and we meet the client again on the 14th.",
    expect:
      "2-3 sentences: tennis booking app for 3 clubs, real-time slots + payments + manager dashboard, 10 weeks, open questions.",
  },
  {
    id: "summary-it",
    action: "summarize",
    lang: "it",
    input:
      "Riunione condominiale del 12 marzo. Presenti 14 condomini su 20. Primo punto: il rifacimento della facciata. Sono arrivati tre preventivi, da 48.000, 52.000 e 61.000 euro; l'assemblea ha scelto il secondo perché include il ponteggio e la garanzia decennale. I lavori partiranno a maggio e dureranno circa tre mesi. Secondo punto: il portone d'ingresso non si chiude bene, l'amministratore chiederà un intervento al fabbro entro fine mese. Terzo punto: si propone di installare le colonnine di ricarica per le auto elettriche nel cortile; la decisione è rinviata alla prossima riunione in attesa di un parere tecnico. Varie ed eventuali: si ricorda di non lasciare biciclette nell'androne.",
    expect: "Facciata (52k, maggio, 3 mesi), fabbro per il portone, colonnine rinviate.",
  },
  {
    id: "shorten-it",
    action: "shorten",
    lang: "it",
    input:
      "Volevo ricordarti che domani mattina, se riesci, dovresti passare dall'ufficio postale per ritirare quel pacco che è arrivato la settimana scorsa e che non siamo ancora riusciti a prendere perché eravamo sempre fuori casa quando è passato il corriere.",
    expect: "One short sentence: domani passa alla posta a ritirare il pacco.",
  },
  // Translation (target = lang).
  {
    id: "translate-it-en",
    action: "translate",
    lang: "en",
    input: "Ricordati di annaffiare le piante sul balcone e di chiudere bene la finestra della cucina prima di uscire.",
    expect: "Remember to water the plants on the balcony and close the kitchen window properly before leaving.",
  },
  {
    id: "translate-en-ja",
    action: "translate",
    lang: "ja",
    input: "The train leaves at 8:15 from platform 4. Bring the tickets and a charger.",
    expect: "Natural Japanese, 8:15 and platform 4 kept.",
  },
  // Titles.
  {
    id: "title-it",
    action: "generate_title",
    lang: "it",
    input:
      "Ingredienti: 400 g di spaghetti, 4 tuorli, 150 g di guanciale, pecorino romano, pepe nero. Rosolare il guanciale senza olio, sbattere i tuorli con il pecorino, scolare la pasta al dente e mantecare fuori dal fuoco.",
    expect: "Something like 'Spaghetti alla carbonara'.",
  },
  {
    id: "title-en",
    action: "generate_title",
    lang: "en",
    input:
      "Flight AZ 610 Rome to New York on June 3rd, departure 10:25, terminal 3. Hotel booked near Central Park for five nights. Remember the ESTA and the travel insurance.",
    expect: "Something like 'New York trip' / 'Trip to New York'.",
  },
  // Categories (one with no fitting category).
  {
    id: "category-recipe",
    action: "suggest_category",
    lang: "it",
    categories: CATEGORIES,
    input: "Title: Tiramisù\nContent: Savoiardi, mascarpone, caffè, cacao amaro, uova, zucchero.",
    expect: "Ricette",
  },
  {
    id: "category-work",
    action: "suggest_category",
    lang: "it",
    categories: CATEGORIES,
    input: "Title: Call con il cliente\nContent: Preparare la demo per giovedì e mandare il preventivo aggiornato.",
    expect: "Lavoro",
  },
  {
    id: "category-health",
    action: "suggest_category",
    lang: "en",
    categories: CATEGORIES,
    input: "Title: Blood test results\nContent: Cholesterol 190, vitamin D low: ask the doctor about supplements.",
    expect: "Salute",
  },
  {
    id: "category-none",
    action: "suggest_category",
    lang: "en",
    categories: CATEGORIES,
    input: "Title: Guitar chords\nContent: Am - F - C - G for the chorus, capo on the 2nd fret.",
    expect: "none",
  },
  // Checklist suggestions.
  {
    id: "items-it-shopping",
    action: "suggest_items",
    lang: "it",
    input: "Spesa per la grigliata\nsalsicce\ncarbone\npane",
    expect: "3 related items in Italian (birra, insalata, ...), no repeats.",
  },
  {
    id: "items-en-packing",
    action: "suggest_items",
    lang: "en",
    input: "Ski trip packing\nski boots\ngloves\ngoggles",
    expect: "3 related items in English (helmet, thermal layers, ...).",
  },
];
