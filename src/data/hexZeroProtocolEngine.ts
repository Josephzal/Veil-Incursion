/**
 * Zero Protocol resolution (v1 refactor).
 *
 * Zero Protocol is gated by Protocol Charges (not full mag). On activation it fires
 * a true-damage execution sequence and applies up to 3 ammo riders drawn from the
 * calibrated ammo sequence (the last 3 Perfect-reload ammo types), plus a Full
 * Calibration or specialization bonus. Pure — the combat hub applies the plan.
 */

import {
  isFullCalibration,
  isFullySpecialized,
  resolveCalibratedSequence,
  type HexAmmoType,
} from '../types/hexAmmo';

export type ZeroProtocolPerformance = 'POOR' | 'GOOD' | 'PERFECT';

export const ZERO_PROTOCOL_CONFIG = {
  baseTrueDamage: 45,
  performanceBonus: { POOR: 0, GOOD: 15, PERFECT: 30 } as Record<ZeroProtocolPerformance, number>,
  /** Used when no tap-minigame result is available. */
  flatDamageNoMinigame: 60,
  fullCalibrationBonus: 15,
  spec: {
    silverExtraFracture: 25,
    wraithTrueVsWarded: 20,
    stasisBossDamageReductionPct: 25,
  },
  riders: {
    silverSurviveFracture: 10,
    wraithVoidMarkedTrueBonus: 10,
    stasisSurviveApReduction: 2,
  },
} as const;

export interface ZeroProtocolTarget {
  isBoss: boolean;
  hasKineticArmor: boolean;
  hasOccultWard: boolean;
  hasVoidMark: boolean;
  isWardedOrSpectralOrBackline: boolean;
  telegraphing: boolean;
}

export interface ZeroProtocolPlan {
  trueDamage: number;
  sequence: HexAmmoType[];
  fullCalibration: boolean;
  specialization: HexAmmoType | null;
  /** Total distinct Kinetic Armor layers to sunder. */
  sunderArmor: number;
  /** Total Occult Wards to sunder. */
  sunderWard: number;
  applyVoidMark: boolean;
  applyStasisLock: boolean;
  interruptIntent: boolean;
  /** AP to reduce on a surviving target. */
  apReduction: number;
  /** Stun a non-boss target (3× Stasis specialization). */
  stunNonBoss: boolean;
  /** Reduce boss outgoing damage next turn by this fraction (3× Stasis vs boss). */
  bossDamageReductionPct: number;
  /** Extra Fracture to apply if the target survives (Silver riders + spec). */
  surviveFractureBonus: number;
  notes: string[];
}

/** Map a rapid-tap count to a performance tier. */
export function performanceFromTaps(tapCount: number): ZeroProtocolPerformance {
  if (tapCount >= 10) return 'PERFECT';
  if (tapCount >= 5) return 'GOOD';
  return 'POOR';
}

export function computeZeroProtocolPlan(input: {
  calibrated: readonly HexAmmoType[];
  currentAmmoType: HexAmmoType;
  performance?: ZeroProtocolPerformance;
  hasMinigameResult: boolean;
  target: ZeroProtocolTarget;
}): ZeroProtocolPlan {
  const cfg = ZERO_PROTOCOL_CONFIG;
  const sequence = resolveCalibratedSequence(input.calibrated, input.currentAmmoType);
  const target = input.target;

  const plan: ZeroProtocolPlan = {
    trueDamage: 0,
    sequence,
    fullCalibration: false,
    specialization: null,
    sunderArmor: 0,
    sunderWard: 0,
    applyVoidMark: false,
    applyStasisLock: false,
    interruptIntent: false,
    apReduction: 0,
    stunNonBoss: false,
    bossDamageReductionPct: 0,
    surviveFractureBonus: 0,
    notes: [],
  };

  // Base damage.
  if (input.hasMinigameResult && input.performance) {
    plan.trueDamage = cfg.baseTrueDamage + cfg.performanceBonus[input.performance];
  } else {
    plan.trueDamage = cfg.flatDamageNoMinigame;
  }

  // Per-ammo riders (one per calibrated entry, in sequence).
  for (const ammo of sequence) {
    switch (ammo) {
      case 'SILVER_CORE':
        plan.sunderArmor += 1;
        plan.surviveFractureBonus += cfg.riders.silverSurviveFracture;
        break;
      case 'WRAITHGLASS':
        if (target.hasOccultWard) plan.sunderWard += 1;
        plan.applyVoidMark = true;
        if (target.hasVoidMark) plan.trueDamage += cfg.riders.wraithVoidMarkedTrueBonus;
        break;
      case 'STASIS_LOCK':
        plan.applyStasisLock = true;
        if (target.telegraphing) plan.interruptIntent = true;
        plan.apReduction = Math.min(cfg.riders.stasisSurviveApReduction, plan.apReduction + cfg.riders.stasisSurviveApReduction);
        break;
      default:
        break;
    }
  }

  // Sequence bonus.
  const spec = isFullySpecialized(sequence);
  if (isFullCalibration(sequence)) {
    plan.fullCalibration = true;
    plan.trueDamage += cfg.fullCalibrationBonus;
    plan.notes.push('FULL CALIBRATION // FIRING SOLUTION COMPLETE');
  } else if (spec) {
    plan.specialization = spec;
    switch (spec) {
      case 'SILVER_CORE':
        plan.surviveFractureBonus += cfg.spec.silverExtraFracture;
        plan.sunderArmor += 1;
        plan.notes.push('SILVER SPECIALIZATION // ARMOR SHREDDED');
        break;
      case 'WRAITHGLASS':
        if (target.isWardedOrSpectralOrBackline) plan.trueDamage += cfg.spec.wraithTrueVsWarded;
        plan.notes.push('WRAITHGLASS SPECIALIZATION // WARD-BREAKER');
        break;
      case 'STASIS_LOCK':
        if (target.isBoss) {
          plan.bossDamageReductionPct = cfg.spec.stasisBossDamageReductionPct;
          plan.notes.push('STASIS SPECIALIZATION // BOSS INTENT DAMPENED');
        } else {
          plan.stunNonBoss = true;
          plan.notes.push('STASIS SPECIALIZATION // TARGET STUNNED');
        }
        break;
      default:
        break;
    }
  }

  // Boss safety: never hard-stun a boss.
  if (target.isBoss) plan.stunNonBoss = false;

  return plan;
}
