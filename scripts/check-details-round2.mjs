// Run with: node scripts/check-details-round2.mjs

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, data: await res.json() };
  } catch (err) {
    return { ok: false, status: "network-error", error: String(err) };
  }
}

console.log("--- 1. Full 'seasonseries' shape for a few different matches ---\n");

const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10).replace(/-/g, "");
const scoreboard = await getJson(
  `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=${yesterday}&limit=10`,
);
const events = scoreboard.ok ? (scoreboard.data?.events ?? []) : [];

for (const ev of events.slice(0, 3)) {
  const summary = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=${ev.id}`,
  );
  console.log(`${ev.name ?? ev.id}:`);
  if (!summary.ok) {
    console.log(`  failed (${summary.status})`);
    continue;
  }
  const series = summary.data?.seasonseries;
  console.log("  seasonseries:", JSON.stringify(series, null, 2));
  console.log();
  await new Promise((r) => setTimeout(r, 150));
}

console.log("\n--- 2. Full 'stats' array for one standings entry ---\n");

const standings = await getJson(
  "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings",
);
if (standings.ok) {
  const entry =
    standings.data?.children?.[0]?.standings?.entries?.[0] ??
    standings.data?.standings?.entries?.[0];
  console.log("Full entry (team + stats):");
  console.log(JSON.stringify(entry, null, 2).slice(0, 2000));
} else {
  console.log(`failed (${standings.status})`);
}

console.log("\n--- 3. Two documented-but-untested basketball slugs ---\n");

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
for (const league of ["nba-development", "fiba"]) {
  const res = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/scoreboard?dates=${today}&limit=50`,
  );
  console.log(
    res.ok
      ? `${league} -> 200 OK, ${res.data?.events?.length ?? 0} events today`
      : `${league} -> failed (${res.status})`,
  );
}

console.log("\nSend me this full output.");
