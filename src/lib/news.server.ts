import type { NewsItem } from "./types";

/**
 * Free, keyless, no-quota news source: BBC Sport's public RSS feeds. BBC's
 * own systems update these the moment they publish something — this module
 * just re-fetches and caches on a short TTL, so "breaking news" reaching the
 * site is fully automatic and needs no manual update from anyone.
 */
const FEEDS = {
  general: "https://feeds.bbci.co.uk/sport/rss.xml",
  football: "https://feeds.bbci.co.uk/sport/football/rss.xml",
} as const;

const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;

type Cached = { value: NewsItem[]; expires: number };
const cache = new Map<string, Cached>();

async function fetchFeed(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[news] ${res.status} fetching ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[news] failed fetching ${url}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

function categoryFromLink(link: string): string {
  const match = link.match(/bbc\.co\.uk\/sport\/([a-z0-9-]+)\//i);
  const slug = match?.[1] ?? "sport";
  const KNOWN: Record<string, string> = {
    football: "Football",
    boxing: "Boxing",
    tennis: "Tennis",
    cricket: "Cricket",
    "rugby-union": "Rugby",
    "rugby-league": "Rugby League",
    cycling: "Cycling",
    golf: "Golf",
    formula1: "Formula 1",
    athletics: "Athletics",
    "american-football": "NFL",
    basketball: "Basketball",
  };
  return KNOWN[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseFeed(xml: string): NewsItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1] ?? "");
  return items.map((item) => {
    const title = decodeEntities(
      item
        .match(/<title>([\s\S]*?)<\/title>/)?.[1]
        ?.replace(/<!\[CDATA\[|\]\]>/g, "")
        .trim() ?? "",
    );
    const link = decodeEntities(item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "");
    const pubDateRaw = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    const description = decodeEntities(
      item
        .match(/<description>([\s\S]*?)<\/description>/)?.[1]
        ?.replace(/<!\[CDATA\[|\]\]>/g, "")
        .trim() ?? "",
    );
    const thumbnail =
      item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/)?.[1] ??
      item.match(/<media:content[^>]*url=["']([^"']+)["']/)?.[1] ??
      item.match(/<enclosure[^>]*url=["']([^"']+)["']/)?.[1] ??
      null;
    const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;

    return {
      id: link || `${title}-${pubDateRaw ?? ""}`,
      title,
      link,
      description,
      thumbnail,
      source: "BBC Sport",
      category: link ? categoryFromLink(link) : "Sport",
      publishedAt: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate.toISOString() : null,
    } satisfies NewsItem;
  });
}

async function loadFeed(key: keyof typeof FEEDS): Promise<NewsItem[]> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const xml = await fetchFeed(FEEDS[key]);
  const items = xml ? parseFeed(xml).filter((i) => i.title && i.link) : [];
  cache.set(key, { value: items, expires: Date.now() + CACHE_TTL_MS });
  return items;
}

/** Returns the merged, deduped, newest-first news list. `category: "football"`
 *  restricts to the football-only feed; otherwise everything from the
 *  general sport feed (which already includes football stories) is used. */
export async function loadNews(category: "all" | "football"): Promise<NewsItem[]> {
  const [general, football] = await Promise.all([loadFeed("general"), loadFeed("football")]);

  const merged = category === "football" ? football : mergeUnique(general, football);
  return merged.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

function mergeUnique(a: NewsItem[], b: NewsItem[]): NewsItem[] {
  const seen = new Set(a.map((i) => i.id));
  const merged = [...a];
  for (const item of b) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
