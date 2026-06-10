import type { DamageChannel } from '../types/aegisCombat';
import type { EnemyCombatProfile } from '../types/run';
import {
  addCombatTag,
  applyDamageWithFractureBonus,
  applyFractureDamage,
  fractureRatio,
  hasCombatTag,
} from './combatFractureEngine';

const ARMOR_ABSORB_PER_LAYER = 3;

export function absorbByArmor(raw: number, layers: number): number {
  if (layers <= 0) return raw;
  return Math.max(0, raw - layers * ARMOR_ABSORB_PER_LAYER);
}

export interface ResolvedHostileHit {
  enemy: EnemyCombatProfile;
  hpDamage: number;
  channel: DamageChannel;
  fractured: boolean;
}

/** Apply HP damage through armor layers and fracture bonus. */
export function resolveHostileHpHit(
  enemy: EnemyCombatProfile,
  raw: number,
  channel: DamageChannel,
): ResolvedHostileHit {
  let working = enemy;
  let afterArmor = raw;

  const exposed = hasCombatTag(working, 'EXPOSED');
  if (channel === 'KINETIC') {
    const layers = working.kineticArmor ?? 0;
    afterArmor = absorbByArmor(raw, exposed ? Math.floor(layers / 2) : layers);
  } else if (channel === 'OCCULT') {
    const layers = working.occultWards ?? 0;
    afterArmor = absorbByArmor(raw, exposed ? Math.floor(layers / 2) : layers);
  }

  const hpDamage = applyDamageWithFractureBonus(afterArmor, working);
  return {
    enemy: working,
    hpDamage,
    channel,
    fractured: hasCombatTag(working, 'FRACTURED') || working.fracturedThisRound === true,
  };
}

export function applyStrikePackage(
  enemy: EnemyCombatProfile,
  kineticDamage: number,
): { enemy: EnemyCombatProfile; hpDamage: number } {
  let next = applyFractureDamage(enemy, 25);
  const hit = resolveHostileHpHit(next, kineticDamage, 'KINETIC');
  next = hit.enemy;
  if (fractureRatio(next) > 0.5) {
    next = addCombatTag(next, 'CONCUSSED');
  }
  return { enemy: next, hpDamage: hit.hpDamage };
}

export function applyVeilPiercerPackage(
  enemy: EnemyCombatProfile,
  occultDamage: number,
): { enemy: EnemyCombatProfile; hpDamage: number } {
  let next = applyFractureDamage(enemy, 15);
  const hit = resolveHostileHpHit(next, occultDamage, 'OCCULT');
  return { enemy: hit.enemy, hpDamage: hit.hpDamage };
}

export const COMBAT_CONSUMABLE_AP_COST = 1;
