import type { DamageChannel } from '../types/aegisCombat';
import type { EnemyCombatProfile } from '../types/run';
import {
  addCombatTag,
  applyDamageWithFractureBonus,
  applyFractureDamage,
  fractureRatio,
  hasCombatTag,
} from './combatFractureEngine';
import { mitigateByChannel } from './combatDefenseLayerEngine';

/** @deprecated Flat absorb retired — Phase 1 uses % mitigation via combatDefenseLayerEngine. */
export function absorbByArmor(raw: number, _layers: number): number {
  return raw;
}

export interface ResolvedHostileHit {
  enemy: EnemyCombatProfile;
  hpDamage: number;
  channel: DamageChannel;
  fractured: boolean;
  damageReduced: number;
  logLines: string[];
}

/** Apply HP damage through armor/ward % mitigation and fracture bonus. */
export function resolveHostileHpHit(
  enemy: EnemyCombatProfile,
  raw: number,
  channel: DamageChannel,
  options?: {
    ignoreDefenses?: boolean;
    pierce?: boolean;
    partialPierce?: boolean;
    armorPierceLayers?: 0 | 1;
    wardPierceLayers?: 0 | 1;
  },
): ResolvedHostileHit {
  const mitigation = mitigateByChannel(enemy, raw, channel, {
    ignoreDefenses: options?.ignoreDefenses,
    pierce: options?.pierce,
    partialPierce: options?.partialPierce,
    armorPierceLayers: options?.armorPierceLayers,
    wardPierceLayers: options?.wardPierceLayers,
  });
  const hpDamage = applyDamageWithFractureBonus(mitigation.damageAfter, mitigation.enemy);
  return {
    enemy: mitigation.enemy,
    hpDamage,
    channel,
    fractured: hasCombatTag(mitigation.enemy, 'FRACTURED') || mitigation.enemy.fracturedThisRound === true,
    damageReduced: mitigation.damageReduced,
    logLines: mitigation.logLines,
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

export const COMBAT_CONSUMABLE_AP_COST = 2;
