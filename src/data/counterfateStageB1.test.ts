import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COUNTERFATE_CORE_IDS,
  COUNTERFATE_MANIFESTATION_ID,
  COUNTERFATE_SUPPORT_IDS,
  COUNTERFATE_VERDICT_ID,
} from '../types/counterfate';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import {
  createNineStrainRuntime,
  weaponFamilyExecutionContext,
} from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { mintIntentInstanceId, nextIntentGeneration } from './nineStrain/intentIdentity';
import { reversalCapForDepth, roundCounterfateAmount } from './nineStrain/counterfateMath';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { WEAPON_ULTIMATE_BY_FAMILY, canFireWeaponUltimate } from './weaponUltimateRegistry';
import { NINE_PERMANENT_WEAPON_FAMILIES, classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import { hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { createDefaultActiveIncursionState } from '../types/game';
import { hydrateNineStrainIncursionFields } from './nineStrainRunState';
import { progressObjectiveOnChannelInterrupt, createEmptyEncounterObjectiveSession } from './encounterObjectiveEngine';
import { TEST_ONLY_UNIVERSAL_BOON_DEFINITIONS } from './nineStrain/testDefinitions';

console.log('Stage B.1 — Counterfate vertical slice');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 16);
assert.equal(live.filter((row) => row.strainId === 'COUNTERFATE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'RITUAL_CADENCE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'COUNTERFATE' && row.role === 'CORE').length, 4);
assert.equal(live.filter((row) => row.strainId === 'COUNTERFATE' && row.role === 'SUPPORT').length, 2);
assert.equal(live.filter((row) => row.strainId === 'COUNTERFATE' && row.role === 'MANIFESTATION').length, 1);
assert.equal(live.filter((row) => row.strainId === 'COUNTERFATE' && row.role === 'VERDICT').length, 1);
assert.equal(new Set(live.map((row) => row.id)).size, 16);
assert.equal(live.some((row) => row.strainId === 'AFTERIMAGE' || row.role === 'CONVERGENCE'), false);
assert.deepEqual(
  live.filter((row) => row.strainId === 'COUNTERFATE' && row.role === 'CORE').map((row) => row.imprint).sort(),
  ['ARMAMENT', 'CURRENT', 'DISCIPLINE', 'INSTINCT'],
);

function strainRuntime() {
  const rt = createNineStrainRuntime({ definitions: live });
  rt.hydrate(activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {}));
  return rt;
}

function grant(rt: ReturnType<typeof strainRuntime>, id: string, extra: { premium?: boolean; depth?: number; family?: string } = {}) {
  const result = rt.commit(id, {
    premiumVerdictSource: extra.premium,
    combatDepth: extra.depth,
    equippedWeaponFamilyId: extra.family ?? 'aegis-longsword',
  });
  assert.equal(result.eligible, true, `${id} ${result.rejectionReasons.join(',')}`);
}

const intents = [
  hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', countdown: 2, hostileTurnOrder: 1, slot: 'FL_1', hp: 40, severity: 'HIGH', designation: 'Alpha' }),
  hostileSnapshotInput({ unitId: 'e2', intentKind: 'BOLT', countdown: 1, hostileTurnOrder: 0, slot: 'FL_0', hp: 20, severity: 'MODERATE', designation: 'Bolt' }),
  hostileSnapshotInput({ unitId: 'e3', intentKind: 'SLAM', countdown: 2, hostileTurnOrder: 2, slot: 'BL_0', hp: 80, severity: 'CRITICAL', designation: 'Slam' }),
];

