"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  serverThemeSnapshot,
  setTheme,
  subscribeTheme,
  themeSnapshot,
} from "@/lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    serverThemeSnapshot,
  );

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={[
        "inline-flex size-9 items-center justify-center rounded-[3px] border border-line",
        "bg-surface text-ink-2 transition-[background-color,border-color,color,transform]",
        "duration-150 ease-[var(--ease-out)] hover:border-line-strong hover:bg-surface-2",
        "hover:text-ink active:scale-[0.96]",
        className,
      ].join(" ")}
    >
      {theme === "dark" ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}
