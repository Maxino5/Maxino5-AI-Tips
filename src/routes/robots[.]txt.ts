import { createFileRoute } from "@tanstack/react-router";

const SITE_URL = process.env["SITE_URL"] ?? "https://maxaitips.vercel.app";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