{
  const gen = nextIntentGeneration(undefined, 'STRIKE');
  const a = mintIntentInstanceId('e1', 'STRIKE', gen.generation);
  const gen2 = nextIntentGeneration(gen, 'STRIKE');
  const b = mintIntentInstanceId('e1', 'STRIKE', gen2.generation);
  assert.equal(a, b);
  const gen3 = nextIntentGeneration(gen2, 'BOLT');
  assert.notEqual(mintIntentInstanceId('e1', 'BOLT', gen3.generation), a);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  const snapped = rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  assert.equal(rt.getState().counterfate.fateboundUnitId, 'e3');
  const firstId = rt.getState().counterfate.fateboundInstanceId;
  rt.syncHostileIntents([
    ...intents.slice(0, 2),
    { ...intents[2], countdown: 9, hp: 80 },
  ], false);
  rt.runTurnStart();
  assert.equal(rt.getState().counterfate.fateboundInstanceId, firstId);
  assert.equal(snapped[0].intentInstanceId.includes('e1'), true);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.syncHostileIntents(intents, true);
  rt.runTurnStart();
  assert.equal(rt.getState().counterfate.fateboundUnitId, 'e2');
  const hud = rt.presentation();
  assert.equal(hud.concealed, true);
  assert.equal(hud.boundLabel, 'Obscured future');
  assert.equal(hud.chosenFateAvailable, false);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 6);
  rt.completeFateboundIntent('ENEMY_REMOVED');
  assert.equal(rt.lastReleases().at(-1)?.multiplier, 1);
  assert.equal(rt.lastReleases().at(-1)?.packet, 6);
}

assert.equal(reversalCapForDepth(1), 30);
assert.equal(reversalCapForDepth(2), 45);
assert.equal(reversalCapForDepth(3), 60);
assert.equal(roundCounterfateAmount(7.9), 7);

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.setCombatDepth(1);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 400,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 12);
}

