import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BetSlip } from "./bet-slip-panel";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";

const nav = [
  { to: "/", label: "Today's card" },
  { to: "/value", label: "Value picks" },
  { to: "/accuracy", label: "Track record" },
  { to: "/news", label: "Sport News" },
];

function todayLine() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-foreground bg-surface">
        <div className="mx-auto max-w-6xl px-4 pb-3 pt-6 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <Link to="/" className="group">
              <span className="font-display text-[2.75rem] leading-[0.85] tracking-wide sm:text-6xl">
                Max AI Tips
              </span>
            </Link>
            <p className="mb-1 font-serif text-xs italic text-muted-foreground sm:text-sm">
              {todayLine()} · statistical model, checked by an AI analyst
            </p>
          </div>
        </div>
        <div className="border-t border-border">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-1 px-4 sm:px-6">
            <div className="flex flex-wrap items-center">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  activeProps={{ className: "border-primary text-foreground" }}
                  inactiveProps={{
                    className: "border-transparent text-muted-foreground hover:text-foreground",
                  }}
                  className="eyebrow border-b-2 px-3 py-2.5 text-xs transition-colors sm:text-sm"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center">
              <CommandPalette />
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mt-16 border-t-4 border-foreground bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <span className="font-display text-2xl tracking-wide">Max AI Tips</span>
            <span className="eyebrow text-[11px] text-muted-foreground">Est. this season</span>
          </div>
          <p className="mt-3 max-w-2xl font-serif text-sm leading-relaxed text-muted-foreground">
            Probabilities come from a Poisson/normal statistical model, cross-checked by an AI
            analyst against form, home advantage and competition context. They describe likelihood,
            not certainty — treat every number here as a well-informed opinion, not a promise. 18+,
            for information only.
          </p>
        </div>
      </footer>

      <BetSlip />
    </div>
  );
}
