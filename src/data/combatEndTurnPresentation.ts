/**
 * End Turn emphasis rules.
 *
 * Warning emphasis is reserved for canonical spendable resources that would be
 * discarded. This never decides availability, ownership, confirmation, or
 * resolution locking — callers keep those unchanged.
 *
 * Run tests: npx tsx --test src/data/combatEndTurnPresentation.test.ts
 */

export type EndTurnTone = 'disabled' | 'neutral' | 'interactive' | 'warning';

export interface EndTurnEmphasis {
  tone: EndTurnTone;
  /** True only when ending the turn discards spendable AP. */
  warnsResourceWaste: boolean;
  /** Full copy — use for the accessible label. */
  label: string;
  /** Copy for the compact system-module button. */
  shortLabel: string;
}

export function resolveEndTurnEmphasis(input: {
  canEndTurn: boolean;
  /** Canonical remaining action points for the current turn. */
  remainingAp: number;
  /** Pointer hover or keyboard focus. */
  interactive?: boolean;
}): EndTurnEmphasis {
  if (!input.canEndTurn) {
    return {
      tone: 'disabled',
      warnsResourceWaste: false,
      label: 'END TURN',
      shortLabel: 'END TURN',
    };
  }

  const remaining = Math.max(0, Math.trunc(input.remainingAp));
  if (remaining > 0) {
    return {
      tone: 'warning',
      warnsResourceWaste: true,
      label: `END TURN • ${remaining} AP LEFT`,
      shortLabel: `END TURN • ${remaining} AP`,
    };
  }

  return {
    tone: input.interactive === true ? 'interactive' : 'neutral',
    warnsResourceWaste: false,
    label: 'END TURN',
    shortLabel: 'END TURN',
  };
}
