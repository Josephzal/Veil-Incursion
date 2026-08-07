/**
 * Presentation window over the canonical turn order.
 *
 * Reads the sequence produced by `buildCombatTurnOrder` and shows the current
 * actor plus the next few. It does not reorder, schedule, or model turns.
 *
 * Run tests: npx tsx --test src/utils/combatTurnOrderWindow.test.ts
 */

/** Structural shape only, so this stays importable without combat side effects. */
export interface TurnOrderWindowEntry {
  id: string;
  state: string;
}

/** Current actor + next three. */
export const TURN_ORDER_WINDOW_SIZE = 4;

export function windowTurnOrderEntries<T extends TurnOrderWindowEntry>(
  entries: readonly T[],
  windowSize: number = TURN_ORDER_WINDOW_SIZE,
): T[] {
  if (windowSize <= 0) return [];
  // Short rosters render whole — wrapping would duplicate actors.
  if (entries.length <= windowSize) return [...entries];

  const activeIndex = entries.findIndex((entry) => entry.state === 'active');
  const start = activeIndex >= 0 ? activeIndex : 0;
  const windowed: T[] = [];
  for (let offset = 0; offset < windowSize; offset += 1) {
    windowed.push(entries[(start + offset) % entries.length]!);
  }
  return windowed;
}

export type TurnOrderEmphasis = 'current' | 'next' | 'upcoming' | 'inactive';

export function resolveTurnOrderEmphasis(input: {
  state: string;
  indexInWindow: number;
  hasCurrentActor: boolean;
}): TurnOrderEmphasis {
  if (input.state === 'defeated') return 'inactive';
  if (input.state === 'active') return 'current';
  if (input.hasCurrentActor && input.indexInWindow === 1) return 'next';
  return 'upcoming';
}

/**
 * Later actors fade progressively but stay identifiable — the floor keeps names
 * readable rather than dissolving them.
 */
export function resolveTurnOrderOpacity(emphasis: TurnOrderEmphasis, indexInWindow: number): number {
  if (emphasis === 'current') return 1;
  if (emphasis === 'inactive') return 0.45;
  if (emphasis === 'next') return 0.95;
  return Math.max(0.7, 0.95 - indexInWindow * 0.08);
}
