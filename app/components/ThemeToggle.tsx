"use client";

import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center justify-center w-7 h-7 rounded text-terminal-muted hover:text-terminal-text transition-colors focus-visible:outline-2 focus-visible:outline-terminal-green"
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span aria-hidden="true">{isDark ? "☀" : "◑"}</span>
    </button>
  );
}
