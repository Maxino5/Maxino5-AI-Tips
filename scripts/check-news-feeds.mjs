// Run with: node scripts/check-news-feeds.mjs
//
// Confirms the free RSS feeds actually resolve, are current (not stale
// cached junk), and checks their structure — no API key, no signup, no
// request quota to worry about, since RSS has none of those.

const FEEDS = [
  { name: "BBC Sport (general)", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
  { name: "BBC Sport — Football", url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
];

function extractItems(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.slice(0, 5).map((item) => {
    const title = item
      .match(/<title>([\s\S]*?)<\/title>/)?.[1]
      ?.replace(/<!\[CDATA\[|\]\]>/g, "")
      .trim();
    const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    const description = item
      .match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?.replace(/<!\[CDATA\[|\]\]>/g, "")
      .trim();
    // Thumbnails can show up under a few different RSS conventions —
    // checking all of them rather than assuming one.
    const mediaThumbnail = item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/)?.[1];
    const mediaContent = item.match(/<media:content[^>]*url=["']([^"']+)["']/)?.[1];
    const enclosure = item.match(/<enclosure[^>]*url=["']([^"']+)["']/)?.[1];
    const thumbnail = mediaThumbnail ?? mediaContent ?? enclosure ?? null;
    return { title, link, pubDate, description, thumbnail };
  });
}

for (const feed of FEEDS) {
  console.log(`\n--- ${feed.name} ---`);
  try {
    const res = await fetch(feed.url, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) {
      console.log(`❌ status ${res.status}`);
      continue;
    }
    const xml = await res.text();
    const items = extractItems(xml);
    if (!items.length) {
      console.log("⚠️  200 OK but no <item> entries found — feed shape may differ from expected RSS 2.0");
      console.log(xml.slice(0, 500));
      continue;
    }
    console.log(`✅ ${items.length} sample headlines (showing publish dates to confirm freshness):\n`);
    for (const item of items) {
      console.log(`   • ${item.title}`);
      console.log(`     ${item.pubDate ?? "no date"} — ${item.link}`);
      console.log(`     thumbnail: ${item.thumbnail ?? "none found"}`);
      if (item.description) console.log(`     "${item.description.slice(0, 100)}..."`);
      console.log();
    }
  } catch (err) {
    console.log(`❌ fetch failed: ${err}`);
  }
}

console.log(
  "Check: are the pubDates actually recent (today/this week), or old cached entries?\n" +
    "Send me this output — if it looks good, this becomes the basis for the news tab.",
);
