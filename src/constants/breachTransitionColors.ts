import type { FactionType } from '../types/game';

/** Breach veil flood colors — cabal-specific entry palette. */
export const BREACH_TRANSITION_COLORS: Record<FactionType, string> = {
  TERRAN_GRID: '#334155',
  LEGION: '#4C1D95',
  SOLARIS: '#991B1B',
};

export const EXTRACT_FLASH_COLOR = '#F8FAFC';

export function resolveBreachTransitionColor(faction: FactionType | null | undefined): string {
  if (faction == null) return BREACH_TRANSITION_COLORS.TERRAN_GRID;
  return BREACH_TRANSITION_COLORS[faction] ?? BREACH_TRANSITION_COLORS.TERRAN_GRID;
}
