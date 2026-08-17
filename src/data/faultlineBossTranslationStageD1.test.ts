import assert from 'node:assert/strict';
import { FAULTLINE_CORE_IDS } from '../types/faultline';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hostileSnapshotInput } from './nineStrain/hostileField';

console.log('Stage D.1 — Faultline boss translation');

const live = getLiveUniversalBoonDefinitions();

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string) {
  const result = runtime.commit(id, { maxAcquisitionWave: 3, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  if (!result.eligible) runtime.grantFixture(id);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  runtime.syncHostileIntents([
    hostileSnapshotInput({
      unitId: 'boss-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT',
      hp: 200, maxHp: 200, protectedPhase: true, designation: 'BOSS',
    }),
  ]);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'prot1',
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'boss-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0,
      fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
    lockedTargetIds: ['boss-a'],
  }));
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'prot2',
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'boss-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0,
      fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
    lockedTargetIds: ['boss-a'],
  }));
  const rupture = runtime.getState().faultline.lastRuptures[0];
  assert.ok(rupture);
  assert.equal(rupture.fizzleReason, 'PROTECTED_PHASE');
  assert.equal(runtime.hostileIntents()[0]?.hp, 200);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  runtime.syncHostileIntents([
    hostileSnapshotInput({
      unitId: 'boss-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT',
      hp: 200, maxHp: 200, protectedPhase: true, authoredCounter: true, designation: 'BOSS',
    }),
  ]);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'press1',
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'boss-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0,
      fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0, 
    }],
    lockedTargetIds: ['boss-a'],
    objectiveProgress: true,
  }));
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'press2',
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'boss-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0,
      fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
    lockedTargetIds: ['boss-a'],
    objectiveProgress: true,
  }));
  assert.equal(runtime.getState().faultline.lastRuptures[0]?.objectivePressure, true);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'phase-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 100, maxHp: 100 }),
  ]);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ph1',
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'phase-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0,
      fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
    lockedTargetIds: ['phase-a'],
  }));
  runtime.setWoundweavePhaseSuccessor('phase-a', 'phase-b');
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'phase-b', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 120, maxHp: 120 }),
  ]);
  assert.equal(runtime.getState().faultline.faultByUnitId['phase-b'], 2);
  assert.equal(runtime.getState().faultline.faultByUnitId['phase-a'], undefined);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'gone', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 40, maxHp: 40 }),
  ]);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'gone1',
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'gone', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0,
      fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
    lockedTargetIds: ['gone'],
  }));
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'other', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 40, maxHp: 40 }),
  ]);
  assert.equal(runtime.getState().faultline.faultByUnitId['gone'], undefined);
}

console.log('Stage D.1 — Faultline boss translation passed');
