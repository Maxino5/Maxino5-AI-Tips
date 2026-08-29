import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { MarketBoard } from "@/components/market-board";
import { getPrediction } from "@/lib/predictions.functions";
import type { TeamForm } from "@/lib/types";
import { BrainCircuit, Gauge, Share2, Target, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { downloadFixtureIcs } from "@/lib/ics";
import { TeamBadge } from "@/components/team-badge";

const predictionQuery = (matchId: string) =>
  queryOptions({
    queryKey: ["prediction", matchId],
    queryFn: () => getPrediction({ data: { matchId } }),
    staleTime: 10 * 60 * 1000,
  });

export const Route = createFileRoute("/match/$matchId")({
  head: () => ({
    meta: [
      { title: "Match prediction & probabilities | PitchIQ" },
      {
        name: "description",
        content:
          "Full prediction breakdown: match result, double chance, over/under goals, corners and totals with probability ratings.",
      },
      { property: "og:title", content: "Match prediction & probabilities | PitchIQ" },
      {
        property: "og:description",
        content: "Every market for this fixture, priced with a calibrated probability rating.",
      },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(predictionQuery(params.matchId)),
  component: MatchPage,
});

function MatchPage() {
  const { matchId } = Route.useParams();
  const { data } = useSuspenseQuery(predictionQuery(matchId));

  if (!data) {
    return (
      <SiteShell>
        <div className="panel p-10 text-center">
          <h1 className="font-display text-3xl">Fixture not found</h1>
          <p className="mt-2 font-serif text-sm text-muted-foreground">
            This match is no longer available from the live feed.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary">
            Back to today&apos;s fixtures
          </Link>
        </div>
      </SiteShell>
    );
  }

  const home = data.form.home;
  const away = data.form.away;
  const unit = data.sport === "basketball" ? "points" : "goals";

  const share = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "PitchIQ prediction", url }).catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => toast("Link copied to clipboard"))
      .catch(() => toast("Couldn't copy the link"));
  };

  const addToCalendar = () => {
    if (!data.kickoff) {
      toast("No confirmed kickoff time for this fixture yet");
      return;
    }
    downloadFixtureIcs({
      matchId: data.matchId,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      kickoff: data.kickoff,
      venue: data.venue,
      league: data.league,
    });
    toast("Calendar file downloaded");
  };

  return (
    <SiteShell>
      <div className="flex items-center justify-between">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
          ← All fixtures
        </Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={addToCalendar}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <CalendarPlus className="size-3.5" /> Add to calendar
          </button>
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Share2 className="size-3.5" /> Share
          </button>
        </div>
      </div>

      <section className="mt-4 border-b-4 border-foreground pb-6">
        <p className="eyebrow text-[11px] text-accent">{data.league}</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-3xl leading-[0.95] sm:text-5xl">
          <TeamBadge name={data.homeTeam} src={data.homeBadge} size="lg" />
          {data.homeTeam}
          <span className="text-muted-foreground">vs</span>
          <TeamBadge name={data.awayTeam} src={data.awayBadge} size="lg" />
          {data.awayTeam}
        </h1>
        {data.venue ? (
          <p className="mt-2 font-serif text-sm italic text-muted-foreground">{data.venue}</p>
        ) : null}

        <div className="mt-5 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          <Stat
            icon={<Target className="size-4" />}
            label={`Expected ${unit}`}
            value={`${data.expectedHome} – ${data.expectedAway}`}
          />
          <Stat
            icon={<Gauge className="size-4" />}
            label="Model confidence"
            value={`${data.confidence}%`}
          />
          <Stat
            icon={<BrainCircuit className="size-4" />}
            label={data.aiEnhanced ? "AI-adjusted" : "Statistical only"}
            value={data.expectedCorners ? `${data.expectedCorners} corners` : data.sport}
          />
        </div>

        <blockquote className="mt-6 border-l-4 border-primary bg-surface-strong/40 py-3 pl-5 pr-4">
          <p className="eyebrow text-[11px] text-primary">
            Standout call · {Math.round(data.bestBet.probability * 100)}%
          </p>
          <p className="mt-1 font-display text-2xl leading-tight tracking-wide">
            {data.bestBet.label}{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              ({data.bestBet.market})
            </span>
          </p>
          <p className="mt-2 font-serif text-base font-semibold leading-snug">{data.headline}</p>
          <p className="mt-1 font-serif text-sm leading-relaxed text-muted-foreground">
            {data.reasoning}
          </p>
        </blockquote>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <FormCard form={home} badge={data.homeBadge} unit={unit} side="Home" />
        <FormCard form={away} badge={data.awayBadge} unit={unit} side="Away" />
      </div>

      <h2 className="eyebrow mb-3 mt-8 border-b border-border pb-2 text-xs text-muted-foreground">
        All markets · probability rating
      </h2>
      <MarketBoard
        markets={data.markets}
        matchId={data.matchId}
        fixture={`${home?.team ?? "Home"} vs ${away?.team ?? "Away"}`}
      />
    </SiteShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <p className="eyebrow flex items-center gap-2 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function FormCard({
  form,
  badge,
  unit,
  side,
}: {
  form: TeamForm | null;
  badge: string | null;
  unit: string;
  side: string;
}) {
  if (!form) return null;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TeamBadge name={form.team} src={badge} size="sm" />
          <h3 className="font-display text-xl tracking-wide">{form.team}</h3>
        </div>
        <span className="eyebrow text-[10px] text-muted-foreground">{side}</span>
      </div>
      <div className="mt-3 flex gap-1">
        {form.formString.split("").map((r, i) => (
          <span
            key={i}
            className={cn(
              "flex size-6 items-center justify-center rounded-sm font-mono text-[11px] font-bold",
              r === "W"
                ? "bg-primary/15 text-primary"
                : r === "D"
                  ? "bg-muted text-muted-foreground"
                  : "bg-destructive/15 text-destructive",
            )}
          >
            {r}
          </span>
        ))}
        {form.played === 0 ? (
          <span className="font-serif text-xs italic text-muted-foreground">
            No recent results on record
          </span>
        ) : null}
      </div>
      {form.played > 0 ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {form.scored} {unit} for · {form.conceded} against · {form.played} played
        </p>
      ) : null}
    </div>
  );
}
