/** One line of a version's changelog. */
export interface ChangelogLine {
  /** Written as "• …" (the list draws its own dot). */
  bullet: boolean;
  /** The part up to its first colon, read first (in bold): "Ricerca unica:", "Recherche unique :", "検索：". */
  lead: string;
  /** The rest, with the space that followed the colon. */
  rest: string;
}

/** The lead stops at the first colon followed by a space (or a full-width colon), within this many characters. */
const LEAD = /^([^:：]{1,60}?)(\s?:(?=\s)|：)(.*)$/;

/**
 * A version's changelog text ("• " lines, as in the locales) as lines. A line that starts with a short phrase and a colon
 * gets that phrase as its lead: so a long list reads at a glance, with no other markup in the translations.
 */
export const changelogLines = (text: string): ChangelogLine[] =>
  text
    .split("\n")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const bullet = raw.startsWith("•");
      const line = bullet ? raw.replace(/^•\s*/, "") : raw;
      const match = LEAD.exec(line);
      return match ? { bullet, lead: match[1] + match[2], rest: match[3] } : { bullet, lead: "", rest: line };
    });
