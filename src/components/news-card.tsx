import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { Match, NewsItem } from "@/lib/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NewsCard({
  item,
  related,
  onOpen,
}: {
  item: NewsItem;
  related: Match | null;
  onOpen: (item: NewsItem) => void;
}) {
  return (
    <div className="rise-in panel overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex w-full gap-3 p-3 text-left transition-colors hover:bg-surface-strong/40"
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            className="size-20 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-sm bg-muted font-display text-xs text-muted-foreground">
            {item.category}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="eyebrow text-primary">{item.category}</span>
            <span className="shrink-0 font-mono">
              {timeAgo(item.publishedAt)} · {item.source}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{item.title}</p>
          {item.description ? (
            <p className="mt-1 line-clamp-2 font-serif text-xs italic leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>
      </button>
      {related ? (
        <Link
          to="/match/$matchId"
          params={{ matchId: related.id }}
          onClick={(e) => e.stopPropagation()}
          className="ticket-divider flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-surface-strong/60"
        >
          <span className="truncate">
            On PitchIQ: {related.homeTeam} vs {related.awayTeam}
          </span>
          <ArrowRight className="size-3.5 shrink-0" />
        </Link>
      ) : null}
    </div>
  );
}
