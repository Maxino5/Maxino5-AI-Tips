function toIcsDate(iso: string) {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeText(value: string) {
  return value.replace(/([,;])/g, "\\$1");
}

export function downloadFixtureIcs(opts: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  venue?: string | null;
  league?: string | null;
}) {
  const start = toIcsDate(opts.kickoff);
  const end = toIcsDate(
    new Date(new Date(opts.kickoff).getTime() + 2 * 60 * 60 * 1000).toISOString(),
  );
  const title = `${opts.homeTeam} vs ${opts.awayTeam}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Max AI Tips//Fixture//EN",
    "BEGIN:VEVENT",
    `UID:${opts.matchId}@pitchiq`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(
      `${opts.league ?? "Fixture"} — probabilities and prediction on Max AI Tips.`,
    )}`,
    opts.venue ? `LOCATION:${escapeText(opts.venue)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
