import type { StandingsRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StandingsTable({
  rows,
  highlight,
}: {
  rows: StandingsRow[];
  highlight: [string, string];
}) {
  const groups = new Map<string | null, StandingsRow[]>();
  for (const r of rows) {
    const arr = groups.get(r.group) ?? [];
    arr.push(r);
    groups.set(r.group, arr);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([group, groupRows]) => (
        <div key={group ?? "table"}>
          {group ? <p className="eyebrow mb-2 text-[10px] text-muted-foreground">{group}</p> : null}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">#</th>
                <th className="py-1.5 pr-2 font-medium">Team</th>
                <th className="px-1.5 py-1.5 text-right font-medium">P</th>
                <th className="px-1.5 py-1.5 text-right font-medium">GD</th>
                <th className="py-1.5 pl-1.5 text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.map((r) => {
                const isHighlighted = highlight.includes(r.team);
                return (
                  <tr
                    key={r.teamId}
                    className={cn(
                      "border-b border-border/60 last:border-0",
                      isHighlighted && "bg-primary/10",
                    )}
                  >
                    <td className="py-1.5 pr-2 font-mono text-xs text-muted-foreground">
                      {r.rank}
                    </td>
                    <td className="flex items-center gap-1.5 py-1.5 pr-2">
                      {r.note ? (
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: r.note.color }}
                          title={r.note.description}
                        />
                      ) : null}
                      {r.badge ? (
                        <img src={r.badge} alt="" className="size-4 shrink-0 object-contain" />
                      ) : null}
                      <span
                        className={cn(
                          "truncate text-xs",
                          isHighlighted ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {r.team}
                      </span>
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono text-xs">
                      {r.played ?? "–"}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono text-xs">
                      {r.goalDiff !== null ? (r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff) : "–"}
                    </td>
                    <td className="py-1.5 pl-1.5 text-right font-mono text-xs font-semibold">
                      {r.points ?? "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
