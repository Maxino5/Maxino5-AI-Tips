import { Link } from "@tanstack/react-router";
import type { Match } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TeamBadge } from "./team-badge";
import { KickoffCountdown } from "./kickoff-countdown";

function kickoffTime(match: Match) {
  if (!match.kickoff) return "TBC";
  const d = new Date(match.kickoff);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MatchCard({ match, index = 0 }: { match: Match; index?: number }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  return (
    <Link
      to="/match/$matchId"
      params={{ matchId: match.id }}
      className="group rise-in panel relative flex overflow-hidden p-0 transition-transform hover:-translate-y-0.5 hover:border-primary/60"
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
    >
      {/* torn stub: status/kickoff read bottom-to-top like a real ticket */}
      <div
        className={cn(
          "ticket-perforation flex w-8 shrink-0 items-center justify-center py-4",
          isLive ? "bg-destructive/10" : isFinished ? "bg-muted" : "bg-primary/5",
        )}
      >
        {isLive ? (
          <span className="live-dot flex items-center gap-1 [writing-mode:vertical-rl]">
            <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
            <span className="rotate-180 font-mono text-[10px] font-bold uppercase tracking-widest text-destructive">
              Live
            </span>
          </span>
        ) : (
          <span className="rotate-180 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
            {isFinished ? "Full time" : kickoffTime(match)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <span className="flex min-w-0 items-center gap-1.5">
            {match.leagueBadge ? (
              <img
                src={match.leagueBadge}
                alt=""
                loading="lazy"
                className="size-3.5 object-contain opacity-80"
              />
            ) : null}
            <span className="truncate font-serif text-[11px] italic text-muted-foreground">
              {match.league}
            </span>
          </span>
          {match.status === "upcoming" && match.kickoff ? (
            <KickoffCountdown
              kickoff={match.kickoff}
              className="shrink-0 font-mono text-[10px] text-muted-foreground"
            />
          ) : null}
        </div>

        <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamBlock
            name={match.homeTeam}
            badge={match.homeBadge}
            winner={isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0)}
          />
          <ScoreDivider match={match} />
          <TeamBlock
            name={match.awayTeam}
            badge={match.awayBadge}
            winner={isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0)}
            align="right"
          />
        </div>

        <div className="ticket-divider mt-3 flex items-center justify-between pt-2.5">
          <span className="truncate font-serif text-[11px] italic text-muted-foreground">
            {match.venue ?? "Venue TBC"}
          </span>
          <span className="shrink-0 pl-2 text-[11px] font-semibold text-primary opacity-70 transition-opacity group-hover:opacity-100">
            Prediction →
          </span>
        </div>
      </div>
    </Link>
  );
}

function ScoreDivider({ match }: { match: Match }) {
  if (match.status === "upcoming") {
    return (
      <span className="px-1 font-display text-lg leading-none text-muted-foreground/40">vs</span>
    );
  }
  return (
    <span className="px-1 font-mono text-base font-bold tabular-nums">
      {match.homeScore ?? 0}
      <span className="mx-0.5 text-muted-foreground/50">–</span>
      {match.awayScore ?? 0}
    </span>
  );
}

function TeamBlock({
  name,
  badge,
  winner,
  align = "left",
}: {
  name: string;
  badge: string | null;
  winner: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        align === "right" ? "items-end text-right" : "items-start text-left",
      )}
    >
      <TeamBadge name={name} src={badge} size="md" />
      <span
        className={cn(
          "line-clamp-2 text-xs leading-tight",
          winner ? "font-semibold text-primary" : "font-medium text-foreground",
        )}
      >
        {name}
      </span>
    </div>
  );
}
