import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { MatchCard } from "@/components/match-card";
import { FeaturedMatch } from "@/components/featured-match";
import { MatchGridSkeleton, DayStatsSkeleton } from "@/components/match-card-skeleton";
import { LeagueFilter, summariseLeagues } from "@/components/league-filter";
import { getDailyMatches } from "@/lib/predictions.functions";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { pickFeaturedMatch, marqueeRank } from "@/lib/featured-match";
import type { Match, Sport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Search } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const matchesQuery = (date: string, sport: Sport) =>
  queryOptions({
    queryKey: ["matches", date, sport],
    queryFn: () => getDailyMatches({ data: { date, sport } }),
    staleTime: 3 * 60 * 1000,
  });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitchIQ — Football & Basketball Predictions" },
      {
        name: "description",
        content:
          "Daily football and basketball fixtures with probability ratings for 1X2, double chance, goals, corners and totals.",
      },
      { property: "og:title", content: "PitchIQ — Football & Basketball Predictions" },
      {
        property: "og:description",
        content:
          "Live fixtures plus calibrated probabilities for match result, double chance, over/under goals and corners.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(matchesQuery(today(), "football")),
  component: Home,
});

function Home() {
  const [sport, setSport] = useState<Sport>("football");
  const [offset, setOffset] = useState(0);

  const date = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <SiteShell>
      <section className="border-b border-border pb-8">
        <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:gap-10">
          <div>
            <span className="eyebrow text-[11px] text-accent">Front page</span>
            <h1 className="mt-2 font-display text-5xl leading-[0.9] sm:text-6xl">
              Every market, <span className="headline-mark">priced by probability.</span>
            </h1>
            <p className="drop-cap mt-4 max-w-xl font-serif text-base leading-relaxed text-muted-foreground">
              Live football and basketball fixtures run through a Poisson/normal simulation, then
              reviewed by an AI analyst against recent form and home advantage — result, double
              chance, goals, corners and totals, each with a calibrated probability rating.
            </p>
          </div>
          <Suspense fallback={<DayStatsSkeleton />}>
            <DayStats date={date} sport={sport} />
          </Suspense>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-4">
          {(["football", "basketball"] as Sport[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={cn(
                "font-display text-2xl tracking-wide transition-colors",
                sport === s ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground",
              )}
            >
              {s === "football" ? "Football" : "Basketball"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 text-sm">
          {[
            { o: -1, l: "Yesterday" },
            { o: 0, l: "Today" },
            { o: 1, l: "Tomorrow" },
          ].map((d) => (
            <button
              key={d.o}
              type="button"
              onClick={() => setOffset(d.o)}
              className={cn(
                "border-b-2 px-2.5 py-1.5 font-medium transition-colors",
                offset === d.o
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {d.l}
            </button>
          ))}
        </div>
      </div>

      <Suspense fallback={<MatchGridSkeleton />}>
        <MatchList date={date} sport={sport} />
      </Suspense>
    </SiteShell>
  );
}

function DayStats({ date, sport }: { date: string; sport: Sport }) {
  const { data } = useSuspenseQuery(matchesQuery(date, sport));
  const leagueCount = new Set(data.map((m) => m.leagueId)).size;
  const liveCount = data.filter((m) => m.status === "live").length;

  return (
    <dl className="grid grid-cols-3 content-start gap-4 border-t-2 border-foreground pt-3 sm:border-t-0 sm:border-l-2 sm:pl-6 sm:pt-0">
      <Stat label="Fixtures" value={data.length} />
      <Stat label="Competitions" value={leagueCount} />
      <Stat label="Live now" value={liveCount} accent={liveCount > 0} />
    </dl>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <dt className="eyebrow text-[10px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-display text-4xl leading-none",
          accent ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

type SortMode = "kickoff" | "league" | "big";

const STATUS_PRIORITY: Record<Match["status"], number> = { live: 0, upcoming: 1, finished: 2 };

function MatchList({ date, sport }: { date: string; sport: Sport }) {
  const { data } = useSuspenseQuery(matchesQuery(date, sport));
  const [search, setSearch] = useState("");
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("kickoff");
  const { value: favorites, toggleInSet } = useLocalStorage<string[]>("pitchiq.favLeagues.v1", []);

  const leagues = useMemo(() => summariseLeagues(data, favorites), [data, favorites]);
  const featured = useMemo(() => pickFeaturedMatch(data), [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((m: Match) => {
      if (featured && m.id === featured.id) return false;
      if (selectedLeague && m.leagueId !== selectedLeague) return false;
      if (!term) return true;
      return (
        m.homeTeam.toLowerCase().includes(term) ||
        m.awayTeam.toLowerCase().includes(term) ||
        m.league.toLowerCase().includes(term)
      );
    });
  }, [data, search, selectedLeague, featured]);

  const sorted = useMemo(() => {
    const favSet = new Set(favorites);
    const list = [...filtered];
    list.sort((a, b) => {
      // Pinned leagues always float up, regardless of sort mode.
      if (!selectedLeague) {
        const fa = favSet.has(a.leagueId) ? 0 : 1;
        const fb = favSet.has(b.leagueId) ? 0 : 1;
        if (fa !== fb) return fa - fb;
      }
      if (sortMode === "league") return a.league.localeCompare(b.league);
      if (sortMode === "big") {
        const rankDiff = marqueeRank(a) - marqueeRank(b);
        if (rankDiff !== 0) return rankDiff;
      }
      const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (statusDiff !== 0) return statusDiff;
      const at = a.kickoff ? new Date(a.kickoff).getTime() : Infinity;
      const bt = b.kickoff ? new Date(b.kickoff).getTime() : Infinity;
      return at - bt;
    });
    return list;
  }, [filtered, favorites, selectedLeague, sortMode]);

  if (!data.length) {
    return (
      <p className="panel mt-6 p-10 text-center font-serif text-sm text-muted-foreground">
        No {sport} fixtures listed for {date}.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {featured ? (
        <div className="mb-6">
          <FeaturedMatch match={featured} />
        </div>
      ) : null}

      <div className="section-ornament mb-4">
        <span className="section-ornament-line" />
        <span className="font-display text-xs tracking-[0.2em]">✦</span>
        <span className="section-ornament-line" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <LeagueFilter
          leagues={leagues}
          selected={selectedLeague}
          onSelect={setSelectedLeague}
          favorites={favorites}
          onToggleFavorite={toggleInSet}
        />
        <div className="flex shrink-0 items-center gap-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a team…"
              className="w-full min-w-0 rounded-sm border border-border bg-surface py-1.5 pl-8 pr-3 font-sans text-sm outline-none placeholder:text-muted-foreground focus:border-primary sm:w-48"
            />
          </label>
          <label className="relative flex items-center">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="appearance-none rounded-sm border border-border bg-surface py-1.5 pl-8 pr-6 font-sans text-sm outline-none focus:border-primary"
            >
              <option value="kickoff">Kickoff time</option>
              <option value="league">Competition A–Z</option>
              <option value="big">Big leagues first</option>
            </select>
          </label>
        </div>
      </div>

      {!sorted.length ? (
        <p className="panel mt-6 p-10 text-center font-serif text-sm text-muted-foreground">
          Nothing matches "{search}" in today's {sport} card.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((match, i) => (
            <MatchCard key={match.id} match={match} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
