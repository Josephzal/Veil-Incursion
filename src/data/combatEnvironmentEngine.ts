import type { EnemyClass, EnemyCombatProfile } from '../types/run';
import type { EnemyAffinity } from '../types/combatEnvironment';
import { BLOOD_FRENZY_RESONANCE_THRESHOLD } from '../types/combatEnvironment';
import type { EnvironmentalModifiers } from '../types/game';

export function buildEnvironmentalModifiersForNode(
  resonancePercent: number,
): EnvironmentalModifiers {
  return {
    isEnemyPhaseShrouded: false,
    isPlayerBlinded: false,
    hasTetanusGlitch: false,
    startingStaminaPenalty: 0,
    resonancePercent,
    bloodFrenzyActive: resonancePercent > BLOOD_FRENZY_RESONANCE_THRESHOLD,
  };
}

export function rollProbableAffinity(
  encounterType: string,
  combatTier: 'STANDARD' | 'ELITE',
  seed: string,
): EnemyAffinity | undefined {
  if (encounterType !== 'COMBAT' && combatTier !== 'ELITE') return undefined;
  const hash = seed.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0);
  const roll = Math.abs(hash) % 100;

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
  spectralImbueActive = false,
): number {
  let scaled = rawDamage;
  if (meleeDamageBonusPct > 0) {
    scaled = Math.floor(scaled * (1 + meleeDamageBonusPct / 100));
  }

  switch (affinity) {
    case 'SPECTRAL':
      if (spectralImbueActive) return Math.max(1, scaled);
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

export function affinityWeaknessLabel(affinity: EnemyAffinity | undefined): string {
  switch (affinity) {
    case 'SPECTRAL':
      return 'Occult / Spectral essence';
    case 'CORPOREAL':
      return 'Melee kinetic';
    case 'CHRONO':
      return 'Kinetic strikes (stun)';
    default:
      return '—';
  }
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
