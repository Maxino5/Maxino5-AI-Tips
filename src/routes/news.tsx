import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { NewsCard } from "@/components/news-card";
import { FeaturedNewsCard } from "@/components/featured-news-card";
import { NewsModal } from "@/components/news-modal";
import { NewsListSkeleton } from "@/components/news-card-skeleton";
import { getNews } from "@/lib/news.functions";
import { matchesQuery, today } from "@/lib/matches-query";
import { findRelatedMatch } from "@/lib/news-match-link";
import type { Match, NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type NewsFilter = "all" | "football";

const newsQuery = (category: NewsFilter) =>
  queryOptions({
    queryKey: ["news", category],
    queryFn: () => getNews({ data: { category } }),
    staleTime: 4 * 60 * 1000,
  });

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Sport News | PitchIQ" },
      {
        name: "description",
        content: "The latest sport headlines from BBC Sport, refreshed automatically.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(newsQuery("all")),
  component: NewsPage,
});

function NewsPage() {
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [selected, setSelected] = useState<NewsItem | null>(null);

  // Today's fixtures, used purely to spot when a headline mentions a team
  // playing today so we can link back to our own prediction page for it.
  // Best-effort: if this fails to load, related-match chips just don't show.
  const { data: todaysMatches } = useQuery({ ...matchesQuery(today(), "football"), retry: false });

  return (
    <SiteShell>
      <header className="border-b-4 border-foreground pb-6">
        <span className="eyebrow text-[11px] text-accent">Off the pitch</span>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">Sport News</h1>
        <p className="mt-2 max-w-xl font-serif text-sm leading-relaxed text-muted-foreground">
          Headlines from BBC Sport, refreshed automatically every few minutes. Tap a story to read a
          summary here — the full article opens on BBC Sport in a new tab.
        </p>

        <div className="mt-4 flex gap-4">
          {(["all", "football"] as const).map((f) => (
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
              {f === "all" ? "All sports" : "Football"}
            </button>
          ))}
        </div>
      </header>

      <Suspense fallback={<NewsListSkeleton />}>
        <NewsList filter={filter} todaysMatches={todaysMatches ?? []} onOpen={setSelected} />
      </Suspense>

      <NewsModal
        item={selected}
        related={
          selected
            ? findRelatedMatch(`${selected.title} ${selected.description}`, todaysMatches ?? [])
            : null
        }
        onClose={() => setSelected(null)}
      />
    </SiteShell>
  );
}

function NewsList({
  filter,
  todaysMatches,
  onOpen,
}: {
  filter: NewsFilter;
  todaysMatches: Match[];
  onOpen: (item: NewsItem) => void;
}) {
  const { data } = useSuspenseQuery(newsQuery(filter));

  const withRelated = useMemo(
    () =>
      data.map((item) => ({
        item,
        related: findRelatedMatch(`${item.title} ${item.description}`, todaysMatches),
      })),
    [data, todaysMatches],
  );

  if (!data.length) {
    return (
      <p className="panel mt-6 p-10 text-center font-serif text-sm text-muted-foreground">
        Couldn't reach BBC Sport's feed right now — try again shortly.
      </p>
    );
  }

  const [top, ...rest] = withRelated;

  return (
    <div className="mt-4 space-y-2">
      {top ? (
        <div className="mb-4">
          <FeaturedNewsCard item={top.item} related={top.related} onOpen={onOpen} />
        </div>
      ) : null}
      {rest.map(({ item, related }) => (
        <NewsCard key={item.id} item={item} related={related} onOpen={onOpen} />
      ))}
    </div>
  );
}
