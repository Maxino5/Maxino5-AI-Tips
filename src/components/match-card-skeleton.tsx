export function MatchCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="panel flex animate-pulse overflow-hidden p-0"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="ticket-perforation w-8 shrink-0 bg-muted" />
      <div className="min-w-0 flex-1 p-3.5">
        <div className="h-3 w-2/3 rounded-sm bg-muted" />
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col gap-1.5">
            <div className="size-6 rounded-sm bg-muted" />
            <div className="h-3 w-16 rounded-sm bg-muted" />
          </div>
          <div className="h-4 w-5 rounded-sm bg-muted" />
          <div className="flex flex-col items-end gap-1.5">
            <div className="size-6 rounded-sm bg-muted" />
            <div className="h-3 w-16 rounded-sm bg-muted" />
          </div>
        </div>
        <div className="ticket-divider mt-3 pt-2.5">
          <div className="h-2.5 w-1/3 rounded-sm bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function MatchGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

export function DayStatsSkeleton() {
  return (
    <dl className="grid animate-pulse grid-cols-3 content-start gap-4 border-t-2 border-foreground pt-3 sm:border-t-0 sm:border-l-2 sm:pl-6 sm:pt-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="h-2.5 w-14 rounded-sm bg-muted" />
          <div className="mt-2 h-8 w-8 rounded-sm bg-muted" />
        </div>
      ))}
    </dl>
  );
}
