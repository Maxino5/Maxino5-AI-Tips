import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { getValuePicks, getAccuracyReport } from "@/lib/predictions.functions";
import type { Sport } from "@/lib/types";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

const valueQuery = queryOptions({
  queryKey: ["value-picks", today()],
  queryFn: () => getValuePicks({ data: { date: today() } }),
  staleTime: 10 * 60 * 1000,
});

const accuracyQuery = queryOptions({
  queryKey: ["accuracy"],
  queryFn: () => getAccuracyReport(),
  staleTime: 30 * 60 * 1000,
});

export const Route = createFileRoute("/value")({
  head: () => ({
    meta: [
      { title: "Value Picks of the Day | Max AI Tips" },
      {
        name: "description",
        content:
          "The highest-confidence football and basketball selections of the day, ranked by model probability and data quality.",
      },
      { property: "og:title", content: "Value Picks of the Day | Max AI Tips" },
      {
        property: "og:description",
        content: "Today's strongest model-rated selections across football and basketball.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(accuracyQuery);
    return context.queryClient.ensureQueryData(valueQuery);
  },
  component: ValuePage,
});

function TrackRecordStrip() {
  const { data, isLoading } = useQuery(accuracyQuery);

  if (isLoading || !data || !data.sampleSize) return null;

  return (
    <Link
      to="/accuracy"
      className="mt-4 flex items-center justify-between gap-3 border border-border bg-surface-strong/40 px-4 py-2.5 transition-colors hover:border-primary/50"
    >
      <span className="text-xs text-muted-foreground">
        Track record:{" "}
        <span className="font-mono font-semibold text-primary">
          {(data.overall * 100).toFixed(0)}%
        </span>{" "}
        hit rate over the last {data.windowDays} days, {data.sampleSize} picks settled
      </span>
      <span className="shrink-0 text-xs font-semibold text-primary">Full breakdown →</span>
    </Link>
  );
}

function ValuePage() {
  const { data } = useSuspenseQuery(valueQuery);
  const [filter, setFilter] = useState<Sport | "all">("all");

  const filtered = useMemo(
    () => (filter === "all" ? data : data.filter((p) => p.match.sport === filter)),
    [data, filter],
  );

  return (
    <SiteShell>
      <header className="border-b-4 border-foreground pb-6">
        <span className="eyebrow text-[11px] text-accent">Editor's picks</span>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">Today&apos;s strongest calls</h1>
        <p className="mt-2 max-w-xl font-serif text-sm leading-relaxed text-muted-foreground">
          Ranked by model probability, weighted against how much recent form data was available.
          These are the model's own highest-conviction picks — not yet checked against bookmaker
          prices, so treat "value" here as confidence, not a guaranteed edge against the market.
        </p>

        <div className="mt-4 flex gap-4">
          {(["all", "football", "basketball"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "border-b-2 pb-1 font-display text-lg tracking-wide transition-colors",
                filter === f
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground/50 hover:text-foreground",
              )}
            >
              {f === "all" ? "All sports" : f === "football" ? "Football" : "Basketball"}
            </button>
          ))}
        </div>

        <TrackRecordStrip />
      </header>

      {!filtered.length ? (
        <p className="panel mt-6 p-10 text-center font-serif text-sm text-muted-foreground">
          Not enough form data on today&apos;s fixtures yet. Check back closer to kickoff.
        </p>
      ) : (
        <div className="mt-6 space-y-2">
          {filtered.map((pick, i) => (
            <Link
              key={pick.match.id + pick.label}
              to="/match/$matchId"
              params={{ matchId: pick.match.id }}
              className="panel rise-in flex items-center gap-4 p-4 transition-colors hover:border-accent/50"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="font-display text-3xl leading-none text-muted-foreground/40">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow truncate text-[10px] text-muted-foreground">
                  {pick.match.league} · {pick.match.sport}
                </p>
                <p className="truncate text-sm font-semibold">
                  {pick.match.homeTeam} vs {pick.match.awayTeam}
                </p>
                <p className="mt-0.5 font-serif text-sm text-accent">
                  {pick.label} <span className="text-muted-foreground">({pick.market})</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold text-primary">
                  {Math.round(pick.probability * 100)}%
                </p>
                <p className="eyebrow text-[10px] text-muted-foreground">conf {pick.confidence}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SiteShell>
  );
}
