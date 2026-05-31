import { useEffect, useMemo, useState } from 'react';

export interface ShatterCountdownState {
  targetLabel: string;
  remainingMs: number;
  remainingLabel: string;
  isExpired: boolean;
}

function nextSunday2359(from: Date): Date {
  const target = new Date(from);
  const day = target.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  target.setDate(target.getDate() + daysUntilSunday);
  target.setHours(23, 59, 0, 0);
  if (target.getTime() <= from.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'SHATTER IMMINENT';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${days}D ${String(hours).padStart(2, '0')}H ${String(minutes).padStart(2, '0')}M ${String(seconds).padStart(2, '0')}S`;
}

export function useShatterCountdown(): ShatterCountdownState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const target = nextSunday2359(new Date(now));
    const remainingMs = target.getTime() - now;
    return {
      targetLabel: 'SUNDAY 23:59 REGIONAL RESET',
      remainingMs,
      remainingLabel: formatRemaining(remainingMs),
      isExpired: remainingMs <= 0,
    };
  }, [now]);
}
