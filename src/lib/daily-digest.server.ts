import { buildValuePickRecord, buildValuePicks } from "./predictions.server";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Builds the full digest message, or null if there's genuinely nothing to
 *  report at all (no config error — just an empty day on both sides). Shows
 *  however many picks are actually available on a quiet fixture day rather
 *  than enforcing a minimum. */
export async function buildDailyDigestMessage(): Promise<string | null> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const [record, picks] = await Promise.all([
    buildValuePickRecord(isoDate(yesterday)).catch(() => null),
    buildValuePicks(isoDate(today)).catch(() => []),
  ]);

  if (!record?.total && !picks.length) return null;

  const siteUrl = process.env["SITE_URL"];
  const lines: string[] = [];

  lines.push(`<b>📊 Max AI Tips — Daily Update</b>`);
  lines.push("");

  if (record && record.total > 0) {
    lines.push(`<b>Yesterday's Value Picks: ${record.hits}/${record.total}</b>`);
  } else {
    lines.push(`<i>Not enough graded picks from yesterday to report.</i>`);
  }
  lines.push("");

  if (picks.length) {
    lines.push(`<b>🔮 Today's Value Picks (${picks.length}):</b>`);
    picks.forEach((p, i) => {
      const pct = Math.round(p.probability * 100);
      lines.push(
        `${i + 1}. ${escapeHtml(p.match.homeTeam)} vs ${escapeHtml(p.match.awayTeam)} — ${escapeHtml(p.label)} (${pct}%)`,
      );
    });
  } else {
    lines.push(`<i>No strong picks on today's fixture list yet.</i>`);
  }

  if (siteUrl) {
    lines.push("");
    lines.push(`See full breakdown → ${siteUrl}`);
  }

  return lines.join("\n");
}
