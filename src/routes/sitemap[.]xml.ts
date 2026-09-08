import { createFileRoute } from "@tanstack/react-router";

const SITE_URL = process.env["SITE_URL"] ?? "https://maxaitips.vercel.app";

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(loc: string, changefreq: string, priority: number, lastmod?: string) {
  return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
  </url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

        const entries: string[] = [
          urlEntry(`${SITE_URL}/`, "hourly", 1.0),
          urlEntry(`${SITE_URL}/value`, "hourly", 0.9),
          urlEntry(`${SITE_URL}/accuracy`, "daily", 0.7),
          urlEntry(`${SITE_URL}/news`, "hourly", 0.7),
        ];

        // Dynamic content can't be known at build time, so this is generated
        // fresh on each request (with a short CDN cache below) rather than
        // relying on a static file — today's and tomorrow's real fixtures
        // across both sports, reusing the exact same data the site itself
        // already loads.
        try {
          const { loadMatches } = await import("@/lib/predictions.server");
          const [footballToday, basketballToday, footballTomorrow, basketballTomorrow] =
            await Promise.all([
              loadMatches(today, "football").catch(() => []),
              loadMatches(today, "basketball").catch(() => []),
              loadMatches(tomorrow, "football").catch(() => []),
              loadMatches(tomorrow, "basketball").catch(() => []),
            ]);

          const seen = new Set<string>();
          for (const m of [
            ...footballToday,
            ...basketballToday,
            ...footballTomorrow,
            ...basketballTomorrow,
          ]) {
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            entries.push(urlEntry(`${SITE_URL}/match/${m.id}`, "hourly", 0.8));
          }
        } catch (err) {
          console.error("[sitemap] failed to load matches, static pages only:", err);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
