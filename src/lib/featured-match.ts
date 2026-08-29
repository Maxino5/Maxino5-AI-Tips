import type { Match } from "./types";

const MARQUEE_KEYWORDS = [
  "champions league",
  "premier league",
  "la liga",
  "serie a",
  "bundesliga",
  "ligue 1",
  "europa league",
  "nba",
];

export function marqueeRank(match: Match) {
  const name = match.league.toLowerCase();
  const idx = MARQUEE_KEYWORDS.findIndex((k) => name.includes(k));
  return idx === -1 ? MARQUEE_KEYWORDS.length : idx;
}

/** Picks the single most "back page" fixture from today's card: a big competition first,
 *  then whatever's live, then the soonest kickoff. Returns null if there's nothing to feature. */
export function pickFeaturedMatch(matches: Match[]): Match | null {
  if (!matches.length) return null;

  const live = matches.filter((m) => m.status === "live");
  const pool = live.length ? live : matches;

  return [...pool].sort((a, b) => {
    const rankDiff = marqueeRank(a) - marqueeRank(b);
    if (rankDiff !== 0) return rankDiff;
    const at = a.kickoff ? new Date(a.kickoff).getTime() : Infinity;
    const bt = b.kickoff ? new Date(b.kickoff).getTime() : Infinity;
    return at - bt;
  })[0]!;
}
