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
    // Passive inspection reads as a faint accent, not a lock.
    case 'inspect':
      return 0.34;
    case 'inspectFocus':
      return 0.55;
    case 'candidate':
      return 0.42;
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
      return 1.1;
    case 'inspectFocus':
      return 1.35;
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
 * Complete bright brackets belong to the active target and its confirmation
 * only. Inspection and candidacy use short exterior corner ticks, so several
 * enemies can be legible at once without any of them reading as committed.
 */
export function resolveTargetReticleVariant(
  mode: TargetReticleMode,
): 'full' | 'candidate' {
  return mode === 'focus' || mode === 'confirm' ? 'full' : 'candidate';
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

  // Hover / keyboard focus during an armed cast — the intense glow.
  if (hovered || input.isFocused) {
    return {
      mode: 'focus',
      intensity: 'focus',
      color,
      dualLabel,
      showCandidateTick: false,
    };
  }

  // Committed pick while armed keeps the same restrained dim glow used when
  // inspecting without an ability. Valid-but-unpicked candidates stay ticks.
  if (dualIdx != null || input.isSelected) {
    return {
      mode: 'inspect',
      intensity: 'inspect',
      color,
      dualLabel,
      showCandidateTick: false,
    };
  }

  if (valid || aoe) {
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
