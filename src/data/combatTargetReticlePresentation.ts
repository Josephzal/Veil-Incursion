/**
 * Presentation-only enemy targeting vocabulary for the Combat Hub.
 * Stable cyan/mint interaction hue — state is intensity/shape/copy, not color swaps.
 * Does not own targeting eligibility, allocation, or execution.
 */

import { OTT } from '../constants/occultTacticalTerminalTheme';

/** Canonical player-targeting accent — never purple or green. */
export const TARGET_RETICLE_COLOR = OTT.cyanSelect;

/** Forbidden hues for player enemy-target brackets (assertion helpers). */
export const FORBIDDEN_TARGET_RETICLE_HUES = [
  OTT.fluxViolet,
  OTT.terminalGreen,
  OTT.terminalGreenMuted,
] as const;

export type TargetReticleIntensity =
  | 'inspect'
  | 'inspectFocus'
  | 'candidate'
  | 'focus'
  | 'confirm';

export type TargetReticleMode =
  | 'hidden'
  | 'inspect'
  | 'candidate'
  | 'focus'
  | 'confirm';

export type DualAllocationRole = 'SOURCE' | 'DESTINATION';

export function resolveTargetReticleOpacity(intensity: TargetReticleIntensity): number {
  switch (intensity) {
    case 'inspect':
      return 0.55;
    case 'inspectFocus':
      return 0.82;
    case 'candidate':
      return 0.4;
    case 'focus':
      return 1;
    case 'confirm':
      return 1;
    default:
      return 0.7;
  }
}

export function resolveTargetReticleStroke(intensity: TargetReticleIntensity): number {
  switch (intensity) {
    case 'inspect':
      return 1.35;
    case 'inspectFocus':
      return 1.7;
    case 'candidate':
      return 1.2;
    case 'focus':
      return 2.05;
    case 'confirm':
      return 2.2;
    default:
      return 1.6;
  }
}

/**
 * Resolve which reticle treatment a hostile should show.
 * Presentation-only — consumes snapshot flags already owned by the hub.
 */
export function resolveEnemyTargetReticlePresentation(input: {
  targetingActive: boolean;
  abilityArmed: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isTargetable: boolean;
  isAoeAffected?: boolean;
  isBlocked?: boolean;
  isActingEnemy?: boolean;
  reticleHovered?: boolean;
  dualAllocationIndex?: 1 | 2 | null;
  confirmFlash?: boolean;
}): {
  mode: TargetReticleMode;
  intensity: TargetReticleIntensity;
  color: string;
  dualLabel: string | null;
  showCandidateTick: boolean;
} {
  const color = TARGET_RETICLE_COLOR;
  if (!input.targetingActive || input.isActingEnemy) {
    return {
      mode: 'hidden',
      intensity: 'inspect',
      color,
      dualLabel: null,
      showCandidateTick: false,
    };
  }

  if (input.confirmFlash) {
    return {
      mode: 'confirm',
      intensity: 'confirm',
      color,
      dualLabel: null,
      showCandidateTick: false,
    };
  }

  const hovered = input.reticleHovered === true;
  const dualIdx = input.dualAllocationIndex ?? null;

  if (!input.abilityArmed) {
    if (!input.isSelected) {
      return {
        mode: 'hidden',
        intensity: 'inspect',
        color,
        dualLabel: null,
        showCandidateTick: false,
      };
    }
    return {
      mode: 'inspect',
      intensity: hovered || input.isFocused ? 'inspectFocus' : 'inspect',
      color,
      dualLabel: null,
      showCandidateTick: false,
    };
  }

  const valid = input.isTargetable && !input.isBlocked;
  const aoe = input.isAoeAffected === true;
  if (!valid && !aoe && dualIdx == null) {
    return {
      mode: 'hidden',
      intensity: 'inspect',
      color,
      dualLabel: null,
      showCandidateTick: false,
    };
  }

  const dualLabel = dualIdx === 1
    ? '1 • SOURCE'
    : dualIdx === 2
      ? '2 • DESTINATION'
      : null;

  // At most one full bright reticle: hover / keyboard focus only.
  // Committed dual picks and other valid candidates use restrained ticks.
  if (hovered || input.isFocused) {
    return {
      mode: 'focus',
      intensity: 'focus',
      color,
      dualLabel,
      showCandidateTick: false,
    };
  }

  if (dualIdx != null || valid || aoe || input.isSelected) {
    return {
      mode: 'candidate',
      intensity: 'candidate',
      color,
      dualLabel,
      showCandidateTick: true,
    };
  }

  return {
    mode: 'hidden',
    intensity: 'inspect',
    color,
    dualLabel: null,
    showCandidateTick: false,
  };
}

export function isForbiddenTargetReticleHue(color: string): boolean {
  const normalized = color.trim().toLowerCase();
  return FORBIDDEN_TARGET_RETICLE_HUES.some((hue) => hue.toLowerCase() === normalized);
}
