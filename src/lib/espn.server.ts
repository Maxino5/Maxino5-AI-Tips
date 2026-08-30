import type { Match, Sport, TeamForm } from "./types";
import { makeMatchId, parseMatchId } from "./match-id";

/**
 * Live data provider: ESPN's public scoreboard feeds.
 * Free, no key, and covers dozens of competitions per day including club
 * friendlies (which the previous provider missed entirely).
 */
const BASE = "https://site.api.espn.com/apis/site/v2/sports";

// Verified directly against ESPN's live API by running
// `npm run check:leagues` (see scripts/check-espn-leagues.mjs) — every slug
// below returned a real response, not a guess. If a `[espn] 400 fetching
// .../<slug>/scoreboard` ever shows up for one of these, re-run that script;
// it'll flag anything that's gone dead since and give you an updated list.
const SOCCER_LEAGUES = [
  "club.friendly",
  "fifa.friendly",
  "uefa.champions",
  "uefa.europa",
  "uefa.europa.conf",
  "uefa.super_cup",
  "uefa.nations",
  "eng.1",
  "eng.2",
  "eng.3",
  "eng.4",
  "eng.fa",
  "eng.league_cup",
  "eng.charity",
  "eng.w.1",
  "esp.1",
  "esp.2",
  "esp.copa_del_rey",
  "ita.1",
  "ita.2",
  "ita.coppa_italia",
  "ger.1",
  "ger.2",
  "ger.dfb_pokal",
  "fra.1",
  "fra.2",
  "fra.coupe_de_france",
  "ned.1",
  "ned.2",
  "por.1",
  "bel.1",
  "tur.1",
  "tur.2",
  "sco.1",
  "sco.2",
  "gre.1",
  "sui.1",
  "aut.1",
  "den.1",
  "nor.1",
  "swe.1",
  "rou.1",
  "isr.1",
  "cze.1",
  "fin.1",
  "wal.1",
  "irl.1",
  "usa.1",
  "usa.usl.1",
  "usa.nwsl",
  "usa.open",
  "mex.1",
  "mex.2",
  "gua.1",
  "hon.1",
  "crc.1",
  "bra.1",
  "bra.2",
  "arg.1",
  "arg.2",
  "col.1",
  "chi.1",
  "per.1",
  "ecu.1",
  "ven.1",
  "bol.1",
  "par.1",
  "conmebol.libertadores",
  "conmebol.sudamericana",
  "concacaf.champions",
  "concacaf.gold",
  "jpn.1",
  "chn.1",
  "aus.1",
  "idn.1",
  "tha.1",
  "ind.1",
  "ksa.1",
  "afc.champions",
  "caf.champions",
  "rsa.1",
  "gha.1",
  "nga.1",
] as const;

const BASKETBALL_LEAGUES = [
  "nba",
  "wnba",
  "mens-college-basketball",
  "womens-college-basketball",
  "nba-summer-las-vegas",
  "nbl",
] as const;

const SPORT_PATH: Record<Sport, string> = {
  football: "soccer",
  basketball: "basketball",
};

const LEAGUES: Record<Sport, readonly string[]> = {
  football: SOCCER_LEAGUES,
  basketball: BASKETBALL_LEAGUES,
};

type Cached<T> = { value: T; expires: number };
const cache = new Map<string, Cached<unknown>>();

// If a competition slug turns out to be invalid (400), there's no point
// hitting it again for every other date/page load in the same server
// lifetime — remember it and skip straight to returning nothing, silently,
// instead of repeating the same doomed request and log line over and over.
const deadLeagues = new Map<string, number>();
const DEAD_LEAGUE_TTL_MS = 6 * 60 * 60 * 1000;

function isKnownDead(league: string): boolean {
  const until = deadLeagues.get(league);
  return until !== undefined && until > Date.now();
}

function markDead(league: string) {
  deadLeagues.set(league, Date.now() + DEAD_LEAGUE_TTL_MS);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ESPN's public endpoints throttle bursts of concurrent requests from the same
 * origin. A short retry recovers genuinely transient failures (429/5xx), and
 * a hard timeout stops one slow/hanging league from stalling the whole page
 * load — without a timeout, `fetch` can hang far longer than is reasonable
 * for a page that's supposed to feel instant.
 */
const REQUEST_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, attempts = 2): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await delay(250 * 2 ** i);
        continue;
      }
      return res;
    } catch {
      await delay(250 * 2 ** i);
    }
  }
  return null;
}

