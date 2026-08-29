// Run with: node scripts/check-espn-leagues.mjs
//
// Tests every candidate ESPN league slug directly against the live API and
// reports which ones are real (any 2xx response) vs dead (400/404) — no
// guessing involved. A slug can be VALID but show 0 events just because
// there's no match in that competition today; that's fine and expected.
// Only the HTTP status decides validity, never the event count.
//
// When it finishes, copy the "VALID — paste into SOCCER_LEAGUES" array at
// the bottom and send it back. Every slug in it has been confirmed live
// against ESPN, so nothing here is a guess anymore.

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

// Already confirmed working (currently in src/lib/espn.server.ts) — included
// so you get one full, up-to-date report in a single run.
const CONFIRMED = [
  "club.friendly",
  "fifa.friendly",
  "uefa.champions",
  "uefa.europa",
  "uefa.europa.conf",
  "uefa.super_cup",
  "eng.1",
  "eng.2",
  "eng.fa",
  "eng.league_cup",
  "eng.charity",
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
  "ned.1",
  "por.1",
  "bel.1",
  "tur.1",
  "sco.1",
  "gre.1",
  "sui.1",
  "aut.1",
  "den.1",
  "nor.1",
  "swe.1",
  "usa.1",
  "usa.usl.1",
  "mex.1",
  "bra.1",
  "arg.1",
  "col.1",
  "chi.1",
  "jpn.1",
  "chn.1",
  "aus.1",
  "ksa.1",
  "caf.champions",
  "concacaf.champions",
  "conmebol.libertadores",
  "conmebol.sudamericana",
  "afc.champions",
  "nga.1",
];

// Candidates that would meaningfully widen coverage if they're real. Includes
// everything previously guessed (some confirmed dead already, re-tested here
// for completeness) plus a few more reasonable options.
const CANDIDATES = [
  "eng.3",
  "eng.4",
  "eng.w.1",
  "fra.coupe_de_france",
  "ned.2",
  "por.2",
  "tur.2",
  "sco.2",
  "pol.1",
  "rou.1",
  "cro.1",
  "srb.1",
  "ukr.1",
  "isr.1",
  "usa.2",
  "usa.nwsl",
  "usa.open",
  "can.1",
  "mex.2",
  "gua.1",
  "hon.1",
  "crc.1",
  "bra.2",
  "arg.2",
  "per.1",
  "ecu.1",
  "ury.1",
  "ven.1",
  "bol.1",
  "par.1",
  "conmebol.copa_america",
  "concacaf.leagues_cup",
  "concacaf.gold",
  "jpn.2",
  "kor.1",
  "idn.1",
  "tha.1",
  "ind.1",
  "uae.1",
  "qat.1",
  "afc.wcq",
  "caf.wcq",
  "uefa.wcq",
  "uefa.nations",
  "conmebol.wcq",
  "concacaf.wcq",
  "egy.1",
  "mar.1",
  "tun.1",
  "rsa.1",
  "irn.1",
  "irq.1",
  "svk.1",
  "cze.1",
  "hun.1",
  "bih.1",
  "svn.1",
  "bul.1",
  "fin.1",
  "isl.1",
  "wal.1",
  "irl.1",
  "sen.1",
  "civ.1",
  "gha.1",
  "dza.1",
  "aus.wl",
  "chn.wsl",
];

async function check(slug) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${today}&limit=200`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { slug, ok: false, status: res.status };
    const json = await res.json();
    return { slug, ok: true, status: res.status, events: json?.events?.length ?? 0 };
  } catch (err) {
    return { slug, ok: false, status: "network-error", error: String(err) };
  }
}

async function checkAll(slugs) {
  const results = [];
  // Gentle concurrency so this doesn't trip ESPN's rate limiting itself.
  const limit = 6;
  let cursor = 0;
  async function worker() {
    while (cursor < slugs.length) {
      const i = cursor++;
      results[i] = await check(slugs[i]);
      // tiny stagger, be polite
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

console.log(`Checking ${CONFIRMED.length} confirmed + ${CANDIDATES.length} candidate slugs against ESPN (date=${today})...\n`);

const [confirmedResults, candidateResults] = await Promise.all([
  checkAll(CONFIRMED),
  checkAll(CANDIDATES),
]);

const deadConfirmed = confirmedResults.filter((r) => !r.ok);
if (deadConfirmed.length) {
  console.log("⚠️  Currently-included slugs that are now DEAD (remove these):");
  for (const r of deadConfirmed) console.log(`   ${r.slug} — status ${r.status}`);
  console.log();
}

const validCandidates = candidateResults.filter((r) => r.ok);
const deadCandidates = candidateResults.filter((r) => !r.ok);

console.log(`✅ NEW valid candidates (${validCandidates.length}):`);
for (const r of validCandidates) {
  console.log(`   ${r.slug} — ${r.events} event(s) today`);
}

console.log(`\n❌ Dead candidates (${deadCandidates.length}):`);
for (const r of deadCandidates) {
  console.log(`   ${r.slug} — status ${r.status}`);
}

console.log("\n\n--- VALID — paste into SOCCER_LEAGUES ---\n");
console.log(
  JSON.stringify(
    [...CONFIRMED.filter((s) => !deadConfirmed.some((d) => d.slug === s)), ...validCandidates.map((r) => r.slug)],
    null,
    2,
  ),
);
