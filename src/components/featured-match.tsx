import { Link } from "@tanstack/react-router";
import type { Match } from "@/lib/types";
import { TeamBadge } from "./team-badge";
import { KickoffCountdown } from "./kickoff-countdown";

export function FeaturedMatch({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  return (
    <Link
      to="/match/$matchId"
      params={{ matchId: match.id }}
      className="group relative block overflow-hidden border-2 border-foreground bg-surface p-5 transition-colors hover:border-primary sm:p-8"
    >
      <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="eyebrow bg-foreground px-2 py-1 text-[10px] text-background">
            Back page · Match of the day
          </span>
          {isLive ? (
            <span className="live-dot flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive">
              <span className="size-2 rounded-full bg-destructive" />{" "}
              {match.liveMinute ? `Live · ${match.liveMinute}` : "Live now"}
            </span>
          ) : match.kickoff && !isFinished ? (
            <KickoffCountdown
              kickoff={match.kickoff}
              className="font-mono text-xs text-muted-foreground"
            />
          ) : null}
        </div>

        <p className="mt-4 font-serif text-xs italic text-muted-foreground">{match.league}</p>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <TeamBadge name={match.homeTeam} src={match.homeBadge} size="lg" />
            <span className="line-clamp-2 font-display text-xl leading-tight tracking-wide sm:text-3xl">
              {match.homeTeam}
            </span>
          </div>

          <div className="text-center">
            {isFinished || isLive ? (
              <span className="font-mono text-3xl font-bold tabular-nums sm:text-5xl">
                {match.homeScore ?? 0}
                <span className="mx-1 text-muted-foreground/50">–</span>
                {match.awayScore ?? 0}
              </span>
            ) : (
              <span className="font-display text-2xl text-muted-foreground/50 sm:text-4xl">vs</span>
            )}
          </div>

          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <TeamBadge name={match.awayTeam} src={match.awayBadge} size="lg" />
            <span className="line-clamp-2 font-display text-xl leading-tight tracking-wide sm:text-3xl">
              {match.awayTeam}
            </span>
          </div>
        </div>

        <div className="ticket-divider mt-6 flex items-center justify-between pt-3">
          <span className="truncate font-serif text-xs italic text-muted-foreground">
            {match.venue ?? "Venue TBC"}
          </span>
          <span className="shrink-0 pl-2 text-xs font-semibold text-primary opacity-80 transition-opacity group-hover:opacity-100">
            Full prediction →
          </span>
        </div>
      </div>
    </Link>
  );
}
