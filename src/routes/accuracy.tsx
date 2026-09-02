import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { getAccuracyReport } from "@/lib/predictions.functions";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const accuracyQuery = queryOptions({
  queryKey: ["accuracy"],
  queryFn: () => getAccuracyReport(),
  staleTime: 30 * 60 * 1000,
});

export const Route = createFileRoute("/accuracy")({
  head: () => ({
    meta: [
      { title: "Prediction Accuracy Tracker | Max AI Tips" },
      {
        name: "description",
        content:
          "Rolling backtest of the Max AI Tips model: hit rate by market, sport and confidence band across recently finished football and basketball matches.",
      },
      { property: "og:title", content: "Prediction Accuracy Tracker | Max AI Tips" },
      {
        property: "og:description",
        content: "Transparent hit rates per market from a rolling backtest on finished fixtures.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accuracyQuery),
  component: AccuracyPage,
});

function AccuracyPage() {
  const { data } = useSuspenseQuery(accuracyQuery);

  return (
    <SiteShell>
      <header className="border-b-4 border-foreground pb-6">
        <span className="eyebrow text-[11px] text-accent">Show your working</span>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">The track record</h1>
        <p className="mt-2 max-w-2xl font-serif text-sm leading-relaxed text-muted-foreground">
          A rolling backtest over the last {data.windowDays} days. For each finished fixture the
          statistical model is re-run using <strong>only</strong> form recorded before that match,
          then its top selection in each verifiable market is settled against the real score.
        </p>
        <div className="mt-5 flex flex-wrap gap-px overflow-hidden border border-border bg-border">
          <div className="bg-surface px-5 py-3">
            <p className="eyebrow text-[10px] text-primary">Overall hit rate</p>
            <p className="font-mono text-3xl font-bold">{(data.overall * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-surface px-5 py-3">
            <p className="eyebrow text-[10px] text-muted-foreground">Matches settled</p>
            <p className="font-mono text-3xl font-bold">{data.sampleSize}</p>
          </div>
        </div>
      </header>

      <div className="section-ornament my-6">
        <span className="section-ornament-line" />
        <span className="font-display text-xs tracking-[0.2em]">✦</span>
        <span className="section-ornament-line" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {data.byMarket.length ? (
          <BarSection
            title="By market"
            rows={data.byMarket.map((m) => ({
              label: m.market,
              hits: m.hits,
              total: m.total,
              accuracy: m.accuracy,
            }))}
          />
        ) : null}

        {data.byConfidence.length ? (
          <BarSection
            title="Calibration by confidence band"
            note="If the model is honest, the 80%+ band should hit close to 80% of the time — not just 'often'."
            rows={data.byConfidence.map((c) => ({
              label: c.band,
              hits: c.hits,
              total: c.total,
              accuracy: c.accuracy,
            }))}
          />
        ) : null}
      </div>

      {data.bySport.length > 1 ? (
        <div className="mt-6">
          <BarSection
            title="By sport"
            rows={data.bySport.map((s) => ({
              label: s.sport === "football" ? "Football" : "Basketball",
              hits: s.hits,
              total: s.total,
              accuracy: s.accuracy,
            }))}
          />
        </div>
      ) : null}

      <section className="mt-8 space-y-2">
        <h2 className="eyebrow border-b border-border pb-2 text-xs text-muted-foreground">
          Settled fixtures
        </h2>
        {!data.recent.length ? (
          <p className="panel mt-4 p-10 text-center font-serif text-sm text-muted-foreground">
            Not enough completed fixtures with prior form data in this window yet.
          </p>
        ) : (
          data.recent.map((r) => (
            <div key={r.matchId} className="panel mt-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="eyebrow text-[10px] text-muted-foreground">
                    {r.league} · {r.date}
                  </p>
                  <p className="text-sm font-semibold">{r.fixture}</p>
                </div>
                <span className="font-mono text-lg font-bold">{r.score}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.picks.map((p) => (
                  <span
                    key={p.market + p.label}
                    className={cn(
                      "flex items-center gap-1.5 rounded-sm border px-3 py-1 text-xs",
                      p.hit
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-destructive/40 bg-destructive/10 text-destructive",
                    )}
                  >
                    {p.hit ? <Check className="size-3" /> : <X className="size-3" />}
                    {p.label}
                    <span className="font-mono opacity-70">{Math.round(p.probability * 100)}%</span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </SiteShell>
  );
}

function BarSection({
  title,
  note,
  rows,
}: {
  title: string;
  note?: string;
  rows: { label: string; hits: number; total: number; accuracy: number }[];
}) {
  return (
    <section className="panel p-5">
      <h2 className="eyebrow text-xs">{title}</h2>
      {note ? (
        <p className="mt-1 font-serif text-xs italic leading-relaxed text-muted-foreground">
          {note}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {rows.map((m) => (
          <div key={m.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span>{m.label}</span>
              <span className="font-mono text-muted-foreground">
                {m.hits}/{m.total} · {(m.accuracy * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${m.accuracy * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
