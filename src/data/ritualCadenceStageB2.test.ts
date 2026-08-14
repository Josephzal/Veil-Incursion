import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COUNTERFATE_CORE_IDS, COUNTERFATE_VERDICT_ID } from '../types/counterfate';
import {
  RITUAL_CADENCE_CORE_IDS,
  RITUAL_CADENCE_MANIFESTATION_ID,
  RITUAL_CADENCE_SUPPORT_IDS,
  RITUAL_CADENCE_VERDICT_ID,
} from '../types/ritualCadence';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { WEAPON_ULTIMATE_BY_FAMILY, canFireWeaponUltimate } from './weaponUltimateRegistry';
import { NINE_PERMANENT_WEAPON_FAMILIES } from './nineStrain/classWeaponAdapter';
import { hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { createDefaultActiveIncursionState } from '../types/game';
import { hydrateNineStrainIncursionFields } from './nineStrainRunState';
import { COUNTERFATE_SUPPORT_IDS } from '../types/counterfate';

console.log('Stage B.2 — Ritual Cadence vertical slice');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 16);
assert.equal(live.filter((row) => row.strainId === 'COUNTERFATE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'RITUAL_CADENCE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'RITUAL_CADENCE' && row.role === 'CORE').length, 4);
assert.equal(live.filter((row) => row.strainId === 'RITUAL_CADENCE' && row.role === 'SUPPORT').length, 2);
assert.equal(live.filter((row) => row.strainId === 'RITUAL_CADENCE' && row.role === 'MANIFESTATION').length, 1);
assert.equal(live.filter((row) => row.strainId === 'RITUAL_CADENCE' && row.role === 'VERDICT').length, 1);
assert.equal(live.some((row) => row.strainId === 'AFTERIMAGE' || row.role === 'CONVERGENCE'), false);

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

let rootSeq = 0;
function nextRoot(): string {
  rootSeq += 1;
  return `root-test-${rootSeq}`;
}

function arm(rt: ReturnType<typeof strainRuntime>, extras: Parameters<typeof weaponFamilyExecutionContext>[1] = {}) {
  rt.commitRootAction(weaponFamilyExecutionContext(extras.weaponFamilyId ?? 'aegis-longsword', {
    rootActionId: nextRoot(),
    actionSurface: 'WEAPON',
    ...extras,
  }));
}

function disc(rt: ReturnType<typeof strainRuntime>, extras: Parameters<typeof weaponFamilyExecutionContext>[1] = {}) {
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: nextRoot(),
    actionSurface: 'TECHNIQUE',
    authoredCosts: { ap: extras.authoredCosts?.ap ?? 2 },
    actualCostsPaid: { ap: extras.actualCostsPaid?.ap ?? 2 },
    ...extras,
  }));
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  const first = rt.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', countdown: 2, hostileTurnOrder: 0, slot: 'FL_0', severity: 'HIGH' }),
  ], false);
  const id1 = first[0].intentInstanceId;
  const ticked = rt.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', countdown: 1, hostileTurnOrder: 0, slot: 'FL_0', severity: 'HIGH' }),
  ], false);
  assert.equal(ticked[0].intentInstanceId, id1);
  rt.runTurnStart();
  assert.equal(rt.getState().counterfate.fateboundInstanceId, id1);
  const saved = rt.serialize();
  rt.noteIntentEnded('e1');
  rt.completeFateboundIntent('RESOLVED');
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  resumed.noteIntentEnded('e1');
  const second = resumed.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'e1', intentKind: 'STRIKE', countdown: 2, hostileTurnOrder: 0, slot: 'FL_0', severity: 'HIGH' }),
  ], false);
  assert.notEqual(second[0].intentInstanceId, id1);
  resumed.runTurnStart();
  assert.equal(resumed.getState().counterfate.fateboundInstanceId, second[0].intentInstanceId);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  disc(rt);
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_II');
  arm(rt);
  assert.equal(rt.getState().ritualCadence.measure, 'EMPTY');
  assert.equal(rt.getState().ritualCadence.previousSurface, 'ARMAMENT');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  arm(rt);
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-claymore', { actionSurface: 'WEAPON' }));
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  rt.dispatch({ type: 'ENEMY_CYCLE_STARTED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {} });
  rt.runTurnStart();
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', { committed: false, actionSurface: 'TECHNIQUE' }));
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    classification: 'DERIVATIVE',
    actionSurface: 'WEAPON',
  }));
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', { sourceKind: 'ULTIMATE' }));
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
}

