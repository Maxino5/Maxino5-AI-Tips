import type { Market, Selection } from "@/lib/types";
import { useBetSlip } from "@/lib/bet-slip";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";

function tone(p: number) {
  if (p >= 0.6) return "text-primary";
  if (p >= 0.4) return "text-accent";
  return "text-muted-foreground";
}

export function MarketBoard({
  markets,
  matchId,
  fixture,
}: {
  markets: Market[];
  matchId: string;
  fixture: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {markets.map((market) => (
        <section key={market.id} className="panel p-4">
          <header className="mb-3 flex items-baseline justify-between gap-2 border-b border-border pb-2">
            <h3 className="eyebrow text-xs">{market.name}</h3>
            {market.note ? (
              <span className="font-serif text-[11px] italic text-muted-foreground">
                {market.note}
              </span>
            ) : null}
          </header>
          <div className="space-y-1.5">
            {market.selections.map((s) => (
              <SelectionRow
                key={s.key}
                selection={s}
                marketName={market.name}
                matchId={matchId}
                fixture={fixture}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SelectionRow({
  selection,
  marketName,
  matchId,
  fixture,
}: {
  selection: Selection;
  marketName: string;
  matchId: string;
  fixture: string;
}) {
  const slip = useBetSlip();
  const id = `${matchId}:${selection.key}`;
  const active = slip.has(id);
  const pct = Math.round(selection.probability * 100);

  return (
    <button
      type="button"
      onClick={() =>
        slip.toggle({
          id,
          matchId,
          fixture,
          market: marketName,
          label: selection.label,
          probability: selection.probability,
          fairOdds: selection.fairOdds,
        })
      }
      className={cn(
        "group relative w-full overflow-hidden rounded-sm border px-3 py-2 text-left transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-transparent bg-surface-strong/60 hover:border-primary/40",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-primary/10"
        style={{ width: `${pct}%` }}
      />
      <span className="relative flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded-sm border text-[10px]",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            {active ? <Check className="size-3" /> : <Plus className="size-2.5 opacity-50" />}
          </span>
          {selection.label}
        </span>
        <span className="flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">{selection.fairOdds.toFixed(2)}</span>
          <span
            className={cn("w-10 text-right text-sm font-semibold", tone(selection.probability))}
          >
            {pct}%
          </span>
        </span>
      </span>
    </button>
  );
}