for (const familyId of NINE_PERMANENT_WEAPON_FAMILIES) {
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  const preview = rt.previewRootAction(weaponFamilyExecutionContext(familyId, {
    nativeByTarget: [{
      targetId: 'e3', hits: 2, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  rt.commitRootAction(weaponFamilyExecutionContext(familyId, {
    nativeByTarget: [{
      targetId: 'e3', hits: 2, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(preview.counterfate.rawReversal, 3, familyId);
  assert.equal(rt.getState().counterfate.rawReversal, 3, familyId);
  assert.equal(classIdForWeaponFamily(familyId), rt.lastRootContext()?.classId);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('hex-carbine', {
    nativeByTarget: [
      { targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0 },
      { targetId: 'e1', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0 },
    ],
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 3);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('hex-shotgun', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 4, defenseBreaks: 1, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 3);
  rt.commitRootAction(weaponFamilyExecutionContext('hex-shotgun', {
    classification: 'DERIVATIVE',
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 3);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.REFUSAL_PATTERN);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'TECHNIQUE',
    actualCostsPaid: { ap: 2 },
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 11);
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'FLEX',
    actualCostsPaid: { ap: 3 },
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 11);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.REFUSAL_PATTERN);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('envoy-scythe', {
    actionSurface: 'TECHNIQUE',
    actualCostsPaid: { ap: 2 },
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 0);
  rt.syncHostileIntents(intents, false);
  rt.commitRootAction(weaponFamilyExecutionContext('envoy-scythe', {
    actionSurface: 'TECHNIQUE',
    actualCostsPaid: { ap: 1 },
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 8);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.resolveInstinct({ classId: 'AEGIS', voidWardPrevented: true });
  assert.equal(rt.getState().counterfate.rawReversal, 6);
  rt.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true });
  assert.equal(rt.getState().counterfate.rawReversal, 6);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.resolveInstinct({ classId: 'AEGIS', wraithParrySuccess: true, parryAttempted: true });
  assert.equal(rt.getState().counterfate.rawReversal, 10);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.resolveInstinct({ classId: 'HEX_SHOT', reloadQuality: 'PERFECT' });
  assert.equal(rt.getState().counterfate.rawReversal, 15);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.resolveInstinct({ classId: 'ENVOY', riftPreventedDamage: 10, riftWouldReachHp: 10 });
  assert.equal(rt.getState().counterfate.rawReversal, 15);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  rt.resolveInstinct({
    classId: 'AEGIS',
    perfectParry: true,
    parryAttempted: true,
    preventedFateboundIntentDamage: true,
  });
  assert.equal(rt.lastReleases().at(-1)?.multiplier, 1.5);
  assert.equal(rt.getState().counterfate.rawReversal, 0);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.BORROWED_ENDING);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword'));
  rt.resolveCurrent({ classId: 'AEGIS', ordinarySpend: true });
  rt.resolveCurrent({ classId: 'AEGIS', ordinarySpend: true, reserveEntered50: true });
  assert.equal(rt.getState().counterfate.rawReversal, 14);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.BORROWED_ENDING);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('hex-revolver'));
  rt.resolveCurrent({ classId: 'HEX_SHOT', ammoSpent: true });
  assert.equal(rt.getState().counterfate.rawReversal, 8);
  rt.resolveCurrent({ classId: 'HEX_SHOT', reloadRestoredRounds: true, ultimateOwnedRefill: true });
  assert.equal(rt.getState().counterfate.rawReversal, 8);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.BORROWED_ENDING);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('envoy-vambrace'));
  rt.resolveCurrent({ classId: 'ENVOY', ordinarySpend: true, brinkEntered: true });
  assert.equal(rt.getState().counterfate.rawReversal, 14);
  rt.resolveCurrent({ classId: 'ENVOY', preserved: true });
  assert.equal(rt.getState().counterfate.rawReversal, 14);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_SUPPORT_IDS.CHOSEN_FATE);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const alts = rt.chosenFateAlternatives();
  const target = alts[0];
  const preview = rt.previewChosenFate(target.intentInstanceId);
  assert.equal(preview.eligible, true);
  assert.equal(preview.transferred, roundCounterfateAmount(6 * 0.75));
  const cancel = rt.previewChosenFate(target.intentInstanceId);
  assert.equal(cancel.eligible, true);
  assert.equal(rt.getState().counterfate.chosenFateUsedThisTurn, false);
  const confirm = rt.confirmChosenFate(target.intentInstanceId);
  assert.equal(confirm.preview.eligible, true);
  assert.equal(rt.getState().counterfate.fateboundInstanceId, target.intentInstanceId);
  assert.equal(rt.getState().counterfate.rawReversal, preview.cappedTransferred);
  assert.equal(rt.lastReleases().length, 0);
  const again = rt.confirmChosenFate(alts[1]?.intentInstanceId ?? target.intentInstanceId);
  assert.equal(again.preview.eligible, false);
}

{
  const rt = createNineStrainRuntime({
    definitions: [...live, ...TEST_ONLY_UNIVERSAL_BOON_DEFINITIONS],
    allowTestOffers: true,
  });
  rt.hydrate(activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {}));
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_SUPPORT_IDS.CHOSEN_FATE);
  const overwrite = rt.preview('TEST_STRAIN_CORE_ARMAMENT_FOREIGN');
  assert.equal(overwrite.eligible, false);
  assert.ok(overwrite.rejectionReasons.includes('DEPENDENCY_PROTECTION'));
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_SUPPORT_IDS.PREEMPTIVE_RUPTURE);
  rt.syncHostileIntents(intents.map((row) => row.unitId === 'e3' ? { ...row, hp: 5 } : row), false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const pre = rt.beginFateboundResolution();
  assert.ok(pre);
  assert.equal(pre.countered, true);
  assert.equal(pre.multiplier, 1.5);
  assert.equal(pre.packet, 6 + 3);
  const after = rt.completeFateboundIntent('RESOLVED');
  assert.equal(after?.packet, pre.packet);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_SUPPORT_IDS.PREEMPTIVE_RUPTURE);
  rt.syncHostileIntents(intents.map((row) => row.unitId === 'e3' ? { ...row, hp: 999, protectedPhase: true } : row), false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-claymore', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const pre = rt.beginFateboundResolution({ protectedPhase: true });
  assert.equal(pre?.countered, false);
  assert.equal(pre?.interruptProgress, 1);
  const session = createEmptyEncounterObjectiveSession();
  const translated = progressObjectiveOnChannelInterrupt(session, 'CHANNEL');
  assert.ok(translated);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_SUPPORT_IDS.PREEMPTIVE_RUPTURE);
  rt.setCombatDepth(2);
  grant(rt, COUNTERFATE_MANIFESTATION_ID, { depth: 2 });
  const field = [
    hostileSnapshotInput({ unitId: 'e1', intentKind: 'A', countdown: 1, hostileTurnOrder: 0, slot: 'FL_0', hp: 3, severity: 'HIGH' }),
    hostileSnapshotInput({ unitId: 'e2', intentKind: 'B', countdown: 1, hostileTurnOrder: 1, slot: 'FL_1', hp: 3, severity: 'MODERATE' }),
    hostileSnapshotInput({ unitId: 'e3', intentKind: 'C', countdown: 1, hostileTurnOrder: 2, slot: 'BL_0', hp: 3, severity: 'LOW' }),
  ];
  rt.syncHostileIntents(field, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: rt.getState().counterfate.fateboundUnitId ?? 'e1', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 40,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  rt.beginFateboundResolution();
  assert.equal(rt.getState().counterfate.noFutureJumpsThisEnemyCycle, 1);
  assert.ok(rt.getState().counterfate.fateboundInstanceId);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  const noDepth = rt.preview(COUNTERFATE_MANIFESTATION_ID, { combatDepth: 1 });
  assert.ok(noDepth.rejectionReasons.includes('DEPTH_GATE') || noDepth.rejectionReasons.includes('MISSING_PARENT'));
}

for (const familyId of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(canFireWeaponUltimate(familyId), true, familyId);
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_VERDICT_ID, { premium: true, family: familyId });
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext(familyId, {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  rt.commitRootAction(weaponFamilyExecutionContext(familyId, {
    sourceKind: 'ULTIMATE',
    actionId: WEAPON_ULTIMATE_BY_FAMILY[familyId].id,
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const release = rt.lastReleases().at(-1);
  assert.equal(release?.multiplier, 2, familyId);
  assert.equal(rt.getState().counterfate.finalRevisionCapture?.consumed, true, familyId);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_SUPPORT_IDS.PREEMPTIVE_RUPTURE);
  rt.setCombatDepth(2);
  grant(rt, COUNTERFATE_MANIFESTATION_ID, { depth: 2 });
  grant(rt, COUNTERFATE_VERDICT_ID, { premium: true, family: 'aegis-longsword' });
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    sourceKind: 'ULTIMATE',
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(rt.lastReleases().filter((row) => row.multiplier === 2).length, 1);
  assert.equal(rt.getState().counterfate.noFutureJumpsThisEnemyCycle, 0);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: true, healingDealt: 0, movement: 0,
    }],
  }));
  const killRelease = rt.lastReleases().at(-1);
  assert.equal(killRelease?.multiplier, 1.5);
  assert.equal(killRelease?.packet, 9);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.syncHostileIntents(intents, false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [{
      targetId: 'e3', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  resumed.syncHostileIntents(intents, false);
  assert.equal(resumed.getState().counterfate.rawReversal, 6);
  assert.equal(resumed.getState().counterfate.fateboundUnitId, 'e3');
}

{
  const legacy = createNineStrainRuntime({ definitions: live });
  assert.equal(legacy.getState().boonSystemMode, 'LEGACY_CLASS_CATALOG');
  assert.equal(legacy.preview(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME).eligible, false);
  assert.ok(legacy.preview(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME).rejectionReasons.includes('BOON_SYSTEM_INACTIVE'));
}

{
  const fresh = hydrateNineStrainIncursionFields(createDefaultActiveIncursionState());
  assert.equal(fresh.nineStrainRuntime.boonSystemMode, 'LEGACY_CLASS_CATALOG');
  const migrated = hydrateNineStrainRuntimeState({ schemaVersion: 2, cores: { ARMAMENT: null } });
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.counterfate.rawReversal, 0);
}

{
  const engineDir = join(import.meta.dirname, 'nineStrain');
  for (const file of readdirSync(engineDir)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(join(engineDir, file), 'utf8');
    assert.equal(source.includes('displayName ==='), false, file);
    assert.equal(source.includes('Longsword'), false, file);
    assert.equal(source.includes('Paired Blades'), false, file);
    assert.equal(/switch\s*\(\s*def\.id/.test(source), false, file);
  }
}

assert.equal(CANONICAL_WEAPON_FAMILY_IDS.length, 9);
console.log('Stage B.1 — Counterfate vertical slice passed');
