import type { FactionType } from '../types/game';

/**
 * @deprecated Grey cabal flood colors — replaced by VeilTransitOverlay (mint/violet field).
 * Kept for any residual call sites / docs.
 */
export const BREACH_TRANSITION_COLORS: Record<FactionType, string> = {
  TERRAN_GRID: '#05090B',
  LEGION: '#05090B',
  SOLARIS: '#05090B',
};

/** @deprecated White extract flash removed — Veil transit uses near-black cover. */
export const EXTRACT_FLASH_COLOR = '#05090B';

export function resolveBreachTransitionColor(faction: FactionType | null | undefined): string {
  if (faction == null) return BREACH_TRANSITION_COLORS.TERRAN_GRID;
  return BREACH_TRANSITION_COLORS[faction] ?? BREACH_TRANSITION_COLORS.TERRAN_GRID;
}
