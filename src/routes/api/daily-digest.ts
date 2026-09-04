import { createFileRoute } from "@tanstack/react-router";

// Triggered once a day by Vercel Cron (see vercel.json). Secured via the
// CRON_SECRET env var, which Vercel automatically sends as a Bearer token
// on requests it generates — this stops anyone else from triggering posts
// by just visiting the URL. If CRON_SECRET isn't set, the route refuses to
// run at all rather than being silently open.
export const Route = createFileRoute("/api/daily-digest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) {
          return Response.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
        }
        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${secret}`) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        try {
          const { buildDailyDigestMessage } = await import("@/lib/daily-digest.server");
          const { sendTelegramMessage } = await import("@/lib/telegram.server");

          const message = await buildDailyDigestMessage();
          if (!message) {
            return Response.json({ ok: true, skipped: "nothing to report today" });
          }

          const result = await sendTelegramMessage(message);
          if (!result.ok) {
            console.error("[daily-digest] Telegram send failed:", result.error);
            return Response.json({ ok: false, error: result.error }, { status: 502 });
          }

          return Response.json({ ok: true, sent: true });
        } catch (err) {
          console.error("[daily-digest] failed:", err);
          return Response.json({ ok: false, error: String(err) }, { status: 500 });
        }
      },
    },
  },
});
