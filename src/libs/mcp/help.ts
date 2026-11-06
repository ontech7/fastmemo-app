/*
 * A help topic's text for an agent, from its i18n strings (`help.<topic>.text_N_M`), which the help screen shows as paragraphs.
 */

/**
 * Lines that have a name instead of a number (`text_heading`, `text_align` of the toolbar topic) sit after the numbered line
 * given here. Any other `text_*` key, such as the `text_link` ones (the label of a link, with no address), is left out.
 */
const NAMED_LINES: Record<string, number> = { text_heading: 3, text_align: 7 };

/**
 * `text_1_0` and `text_1_1` on one line, `text_2_0` on the next. The title isn't part of it. The lines are in the order of their
 * numbers, not of the keys in the object (`text_2_0` comes before `text_10_0`). Values that aren't strings are left out.
 */
export function helpText(body: Record<string, string>): string {
  const parts: { line: number; part: number; text: string }[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") continue;
    const numbered = /^text_(\d+)_(\d+)$/.exec(key);
    if (numbered) parts.push({ line: Number(numbered[1]), part: Number(numbered[2]), text: value });
    else if (Object.hasOwn(NAMED_LINES, key)) parts.push({ line: NAMED_LINES[key] + 0.5, part: 0, text: value });
  }

  parts.sort((a, b) => a.line - b.line || a.part - b.part);

  const lines: string[] = [];
  parts.forEach((part, index) => {
    if (index > 0 && parts[index - 1].line === part.line) lines[lines.length - 1] += ` ${part.text}`;
    else lines.push(part.text);
  });
  return lines.join("\n");
}
