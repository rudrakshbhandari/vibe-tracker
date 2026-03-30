"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "vt-theme";
const THEME_EVENT = "vt-theme-change";

function readStoredTheme(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function getResolvedTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  try {
    const rootTheme = document.documentElement.getAttribute("data-theme");
    if (rootTheme === "light" || rootTheme === "dark") return rootTheme;
  } catch {
    return "light";
  }

  const stored = readStoredTheme();
  if (stored) return stored;

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(THEME_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getResolvedTheme, () => "light");

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the toggle should still work for the current document.
    }

    try {
      document.documentElement.setAttribute("data-theme", next);
      window.dispatchEvent(new Event(THEME_EVENT));
    } catch {
      // Ignore DOM/event failures so the page never crashes from theme persistence.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="toggle-pill"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
