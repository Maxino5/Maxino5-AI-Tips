import { runModel, normaliseMarket, fairOdds } from "./model.server";
import {
  fetchEventsByDay,
  fetchMatchContext as fetchEspnMatchContext,
  fetchTeamCardHistory,
  fetchMatchCardTotal,
  fetchStandings,
  mapWithConcurrency,
} from "./espn.server";
import {
  fetchSportsDbEventsByDay,
  fetchSportsDbMatchContext,
  isSportsDbMatchId,
} from "./thesportsdb.server";
import { mergeMatchSources } from "./match-dedupe";
import { deriveTrends } from "./trends.server";
import { parseMatchId } from "./match-id";
import { analyseMatch } from "./ai.server";
import type {
  AccuracyReport,
  Market,
  Match,
  Prediction,
  Sport,
  ValuePick,
  ValuePickRecord,
  ValuePickRecordEntry,
} from "./types";
import type { MatchContext } from "./espn.server";

const predictionCache = new Map<string, { value: Prediction; expires: number }>();

/** Fetches full recent-form context for a match, routing to whichever
 *  source (ESPN or TheSportsDB) it originally came from. */
async function fetchMatchContext(
  matchId: string,
  beforeDate?: string,
): Promise<MatchContext | null> {
  if (isSportsDbMatchId(matchId)) return fetchSportsDbMatchContext(matchId, beforeDate);
  return fetchEspnMatchContext(matchId, beforeDate);
}

export async function loadMatches(date: string, sport: Sport): Promise<Match[]> {
  const [primary, secondary] = await Promise.all([
    fetchEventsByDay(date, sport).catch(() => []),
    fetchSportsDbEventsByDay(date, sport).catch(() => []),
  ]);
  const matches = mergeMatchSources(primary, secondary);
  return matches.sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""));
}

function applyAdjustments(markets: Market[], adjustments: { key: string; probability: number }[]) {
  const map = new Map(adjustments.map((a) => [a.key, a.probability]));
  return markets
    .map((m) => ({
      ...m,
      selections: m.selections.map((s) => {
        const raw = map.get(s.key);
        if (typeof raw !== "number" || Number.isNaN(raw)) return s;
        const blended = Math.min(0.97, Math.max(0.02, s.probability * 0.45 + raw * 0.55));
        return { ...s, probability: blended, fairOdds: fairOdds(blended) };
      }),
    }))
    .map(normaliseMarket);
}