for (const familyId of NINE_PERMANENT_WEAPON_FAMILIES) {
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt, { weaponFamilyId: familyId });
  disc(rt);
  const preview = rt.previewRootAction(weaponFamilyExecutionContext(familyId, {
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  rt.commitRootAction(weaponFamilyExecutionContext(familyId, {
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(rt.lastRootContext()?.totalNativeDirectDamage, 13, familyId);
  assert.equal(preview.ritualCadence.lastOutcome, 'FINALE', familyId);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  disc(rt);
  rt.commitRootAction(weaponFamilyExecutionContext('hex-carbine', {
    actionSurface: 'WEAPON',
    nativeByTarget: [
      { targetId: 'a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0 },
      { targetId: 'b', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0 },
    ],
  }));
  assert.equal(rt.lastRootContext()?.nativeByTarget[0].nativeDirectDamage, 13);
  assert.equal(rt.lastRootContext()?.nativeByTarget[1].nativeDirectDamage, 13);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  disc(rt);
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-paired-blades', {
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      kineticNativeDamage: 10, occultNativeDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const row = rt.lastRootContext()?.nativeByTarget[0];
  assert.equal(row?.nativeDirectDamage, 26);
  assert.equal(row?.kineticNativeDamage, 13);
  assert.equal(row?.occultNativeDamage, 13);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION);
  disc(rt);
  arm(rt);
  disc(rt, { authoredCosts: { ap: 2 }, actualCostsPaid: { ap: 2 }, startsCooldown: true });
  assert.equal(rt.lastRootContext()?.actualCostsPaid.ap, 1);
  assert.equal(rt.metric('ritual_cooldown_advance'), 1);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.SYNCOPATED_REFLEX);
  rt.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true });
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_II');
  rt.resolveInstinct({ classId: 'AEGIS', wraithParrySuccess: true, parryAttempted: true });
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_II');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_CORE_IDS.SYNCOPATED_REFLEX);
  arm(rt);
  rt.resolveInstinct({ classId: 'HEX_SHOT', reloadQuality: 'PERFECT' });
  assert.equal(rt.getState().ritualCadence.lastOutcome, 'FINALE');
  assert.equal(rt.getState().ritualCadence.measure, 'EMPTY');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_CORE_IDS.SYNCOPATED_REFLEX);
  arm(rt);
  disc(rt);
  rt.resolveInstinct({ classId: 'ENVOY', riftPreventedDamage: 1, riftWouldReachHp: 10 });
  assert.equal(rt.getState().ritualCadence.lastOutcome, 'FINALE');
  assert.equal(rt.getState().ritualCadence.measure, 'EMPTY');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.SYNCOPATED_REFLEX);
  rt.resolveInstinct({ classId: 'AEGIS', parryAttempted: true });
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.HELD_RESONANCE);
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  disc(rt);
  arm(rt, { primaryResource: { gained: 0, spent: 8, preserved: 0, converted: 0 } });
  assert.equal(rt.getState().ritualCadence.heldResonance.armed, true);
  arm(rt, {
    actionSurface: 'TECHNIQUE',
    primaryResource: { gained: 0, spent: 12, preserved: 0, converted: 0 },
    actualCostsPaid: { ap: 1, reserve: 12 },
  });
  assert.equal(rt.getState().ritualCadence.heldResonance.armed, false);
  assert.equal(rt.events().some((event) => event.type === 'CURRENT_PRESERVED'), true);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_SUPPORT_IDS.IMPROVISED_MEASURE);
  arm(rt);
  const preview = rt.previewMeasure({ actionSurface: 'WEAPON', sourceKind: 'PLAYER_ACTION', classification: 'NATIVE_DIRECT' });
  assert.equal(preview.held, true);
  arm(rt);
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  assert.equal(rt.getState().ritualCadence.improvisedUsedThisTurn, true);
  arm(rt);
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_SUPPORT_IDS.DOWNBEAT);
  arm(rt);
  disc(rt);
  arm(rt, {
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: true, healingDealt: 0, movement: 0,
    }],
    kills: 1,
  });
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  assert.equal(rt.getState().ritualCadence.downbeatProtected, true);
  rt.requestClearMeasure();
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  rt.requestClearMeasure();
  assert.equal(rt.getState().ritualCadence.measure, 'EMPTY');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_SUPPORT_IDS.DOWNBEAT);
  rt.setCombatDepth(2);
  grant(rt, RITUAL_CADENCE_MANIFESTATION_ID, { depth: 2 });
  disc(rt);
  arm(rt);
  disc(rt);
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  assert.equal(rt.getState().ritualCadence.lastPostFinaleReason, 'UNBROKEN_RITE');
}

