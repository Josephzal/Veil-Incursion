/**
 * WU-4 — resolve plans for the six new weapon ultimates.
 * Pure data: combat hub applies damage / spends / logs.
 */
import type { WeaponUltimateGrade } from '../types/weaponUltimateInteraction';
import type { WeaponUltimateId } from './weaponUltimateRegistry';

/** ~10% CLEAN / ~20% PERFECT on the performance-sensitive portion. */
export function gradePerformanceMult(grade: WeaponUltimateGrade): number {
  if (grade === 'PERFECT') return 1.2;
  if (grade === 'CLEAN') return 1.1;
  return 1;
}

export function gradeFromStageScores(scores: readonly number[], forceStandard = false): WeaponUltimateGrade {
  if (forceStandard) return 'STANDARD';
  if (scores.length === 0) return 'STANDARD';
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 0.85) return 'PERFECT';
  if (avg >= 0.55) return 'CLEAN';
  return 'STANDARD';
}

export interface RendTheVeilPlan {
  ultimateId: 'REND_THE_VEIL';
  grade: WeaponUltimateGrade;
  kineticHitDamage: number;
  occultRuptureDamage: number;
  consumeTempo: boolean;
  notes: string[];
}

export function planRendTheVeil(input: {
  grade: WeaponUltimateGrade;
  baseStrike: number;
  tempoArmed: boolean;
}): RendTheVeilPlan {
  const mult = gradePerformanceMult(input.grade);
  const kinetic = Math.max(1, Math.floor(input.baseStrike * 0.55 * mult));
  const occultBase = Math.max(1, Math.floor(input.baseStrike * (input.tempoArmed ? 0.85 : 0.4) * mult));
  const notes = [
    input.tempoArmed
      ? 'Tempo cashed — Occult rupture fully armed.'
      : 'Tempo cold — baseline rupture only.',
  ];
  if (input.grade !== 'STANDARD') {
    notes.push(`${input.grade} — rupture stability improved.`);
  }
  return {
    ultimateId: 'REND_THE_VEIL',
    grade: input.grade,
    kineticHitDamage: kinetic,
    occultRuptureDamage: occultBase,
    consumeTempo: input.tempoArmed,
    notes,
  };
}

export interface GravefallPlan {
  ultimateId: 'GRAVEFALL';
  grade: WeaponUltimateGrade;
  impactDamage: number;
  fractureCashoutHint: boolean;
  shockwaveSecondary: boolean;
  notes: string[];
}

export function planGravefall(input: {
  grade: WeaponUltimateGrade;
  baseStrike: number;
  targetFractured: boolean;
}): GravefallPlan {
  const mult = gradePerformanceMult(input.grade);
  const impact = Math.max(1, Math.floor(input.baseStrike * 1.35 * mult));
  const notes = [
    input.targetFractured
      ? 'Fracture prepared — cashout window open.'
      : 'Unprepared target — chip impact only.',
  ];
  if (input.grade === 'CLEAN') notes.push('CLEAN — armor/Fracture break pressure.');
  if (input.grade === 'PERFECT') notes.push('PERFECT — narrow impact shockwave.');
  return {
    ultimateId: 'GRAVEFALL',
    grade: input.grade,
    impactDamage: impact,
    fractureCashoutHint: input.targetFractured,
    shockwaveSecondary: input.grade === 'PERFECT',
    notes,
  };
}

export type SixthSealReloadQuality = 'NORMAL' | 'ACTIVE' | 'PERFECT';

export interface SixthSealPlan {
  ultimateId: 'SIXTH_SEAL';
  grade: WeaponUltimateGrade;
  reloadQuality: SixthSealReloadQuality;
  precisionShots: number;
  emptyMagazineAfter: boolean;
  notes: string[];
}

export function planSixthSeal(input: {
  grade: WeaponUltimateGrade;
  magSize: number;
}): SixthSealPlan {
  const reloadQuality: SixthSealReloadQuality =
    input.grade === 'PERFECT' ? 'PERFECT' : input.grade === 'CLEAN' ? 'ACTIVE' : 'NORMAL';
  const shots = Math.min(3, Math.max(1, Math.floor(input.magSize / 2) || 1));
  return {
    ultimateId: 'SIXTH_SEAL',
    grade: input.grade,
    reloadQuality,
    precisionShots: shots,
    emptyMagazineAfter: true,
    notes: [
      `Cylinder sealed — ultimate-owned ${reloadQuality.toLowerCase()} refill ritual.`,
      `Precision sequence ×${shots}; magazine empties after the seal (no ordinary reload rewards).`,
    ],
  };
}

export interface LastKnockPlan {
  ultimateId: 'LAST_KNOCK';
  grade: WeaponUltimateGrade;
  committedRounds: number;
  breachDamage: number;
  armorStrip: number;
  fractureBonus: number;
  notes: string[];
}

