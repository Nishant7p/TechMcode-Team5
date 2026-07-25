"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { BRAND } from "../lib/brand";
import { DEMO_MODE } from "../lib/api";

function GithubMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function TopBar() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (DEMO_MODE) return;
    let active = true;
    fetch("/api/health", { cache: "no-store" })
      .then((response) => {
        if (active) setOnline(response.ok);
      })
      .catch(() => {
        if (active) setOnline(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const statusColor = DEMO_MODE
    ? "var(--accent-green)"
    : online === null
      ? "var(--text-tertiary)"
      : online
        ? "var(--accent-green)"
        : "var(--accent-amber)";
  const statusLabel = DEMO_MODE
    ? "Live demo"
    : online === null
      ? "Connecting"
      : online
        ? "Engine online"
        : "Engine offline";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line-hairline)] bg-[var(--bg-base)]/85 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link href="/" aria-label={`${BRAND.name} home`} className="interactive rounded-[var(--radius-md)] -ml-1 px-1 py-1">
          <Logo size={30} showWordmark showDescriptor />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--line-hairline)] bg-[var(--bg-panel)]/60">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
              aria-hidden
            />
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{statusLabel}</span>
          </span>
          <span className="hidden md:inline text-[10.5px] font-mono font-semibold text-[var(--text-tertiary)] px-2 py-1 rounded-md border border-[var(--line-hairline)]">
            {BRAND.version}
          </span>
          <a
            href={BRAND.repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="interactive flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-white border border-[var(--line-hairline)] rounded-[var(--radius-md)] px-2.5 py-1.5"
          >
            <GithubMark size={14} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