for (const familyId of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(canFireWeaponUltimate(familyId), true, familyId);
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_VERDICT_ID, { premium: true, family: familyId });
  disc(rt);
  arm(rt, { weaponFamilyId: familyId });
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_II');
  rt.commitRootAction(weaponFamilyExecutionContext(familyId, {
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    actionId: WEAPON_ULTIMATE_BY_FAMILY[familyId].id,
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(rt.lastRootContext()?.totalNativeDirectDamage, 27, familyId);
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I', familyId);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_VERDICT_ID, { premium: true });
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', { sourceKind: 'ULTIMATE', actionSurface: 'ULTIMATE' }));
  assert.equal(rt.getState().ritualCadence.measure, 'EMPTY');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  rt.grantFixture(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  arm(rt);
  disc(rt);
  rt.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', countdown: 1, hostileTurnOrder: 0, slot: 'FL_0', hp: 40, severity: 'HIGH' }),
  ], false);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: nextRoot(),
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(rt.getState().counterfate.rawReversal, 7);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION);
  rt.grantFixture(COUNTERFATE_SUPPORT_IDS.CHOSEN_FATE);
  rt.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'e3', intentKind: 'SLAM', countdown: 1, hostileTurnOrder: 0, slot: 'FL_0', hp: 40, severity: 'HIGH' }),
  ], false);
  rt.runTurnStart();
  disc(rt);
  arm(rt);
  rt.grantFixture(COUNTERFATE_CORE_IDS.REFUSAL_PATTERN);
  disc(rt, { authoredCosts: { ap: 2 }, actualCostsPaid: { ap: 2 } });
  assert.equal(rt.getState().counterfate.rawReversal, 8);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.HELD_RESONANCE);
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  rt.grantFixture(COUNTERFATE_CORE_IDS.BORROWED_ENDING);
  arm(rt);
  disc(rt);
  arm(rt, { primaryResource: { gained: 0, spent: 8, preserved: 0, converted: 0 } });
  const before = rt.getState().counterfate.rawReversal;
  arm(rt, {
    actionSurface: 'TECHNIQUE',
    primaryResource: { gained: 0, spent: 8, preserved: 0, converted: 0 },
    actualCostsPaid: { ap: 1, reserve: 8 },
  });
  assert.equal(rt.getState().counterfate.rawReversal, before);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_VERDICT_ID, { premium: true });
  const blocked = rt.preview(RITUAL_CADENCE_VERDICT_ID, { premiumVerdictSource: true, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.rejectionReasons.includes('VERDICT_OCCUPIED'));
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().ritualCadence.measure, 'BEAT_I');
  disc(resumed);
  assert.equal(resumed.getState().ritualCadence.measure, 'BEAT_II');
}

{
  const legacy = createNineStrainRuntime({ definitions: live });
  assert.equal(legacy.preview(RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE).eligible, false);
}

