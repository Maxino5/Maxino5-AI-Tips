import type { Sport } from "./types";

/** The middle segment doubles as a "which source/competition" tag, e.g. an
 *  ESPN league slug like "eng.1", or the literal "sportsdb" for matches that
 *  came from TheSportsDB instead. */
export function makeMatchId(sport: Sport, league: string, eventId: string): string {
  return `${sport}~${league}~${eventId}`;
}

export function parseMatchId(id: string): { sport: Sport; league: string; eventId: string } | null {
  const [sport, league, eventId] = id.split("~");
  if (!sport || !league || !eventId) return null;
  if (sport !== "football" && sport !== "basketball") return null;
  return { sport, league, eventId };
}
