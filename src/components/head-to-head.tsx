import type { H2HMeeting } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HeadToHead({ meetings }: { meetings: H2HMeeting[] }) {
  if (!meetings.length) {
    return (
      <p className="font-serif text-sm italic text-muted-foreground">
        No previous meetings on record.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {meetings.map((m) => {
        const homeWon = m.homeScore > m.awayScore;
        const awayWon = m.awayScore > m.homeScore;
        return (
          <div
            key={m.id}
            className="ticket-divider flex items-center justify-between gap-3 pt-2 first:border-0 first:pt-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm">
                <span className={cn(homeWon && "font-semibold text-primary")}>{m.homeTeam}</span>
                <span className="text-muted-foreground"> vs </span>
                <span className={cn(awayWon && "font-semibold text-primary")}>{m.awayTeam}</span>
              </p>
              <p className="truncate font-serif text-[11px] italic text-muted-foreground">
                {m.competition || "Fixture"} ·{" "}
                {m.date
                  ? new Date(m.date).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
              </p>
            </div>
            <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
              {m.homeScore}–{m.awayScore}
            </span>
          </div>
        );
      })}
    </div>
  );
}