{
  const fresh = hydrateNineStrainIncursionFields(createDefaultActiveIncursionState());
  assert.equal(fresh.nineStrainRuntime.boonSystemMode, 'LEGACY_CLASS_CATALOG');
  const migrated = hydrateNineStrainRuntimeState({ schemaVersion: 3, counterfate: { rawReversal: 4 } });
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.counterfate.rawReversal, 4);
  assert.equal(migrated.ritualCadence.measure, 'EMPTY');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_SUPPORT_IDS.IMPROVISED_MEASURE);
  const emptyHold = rt.previewMeasure({ actionSurface: 'WEAPON', sourceKind: 'PLAYER_ACTION', classification: 'NATIVE_DIRECT' });
  assert.equal(emptyHold.held, false);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION);
  disc(rt);
  arm(rt);
  disc(rt, { authoredCosts: { ap: 0 }, actualCostsPaid: { ap: 0 }, actionSurface: 'FLEX' });
  assert.equal(rt.lastRootContext()?.actualCostsPaid.ap, 0);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.HELD_RESONANCE);
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  disc(rt);
  arm(rt);
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().ritualCadence.heldResonance.armed, true);
  resumed.commitRootAction(weaponFamilyExecutionContext('hex-revolver', {
    rootActionId: nextRoot(),
    actionSurface: 'TECHNIQUE',
    classId: 'HEX_SHOT',
    selectedAmmoType: 'hollow',
    primaryResource: { gained: 0, spent: 1, preserved: 0, converted: 0 },
    actualCostsPaid: { ap: 1, ammo: 1 },
  }));
  const preserved = resumed.events().filter((event) => event.type === 'CURRENT_PRESERVED');
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0].payload.preserved, 1);
  assert.equal(preserved[0].payload.ammoType, 'hollow');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.HELD_RESONANCE);
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  disc(rt);
  arm(rt);
  rt.commitRootAction(weaponFamilyExecutionContext('envoy-vambrace', {
    rootActionId: nextRoot(),
    actionSurface: 'TECHNIQUE',
    classId: 'ENVOY',
    primaryResource: { gained: 0, spent: 14, preserved: 0, converted: 0 },
    actualCostsPaid: { ap: 1, flux: 14 },
  }));
  const flux = rt.events().filter((event) => event.type === 'CURRENT_PRESERVED').at(-1);
  assert.equal(flux?.payload.preserved, 10);
}

{
  for (const extras of [
    { kineticArmorBroken: true as const, occultWardBroken: false as const, defenseBreaks: 1 },
    { kineticArmorBroken: false as const, occultWardBroken: true as const, defenseBreaks: 0 },
  ]) {
    const row = strainRuntime();
    grant(row, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
    grant(row, RITUAL_CADENCE_SUPPORT_IDS.DOWNBEAT);
    arm(row);
    disc(row);
    arm(row, {
      nativeByTarget: [{
        targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
        defenseDamage: 0, defenseBreaks: extras.defenseBreaks, fractures: 0, statusesApplied: 0,
        killed: false, healingDealt: 0, movement: 0,
        kineticArmorBroken: extras.kineticArmorBroken,
        occultWardBroken: extras.occultWardBroken,
      }],
    });
    assert.equal(row.getState().ritualCadence.measure, 'BEAT_I');
    assert.equal(row.getState().ritualCadence.downbeatProtected, true);
  }
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_SUPPORT_IDS.DOWNBEAT);
  arm(rt);
  disc(rt);
  arm(rt, { intentCountered: true, bossThresholdReached: true, objectiveProgress: true });
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_VERDICT_ID, { premium: true });
  disc(rt);
  arm(rt);
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().ritualCadence.measure, 'BEAT_II');
  resumed.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(resumed.getState().ritualCadence.measure, 'BEAT_I');
  assert.equal(resumed.lastRootContext()?.totalNativeDirectDamage, 27);
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

void COUNTERFATE_SUPPORT_IDS;
console.log('Stage B.2 — Ritual Cadence vertical slice passed');