/** Runs `fn` over `items` with at most `limit` requests in flight at once,
 *  instead of firing every request simultaneously and tripping rate limits. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function cachedJson<T>(url: string, ttlMs: number, on400?: () => void): Promise<T | null> {
  const hit = cache.get(url) as Cached<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const res = await fetchWithRetry(url);
    if (!res || !res.ok) {
      if (res?.status === 400) {
        console.warn(`[espn] 400 fetching ${url} — marking this competition as dead for now`);
        on400?.();
      } else if (res && res.status !== 404) {
        console.warn(`[espn] ${res.status} fetching ${url}`);
      }
      return null;
    }
    const json = (await res.json()) as T;
    cache.set(url, { value: json, expires: Date.now() + ttlMs });
    return json;
  } catch (err) {
    console.warn(`[espn] failed fetching ${url}`, err);
    return null;
  }
}

interface EspnCompetitor {
  id: string;
  homeAway: "home" | "away";
  score?: string | { displayValue?: string; value?: number } | null;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    logo?: string;
    logos?: { href: string }[];
  };
}

interface EspnEvent {
  id: string;
  date: string;
  name?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions?: {
    id: string;
    date: string;
    venue?: { fullName?: string };
    status?: { type?: { state?: string; completed?: boolean } };
    competitors?: EspnCompetitor[];
  }[];
}

interface EspnScoreboard {
  leagues?: { id?: string; name?: string; abbreviation?: string; logos?: { href: string }[] }[];
  events?: EspnEvent[] | null;
}

function scoreOf(c: EspnCompetitor | undefined): number | null {
  if (!c) return null;
  const raw =
    typeof c.score === "object" && c.score !== null
      ? (c.score.displayValue ?? c.score.value)
      : c.score;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function logoOf(c: EspnCompetitor | undefined): string | null {
  return c?.team?.logo ?? c?.team?.logos?.[0]?.href ?? null;
}

export { makeMatchId, parseMatchId };

function mapEvent(
  e: EspnEvent,
  sport: Sport,
  league: string,
  leagueName: string,
  leagueBadge: string | null,
): Match | null {
  const comp = e.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team?.displayName || !away?.team?.displayName) return null;

  const state = comp?.status?.type?.state ?? e.status?.type?.state;
  const completed = comp?.status?.type?.completed ?? e.status?.type?.completed;
  const status: Match["status"] =
    completed || state === "post" ? "finished" : state === "in" ? "live" : "upcoming";

  return {
    id: makeMatchId(sport, league, e.id),
    sport,
    league: leagueName,
    leagueId: league,
    leagueBadge,
    homeTeam: home.team.displayName,
    awayTeam: away.team.displayName,
    homeBadge: logoOf(home),
    awayBadge: logoOf(away),
    kickoff: e.date ?? null,
    date: (e.date ?? "").slice(0, 10),
    status,
    homeScore: scoreOf(home),
    awayScore: scoreOf(away),
    venue: comp?.venue?.fullName ?? null,
  };
}

const eventIndex = new Map<string, Match>();

async function fetchLeagueDay(sport: Sport, league: string, date: string): Promise<Match[]> {
  if (isKnownDead(league)) return [];
  const url = `${BASE}/${SPORT_PATH[sport]}/${league}/scoreboard?dates=${date.replace(/-/g, "")}&limit=200`;
  const data = await cachedJson<EspnScoreboard>(url, 3 * 60 * 1000, () => markDead(league));
  const leagueMeta = data?.leagues?.[0];
  const leagueName = leagueMeta?.name ?? league;
  const badge = leagueMeta?.logos?.[0]?.href ?? null;
  const matches: Match[] = [];
  for (const e of data?.events ?? []) {
    const m = mapEvent(e, sport, league, leagueName, badge);
    if (m) {
      eventIndex.set(m.id, m);
      matches.push(m);
    }
  }
  return matches;
}

export async function fetchEventsByDay(date: string, sport: Sport): Promise<Match[]> {
  const results = await mapWithConcurrency(LEAGUES[sport], 8, (league) =>
    fetchLeagueDay(sport, league, date).catch(() => []),
  );
  const seen = new Set<string>();
  return results.flat().filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export interface PastResult {
  date: string;
  isHome: boolean;
  scored: number;
  conceded: number;
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

interface EspnSummary {
  header?: {
    id?: string;
    competitions?: {
      date?: string;
      venue?: { fullName?: string };
      status?: { type?: { state?: string; completed?: boolean } };
      competitors?: EspnCompetitor[];
    }[];
    league?: { name?: string; slug?: string; logos?: { href: string }[] };
    leagues?: { name?: string; slug?: string; logos?: { href: string }[] }[];
  };
  lastFiveGames?: {
    team?: { id?: string; displayName?: string };
    events?: {
      gameDate?: string;
      homeTeamId?: string;
      awayTeamId?: string;
      homeTeamScore?: string;
      awayTeamScore?: string;
    }[];
  }[];
  // Confirmed present via scripts/check-match-extras.mjs against live data:
  // rosters[].roster[].plays[].{yellowCard,redCard} are real booleans.
  // Team identification on the roster entry itself isn't fully confirmed,
  // so lookup below tries a couple of shapes defensively.
  rosters?: {
    team?: { id?: string };
    homeAway?: string;
    roster?: { plays?: { yellowCard?: boolean; redCard?: boolean }[] }[];
  }[];
}

async function fetchSummary(
  sport: Sport,
  league: string,
  eventId: string,
): Promise<EspnSummary | null> {
  return cachedJson<EspnSummary>(
    `${BASE}/${SPORT_PATH[sport]}/${league}/summary?event=${eventId}`,
    10 * 60 * 1000,
  );
}

interface EspnSchedule {
  events?: {
    id?: string;
    date?: string;
    competitions?: {
      status?: { type?: { completed?: boolean } };
      competitors?: EspnCompetitor[];
    }[];
  }[];
}

async function fetchTeamSchedule(
  sport: Sport,
  league: string,
  teamId: string,
  beforeDate?: string,
): Promise<PastResult[]> {
  const data = await cachedJson<EspnSchedule>(
    `${BASE}/${SPORT_PATH[sport]}/${league}/teams/${teamId}/schedule`,
    30 * 60 * 1000,
  );
  const out: PastResult[] = [];
  for (const e of data?.events ?? []) {
    const comp = e.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    const date = (e.date ?? "").slice(0, 10);
    if (beforeDate && date >= beforeDate) continue;
    const me = comp.competitors?.find((c) => (c.team?.id ?? c.id) === teamId);
    const opp = comp.competitors?.find((c) => (c.team?.id ?? c.id) !== teamId);
    const mine = scoreOf(me);
    const theirs = scoreOf(opp);
    if (mine === null || theirs === null) continue;
    out.push({ date, isHome: me?.homeAway === "home", scored: mine, conceded: theirs });
  }
  return out.slice(-8);
}

function findRosterForTeam(summary: EspnSummary, teamId: string, homeAway: "home" | "away") {
  const rosters = summary.rosters ?? [];
  return (
    rosters.find((r) => r.team?.id === teamId) ??
    rosters.find((r) => r.homeAway === homeAway) ??
    null
  );
}

function countCards(roster: NonNullable<EspnSummary["rosters"]>[number]): number {
  let count = 0;
  for (const player of roster.roster ?? []) {
    for (const play of player.plays ?? []) {
      if (play.yellowCard) count++;
      if (play.redCard) count++;
    }
  }
  return count;
}

/** Real per-match card counts for a team's last few completed matches.
 *  Deliberately not called from the daily list, value picks, or accuracy
 *  backtest — each call here needs one full match-summary request per past
 *  match, so it's reserved for the single-match prediction page only. */
