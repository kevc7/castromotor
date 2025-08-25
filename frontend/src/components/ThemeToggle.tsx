"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // Scope marker to limit CSS overrides to client area only
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (isAdmin) {
      body.classList.remove("client-surface");
    } else {
      body.classList.add("client-surface");
    }
  }, [isAdmin]);

  useEffect(() => {
    setMounted(true);
    try {
      const fromStorage = (localStorage.getItem("theme") as "light" | "dark") || "dark";
      setTheme(fromStorage);
      applyTheme(fromStorage);
    } catch {}
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch {}
    applyTheme(next);
  }

  // Hide on admin for now
  if (isAdmin) return null;

  // Evitar hydration mismatch - no renderizar hasta que esté montado en el cliente
  if (!mounted) {
    if (variant === "floating") {
      return (
        <div className="fixed right-4 top-20 sm:top-4 z-[60] inline-flex items-center gap-2 px-3 py-2 rounded-full shadow-md theme-toggle opacity-0">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
            <div className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium">Tema</span>
        </div>
      );
    }
    // inline: no placeholder para no empujar layout
    return null;
  }

  const baseClasses = "inline-flex items-center gap-2 px-3 py-2 rounded-full shadow-md theme-toggle transition-opacity duration-300 opacity-100";
  const positionClasses = variant === "floating" ? "fixed right-4 top-20 sm:top-4 z-[60]" : "relative z-[1]";
  const classes = `${positionClasses} ${baseClasses}`;

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={classes}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
        {theme === "dark" ? (
          // Sun icon
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.48 14.32l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM12 4V1h-1v3h1zm0 19v-3h-1v3h1zM4 12H1v-1h3v1zm19 0v-1h-3v1h3zM6.76 19.16l-1.42 1.41-1.79-1.8 1.41-1.41 1.8 1.8zm12.02-12.02l1.41-1.41 1.8 1.79-1.41 1.41-1.8-1.79zM12 7a5 5 0 100 10 5 5 0 000-10z"/></svg>
        ) : (
          // Moon icon
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.64 13A9 9 0 1111 2.36 7 7 0 0021.64 13z"/></svg>
        )}
      </span>
      <span className="text-sm font-medium">{theme === "dark" ? "Claro" : "Oscuro"}</span>
    </button>
  );
}
