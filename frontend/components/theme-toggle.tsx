"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: 36, height: 36 }} />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="theme-toggle citation-toggle"
      aria-label="Toggle theme"
      title="Toggle theme"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px",
        borderRadius: "50%",
        width: "36px",
        height: "36px",
        background: "var(--paper-strong)",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "absolute",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s",
          transform: theme === "dark" ? "rotate(-90deg) scale(0)" : "rotate(0) scale(1)",
          opacity: theme === "dark" ? 0 : 1,
        }}
      >
        <Moon size={18} />
      </div>
      <div
        style={{
          position: "absolute",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s",
          transform: theme === "dark" ? "rotate(0) scale(1)" : "rotate(90deg) scale(0)",
          opacity: theme === "dark" ? 1 : 0,
        }}
      >
        <Sun size={18} />
      </div>
    </button>
  );
}
