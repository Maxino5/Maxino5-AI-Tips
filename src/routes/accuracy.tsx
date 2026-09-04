import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { getAccuracyReport, getValuePickRecord } from "@/lib/predictions.functions";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const accuracyQuery = queryOptions({
  queryKey: ["accuracy"],
  queryFn: () => getAccuracyReport(),
  staleTime: 30 * 60 * 1000,
});

const yesterday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const valuePickRecordQuery = queryOptions({
  queryKey: ["value-pick-record", yesterday()],
  queryFn: () => getValuePickRecord({ data: { date: yesterday() } }),
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
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(valuePickRecordQuery);
    return context.queryClient.ensureQueryData(accuracyQuery);
  },
  component: AccuracyPage,
});

function ValuePickRecordSection() {
  const { data } = useSuspenseQuery(valuePickRecordQuery);

  return (
    <section id="value-pick-record" className="mt-6 scroll-mt-6">
      <h2 className="eyebrow border-b border-border pb-2 text-xs text-muted-foreground">
        Yesterday's Value Picks · {data.date}
      </h2>
      <p className="mt-2 font-serif text-xs italic leading-relaxed text-muted-foreground">
        Reconstructed using only data available before those matches kicked off — this app has no
        database, so it isn't a literal saved log of what was shown, but the ranking is
        deterministic from the same data, so it should match almost exactly.
      </p>
      {!data.total ? (
        <p className="panel mt-4 p-10 text-center font-serif text-sm text-muted-foreground">
          Not enough graded picks from yesterday to show yet.
        </p>
      ) : (
        <>
          <p className="panel mt-4 flex items-center justify-between p-3 text-sm">
            <span className="text-muted-foreground">Yesterday's Value Pick record</span>
            <span className="font-mono font-bold">
              {data.hits}/{data.total}
            </span>
          </p>
          <div className="mt-2 space-y-2">
            {data.picks.map((p) => (
              <div
                key={p.matchId}
                className={cn(
                  "panel flex items-center justify-between gap-3 p-3",
                  p.hit ? "border-primary/30" : "border-destructive/30",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {p.hit ? (
                    <Check className="size-4 shrink-0 text-primary" />
                  ) : (
                    <X className="size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.fixture}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.label} <span className="text-muted-foreground/70">({p.market})</span> ·{" "}
                      {p.league}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {Math.round(p.probability * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

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

      <ValuePickRecordSection />

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
