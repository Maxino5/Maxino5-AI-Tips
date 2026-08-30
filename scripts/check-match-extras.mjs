// Run with: node scripts/check-match-extras.mjs
//
// Checks whether either data source actually exposes two things the app
// doesn't currently collect at all, needed for Halftime/Fulltime, Win Either
// Half, and Bookings (cards) Over/Under:
//
//   1. Halftime score (not just full-time)
//   2. Card counts (yellow/red bookings) per team
//
// Uses REAL recently-finished matches (pulled from yesterday's scoreboard),
// not guessed IDs. Prints the raw shape of whatever comes back so we can see
// exactly what's there — this script makes no assumption about field names
// beyond the ones ESPN/TheSportsDB are documented to sometimes use.

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const ymd = yesterday.toISOString().slice(0, 10);
const ymdCompact = ymd.replace(/-/g, "");

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

const LEAGUES = ["eng.1", "esp.1", "ita.1", "usa.1", "bra.1"];
const MATCHES_PER_LEAGUE = 2;

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, data: await res.json() };
  } catch (err) {
    return { ok: false, status: "network-error", error: String(err) };
  }
}

async function finishedMatchesYesterday(league) {
  const url = `${ESPN_BASE}/${league}/scoreboard?dates=${ymdCompact}&limit=50`;
  const res = await getJson(url);
  if (!res.ok) return [];
  const finished = (res.data?.events ?? []).filter(
    (ev) => ev.status?.type?.completed === true,
  );
  return finished.slice(0, MATCHES_PER_LEAGUE).map((ev) => ({
    id: ev.id,
    name: ev.name,
    league,
  }));
}

function findHalftimeFields(obj, path = "", hits = []) {
  if (!obj || typeof obj !== "object") return hits;
  for (const [key, value] of Object.entries(obj)) {
    if (/half|ht\b/i.test(key)) hits.push({ path: `${path}.${key}`, value: typeof value === "object" ? "[object]" : value });
    if (typeof value === "object") findHalftimeFields(value, `${path}.${key}`, hits);
  }
  return hits;
}

function findCardFields(obj, path = "", hits = []) {
  if (!obj || typeof obj !== "object") return hits;
  for (const [key, value] of Object.entries(obj)) {
    if (/card|yellow|red\b|booking/i.test(key)) {
      hits.push({ path: `${path}.${key}`, value: typeof value === "object" ? "[object]" : value });
    }
    if (typeof value === "object") findCardFields(value, `${path}.${key}`, hits);
  }
  return hits;
}

async function checkEspnSummary(match) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${match.league}/summary?event=${match.id}`;
  const res = await getJson(url);
  if (!res.ok) return { ...match, source: "espn", ok: false, status: res.status };
  return {
    ...match,
    source: "espn",
    ok: true,
    halftimeHits: findHalftimeFields(res.data).slice(0, 5),
    cardHits: findCardFields(res.data).slice(0, 5),
  };
}

async function checkSportsDbEvent(homeTeam, awayTeam) {
  const url = `${SPORTSDB_BASE}/searchevents.php?e=${encodeURIComponent(`${homeTeam}_vs_${awayTeam}`)}`;
  const res = await getJson(url);
  if (!res.ok || !res.data?.event?.length) return { ok: false };
  const ev = res.data.event[0];
  return {
    ok: true,
    halftimeHits: findHalftimeFields(ev).slice(0, 5),
    cardHits: findCardFields(ev).slice(0, 5),
    rawKeys: Object.keys(ev).filter((k) => /half|card|yellow|red|book/i.test(k)),
  };
}

console.log(`Pulling real finished matches from ${ymd} to inspect their full data...\n`);

const allResults = [];
for (const league of LEAGUES) {
  const matches = await finishedMatchesYesterday(league);
  if (!matches.length) {
    console.log(`(${league}) — no finished matches found for ${ymd})`);
    continue;
  }
  for (const match of matches) {
    const espnResult = await checkEspnSummary(match);
    allResults.push(espnResult);
    await new Promise((r) => setTimeout(r, 150));

    const [home, away] = match.name?.split(" at ").reverse() ?? [];
    if (home && away) {
      const sportsDbResult = await checkSportsDbEvent(home, away);
      allResults.push({ ...match, source: "sportsdb", ...sportsDbResult });
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

console.log("\n--- Results ---\n");
for (const r of allResults) {
  console.log(`\n${r.source.toUpperCase()} — ${r.name ?? `${r.league}`} `);
  if (!r.ok) {
    console.log(`   ❌ request failed (status ${r.status ?? "n/a"})`);
    continue;
  }
  console.log(
    r.halftimeHits?.length
      ? `   ✅ halftime-related fields found: ${JSON.stringify(r.halftimeHits)}`
      : "   ➖ no halftime-related fields found",
  );
  console.log(
    r.cardHits?.length
      ? `   ✅ card/booking-related fields found: ${JSON.stringify(r.cardHits)}`
      : "   ➖ no card/booking-related fields found",
  );
}

console.log(
  "\nSend me this full output. If halftime/card fields show up with real numbers (not always\n" +
    "null/0), that's a green light to build those markets. If they're consistently absent, we\n" +
    "leave Halftime/Fulltime, Win Either Half, and Bookings out rather than fake them.",
);
