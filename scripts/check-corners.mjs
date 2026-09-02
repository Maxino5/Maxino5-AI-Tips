// Run with: node scripts/check-corners.mjs
//
// The corners MARKET already exists (an expected-value estimate before
// kickoff), but grading a Value Pick needs the REAL final corner count after
// the match — which nothing in this app has ever actually looked for. This
// checks several real finished matches' full summary payload for any
// corner-shaped field, the same way we found real card data hiding in
// `rosters[].roster[].plays[]` before.

const LEAGUES = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "usa.1", "bra.1", "mex.1"];

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, data: await res.json() };
  } catch (err) {
    return { ok: false, status: "network-error", error: String(err) };
  }
}

function findFields(obj, pattern, path = "", hits = [], depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 8) return hits;
  for (const [key, value] of Object.entries(obj)) {
    if (pattern.test(key)) {
      hits.push({
        path: `${path}.${key}`,
        value: typeof value === "object" ? "[object]" : value,
      });
    }
    if (typeof value === "object") findFields(value, pattern, `${path}.${key}`, hits, depth + 1);
  }
  return hits;
}

// Search backward day by day (up to 2 weeks) until real finished matches
// turn up — don't depend on exactly "yesterday" having fixtures, since a
// quiet midweek day proves nothing either way.
async function findFinishedMatches(league, maxDaysBack = 14) {
  for (let daysBack = 1; daysBack <= maxDaysBack; daysBack++) {
    const date = new Date(Date.now() - daysBack * 86400000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const scoreboard = await getJson(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}&limit=10`,
    );
    const events = scoreboard.ok
      ? (scoreboard.data?.events ?? []).filter((e) => e.status?.type?.completed)
      : [];
    if (events.length) return { date, events };
    await new Promise((r) => setTimeout(r, 100));
  }
  return { date: null, events: [] };
}

let checkedAny = false;

for (const league of LEAGUES) {
  const { date, events } = await findFinishedMatches(league);
  if (!events.length) {
    console.log(`(${league}) — no finished matches found in the last 14 days)`);
    continue;
  }

  for (const ev of events.slice(0, 2)) {
    checkedAny = true;
    const summary = await getJson(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${ev.id}`,
    );
    console.log(`\n${ev.name ?? ev.id} (${league}, ${date}):`);
    if (!summary.ok) {
      console.log(`  failed (${summary.status})`);
      continue;
    }
    const hits = findFields(summary.data, /corner/i);
    if (!hits.length) {
      console.log("  no corner-shaped fields found anywhere in the summary payload.");
    } else {
      console.log(`  found ${hits.length} field(s):`);
      for (const h of hits.slice(0, 10)) console.log(`    ${h.path} = ${JSON.stringify(h.value)}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

if (!checkedAny) {
  console.log(
    "\nNo finished matches found in ANY of these leagues in the last 14 days — that would be" +
      " unusual and worth re-running; something else may be wrong (e.g. rate limiting).",
  );
}

console.log(
  "\nSend me this output. If real numeric corner counts show up (not just 0/null for both\n" +
    "teams), corners becomes gradable. If nothing shows up across all of these, it's a genuine\n" +
    "dead end — not a coding gap — and we skip it for good.",
);