export function planLastKnock(input: {
  grade: WeaponUltimateGrade;
  currentAmmo: number;
  baseBallistic: number;
}): LastKnockPlan | { blocked: true; reason: string } {
  if (input.currentAmmo <= 0) {
    return { blocked: true, reason: 'RELOAD REQUIRED — no rounds for Last Knock.' };
  }
  const committed = input.currentAmmo;
  const mult = gradePerformanceMult(input.grade);
  const perRound = Math.max(1, Math.floor(input.baseBallistic * 0.9 * mult));
  const breachDamage = perRound * committed;
  const armorStrip = input.grade === 'PERFECT' ? 2 : input.grade === 'CLEAN' ? 2 : 1;
  const fractureBonus = input.grade === 'PERFECT' ? 20 : input.grade === 'CLEAN' ? 12 : 6;
  return {
    ultimateId: 'LAST_KNOCK',
    grade: input.grade,
    committedRounds: committed,
    breachDamage,
    armorStrip,
    fractureBonus,
    notes: [
      `Committed ${committed} round${committed === 1 ? '' : 's'}.`,
      `${input.grade} — armor strip ${armorStrip}, Fracture +${fractureBonus}.`,
    ],
  };
}

export interface FuneralKnotPlan {
  ultimateId: 'FUNERAL_KNOT';
  grade: WeaponUltimateGrade;
  baselineOccult: number;
  detonationEfficiency: number;
  notes: string[];
}

export function planFuneralKnot(input: {
  grade: WeaponUltimateGrade;
  baseOccult: number;
}): FuneralKnotPlan {
  const mult = gradePerformanceMult(input.grade);
  const efficiency = input.grade === 'PERFECT' ? 1.2 : input.grade === 'CLEAN' ? 1.1 : 1;
  return {
    ultimateId: 'FUNERAL_KNOT',
    grade: input.grade,
    baselineOccult: Math.max(1, Math.floor(input.baseOccult * 0.45 * mult)),
    detonationEfficiency: efficiency,
    notes: [
      'Knot tears — Rot cashout weighted by existing stacks.',
      `${input.grade} — detonation efficiency ×${efficiency.toFixed(1)}.`,
    ],
  };
}

export interface CrimsonRefractionPlan {
  ultimateId: 'CRIMSON_REFRACTION';
  grade: WeaponUltimateGrade;
  offeredHp: number;
  fullPay: boolean;
  occultPerTarget: number;
  brinkAmp: boolean;
  notes: string[];
}

export function planCrimsonRefraction(input: {
  grade: WeaponUltimateGrade;
  baseOccult: number;
  offeredHp: number;
  maxSafeOffer: number;
  operativeHp: number;
  veilFlux: number;
  brinkThresholdPct?: number;
}): CrimsonRefractionPlan {
  const brinkPct = input.brinkThresholdPct ?? 25;
  const brinkAmp = input.veilFlux <= brinkPct;
  const cappedOffer = Math.max(
    0,
    Math.min(input.offeredHp, input.maxSafeOffer, Math.max(0, input.operativeHp - 1)),
  );
  const fullPay = cappedOffer > 0 && cappedOffer >= input.maxSafeOffer && input.maxSafeOffer > 0;
  const mult = gradePerformanceMult(input.grade);
  let occult = Math.max(1, Math.floor(input.baseOccult * 0.7 * mult));
  if (fullPay) occult = Math.floor(occult * 1.15);
  if (brinkAmp) occult = Math.floor(occult * 1.2);
  const notes: string[] = [
    cappedOffer > 0
      ? `Offer ${cappedOffer} HP${fullPay ? ' — FULL PAY' : ' — partial'}.`
      : 'Zero offering — baseline refraction only.',
  ];
  if (brinkAmp) notes.push('Brink armed — occult amp applied.');
  if (!fullPay && cappedOffer > 0) notes.push('Partial payment — FULL PAY withheld.');
  notes.push(`${input.grade} — ray alignment grade (not offer size).`);
  return {
    ultimateId: 'CRIMSON_REFRACTION',
    grade: input.grade,
    offeredHp: cappedOffer,
    fullPay,
    occultPerTarget: occult,
    brinkAmp,
    notes,
  };
}

export const WU4_ULTIMATE_IDS: readonly WeaponUltimateId[] = [
  'REND_THE_VEIL',
  'GRAVEFALL',
  'SIXTH_SEAL',
  'LAST_KNOCK',
  'FUNERAL_KNOT',
  'CRIMSON_REFRACTION',
] as const;

export function isWu4NewUltimateId(id: string): boolean {
  return (WU4_ULTIMATE_IDS as readonly string[]).includes(id);
}
