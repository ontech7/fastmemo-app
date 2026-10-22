import type { LongNoteAction } from "./longNote";
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
  {
    id: "transcript-it-list",
    action: "clean_transcript",
    lang: "it",
    input:
      "allora per la festa di sabato devo prendere le bibite i piatti di carta i palloncini e la torta e poi mandare l'invito a tutti entro giovedì",
    expect: "The four things as a '- ' list (or a clean sentence), the invite kept as its own sentence.",
  },
  // Dictation into a checklist.
  {
    id: "voice-items-it",
    action: "transcript_to_items",
    lang: "it",
    input: "Comprare latte, pane, poi chiamare Marco e prenotare il dentista",
    expect: "4 items: latte, pane, chiamare Marco, prenotare il dentista (Italian, nothing added).",
  },
  {
    id: "voice-items-en",
    action: "transcript_to_items",
    lang: "en",
    input: "um I need to pick up the dry cleaning buy dog food and uh call the plumber about the kitchen sink",
    expect: "3 items: pick up the dry cleaning, buy dog food, call the plumber about the kitchen sink.",
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

/**
 * Notes of the length people keep, as the text editor stores them (pell's HTML: the first line unwrapped, then a div per
 * line, headings and lists). Each runs through the long-note path: one call per paragraph or part, the structure kept.
 */
export interface LongNoteFixture {
  id: string;
  action: LongNoteAction;
  lang: string;
  title?: string;
  html: string;
  expect: string;
}

export const LONG_NOTE_FIXTURES: LongNoteFixture[] = [
  {
    id: "long-grammar-it",
    action: "fix_grammar",
    lang: "it",
    html: "Cose da fare per il trasloco<div>Allora, il trasloco e fissato per sabato 18 ma ci sono ancora un pò di cose da sistemare.</div><h1>Prima del trasloco</h1><ul><li>disdire il contratto della luce, qual'è il numero del servizio clienti?</li><li>comprare i scatoloni grandi</li><li>chiedere a Paolo se c'è la fa a portare il furgone</li></ul><div>Mia sorella ha detto che viene ad aiutarci, pero solo la mattina perche il pomeriggio lavora.</div><div>Ricordarsi di fotografare i contatori prima di consegnare le chiavi, cosi non ci sono problemi con il padrone di casa.</div><h1>Dopo il trasloco</h1><ul><li>cambiare la residenza al comune, servono documento e contratto d'affitto</li><li>aggiornare l'indirizzo sulla patente e sul conto in banca</li><li>montare la cucina, se no mangiamo fuori per una settimana</li></ul><div>Se qualcuno a delle scatole avanzate, le prendiamo volentieri.</div>",
    expect:
      "è fissato, un po', qual è, gli scatoloni, ce la fa, però, perché, così, ha delle scatole; headings and lists kept, nothing else changed.",
  },
  {
    id: "long-translate-it-en",
    action: "translate",
    lang: "en",
    html: "Tiramisù della nonna<h1>Ingredienti</h1><ul><li>500 g di mascarpone</li><li>4 uova freschissime</li><li>100 g di zucchero</li><li>300 g di savoiardi</li><li>caffè espresso, già freddo</li><li>cacao amaro in polvere</li></ul><h1>Preparazione</h1><div>Separa i tuorli dagli albumi. Monta i tuorli con lo zucchero finché diventano chiari e spumosi, poi aggiungi il mascarpone poco alla volta.</div><div>Monta gli albumi a neve ben ferma e incorporali alla crema con una spatola, mescolando dal basso verso l'alto per non smontarli.</div><div>Inzuppa velocemente i savoiardi nel caffè: devono restare morbidi ma non sfaldarsi. Fai uno strato di biscotti, uno di crema, e ripeti.</div><div><b>Importante:</b> lascia riposare in frigo almeno sei ore, meglio tutta la notte. Spolvera di cacao solo prima di servire.</div>",
    expect: "Every heading, item and step in English (ladyfingers, egg whites...), the same headings and list.",
  },
  {
    id: "long-shorten-it",
    action: "shorten",
    lang: "it",
    html: "Note per la riunione con il fornitore<div>Prima di tutto vorrei che fosse chiaro a tutti che le ultime tre consegne sono arrivate in ritardo di almeno una settimana ciascuna, e questo ci ha costretti a rimandare due ordini importanti dei nostri clienti, con tutte le conseguenze che potete immaginare in termini di reputazione e di rapporti commerciali.</div><div>Prezzi: invariati.</div><div>Per quanto riguarda la qualità dei materiali, devo dire che nel complesso non abbiamo avuto grossi problemi, anche se in un paio di casi abbiamo trovato dei pannelli leggermente graffiati che abbiamo dovuto rimandare indietro, cosa che ha richiesto tempo e telefonate.</div><ul><li>chiedere una penale per i ritardi</li><li>proporre consegne ogni due settimane</li></ul><div>Infine sarebbe utile capire se loro sono disposti a garantirci per iscritto delle date di consegna precise per i prossimi sei mesi, magari con una piccola penale nel caso in cui non riescano a rispettarle, in modo da poter pianificare meglio il nostro lavoro.</div>",
    expect: "The three long paragraphs in one short sentence each; the title, 'Prezzi: invariati.' and the list untouched.",
  },
  {
    id: "long-summary-it",
    action: "summarize",
    lang: "it",
    title: "Giappone 2026",
    html: "Diario del viaggio in Giappone, aprile<div>Giorno 1, Tokyo. Atterrati a Narita alle 7 dopo dodici ore di volo. Narita Express fino a Shinjuku (incluso nel JR Pass, attivato all'aeroporto), hotel a cinque minuti dalla stazione ma check-in solo alle 15, quindi valigie al deposito e primo giro a piedi. Sera a Omoide Yokocho, ramen da Fuunji dopo quaranta minuti di coda: ne valeva la pena. A letto alle nove per il jet lag.</div><div>Giorno 2. Senso-ji ad Asakusa alle 8, prima che arrivassero i gruppi; la via Nakamise apre più tardi, quindi colazione con i melonpan. Battello sul fiume Sumida fino ai giardini Hamarikyu, poi pomeriggio ad Akihabara tra negozi di elettronica e sale giochi. Cena a base di okonomiyaki. Speso in tutto circa 9.000 yen a testa.</div><div>Giorno 3. Santuario Meiji la mattina, Takeshita Street a Harajuku (troppa folla), poi l'incrocio di Shibuya e lo Shibuya Sky al tramonto, prenotato online per le 17:20 a 2.500 yen: da prenotare con almeno una settimana di anticipo. Cena in un izakaya sotto la ferrovia, senza menù in inglese ma con le foto.</div><div>Giorno 4, gita a Nikko. Treno Tobu da Asakusa: il JR Pass non vale, pagati 2.800 yen in più a testa. Il santuario Toshogu è splendido ma pieno di scolaresche; la cascata Kegon era mezza ghiacciata e la strada per il lago Chuzenji chiusa per neve. Rientro tardi e stanchi, forse una gita da fare in primavera.</div><div>Giorno 5. Colazione a base di sushi al mercato esterno di Tsukiji, poi teamLab Planets con i biglietti comprati online (si cammina scalzi nell'acqua, portare pantaloni che si arrotolano). Pomeriggio di shopping a Ginza con il tax free: persa una ricevuta, quindi niente rimborso su un acquisto da 12.000 yen.</div><div>Giorno 6, trasferimento a Kyoto. Valigie spedite il giorno prima con il takkyubin (2.000 yen a valigia, comodissimo), Shinkansen Hikari in due ore e quaranta con il JR Pass. Ryokan a Gion con tatami e bagno in comune, cena kaiseki di nove portate inclusa nel prezzo. Passeggiata serale a Hanamikoji: viste due maiko di sfuggita.</div><div>Giorno 7. Fushimi Inari alle 6:30 per avere i torii quasi vuoti, salita fino in cima in due ore. Poi il tempio Tofuku-ji, poco affollato e bellissimo. Pomeriggio al Kiyomizu-dera e lungo Sannenzaka e Ninenzaka sotto la pioggia: ombrelli comprati al konbini per 500 yen.</div><div>Giorno 8, Arashiyama. Bosco di bambù alle 7:30, tempio Tenryu-ji, salita al parco delle scimmie di Iwatayama. Il trenino panoramico Sagano era esaurito per il giorno stesso: va prenotato giorni prima. Tofu in tutte le salse a pranzo in un ristorante buddhista vicino al tempio.</div><div>Giorno 9, Nara in giornata da Kyoto. I cervi sono ovunque e mordicchiano le mappe; il Buddha del Todai-ji è enorme, il santuario Kasuga con le lanterne è più tranquillo. Pranzo con il kakinoha-zushi, il sushi avvolto nelle foglie di cachi. Sera di nuovo a Kyoto, cena a Pontocho lungo il fiume.</div><div>Giorno 10, Osaka. Hotel a Namba. Mercato di Kuromon a pranzo (caro ma buono), castello di Osaka nel pomeriggio, sera a Dotonbori tra takoyaki e insegne luminose. Universal Studios scartato: 9.800 yen a testa più l'Express Pass, troppo per un giorno solo.</div><div>Giorno 11, Hiroshima e Miyajima. Shinkansen da Shin-Osaka, il Museo della Pace richiede almeno due ore ed è molto toccante. Traghetto JR per Miyajima incluso nel pass; il grande torii con l'alta marea delle 16 sembra galleggiare. Okonomiyaki in stile Hiroshima con i noodles prima di rientrare a Osaka.</div><div>Giorno 12, rientro. Treno Haruka da Osaka all'aeroporto del Kansai, volo alle 11:30. Bilancio: circa 2.300 euro a testa tutto compreso, voli inclusi. Il JR Pass da sette giorni conviene solo grazie alla tratta Tokyo-Kyoto-Hiroshima. La prossima volta: più giorni a Kyoto, uno in meno a Tokyo, e Nikko in un'altra stagione.</div>",
    expect:
      "Read in parts then merged: 12 days Tokyo-Kyoto-Nara-Osaka-Hiroshima, ~2.300 euro each, the JR Pass worth it only for the long legs, more Kyoto next time.",
  },
  {
    id: "long-summary-en",
    action: "summarize",
    lang: "en",
    title: "Renovation 2026",
    html: "Kitchen and bathroom renovation log<div>Week 1. Signed the contract with Baker & Sons for the kitchen and the upstairs bathroom: 38,500 dollars all in, 10 percent paid up front. Start date is March 3. We have to empty the kitchen by then, so the fridge goes to the garage and we cook on the camping stove in the dining room.</div><div>Week 2. Demolition done in three days. Behind the old tiles the wall was wet: a slow leak from the bathroom pipe above, probably for years. Mike says the subfloor under the sink has to be replaced too. Extra cost estimated at 1,200 dollars; we said yes.</div><div>Week 3. Plumber came on Tuesday and rerouted the bathroom drain. The inspector visited on Friday and passed the rough plumbing. Electrical rough-in starts next week. We chose the induction cooktop, so the kitchen needs a new 40 amp circuit.</div><div>Week 4. The electrician found aluminum wiring in two bedroom circuits. Not part of the contract, but unsafe: replacing it costs 2,100 dollars extra. Decided to do it now while the walls are open. Budget so far: 41,800 with the extras.</div><div>Week 5. Drywall in the kitchen. Picked the cabinets at the showroom: shaker style, sage green lowers, white uppers, brass handles. Lead time is six weeks, which pushes the kitchen finish to late May. Sarah wants open shelves on the window wall instead of uppers.</div><div>Week 6. Bathroom waterproofing done and the shower pan tested for 24 hours with no leak. Tile choice for the bathroom: large grey porcelain on the floor, white zellige on the shower wall. The zellige is expensive, 28 dollars a square foot, so only the shower wall gets it.</div><div>Week 7. Nothing happened on Monday and Tuesday because the tiler was sick. Used the time to order the vanity, the mirror and the lights. The vanity is 60 inches with two sinks; it barely fits, 2 inches to spare on each side. Measured three times.</div><div>Week 8. Bathroom tiling finished. The grout on the floor is a shade darker than the sample; we decided to live with it. The window in the shower turned out to be single glazed and fogs up badly; asked for a quote to replace it with frosted double glazing.</div><div>Week 9. Window quote: 950 dollars, installed in two weeks. Accepted. The kitchen floor is now the problem: the old oak under the vinyl is in good shape in the dining area but rotten near the back door. Options: patch with reclaimed oak or put tile everywhere.</div><div>Week 10. Went with reclaimed oak for the patch and refinishing the whole floor, 3,400 dollars. Floor work has to wait until the cabinets are in, so the house will be dusty again in June. Kids are staying at their grandparents for that week.</div><div>Week 11. Bathroom done except the window. The vanity drawers hit the door frame when the door is open; the carpenter shaved the door stop and now it works. Final bathroom walkthrough list has six small items, mostly caulk and one loose towel bar.</div><div>Week 12. Cabinets delivered a week early. Two doors arrived scratched and one drawer front is the wrong color. The supplier will replace them in ten days. Installation of the rest started anyway on Thursday.</div><div>Week 13. Countertops templated on Monday: quartz, warm white with light veining, with a 10 foot island. Fabrication takes two weeks. The sink is an undermount single bowl, 33 inches; the faucet is the brushed brass one Sarah liked at the showroom.</div><div>Week 14. Paid the third installment, 10,000 dollars. Running total paid: 26,250. Remaining on the contract: 12,250 plus the extras, 8,600 so far. The new shower window is in and it is much better; no more fog.</div><div>Week 15. Countertops installed. The seam on the island is almost invisible. Backsplash decision: the same white zellige as the shower, but only behind the range, and simple white tile elsewhere to save money. The induction cooktop needed a firmware update to pair with the hood.</div><div>Week 16. Replacement cabinet doors arrived and fit well. Appliances in: fridge, cooktop, wall oven, dishwasher. The dishwasher door hits the island handle by half an inch when fully open; we will swap the handle for a knob on that side.</div><div>Week 17. Floor refinishing week. Three coats of matte water-based finish. The reclaimed oak patch blends better than expected. We stayed at a hotel for two nights because of the smell; 340 dollars, not in the budget.</div><div>Week 18. Lighting: pendants over the island, under-cabinet strips and recessed lights. One pendant was installed off center by two inches and had to be moved. The dimmers buzz with the strips; the electrician will try a different dimmer model.</div><div>Week 19. Painting week: walls in a warm white, the ceiling flat white, the trim semi-gloss. Touch-ups around the outlets are left for the final list. The open shelves went up on the window wall and they look great.</div><div>Week 20. Final walkthrough with Mike. Punch list of 14 items: dimmer buzz, two cabinet hinges to adjust, caulk around the backsplash, the dishwasher knob, paint touch-ups and a loose transition strip at the back door.</div><div>Week 21. Punch list down to three items. The new dimmers fixed the buzz. Final inspection passed on Thursday; the permit is closed. The garage is still full of boxes and the old fridge, which we are selling online.</div><div>Week 22. Final payment made. Total cost: 38,500 contract plus 8,600 in extras plus 340 for the hotel, so 47,440 dollars, about 23 percent over the original price. Took eleven weeks longer than planned, mostly because of the cabinet lead time and the wet wall.</div><div>Lessons learned. Open the walls before signing a fixed price: the leak and the wiring were the biggest surprises. Order cabinets first, everything else waits for them. Keep a 20 percent reserve. Baker & Sons were reliable and tidy; we would hire them again for the basement next year.</div>",
    expect:
      "Read in parts then merged: kitchen + bathroom by Baker & Sons, 38,500 contract, 47,440 in the end (~23% over: leak, wiring, floor), 11 weeks late (cabinets), would hire them again.",
  },
];
