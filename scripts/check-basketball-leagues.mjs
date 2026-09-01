// Run with: node scripts/check-basketball-leagues.mjs
//
// Same discipline as the soccer league checker — test candidates live
// instead of guessing. Currently only nba/wnba/college/summer-league/nbl are
// in the app; this checks a wider set of pro basketball leagues around the
// world.

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

const CONFIRMED = [
  "nba",
  "wnba",
  "mens-college-basketball",
  "womens-college-basketball",
  "nba-summer-las-vegas",
  "nbl",
];

const CANDIDATES = [
  "euroleague-men",
  "eurocup-men",
  "spain.liga-acb",
  "italy.lega-a",
  "greece.hlbl",
  "turkey.bsl",
  "germany.bbl",
  "france.lnb",
  "australia.nbl1",
  "china.cba",
  "philippines.pba",
  "argentina.la-liga",
  "brazil.nbb",
  "adriatic-league",
  "vtb-united-league",
  "israel.premier-league",
  "fiba-world-cup",
  "fiba-champions-league",
];

async function check(league) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/scoreboard?dates=${today}&limit=50`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { league, ok: false, status: res.status };
    const json = await res.json();
    return { league, ok: true, status: res.status, events: json?.events?.length ?? 0 };
  } catch (err) {
    return { league, ok: false, status: "network-error", error: String(err) };
  }
}

async function checkAll(list) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const i = cursor++;
      results[i] = await check(list[i]);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return results;
}

console.log(
  `Checking ${CONFIRMED.length} confirmed + ${CANDIDATES.length} candidate basketball leagues (date=${today})...\n`,
);

const [confirmedResults, candidateResults] = await Promise.all([
  checkAll(CONFIRMED),
  checkAll(CANDIDATES),
]);

const deadConfirmed = confirmedResults.filter((r) => !r.ok);
if (deadConfirmed.length) {
  console.log("⚠️  Currently-included slugs that are now DEAD:");
  for (const r of deadConfirmed) console.log(`   ${r.league} — status ${r.status}`);
  console.log();
}

const validCandidates = candidateResults.filter((r) => r.ok);
const deadCandidates = candidateResults.filter((r) => !r.ok);

console.log(`✅ NEW valid candidates (${validCandidates.length}):`);
for (const r of validCandidates) console.log(`   ${r.league} — ${r.events} event(s) today`);

console.log(`\n❌ Dead candidates (${deadCandidates.length}):`);
for (const r of deadCandidates) console.log(`   ${r.league} — status ${r.status}`);

console.log("\n\n--- VALID — paste into BASKETBALL_LEAGUES ---\n");
console.log(
  JSON.stringify(
    [
      ...CONFIRMED.filter((s) => !deadConfirmed.some((d) => d.league === s)),
      ...validCandidates.map((r) => r.league),
    ],
    null,
    2,
  ),
);
