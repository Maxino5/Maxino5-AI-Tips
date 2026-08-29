import type { Match, Sport, TeamForm } from "./types";
import { makeMatchId, parseMatchId } from "./match-id";
import type { MatchContext, PastResult } from "./espn.server";

/**
 * TheSportsDB's free, keyless-signup "test" key. It's the publicly documented
 * key for their hobbyist tier (see thesportsdb.com/free_sports_api) — no
 * registration needed, rate-limited but genuinely free.
 *
 * This is used purely as a *second* source to widen fixture coverage beyond
 * ESPN's per-competition scoreboard endpoints. Its big advantage: one call
 * returns every match for a whole sport on a given day, instead of one call
 * per competition — so it doesn't add to the request-burst problem at all.
 */
const BASE = "https://www.thesportsdb.com/api/v1/json/3";

const SPORT_NAME: Record<Sport, string> = {
  football: "Soccer",
  basketball: "Basketball",
};

const SOURCE_TAG = "sportsdb";

type Cached<T> = { value: T; expires: number };
const cache = new Map<string, Cached<unknown>>();

const REQUEST_TIMEOUT_MS = 6000;

async function cachedJson<T>(url: string, ttlMs: number): Promise<T | null> {
  const hit = cache.get(url) as Cached<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[sportsdb] ${res.status} fetching ${url}`);
      return null;
    }
    const json = (await res.json()) as T;
    cache.set(url, { value: json, expires: Date.now() + ttlMs });
    return json;
  } catch (err) {
    console.warn(`[sportsdb] failed fetching ${url}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface SportsDbEvent {
  idEvent: string;
  idLeague?: string;
  strLeague?: string;
  strLeagueBadge?: string | null;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  dateEvent?: string;
  strTime?: string | null;
  strTimestamp?: string | null;
  strStatus?: string | null;
  strVenue?: string | null;
}

interface SportsDbEventsResponse {
  events?: SportsDbEvent[] | null;
}

const FINISHED_MARKERS = ["FT", "AET", "PEN", "FINISHED", "MATCH FINISHED", "AWARDED"];
const LIVE_MARKERS = ["1H", "2H", "HT", "ET", "LIVE", "IN PLAY", "Q1", "Q2", "Q3", "Q4", "OT"];

function classifyStatus(ev: SportsDbEvent): Match["status"] {
  const status = (ev.strStatus ?? "").toUpperCase().trim();
  if (status && FINISHED_MARKERS.some((m) => status.includes(m))) return "finished";
  if (status && LIVE_MARKERS.some((m) => status.includes(m))) return "live";

  // Some feeds leave strStatus blank even once a game has kicked off — fall
  // back to comparing kickoff time against now, using scores as a signal.
  const kickoff = kickoffOf(ev);
  const hasScore = ev.intHomeScore != null && ev.intAwayScore != null && ev.intHomeScore !== "";
  if (kickoff) {
    const elapsedMs = Date.now() - new Date(kickoff).getTime();
    if (hasScore && elapsedMs > 2.5 * 60 * 60 * 1000) return "finished";
    if (elapsedMs > 0 && elapsedMs < 3 * 60 * 60 * 1000) return hasScore ? "live" : "upcoming";
  }
  return hasScore ? "finished" : "upcoming";
}

function kickoffOf(ev: SportsDbEvent): string | null {
  if (ev.strTimestamp) {
    const d = new Date(ev.strTimestamp);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (ev.dateEvent) {
    const time = ev.strTime && ev.strTime !== "00:00:00" ? ev.strTime : "00:00:00";
    const d = new Date(`${ev.dateEvent}T${time}Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function scoreOf(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

const eventIndex = new Map<string, SportsDbEvent>();

function mapEvent(ev: SportsDbEvent, sport: Sport): Match | null {
  if (!ev.strHomeTeam || !ev.strAwayTeam) return null;
  const id = makeMatchId(sport, SOURCE_TAG, ev.idEvent);
  eventIndex.set(id, ev);

  return {
    id,
    sport,
    league: ev.strLeague ?? "Other",
    leagueId: ev.idLeague ? `sportsdb-${ev.idLeague}` : "sportsdb-other",
    // Crest URLs from this feed are inconsistent, so we deliberately leave
    // badges null — the UI already falls back to a clean initials avatar.
    leagueBadge: null,
    homeTeam: ev.strHomeTeam,
    awayTeam: ev.strAwayTeam,
    homeBadge: null,
    awayBadge: null,
    kickoff: kickoffOf(ev),
    date: ev.dateEvent ?? "",
    status: classifyStatus(ev),
    homeScore: scoreOf(ev.intHomeScore),
    awayScore: scoreOf(ev.intAwayScore),
    venue: ev.strVenue ?? null,
  };
}

export async function fetchSportsDbEventsByDay(date: string, sport: Sport): Promise<Match[]> {
  const url = `${BASE}/eventsday.php?d=${date}&s=${encodeURIComponent(SPORT_NAME[sport])}`;
  const data = await cachedJson<SportsDbEventsResponse>(url, 3 * 60 * 1000);
  const out: Match[] = [];
  for (const ev of data?.events ?? []) {
    const m = mapEvent(ev, sport);
    if (m) out.push(m);
  }
  return out;
}

interface SportsDbLastEvents {
  results?:
    | {
        idHomeTeam?: string;
        idAwayTeam?: string;
        intHomeScore?: string | null;
        intAwayScore?: string | null;
        dateEvent?: string;
        strStatus?: string | null;
      }[]
    | null;
}

async function fetchTeamRecentResults(teamId: string, beforeDate?: string): Promise<PastResult[]> {
  const data = await cachedJson<SportsDbLastEvents>(
    `${BASE}/eventslast.php?id=${teamId}`,
    30 * 60 * 1000,
  );
  const out: PastResult[] = [];
  for (const e of data?.results ?? []) {
    const date = e.dateEvent ?? "";
    if (beforeDate && date >= beforeDate) continue;
    const home = scoreOf(e.intHomeScore);
    const away = scoreOf(e.intAwayScore);
    if (home === null || away === null) continue;
    const isHome = e.idHomeTeam === teamId;
    out.push({ date, isHome, scored: isHome ? home : away, conceded: isHome ? away : home });
  }
  return out.slice(-8);
}

function formFrom(team: string, results: PastResult[]): TeamForm {
  return {
    team,
    played: results.length,
    wins: results.filter((r) => r.scored > r.conceded).length,
    draws: results.filter((r) => r.scored === r.conceded).length,
    losses: results.filter((r) => r.scored < r.conceded).length,
    scored: results.reduce((a, r) => a + r.scored, 0),
    conceded: results.reduce((a, r) => a + r.conceded, 0),
    formString: results
      .map((r) => (r.scored > r.conceded ? "W" : r.scored === r.conceded ? "D" : "L"))
      .join(""),
  };
}

export function isSportsDbMatchId(matchId: string): boolean {
  return parseMatchId(matchId)?.league === SOURCE_TAG;
}

export async function fetchSportsDbMatchContext(
  matchId: string,
  beforeDate?: string,
): Promise<MatchContext | null> {
  const parsed = parseMatchId(matchId);
  if (!parsed) return null;

  let ev = eventIndex.get(matchId);
  if (!ev) {
    // Cache miss (e.g. cold start) — look the single event up directly.
    const data = await cachedJson<{ events?: SportsDbEvent[] | null }>(
      `${BASE}/lookupevent.php?id=${parsed.eventId}`,
      10 * 60 * 1000,
    );
    ev = data?.events?.[0];
    if (ev) eventIndex.set(matchId, ev);
  }
  if (!ev || !ev.strHomeTeam || !ev.strAwayTeam) return null;

  const match = mapEvent(ev, parsed.sport);
  if (!match) return null;

  const [homeResults, awayResults] = await Promise.all([
    ev.idHomeTeam ? fetchTeamRecentResults(ev.idHomeTeam, beforeDate).catch(() => []) : [],
    ev.idAwayTeam ? fetchTeamRecentResults(ev.idAwayTeam, beforeDate).catch(() => []) : [],
  ]);

  return {
    match,
    home: { form: formFrom(match.homeTeam, homeResults), results: homeResults },
    away: { form: formFrom(match.awayTeam, awayResults), results: awayResults },
  };
}
