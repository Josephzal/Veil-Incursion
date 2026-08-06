/**
 * ABYSSAL VERDICT ready / targeting presentation helpers.
 * Pure — no React. Presentation state only; combat math stays in commit helpers / hub.
 */

import { ABYSSAL_VERDICT_DISPLAY_NAME } from './abyssalVerdictPresentation';
import {
  resolveAbyssalVerdictCommitFromGradeInput,
  scaleAbyssalVerdictDamage,
} from './abyssalVerdictCommitEngine';
import type { WeaponUltimateGrade } from '../types/weaponUltimateInteraction';

export type AbyssalVerdictPresentationState = 'unavailable' | 'ready' | 'targeting';

export const ABYSSAL_VERDICT_READY_NOTIFY_MS = 800;
export const ABYSSAL_VERDICT_BRACKET_COLLAPSE_MS = 75;

export type AbyssalVerdictDamagePreview = {
  damage: number;
  remainingHp: number;
  remainingArmor: number;
  lethal: boolean;
  gradeLabel: string;
};

export { scaleAbyssalVerdictDamage };

/**
 * Canonical commit damage for Abyssal Verdict.
 * Grade comes from the authoritative grade/input engine (or staged grade) —
 * FULL targeting confirmation does not itself award PERFECT.
 */
export function resolveAbyssalVerdictCommitDamage(input: {
  simplifiedInputs?: boolean;
  hitCount?: number;
  grade?: WeaponUltimateGrade;
  sliceDamagePenalty?: number;
}): { damage: number; gradeLabel: string; hits: number } {
  const resolved = resolveAbyssalVerdictCommitFromGradeInput(input);
  return {
    damage: resolved.damage,
    gradeLabel: resolved.grade,
    hits: resolved.hits,
  };
}

/**
 * TRUE-channel preview — Abyssal Verdict bypasses evade and armor in commit.
 * remainingArmor is informational (will not absorb this hit).
 */
export function previewAbyssalVerdictDamage(input: {
  currentHp: number;
  kineticArmor?: number;
  simplifiedInputs?: boolean;
  hitCount?: number;
  grade?: WeaponUltimateGrade;
  sliceDamagePenalty?: number;
}): AbyssalVerdictDamagePreview {
  const { damage, gradeLabel } = resolveAbyssalVerdictCommitDamage({
    simplifiedInputs: input.simplifiedInputs,
    hitCount: input.hitCount,
    grade: input.grade,
    sliceDamagePenalty: input.sliceDamagePenalty,
  });
  const remainingHp = Math.max(0, input.currentHp - damage);
  return {
    damage,
    remainingHp,
    remainingArmor: Math.max(0, input.kineticArmor ?? 0),
    lethal: remainingHp <= 0,
    gradeLabel,
  };
}

export function resolveAbyssalVerdictPresentationState(input: {
  ultimateReady: boolean;
  primed: boolean;
}): AbyssalVerdictPresentationState {
  if (!input.ultimateReady) return 'unavailable';
  if (input.primed) return 'targeting';
  return 'ready';
}

/**
 * Edge-detect ready transition. Returns true only on false→true.
 * Callers must persist `wasReady` across renders/turns.
 */
export function shouldFireAbyssalVerdictReadyNotification(
  wasReady: boolean,
  isReady: boolean,
): boolean {
  return !wasReady && isReady;
}

export function isAbyssalVerdictEnemyEligible(input: {
  alive: boolean;
  dissolveHidden?: boolean;
}): boolean {
  return input.alive && input.dissolveHidden !== true;
}

/**
 * Center-screen orbital ping must never appear for Abyssal Verdict (eviscerate).
 * Hex/Envoy keep their orbital ready pings.
 */
export function shouldShowOrbitalUltimatePing(
  variant: 'eviscerate' | 'zero_protocol' | 'cataclysm' | null | undefined,
): boolean {
  return variant != null && variant !== 'eviscerate';
}

export const ABYSSAL_VERDICT_UI_COPY = {
  displayName: ABYSSAL_VERDICT_DISPLAY_NAME,
  readyEyebrow: 'ULTIMATE READY',
  moduleHeader: 'ULTIMATE // RESERVE',
  readyStatus: 'READY',
  primeHint: 'PRIME ULTIMATE',
  selectTarget: 'SELECT TARGET',
  targetingInstruction: `${ABYSSAL_VERDICT_DISPLAY_NAME} // SELECT TARGET`,
  cancelLabel: 'CANCEL — FREE',
  lethal: 'LETHAL',
} as const;

/** Dried-crimson / worn-bone / bruised-violet palette for ultimate chrome. */
export const ABYSSAL_VERDICT_UI_COLORS = {
  bone: '#E4D8C4',
  boneMuted: '#B8A990',
  crimson: '#8B1E2D',
  crimsonBright: '#C43A4A',
  crimsonBorder: 'rgba(160, 40, 55, 0.85)',
  black: '#0A0708',
  panel: 'rgba(8, 5, 6, 0.92)',
  violet: '#5C3D5A',
  violetAccent: 'rgba(110, 70, 105, 0.55)',
  dim: 'rgba(4, 2, 3, 0.45)',
} as const;

/** Live HUD snapshot published to CombatScreen (no function fields). */
export type AbyssalVerdictHudSnapshot = {
  state: AbyssalVerdictPresentationState;
  reserve: number;
  cap: number;
  notifySeq: number;
  canInteract: boolean;
  collapsingUnitId: string | null;
  reducedMotion: boolean;
  /** Staged grade after slice / simplified resolve; null before grade input. */
  stagedGrade: string | null;
  stagedDamage: number | null;
};
