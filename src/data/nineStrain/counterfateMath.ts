import type { CombatDepthBand, ReversalStoreResult } from '../../types/counterfate';

/** Repository convention for derived combat integers: floor toward zero. */
export function roundCounterfateAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export const REVERSAL_DEPTH_CAPS: Record<CombatDepthBand, number> = {
  1: 30,
  2: 45,
  3: 60,
};

export function reversalCapForDepth(depth: CombatDepthBand): number {
  return REVERSAL_DEPTH_CAPS[depth];
}

export function applyReversalStore(
  currentRaw: number,
  attempted: number,
  cap: number,
): ReversalStoreResult {
  const rounded = roundCounterfateAmount(attempted);
  const room = Math.max(0, cap - currentRaw);
  const accepted = Math.min(room, rounded);
  return {
    attempted: rounded,
    accepted,
    wastedOverCap: Math.max(0, rounded - accepted),
    rawAfter: currentRaw + accepted,
  };
}

export function reversalPacket(raw: number, multiplier: number): number {
  return roundCounterfateAmount(raw * multiplier);
}
