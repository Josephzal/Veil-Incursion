import assert from 'node:assert/strict';
import { resolveHostileHpHit } from './aegisAbilityResolver';
import { resolvePlayerCritChance } from './combatChanceEngine';
import type { EnemyCombatProfile } from '../types/run';

const target = {
  currentHp: 100,
  maxHp: 100,
  kineticArmor: 1,
  baseKineticArmor: 1,
  occultWards: 1,
  baseOccultWards: 1,
} as EnemyCombatProfile;

{
  const result = resolvePlayerCritChance({
    target,
    factionCritBonus: 0,
    additiveCritChanceBonus: 0.1,
    hasShatterPoint: false,
    guaranteedCrits: 0,
  });
  assert.equal(result.chance, 0.2);
  assert.equal(result.guaranteed, false);
}

{
  const result = resolvePlayerCritChance({
    target,
    factionCritBonus: 0.95,
    additiveCritChanceBonus: 0.1,
    hasShatterPoint: false,
    guaranteedCrits: 0,
  });
  assert.equal(result.chance, 1);
}

{
  const hit = resolveHostileHpHit(target, 100, 'KINETIC', {
    armorPierceLayers: 1,
  });
  assert.equal(hit.hpDamage, 100);
  assert.equal(hit.enemy.kineticArmor, 1);
  assert.equal(hit.enemy.baseKineticArmor, 1);
}

{
  const layered = {
    ...target,
    kineticArmor: 2,
    baseKineticArmor: 2,
  };
  const hit = resolveHostileHpHit(layered, 100, 'KINETIC', {
    armorPierceLayers: 1,
  });
  const ordinaryOneLayer = resolveHostileHpHit(
    { ...layered, kineticArmor: 1, baseKineticArmor: 1 },
    100,
    'KINETIC',
  );
  assert.equal(hit.hpDamage, ordinaryOneLayer.hpDamage);
  assert.equal(hit.enemy.kineticArmor, 2);
  assert.equal(hit.enemy.baseKineticArmor, 2);
}

{
  const hit = resolveHostileHpHit(target, 100, 'OCCULT', {
    wardPierceLayers: 1,
  });
  assert.equal(hit.hpDamage, 100);
  assert.equal(hit.enemy.occultWards, 1);
  assert.equal(hit.enemy.baseOccultWards, 1);
}

{
  const hit = resolveHostileHpHit(target, 100, 'KINETIC', {
    ignoreDefenses: true,
    armorPierceLayers: 0,
  });
  assert.equal(hit.hpDamage, 100);
}

console.log('Combat requisition integration tests passed.');