export async function fetchTeamCardHistory(
  sport: Sport,
  league: string,
  teamId: string,
  beforeDate?: string,
  limit = 5,
): Promise<number[]> {
  const data = await cachedJson<EspnSchedule>(
    `${BASE}/${SPORT_PATH[sport]}/${league}/teams/${teamId}/schedule`,
    30 * 60 * 1000,
  );
  const pastMatches: { id: string; homeAway: "home" | "away" }[] = [];
  for (const e of data?.events ?? []) {
    const comp = e.competitions?.[0];
    if (!comp?.status?.type?.completed || !e.id) continue;
    const date = (e.date ?? "").slice(0, 10);
    if (beforeDate && date >= beforeDate) continue;
    const me = comp.competitors?.find((c) => (c.team?.id ?? c.id) === teamId);
    if (!me) continue;
    pastMatches.push({ id: e.id, homeAway: me.homeAway === "home" ? "home" : "away" });
  }

  const recent = pastMatches.slice(-limit);
  const counts = await mapWithConcurrency(recent, 3, async (m) => {
    const summary = await fetchSummary(sport, league, m.id);
    if (!summary) return null;
    const roster = findRosterForTeam(summary, teamId, m.homeAway);
    return roster ? countCards(roster) : null;
  });
  return counts.filter((c): c is number => c !== null);
}

