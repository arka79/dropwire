export type ThemeChoice = "light" | "dark";

const KEY = "dropwire:theme";
const CHANGE_EVENT = "dropwire:theme-change";

export function subscribeTheme(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  const onLocal = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onLocal);
  };
}

export function themeSnapshot(): ThemeChoice {
  return resolvedTheme();
}

export function serverThemeSnapshot(): ThemeChoice {
  return "light";
}

export function readThemeChoice(): ThemeChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // ignore
  }
  return null;
}

export function systemTheme(): ThemeChoice {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolvedTheme(): ThemeChoice {
  return readThemeChoice() ?? systemTheme();
}

export function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", choice === "dark");
  root.style.colorScheme = choice;
}

export function setTheme(choice: ThemeChoice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // ignore
  }
  applyTheme(choice);
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore
  }
}
