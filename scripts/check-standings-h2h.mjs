// Run with: node scripts/check-standings-h2h.mjs
//
// Two things to verify before building anything:
//
// 1. STANDINGS — community docs say the site/v2 path returns empty {} for
//    soccer, and the real data lives at a DIFFERENT path: /apis/v2/ instead
//    of /apis/site/v2/. This checks that directly.
//
// 2. HEAD-TO-HEAD — there's no documented dedicated endpoint for this. This
//    checks two possible ways to get it ourselves: (a) whether a team's
//    schedule endpoint accepts a `season` param to pull multiple past
//    seasons (so we could search across them for the same opponent), and
//    (b) whether a match summary contains any head-to-head-shaped field at
//    all, the same way we found real card data hiding in there before.

const LEAGUES = ["eng.1", "esp.1", "ita.1", "usa.1"];

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
  if (!obj || typeof obj !== "object" || depth > 6) return hits;
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

console.log(
  "--- 1. Standings: apis/site/v2 (expected to fail/empty) vs apis/v2 (expected to work) ---\n",
);

for (const league of LEAGUES) {
  const oldPath = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/standings`,
  );
  const newPath = await getJson(
    `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`,
  );

  console.log(`${league}:`);
  console.log(
    `  apis/site/v2 -> ${oldPath.ok ? `200 OK, ${Object.keys(oldPath.data ?? {}).length} top-level keys` : `failed (${oldPath.status})`}`,
  );
  if (newPath.ok) {
    const entries =
      newPath.data?.children?.[0]?.standings?.entries ?? newPath.data?.standings?.entries ?? null;
    console.log(
      `  apis/v2       -> 200 OK, ${entries ? `${entries.length} teams found` : "no 'entries' array at the expected path — raw shape below"}`,
    );
    if (!entries) console.log("    ", JSON.stringify(newPath.data).slice(0, 400));
    else console.log("    sample team entry:", JSON.stringify(entries[0], null, 2).slice(0, 500));
  } else {
    console.log(`  apis/v2       -> failed (${newPath.status})`);
  }
  console.log();
  await new Promise((r) => setTimeout(r, 150));
}

console.log("\n--- 2a. Does a team schedule accept a `season` param for past seasons? ---\n");

// Man Utd (ESPN team id 360) as a known-good test team in eng.1.
const seasonsToTry = [2024, 2023];
for (const season of seasonsToTry) {
  const res = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/360/schedule?season=${season}`,
  );
  if (!res.ok) {
    console.log(`season=${season} -> failed (${res.status})`);
    continue;
  }
  const events = res.data?.events ?? [];
  const seasonsSeen = new Set(events.map((e) => (e.date ?? "").slice(0, 4)));
  console.log(
    `season=${season} -> 200 OK, ${events.length} events, years present: ${[...seasonsSeen].join(", ")}`,
  );
}

console.log("\n--- 2b. Any head-to-head-shaped field in a match summary? ---\n");

const scoreboard = await getJson(
  `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=${new Date(Date.now() - 86400000).toISOString().slice(0, 10).replace(/-/g, "")}&limit=5`,
);
const firstEvent = scoreboard.ok ? scoreboard.data?.events?.[0] : null;
if (firstEvent) {
  const summary = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=${firstEvent.id}`,
  );
  if (summary.ok) {
    const hits = findFields(summary.data, /head.?to.?head|series|previousMeeting|h2h/i);
    console.log(
      hits.length
        ? `Found ${hits.length} possible field(s): ${JSON.stringify(hits.slice(0, 5))}`
        : "No head-to-head-shaped fields found anywhere in the summary payload.",
    );
  } else {
    console.log(`Couldn't fetch summary for event ${firstEvent.id} (status ${summary.status})`);
  }
} else {
  console.log("No finished match found yesterday to test against.");
}

console.log(
  "\nSend me this full output. Standings: if apis/v2 shows real team entries, that's buildable.\n" +
    "Head-to-head: if neither the season param nor the summary scan turns up anything, we build it\n" +
    "ourselves by cross-referencing both teams' own schedules instead — also fine, just want to know\n" +
    "which approach applies before writing it.",
);