function resultsFromLastFive(
  summary: EspnSummary,
  teamId: string,
  beforeDate?: string,
): PastResult[] {
  const block = summary.lastFiveGames?.find((b) => b.team?.id === teamId);
  const out: PastResult[] = [];
  for (const g of block?.events ?? []) {
    const date = (g.gameDate ?? "").slice(0, 10);
    if (beforeDate && date >= beforeDate) continue;
    const hs = Number(g.homeTeamScore);
    const as = Number(g.awayTeamScore);
    if (Number.isNaN(hs) || Number.isNaN(as)) continue;
    const isHome = g.homeTeamId === teamId;
    out.push({ date, isHome, scored: isHome ? hs : as, conceded: isHome ? as : hs });
  }
  return out;
}

export interface MatchContext {
  match: Match;
  home: { form: TeamForm; results: PastResult[]; teamId: string | null };
  away: { form: TeamForm; results: PastResult[]; teamId: string | null };
}

export async function fetchMatchContext(
  matchId: string,
  beforeDate?: string,
): Promise<MatchContext | null> {
  const parsed = parseMatchId(matchId);
  if (!parsed) return null;
  const { sport, league, eventId } = parsed;

  const summary = await fetchSummary(sport, league, eventId);
  const header = summary?.header;
  const comp = header?.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const homeC = competitors.find((c) => c.homeAway === "home");
  const awayC = competitors.find((c) => c.homeAway === "away");

  const indexed = eventIndex.get(matchId);
  let match = indexed ?? null;

  if (!match && homeC?.team?.displayName && awayC?.team?.displayName) {
    const leagueMeta = header?.league ?? header?.leagues?.[0];
    const state = comp?.status?.type?.state;
    match = {
      id: matchId,
      sport,
      league: leagueMeta?.name ?? league,
      leagueId: league,
      leagueBadge: leagueMeta?.logos?.[0]?.href ?? null,
      homeTeam: homeC.team.displayName,
      awayTeam: awayC.team.displayName,
      homeBadge: logoOf(homeC),
      awayBadge: logoOf(awayC),
      kickoff: comp?.date ?? null,
      date: (comp?.date ?? "").slice(0, 10),
      status:
        comp?.status?.type?.completed || state === "post"
          ? "finished"
          : state === "in"
            ? "live"
            : "upcoming",
      homeScore: scoreOf(homeC),
      awayScore: scoreOf(awayC),
      venue: comp?.venue?.fullName ?? null,
    };
  }
  if (!match) return null;

  const homeId = homeC?.team?.id ?? homeC?.id;
  const awayId = awayC?.team?.id ?? awayC?.id;

  let homeResults: PastResult[] = [];
  let awayResults: PastResult[] = [];

  if (summary && homeId && awayId) {
    homeResults = resultsFromLastFive(summary, homeId, beforeDate);
    awayResults = resultsFromLastFive(summary, awayId, beforeDate);
  }

  if (!homeResults.length && homeId) {
    homeResults = await fetchTeamSchedule(sport, league, homeId, beforeDate).catch(() => []);
  }
  if (!awayResults.length && awayId) {
    awayResults = await fetchTeamSchedule(sport, league, awayId, beforeDate).catch(() => []);
  }

  return {
    match,
    home: {
      form: formFrom(match.homeTeam, homeResults),
      results: homeResults,
      teamId: homeId ?? null,
    },
    away: {
      form: formFrom(match.awayTeam, awayResults),
      results: awayResults,
      teamId: awayId ?? null,
    },
  };
}
