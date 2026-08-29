import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { getDailyMatches } from "@/lib/predictions.functions";
import { TeamBadge } from "./team-badge";
import type { Match } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const date = today();
  const football = useQuery({
    queryKey: ["matches", date, "football"],
    queryFn: () => getDailyMatches({ data: { date, sport: "football" } }),
    enabled: open,
    staleTime: 3 * 60 * 1000,
  });
  const basketball = useQuery({
    queryKey: ["matches", date, "basketball"],
    queryFn: () => getDailyMatches({ data: { date, sport: "basketball" } }),
    enabled: open,
    staleTime: 3 * 60 * 1000,
  });

  const all: Match[] = useMemo(
    () => [...(football.data ?? []), ...(basketball.data ?? [])],
    [football.data, basketball.data],
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return all.slice(0, 8);
    return all
      .filter(
        (m) =>
          m.homeTeam.toLowerCase().includes(term) ||
          m.awayTeam.toLowerCase().includes(term) ||
          m.league.toLowerCase().includes(term),
      )
      .slice(0, 12);
  }, [all, query]);

  const loading = open && (football.isLoading || basketball.isLoading);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        aria-label="Search fixtures"
      >
        <Search className="size-3.5" />
        <span className="eyebrow hidden sm:inline">Search</span>
        <kbd className="hidden rounded-sm border border-border px-1 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-foreground/40 px-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="panel w-full max-w-lg overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a team or competition…"
                className="w-full bg-transparent font-sans text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Esc
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {loading ? (
                <p className="p-4 text-center font-serif text-sm italic text-muted-foreground">
                  Loading today&apos;s card…
                </p>
              ) : !results.length ? (
                <p className="p-4 text-center font-serif text-sm italic text-muted-foreground">
                  No fixtures match "{query}".
                </p>
              ) : (
                results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: "/match/$matchId", params: { matchId: m.id } });
                    }}
                    className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left text-sm hover:bg-surface-strong"
                  >
                    <TeamBadge name={m.homeTeam} src={m.homeBadge} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {m.homeTeam} <span className="text-muted-foreground">vs</span> {m.awayTeam}
                    </span>
                    <span className="eyebrow shrink-0 text-[10px] text-muted-foreground">
                      {m.league}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
