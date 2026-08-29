import { cn } from "@/lib/utils";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0] ?? "";
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  const last = words[words.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

// A small fixed palette keeps fallback badges feeling designed rather than random.
const PALETTE = [
  "oklch(0.36 0.09 152)",
  "oklch(0.5 0.16 26)",
  "oklch(0.5 0.13 250)",
  "oklch(0.56 0.15 45)",
  "oklch(0.45 0.1 300)",
  "oklch(0.42 0.11 190)",
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function TeamBadge({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "size-5" : size === "lg" ? "size-11" : "size-6";
  const text = size === "lg" ? "text-sm" : "text-[9px]";

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className={cn(dims, "shrink-0 object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        dims,
        text,
        "flex shrink-0 items-center justify-center rounded-sm font-mono font-bold text-white",
        className,
      )}
      style={{ backgroundColor: colorFor(name) }}
    >
      {initials(name)}
    </span>
  );
}
