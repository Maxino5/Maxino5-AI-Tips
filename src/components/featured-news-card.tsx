import type { Match, NewsItem } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function FeaturedNewsCard({
  item,
  related,
  onOpen,
}: {
  item: NewsItem;
  related: Match | null;
  onOpen: (item: NewsItem) => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            className="h-56 w-full object-cover sm:h-72"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted">
            <span className="font-display text-2xl text-muted-foreground">{item.category}</span>
          </div>
        )}
        <div className="p-5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="eyebrow bg-foreground px-2 py-0.5 text-background">Top story</span>
            <span className="font-mono">
              {timeAgo(item.publishedAt)} · {item.source}
            </span>
          </div>
          <h2 className="mt-3 font-display text-2xl leading-tight tracking-wide sm:text-3xl">
            {item.title}
          </h2>
          {item.description ? (
            <p className="mt-2 font-serif text-base italic leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>
      </button>
      {related ? (
        <Link
          to="/match/$matchId"
          params={{ matchId: related.id }}
          className="ticket-divider flex items-center justify-between gap-2 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong/50"
        >
          <span>
            On PitchIQ: {related.homeTeam} vs {related.awayTeam}
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      ) : null}
    </div>
  );
}
