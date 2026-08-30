export function NewsCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="panel flex animate-pulse gap-3 p-3"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="size-20 shrink-0 rounded-sm bg-muted" />
      <div className="min-w-0 flex-1">
        <div className="h-2.5 w-16 rounded-sm bg-muted" />
        <div className="mt-2 h-3.5 w-full rounded-sm bg-muted" />
        <div className="mt-1.5 h-3.5 w-2/3 rounded-sm bg-muted" />
        <div className="mt-2 h-3 w-full rounded-sm bg-muted" />
      </div>
    </div>
  );
}

export function NewsListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-4 space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <NewsCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}
