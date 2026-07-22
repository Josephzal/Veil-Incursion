import { useEffect, useMemo, useState } from 'react';

const BREACH_WINDOW_CYCLE_MS = 3 * 60 * 60 * 1000;

function remainingInCycle(now = Date.now()): number {
  return BREACH_WINDOW_CYCLE_MS - (now % BREACH_WINDOW_CYCLE_MS);
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Shared 3-hour breach-window countdown for hub chrome. */
export function useBreachWindowCountdown(): string {
  const [remainingMs, setRemainingMs] = useState(() => remainingInCycle());

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(remainingInCycle());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => formatCountdown(remainingMs), [remainingMs]);
}
