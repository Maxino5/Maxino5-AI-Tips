import type { Match } from "./types";

/** Escapes a string for safe use inside a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finds the first of today's fixtures where either team's name is
 *  genuinely mentioned in the given text — used to link a news headline back
 *  to a real prediction page on the site. Deliberately conservative: only
 *  matches whole words of reasonable length, to avoid a short/common team
 *  name (e.g. a one-word club nickname) matching unrelated text. */
export function findRelatedMatch(text: string, matches: Match[]): Match | null {
  const haystack = text.toLowerCase();

  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (team.length < 4) continue; // too short to safely match as a whole word
      const pattern = new RegExp(`\\b${escapeRegex(team.toLowerCase())}\\b`);
      if (pattern.test(haystack)) return match;
    }
  }
  return null;
}
