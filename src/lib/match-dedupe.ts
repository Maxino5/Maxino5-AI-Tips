import type { Match } from "./types";

const CLUB_SUFFIXES = [
  "fc",
  "cf",
  "afc",
  "sc",
  "ac",
  "cd",
  "ud",
  "ss",
  "ff",
  "if",
  "bk",
  "sk",
  "club",
  "calcio",
  "united",
  "utd",
];

/** Normalizes a team name so the same club spelled slightly differently by
 *  two different data providers ("Utd" vs "United", accents, punctuation)
 *  still compares equal. Not perfect — good enough for fixture dedup. */
export function normalizeTeamName(name: string): string {
  const stripped = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !CLUB_SUFFIXES.includes(word));
  return stripped.join(" ");
}

function fixtureKey(m: Match): string {
  return `${m.date}|${normalizeTeamName(m.homeTeam)}|${normalizeTeamName(m.awayTeam)}`;
}

/** Merges fixture lists from multiple sources, preferring `primary` on
 *  overlap (it carries real crest art and richer stats) and only keeping
 *  `secondary` fixtures that don't already appear in `primary`. */
export function mergeMatchSources(primary: Match[], ...secondary: Match[][]): Match[] {
  const seen = new Set(primary.map(fixtureKey));
  const merged = [...primary];
  for (const list of secondary) {
    for (const m of list) {
      const key = fixtureKey(m);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(m);
    }
  }
  return merged;
}