export async function buildPrediction(matchId: string): Promise<Prediction | null> {
  const cached = predictionCache.get(matchId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const context = await fetchMatchContext(matchId);
  if (!context) return null;
  const { match, home, away, headToHead } = context;

  // Standings only exist for football, and only for ESPN-sourced matches.
  let standings: Awaited<ReturnType<typeof fetchStandings>> = null;
  if (!isSportsDbMatchId(matchId) && match.sport === "football") {
    const parsedForStandings = parseMatchId(matchId);
    if (parsedForStandings) {
      standings = await fetchStandings(parsedForStandings.league).catch(() => null);
    }
  }

  // Card history needs one extra request per historical match, so it's only
  // ever fetched here — for the single match someone actually opened — never
  // for the daily list, value picks, or the accuracy backtest. Only
  // available for ESPN-sourced matches (TheSportsDB doesn't expose it).
  let cards: { home: number[]; away: number[] } | undefined;
  if (!isSportsDbMatchId(matchId) && match.sport === "football" && home.teamId && away.teamId) {
    const parsed = parseMatchId(matchId);
    const league = parsed?.league ?? "";
    const [homeCards, awayCards] = await Promise.all([
      fetchTeamCardHistory(match.sport, league, home.teamId).catch(() => []),
      fetchTeamCardHistory(match.sport, league, away.teamId).catch(() => []),
    ]);
    if (homeCards.length && awayCards.length) cards = { home: homeCards, away: awayCards };
  }

  const model = runModel({
    sport: match.sport,
    home: home.results,
    away: away.results,
    ...(cards ? { cards } : {}),
  });
  let markets = model.markets.map(normaliseMarket);

  const trends = {
    home: deriveTrends(match.homeTeam, home.results),
    away: deriveTrends(match.awayTeam, away.results),
  };

  const analysis = await analyseMatch({
    sport: match.sport,
    league: match.league,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoff: match.kickoff,
    form: { home: home.form, away: away.form },
    trends,
    expectedHome: model.expectedHome,
    expectedAway: model.expectedAway,
    expectedCorners: model.expectedCorners,
    markets,
  });

  if (analysis?.adjustments?.length) {
    markets = applyAdjustments(markets, analysis.adjustments);
  }

  const flat = markets.flatMap((m) => m.selections.map((s) => ({ m, s })));
  const preferred = analysis?.bestBetKey
    ? flat.find((f) => f.s.key === analysis.bestBetKey)
    : undefined;
  const fallback = flat
    .filter((f) => f.m.id !== "dc")
    .sort((a, b) => b.s.probability - a.s.probability)[0];
  const best = preferred ?? fallback;

  const baseConfidence = 42 + model.dataQuality * 26 + (best ? best.s.probability * 26 : 0);
  const aiConfidence = analysis
    ? analysis.confidence <= 1
      ? analysis.confidence * 100
      : analysis.confidence
    : null;
  const confidence = Math.round(
    Math.min(
      96,
      Math.max(35, aiConfidence !== null ? (aiConfidence + baseConfidence) / 2 : baseConfidence),
    ),
  );

  const fallbackReasoning = () => {
    const bits = [...trends.home, ...trends.away];
    if (bits.length) return `${bits.join(". ")}.`;
    return `Built from recent scoring rates: ${match.homeTeam} project ${model.expectedHome} and ${match.awayTeam} ${model.expectedAway}. Probabilities come from a Poisson/normal simulation of that expectation.`;
  };

  const prediction: Prediction = {
    matchId,
    sport: match.sport,
    generatedAt: new Date().toISOString(),
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeBadge: match.homeBadge,
    awayBadge: match.awayBadge,
    league: match.league,
    venue: match.venue,
    kickoff: match.kickoff,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    liveMinute: match.liveMinute,
    expectedHome: model.expectedHome,
    expectedAway: model.expectedAway,
    expectedCorners: model.expectedCorners,
    confidence,
    headline:
      analysis?.headline ?? (best ? `${best.s.label} looks the standout call` : "Balanced matchup"),
    reasoning: analysis?.reasoning ?? fallbackReasoning(),
    trends,
    bestBet: best
      ? { market: best.m.name, label: best.s.label, probability: best.s.probability }
      : { market: "Match Result", label: "No edge", probability: 0.33 },
    markets,
    form: { home: home.form, away: away.form },
    standings,
    headToHead,
    aiEnhanced: Boolean(analysis),
  };

  predictionCache.set(matchId, { value: prediction, expires: Date.now() + 20 * 60 * 1000 });
  return prediction;
}

/** Fast, AI-free ranking used for the "value picks" strip. */
export async function buildValuePicks(date: string, limit = 15): Promise<ValuePick[]> {
  const tomorrow = new Date(`${date}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextDay = tomorrow.toISOString().slice(0, 10);

  const [football, basketball, footballNext, basketballNext] = await Promise.all([
    loadMatches(date, "football"),
    loadMatches(date, "basketball"),
    loadMatches(nextDay, "football"),
    loadMatches(nextDay, "basketball"),
  ]);
  const upcoming = [...football, ...basketball].filter((m) => m.status !== "finished");
  const pool = (
    upcoming.length
      ? upcoming
      : [...footballNext, ...basketballNext].filter((m) => m.status !== "finished")
  ).slice(0, 45);

  const picks = await Promise.all(
    pool.map(async (match): Promise<ValuePick | null> => {
      const context = await fetchMatchContext(match.id);
      if (!context) return null;
      const { home, away } = context;
      if (home.results.length + away.results.length < 1) return null;
      const model = runModel({ sport: match.sport, home: home.results, away: away.results });
      const flat = model.markets
        .map(normaliseMarket)
        .flatMap((m) => m.selections.map((s) => ({ m, s })))
        .filter((f) => f.s.probability < 0.9 && !UNGRADABLE_MARKETS.has(f.m.id))
        .sort((a, b) => b.s.probability - a.s.probability);
      const top = flat[0];
      if (!top) return null;
      return {
        match,
        market: top.m.name,
        label: top.s.label,
        probability: top.s.probability,
        confidence: Math.round(45 + model.dataQuality * 25 + top.s.probability * 25),
      };
    }),
  );

  return picks
    .filter((p): p is ValuePick => p !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/** Reconstructs exactly what buildValuePicks would have shown on a specific
 *  PAST date, then grades each of those picks against real results. Not a
 *  literal saved record (this app has no database) — a faithful replay
 *  using only data that existed before that day's matches kicked off
 *  (fetchMatchContext's `beforeDate` prevents any leakage from results
 *  after the fact). In the overwhelming majority of cases this matches what
 *  a visitor actually saw that day, since the ranking logic is
 *  deterministic given the same inputs. */
export async function buildValuePickRecord(date: string, limit = 15): Promise<ValuePickRecord> {
  const [football, basketball] = await Promise.all([
    loadMatches(date, "football"),
    loadMatches(date, "basketball"),
  ]);
  const pool = [...football, ...basketball].slice(0, 60);

  const candidates = await Promise.all(
    pool.map(async (match) => {
      const context = await fetchMatchContext(match.id, date);
      if (!context) return null;
      const { home, away } = context;
      if (home.results.length + away.results.length < 1) return null;
      const model = runModel({ sport: match.sport, home: home.results, away: away.results });
      const flat = model.markets
        .map(normaliseMarket)
        .flatMap((m) => m.selections.map((s) => ({ m, s })))
        .filter((f) => f.s.probability < 0.9 && !UNGRADABLE_MARKETS.has(f.m.id))
        .sort((a, b) => b.s.probability - a.s.probability);
      const top = flat[0];
      if (!top) return null;
      return {
        match,
        marketId: top.m.id,
        market: MARKET_LABELS[top.m.id] ?? top.m.name,
        key: top.s.key,
        label: top.s.label,
        probability: top.s.probability,
        confidence: Math.round(45 + model.dataQuality * 25 + top.s.probability * 25),
      };
    }),
  );

  const ranked = candidates
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);

  const picks: ValuePickRecordEntry[] = [];
  for (const c of ranked) {
    if (c.match.status !== "finished" || c.match.homeScore === null || c.match.awayScore === null) {
      continue;
    }

    let hit: boolean | null;
    if (c.marketId === "cards") {
      const parsed = isSportsDbMatchId(c.match.id) ? null : parseMatchId(c.match.id);
      if (!parsed) continue;
      const total = await fetchMatchCardTotal(c.match.sport, parsed.league, parsed.eventId).catch(
        () => null,
      );
      if (total === null) continue;
      hit = settleCards(c.key, total);
    } else {
      hit = settle(c.key, c.match.homeScore, c.match.awayScore);
    }
    if (hit === null) continue;

    picks.push({
      matchId: c.match.id,
      fixture: `${c.match.homeTeam} vs ${c.match.awayTeam}`,
      league: c.match.league,
      market: c.market,
      label: c.label,
      probability: c.probability,
      hit,
    });
  }

  return {
    date,
    hits: picks.filter((p) => p.hit).length,
    total: picks.length,
    picks,
  };
}

const MARKET_LABELS: Record<string, string> = {
  "1x2": "Match Result",
  dc: "Double Chance",
  goals: "Total Goals",
  btts: "Both Teams To Score",
  points: "Total Points",
};

// Corners has no real final-result data available anywhere in either source
// (see scripts/check-corners.mjs) — excluding it from ever being chosen as
// "the" pick for a match keeps every shown pick gradable. If that ever
// changes, remove it here and add a settle() case for it.
const UNGRADABLE_MARKETS = new Set(["corners"]);

function settle(key: string, hs: number, as: number): boolean | null {
  const [market, option] = key.split(":");
  const total = hs + as;
  if (market === "1x2") {
    if (option === "home") return hs > as;
    if (option === "away") return as > hs;
    if (option === "draw") return hs === as;
  }
  if (market === "dnb") {
    if (hs === as) return null; // push/void — a draw refunds the stake, neither a win nor a loss
    if (option === "home") return hs > as;
    if (option === "away") return as > hs;
  }
  if (market === "dc") {
    if (option === "1x") return hs >= as;
    if (option === "12") return hs !== as;
    if (option === "x2") return as >= hs;
  }
  if (market === "goals" || market === "points") {
    const line = Number(option?.slice(1));
    if (Number.isNaN(line)) return null;
    return option?.startsWith("o") ? total > line : total < line;
  }
  if (market === "home_goals" || market === "away_goals") {
    const line = Number(option?.slice(1));
    if (Number.isNaN(line)) return null;
    const score = market === "home_goals" ? hs : as;
    return option?.startsWith("o") ? score > line : score < line;
  }
  if (market === "btts") {
    const yes = hs > 0 && as > 0;
    return option === "yes" ? yes : !yes;
  }
  return null; // corners / spreads not verifiable from the free feed
}

function settleCards(key: string, actualTotal: number): boolean | null {
  const [market, option] = key.split(":");
  if (market !== "cards") return null;
  const line = Number(option?.slice(1));
  if (Number.isNaN(line)) return null;
  return option?.startsWith("o") ? actualTotal > line : actualTotal < line;
}

/**
 * Rolling backtest: for finished matches in the last N days, re-run the
 * statistical model using only form recorded BEFORE the match, then settle
 * the top pick of each verifiable market against the real score.
 */
export async function buildAccuracyReport(windowDays = 5): Promise<AccuracyReport> {
  const days: string[] = [];
  for (let i = 1; i <= windowDays; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // This never calls the AI — only the free ESPN/TheSportsDB feeds and the
  // statistical model — so a bigger sample doesn't touch the Groq quota at
  // all. What it DOES cost is request volume and page-load time, which is
  // why the per-match work below is concurrency-limited rather than one at
  // a time. A fair cap PER DAY (not one global cutoff applied in day order)
  // means a single busy day can't crowd out the rest of the window — with a
  // global cutoff, one 50-fixture day could silently leave the other four
  // days contributing nothing to this report at all.
  const TOTAL_SAMPLE_CAP = 150;
  const perDayCap = Math.ceil(TOTAL_SAMPLE_CAP / windowDays);

  const dayMatchLists = await Promise.all(
    days.map(async (d) => {
      const [football, basketball] = await Promise.all([
        loadMatches(d, "football"),
        loadMatches(d, "basketball"),
      ]);
      return [...football, ...basketball]
        .filter((m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null)
        .slice(0, perDayCap);
    }),
  );
  const finished = dayMatchLists.flat();

  const byMarket = new Map<string, { hits: number; total: number }>();
  const bySport = new Map<Sport, { hits: number; total: number }>();
  const CONF_BANDS: { min: number; max: number; band: string }[] = [
    { min: 0, max: 0.6, band: "Under 60%" },
    { min: 0.6, max: 0.7, band: "60–69%" },
    { min: 0.7, max: 0.8, band: "70–79%" },
    { min: 0.8, max: 1.01, band: "80%+" },
  ];
  const byConfidence = new Map<string, { hits: number; total: number }>();
  let sampleSize = 0;

  await mapWithConcurrency(finished, 10, async (match) => {
    const context = await fetchMatchContext(match.id, match.date).catch(() => null);
    if (!context) return;
    const { home, away } = context;
    if (home.results.length + away.results.length < 1) return;

    const model = runModel({ sport: match.sport, home: home.results, away: away.results });
    let countedThisMatch = false;

    for (const market of model.markets.map(normaliseMarket)) {
      const top = [...market.selections].sort((a, b) => b.probability - a.probability)[0];
      if (!top) continue;
      const hit = settle(top.key, match.homeScore ?? 0, match.awayScore ?? 0);
      if (hit === null) continue;
      countedThisMatch = true;

      const label = MARKET_LABELS[market.id] ?? market.name;
      const bucket = byMarket.get(label) ?? { hits: 0, total: 0 };
      bucket.total += 1;
      if (hit) bucket.hits += 1;
      byMarket.set(label, bucket);

      const sportBucket = bySport.get(match.sport) ?? { hits: 0, total: 0 };
      sportBucket.total += 1;
      if (hit) sportBucket.hits += 1;
      bySport.set(match.sport, sportBucket);

      const band =
        CONF_BANDS.find((b) => top.probability >= b.min && top.probability < b.max)?.band ?? "80%+";
      const confBucket = byConfidence.get(band) ?? { hits: 0, total: 0 };
      confBucket.total += 1;
      if (hit) confBucket.hits += 1;
      byConfidence.set(band, confBucket);
    }

    if (countedThisMatch) sampleSize += 1;
  });

  const totals = [...byMarket.values()].reduce(
    (a, b) => ({ hits: a.hits + b.hits, total: a.total + b.total }),
    { hits: 0, total: 0 },
  );

  return {
    windowDays,
    sampleSize,
    overall: totals.total ? totals.hits / totals.total : 0,
    byMarket: [...byMarket.entries()]
      .map(([market, v]) => ({
        market,
        hits: v.hits,
        total: v.total,
        accuracy: v.total ? v.hits / v.total : 0,
      }))
      .sort((a, b) => b.total - a.total),
    bySport: [...bySport.entries()].map(([sport, v]) => ({
      sport,
      hits: v.hits,
      total: v.total,
      accuracy: v.total ? v.hits / v.total : 0,
    })),
    byConfidence: CONF_BANDS.map((b) => {
      const v = byConfidence.get(b.band) ?? { hits: 0, total: 0 };
      return {
        band: b.band,
        hits: v.hits,
        total: v.total,
        accuracy: v.total ? v.hits / v.total : 0,
      };
    }).filter((b) => b.total > 0),
  };
}
