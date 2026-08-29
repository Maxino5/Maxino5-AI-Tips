import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getStoredTheme, type ThemeName } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const toggle = () => {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      aria-label="Toggle day or night edition"
      title={theme === "dark" ? "Switch to day edition" : "Switch to night edition"}
    >
      {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      <span className="eyebrow hidden sm:inline">
        {theme === "dark" ? "Day edition" : "Night edition"}
      </span>
    </button>
  );
}
