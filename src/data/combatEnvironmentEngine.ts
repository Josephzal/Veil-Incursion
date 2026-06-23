import type { EnvironmentalModifiers } from '../types/game';
import { BLOOD_FRENZY_RESONANCE_THRESHOLD } from '../types/combatEnvironment';

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

export type KineticDamageSource = 'STRIKE' | 'COUNTER' | 'EVISCERATE' | 'OTHER';

export function scaleKineticDamage(
  rawDamage: number,
  meleeDamageBonusPct = 0,
): number {
  let scaled = rawDamage;
  if (meleeDamageBonusPct > 0) {
    scaled = Math.floor(scaled * (1 + meleeDamageBonusPct / 100));
  }
  return Math.max(1, scaled);
}

export function computeBloodFrenzyHeal(
  damageDealt: number,
  bloodFrenzyActive: boolean,
): number {
  if (!bloodFrenzyActive || damageDealt <= 0) return 0;
  return Math.max(1, Math.floor(damageDealt * 0.15));
}
