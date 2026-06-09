import type { EnemyClass, EnemyCombatProfile } from '../types/run';
import type { EnvironmentType } from '../types/sector';
import type {
  AegisCombatContext,
  EnemyAffinity,
  EnvironmentCombatProfile,
} from '../types/combatEnvironment';
import {
  BLOOD_FRENZY_RESONANCE_THRESHOLD,
  ENVIRONMENT_COMBAT_PROFILE,
} from '../types/combatEnvironment';
import type { EnvironmentalModifiers } from '../types/game';

export interface BlindBreachPenaltyResult {
  soulAnchorLoss: number;
  resonanceSpike: number;
  attunementDrain: number;
  logLines: string[];
}

export function getEnvironmentCombatProfile(
  environmentType: EnvironmentType | null | undefined,
): EnvironmentCombatProfile | null {
  if (!environmentType) return null;
  return ENVIRONMENT_COMBAT_PROFILE[environmentType] ?? null;
}

export function buildAegisCombatContext(
  environmentType: EnvironmentType | null | undefined,
  resonancePercent: number,
): AegisCombatContext {
  const profile = getEnvironmentCombatProfile(environmentType);
  return {
    environmentType: environmentType ?? null,
    resonancePercent,
    bloodFrenzyActive: resonancePercent > BLOOD_FRENZY_RESONANCE_THRESHOLD,
    meleeDamageBonusPct: profile?.meleeDamageBonusPct ?? 0,
    staminaCostReductionPct: profile?.staminaCostReductionPct ?? 0,
    parryWindowBonusPct: environmentType === 'BLEEDING_HIGH_RISE' ? 10 : 0,
  };
}

export function buildEnvironmentalModifiersForNode(
  environmentType: EnvironmentType | null | undefined,
  resonancePercent: number,
): EnvironmentalModifiers {
  const context = buildAegisCombatContext(environmentType, resonancePercent);
  return {
    isEnemyPhaseShrouded: false,
    isPlayerBlinded: false,
    hasTetanusGlitch: false,
    startingStaminaPenalty: 0,
    environmentType: context.environmentType ?? undefined,
    meleeDamageBonusPct: context.meleeDamageBonusPct,
    staminaCostReductionPct: context.staminaCostReductionPct,
    parryWindowBonusPct: context.parryWindowBonusPct,
    resonancePercent: context.resonancePercent,
    bloodFrenzyActive: context.bloodFrenzyActive,
  };
}

export function applyBlindBreachPenalty(
  environmentType: EnvironmentType | null | undefined,
  maxSoulAnchor: number,
): BlindBreachPenaltyResult {
  const profile = getEnvironmentCombatProfile(environmentType);
  if (!profile) {
    return { soulAnchorLoss: 0, resonanceSpike: 0, attunementDrain: 0, logLines: [] };
  }

  const soulAnchorLoss = profile.blindBreachSoulAnchorLoss
    + Math.floor(maxSoulAnchor * (profile.blindBreachSoulAnchorLossPct / 100));
  const logLines: string[] = [];

  if (soulAnchorLoss > 0) {
    logLines.push(`>> ENV HAZARD — ${profile.hazardLabel} // −${soulAnchorLoss} SOUL ANCHOR.`);
  }
  if (profile.blindBreachResonanceSpike > 0) {
    logLines.push(`>> ENV ALARM — sector resonance spike +${profile.blindBreachResonanceSpike}%.`);
  }

  return {
    soulAnchorLoss,
    resonanceSpike: profile.blindBreachResonanceSpike,
    attunementDrain: 0,
    logLines,
  };
}

export function rollProbableAffinity(
  encounterType: string,
  combatTier: 'STANDARD' | 'ELITE',
  environmentType: EnvironmentType,
  seed: string,
): EnemyAffinity | undefined {
  if (encounterType !== 'COMBAT' && combatTier !== 'ELITE') return undefined;
  const hash = seed.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0);
  const roll = Math.abs(hash) % 100;

  if (environmentType === 'DESECRATED_SANCTUARY') {
    if (roll < 55) return 'SPECTRAL';
    if (roll < 80) return 'CHRONO';
    return 'CORPOREAL';
  }
  if (environmentType === 'BLEEDING_HIGH_RISE') {
    if (roll < 45) return 'CORPOREAL';
    if (roll < 70) return 'CHRONO';
    return 'SPECTRAL';
  }
  if (combatTier === 'ELITE' && roll < 25) return 'CHRONO';
  if (roll < 50) return 'SPECTRAL';
  return 'CORPOREAL';
}

export function resolveEnemyAffinity(
  classType: EnemyClass,
  isElite: boolean,
  resonancePercent: number,
): EnemyAffinity {
  if (classType === 'ABOMINATION') return 'CORPOREAL';
  if (classType === 'APPARITION') {
    if (isElite && resonancePercent >= 50 && Math.random() < 0.22) return 'CHRONO';
    return 'SPECTRAL';
  }
  if (Math.random() < 0.3) return 'CORPOREAL';
  if (isElite && resonancePercent >= 40 && Math.random() < 0.18) return 'CHRONO';
  return 'SPECTRAL';
}

export function applyCorporealHpMultiplier(
  profile: EnemyCombatProfile,
  affinity: EnemyAffinity,
): EnemyCombatProfile {
  if (affinity !== 'CORPOREAL') return profile;
  const maxHp = Math.floor(profile.maxHp * 2);
  return {
    ...profile,
    maxHp,
    currentHp: maxHp,
  };
}

export type KineticDamageSource = 'STRIKE' | 'COUNTER' | 'EVISCERATE' | 'OTHER';

export function scaleKineticDamage(
  rawDamage: number,
  affinity: EnemyAffinity | undefined,
  meleeDamageBonusPct: number,
): number {
  let scaled = rawDamage;
  if (meleeDamageBonusPct > 0) {
    scaled = Math.floor(scaled * (1 + meleeDamageBonusPct / 100));
  }

  switch (affinity) {
    case 'SPECTRAL':
      return Math.max(1, Math.floor(scaled * 0.25));
    case 'CORPOREAL':
      return Math.max(1, Math.floor(scaled * 2));
    case 'CHRONO':
    default:
      return Math.max(1, scaled);
  }
}

export function shouldChronoStunOnKineticHit(
  affinity: EnemyAffinity | undefined,
  source: KineticDamageSource,
): boolean {
  return affinity === 'CHRONO' && (source === 'STRIKE' || source === 'COUNTER' || source === 'EVISCERATE');
}

export function computeBloodFrenzyHeal(
  damageDealt: number,
  bloodFrenzyActive: boolean,
): number {
  if (!bloodFrenzyActive || damageDealt <= 0) return 0;
  return Math.max(1, Math.floor(damageDealt * 0.15));
}

export function affinityCombatLogLine(affinity: EnemyAffinity): string {
  switch (affinity) {
    case 'SPECTRAL':
      return '>> AFFINITY SPECTRAL — kinetic damage heavily resisted (75%).';
    case 'CORPOREAL':
      return '>> AFFINITY CORPOREAL — dense tissue (+100% HP), vulnerable to melee.';
    case 'CHRONO':
      return '>> AFFINITY CHRONO — temporal drift; kinetic hits may stun.';
    default:
      return '';
  }
}

export function environmentAdvantageLogLine(environmentType: EnvironmentType | null | undefined): string {
  const profile = getEnvironmentCombatProfile(environmentType);
  if (!profile) return '';
  return `>> ENV ADVANTAGE — ${profile.advantageLabel}`;
}
