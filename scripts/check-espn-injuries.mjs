// Run with: node scripts/check-espn-injuries.mjs
//
// Checks whether ESPN's documented (but unofficial) injuries endpoint
// actually returns real player data, and for which leagues, before any of
// it gets built into the app's match-narrative feature.
//
//   GET /apis/site/v2/sports/soccer/{league}/teams/{teamId}/injuries
//
// Team IDs are NOT guessed — they're pulled from today's real scoreboard
// first, then used to query the injuries endpoint for real teams that are
// actually playing today. A spread of leagues is tested on purpose, since
// coverage on ESPN's unofficial endpoints is known to be uneven.

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

const LEAGUES_TO_SAMPLE = [
  "eng.1",
  "esp.1",
  "ger.1",
  "ita.1",
  "fra.1",
  "usa.1",
  "mex.1",
  "bra.1",
  "jpn.1",
  "nor.1",
];

const TEAMS_PER_LEAGUE = 3;

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, data: await res.json() };
  } catch (err) {
    return { ok: false, status: "network-error", error: String(err) };
  }
}

async function teamsForLeagueToday(league) {
  const url = `${BASE}/${league}/scoreboard?dates=${today}&limit=50`;
  const res = await getJson(url);
  if (!res.ok) return [];
  const teams = new Map();
  for (const ev of res.data?.events ?? []) {
    for (const comp of ev.competitions ?? []) {
      for (const c of comp.competitors ?? []) {
        if (c.team?.id && c.team?.displayName) teams.set(c.team.id, c.team.displayName);
      }
    }
  }
  return [...teams.entries()].slice(0, TEAMS_PER_LEAGUE);
}

async function checkInjuries(league, teamId, teamName) {
  const url = `${BASE}/${league}/teams/${teamId}/injuries`;
  const res = await getJson(url);
  if (!res.ok) return { league, teamId, teamName, ok: false, status: res.status };
  const list = res.data?.injuries ?? res.data?.items ?? null;
  const count = Array.isArray(list) ? list.length : null;
  const sample = Array.isArray(list) ? list.slice(0, 2) : res.data;
  return { league, teamId, teamName, ok: true, status: res.status, count, sample };
}

console.log(`Pulling today's real fixtures (date=${today}) to get genuine team IDs...\n`);

const results = [];
for (const league of LEAGUES_TO_SAMPLE) {
  const teams = await teamsForLeagueToday(league);
  if (!teams.length) {
    console.log(`(${league}) — no fixtures today, skipping)`);
    continue;
  }
  for (const [teamId, teamName] of teams) {
    results.push(await checkInjuries(league, teamId, teamName));
    await new Promise((r) => setTimeout(r, 150));
  }
}

console.log("\n--- Results ---\n");
for (const r of results) {
  if (!r.ok) {
    console.log(`❌ ${r.league} / ${r.teamName} (id ${r.teamId}) — status ${r.status}`);
    continue;
  }
  if (r.count === null) {
    console.log(`⚠️  ${r.league} / ${r.teamName} (id ${r.teamId}) — 200 OK, unexpected shape:`);
    console.log(JSON.stringify(r.sample, null, 2).slice(0, 600));
    continue;
  }
  const icon = r.count > 0 ? "✅" : "➖";
  console.log(`${icon} ${r.league} / ${r.teamName} (id ${r.teamId}) — ${r.count} injury entr${r.count === 1 ? "y" : "ies"}`);
  if (r.count > 0) console.log("   Sample:", JSON.stringify(r.sample, null, 2).slice(0, 500));
}

console.log(
  "\nNext step: for any league marked ✅ with real entries, cross-check ONE listed player\n" +
    "against ESPN's actual site/app for that team to confirm it's accurate and current, not\n" +
    "stale. Send me this full output either way — leagues with 0 or errors matter too.",
);
