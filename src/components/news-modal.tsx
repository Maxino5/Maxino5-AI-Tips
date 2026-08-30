import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, X } from "lucide-react";
import type { Match, NewsItem } from "@/lib/types";

export function NewsModal({
  item,
  related,
  onClose,
}: {
  item: NewsItem | null;
  related: Match | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="panel max-h-[85vh] w-full max-w-lg overflow-y-auto p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="h-48 w-full object-cover" />
        ) : null}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="eyebrow text-[11px] text-primary">{item.category}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <h2 className="mt-2 font-display text-2xl leading-tight tracking-wide">{item.title}</h2>
          {item.description ? (
            <p className="mt-3 font-serif text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}

          {related ? (
            <Link
              to="/match/$matchId"
              params={{ matchId: related.id }}
              onClick={onClose}
              className="mt-4 flex items-center justify-between gap-2 rounded-sm border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <span>
                See PitchIQ's prediction: {related.homeTeam} vs {related.awayTeam}
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          ) : null}

          <div className="ticket-divider mt-5 pt-4">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 border border-foreground bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-85"
            >
              Read full article on {item.source} <ExternalLink className="size-3.5" />
            </a>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Opens in a new tab — this page stays open.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
