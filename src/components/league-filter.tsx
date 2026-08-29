import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/types";

export interface LeagueSummary {
  id: string;
  name: string;
  count: number;
}

export function summariseLeagues(matches: Match[], favorites: string[]): LeagueSummary[] {
  const map = new Map<string, LeagueSummary>();
  for (const m of matches) {
    const existing = map.get(m.leagueId);
    if (existing) existing.count += 1;
    else map.set(m.leagueId, { id: m.leagueId, name: m.league, count: 1 });
  }
  const favSet = new Set(favorites);
  return [...map.values()].sort((a, b) => {
    const fa = favSet.has(a.id) ? 0 : 1;
    const fb = favSet.has(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return b.count - a.count;
  });
}

export function LeagueFilter({
  leagues,
  selected,
  onSelect,
  favorites,
  onToggleFavorite,
}: {
  leagues: LeagueSummary[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}) {
  if (!leagues.length) return null;
  const favSet = new Set(favorites);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-none border-b-2 px-2.5 py-1 text-xs font-semibold transition-colors",
          selected === null
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        All competitions
      </button>
      {leagues.map((l) => (
        <span
          key={l.id}
          className={cn(
            "group flex items-center gap-1 rounded-none border-b-2 pl-2.5 pr-1 py-1 text-xs transition-colors",
            selected === l.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <button type="button" onClick={() => onSelect(l.id)} className="font-medium">
            {l.name} <span className="font-mono text-[10px] opacity-60">{l.count}</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(l.id)}
            aria-label={favSet.has(l.id) ? "Unpin league" : "Pin league"}
            className={cn(
              "rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
              favSet.has(l.id) && "opacity-100",
            )}
          >
            <Star
              className={cn(
                "size-3",
                favSet.has(l.id) ? "fill-accent text-accent" : "text-muted-foreground",
              )}
            />
          </button>
        </span>
      ))}
    </div>
  );
}
