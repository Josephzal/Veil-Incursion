import assert from 'node:assert/strict';
import {
  FAULTLINE_CORE_IDS,
  FAULTLINE_MANIFESTATION_ID,
  FAULTLINE_SUPPORT_IDS,
  FAULTLINE_VERDICT_ID,
} from '../types/faultline';
import { COUNTERFATE_CORE_IDS } from '../types/counterfate';
import { RITUAL_CADENCE_CORE_IDS } from '../types/ritualCadence';
import { STILLPOINT_CORE_IDS, STILLPOINT_SUPPORT_IDS } from '../types/stillpoint';
import { WOUNDWEAVE_CORE_IDS, WOUNDWEAVE_SUPPORT_IDS } from '../types/woundweave';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import {
  createNineStrainRuntime,
  instinctInputForClass,
  majorCurrentInput,
  ordinaryCurrentInput,
  weaponFamilyExecutionContext,
} from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState, createLiveNineStrainRuntimeState, hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { appliedFractureAmount, counterpressureAmount, resolveRuptureRoute } from './nineStrain/faultlineEngine';
import { promoteQuietReflexGrade } from './nineStrain/stillpointEngine';
import type { TargetNativeResult } from '../types/nineStrain';

console.log('Stage D.1 — Faultline');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(live.filter((row) => row.strainId === 'FAULTLINE' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'SOULWAKE' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(live.filter((row) => row.role === 'CONVERGENCE').length, 36);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);
assert.equal(appliedFractureAmount(0), 1);
assert.equal(appliedFractureAmount(1), 1);
assert.equal(appliedFractureAmount(2), 2);
assert.equal(appliedFractureAmount(3), 2);
assert.equal(appliedFractureAmount(4), 3);
assert.equal(appliedFractureAmount(9), 3);
assert.equal(counterpressureAmount(promoteQuietReflexGrade('STANDARD')), 2);
assert.equal(counterpressureAmount(promoteQuietReflexGrade('CLEAN')), 3);

assert.equal(resolveRuptureRoute({
  defenseRoutingTags: ['ARMOR_BREAK'],
  damageChannels: ['OCCULT'],
  kineticNativeDamage: 0,
  occultNativeDamage: 10,
  kineticArmor: 2,
  occultWards: 2,
}), 'KINETIC_ARMOR');
assert.equal(resolveRuptureRoute({
  defenseRoutingTags: ['WARD_BREAK'],
  damageChannels: ['KINETIC'],
  kineticNativeDamage: 10,
  occultNativeDamage: 0,
  kineticArmor: 2,
  occultWards: 2,
}), 'OCCULT_WARD');
assert.equal(resolveRuptureRoute({
  defenseRoutingTags: ['KINETIC', 'OCCULT'],
  damageChannels: ['KINETIC', 'OCCULT'],
  kineticNativeDamage: 8,
  occultNativeDamage: 12,
  kineticArmor: 1,
  occultWards: 1,
}), 'OCCULT_WARD');
assert.equal(resolveRuptureRoute({
  defenseRoutingTags: [],
  damageChannels: [],
  kineticNativeDamage: 0,
  occultNativeDamage: 0,
  kineticArmor: 1,
  occultWards: 1,
}), 'KINETIC_ARMOR');
assert.equal(resolveRuptureRoute({
  defenseRoutingTags: ['ARMOR_BREAK'],
  damageChannels: ['KINETIC'],
  kineticNativeDamage: 10,
  occultNativeDamage: 0,
  kineticArmor: 0,
  occultWards: 2,
}), 'OCCULT_WARD');
assert.equal(resolveRuptureRoute({
  defenseRoutingTags: ['KINETIC'],
  damageChannels: ['KINETIC'],
  kineticNativeDamage: 4,
  occultNativeDamage: 0,
  kineticArmor: 0,
  occultWards: 0,
}), 'UNARMORED');

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string, extra: { premium?: boolean; depth?: number; family?: string } = {}) {
  const result = runtime.commit(id, {
    maxAcquisitionWave: 3,
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: extra.depth ?? 2,
    equippedWeaponFamilyId: extra.family ?? 'aegis-longsword',
  });
  if (!result.eligible) runtime.grantFixture(id);
}

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId,
    hits: damage > 0 || extra.killed || extra.statusesApplied ? 1 : 0,
    misses: damage <= 0 && !extra.killed && !extra.statusesApplied && extra.misses == null ? 1 : 0,
    crits: 0,
    nativeDirectDamage: damage,
    defenseDamage: 0,
    defenseBreaks: 0,
    fractures: 0,
    statusesApplied: 0,
    killed: false,
    healingDealt: 0,
    movement: 0,
    ...extra,
  };
}

function hostiles(runtime: ReturnType<typeof rt>, extra: { jammed?: boolean; ka?: number; ow?: number; third?: boolean; protectedPhase?: boolean } = {}) {
  const rows = [
    hostileSnapshotInput({
      unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', designation: 'A',
      hp: 80, maxHp: 80, severity: 'HIGH', kineticArmor: extra.ka ?? 0, occultWards: extra.ow ?? 0,
      protectedPhase: extra.protectedPhase,
    }),
    hostileSnapshotInput({
      unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT', designation: 'B',
      hp: 80, maxHp: 80, severity: 'MODERATE', kineticArmor: extra.ka ?? 0, occultWards: extra.ow ?? 0,
    }),
  ];
  if (extra.third) {
    rows.push(hostileSnapshotInput({
      unitId: 'enemy-c', intentKind: 'STRIKE', hostileTurnOrder: 2, slot: 'BACK_LEFT', designation: 'C',
      hp: 80, maxHp: 80, severity: 'LOW', kineticArmor: extra.ka ?? 0, occultWards: extra.ow ?? 0,
    }));
  }
  runtime.syncHostileIntents(rows, extra.jammed === true);
}

function strike(
  runtime: ReturnType<typeof rt>,
  family: typeof CANONICAL_WEAPON_FAMILY_IDS[number],
  rootActionId: string,
  targets: TargetNativeResult[],
  extra: Parameters<typeof weaponFamilyExecutionContext>[1] = {},
) {
  runtime.commitRootAction(weaponFamilyExecutionContext(family, {
    rootActionId,
    actionSurface: extra.actionSurface ?? 'WEAPON',
    nativeByTarget: targets,
    lockedTargetIds: extra.lockedTargetIds ?? targets.map((row) => row.targetId),
    totalNativeDirectDamage: targets.reduce((sum, row) => sum + row.nativeDirectDamage, 0),
    ...extra,
  }));
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'r1', [native('enemy-a', 10), native('enemy-b', 10)], { lockedTargetIds: ['enemy-a', 'enemy-b'] });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 2);
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-b'], 1);
  strike(runtime, 'aegis-longsword', 'r2', [native('enemy-a', 10)]);
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 2);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'hex-carbine', 'spread', [
    native('enemy-a', 8, { hits: 3 }),
    native('enemy-b', 8, { hits: 2 }),
  ], { lockedTargetIds: ['enemy-a', 'enemy-b'], targetPattern: 'SPREAD' });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 2);
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-b'], 1);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  hostiles(runtime, { ka: 1 });
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'cap', [native('enemy-a', 10)]);
  strike(runtime, 'aegis-longsword', 'cap2', [native('enemy-a', 10)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'cap3', [native('enemy-a', 10)]);
  const fl = runtime.getState().faultline;
  assert.equal(fl.faultByUnitId['enemy-a'], undefined);
  assert.equal(fl.lastRuptures[0]?.route, 'KINETIC_ARMOR');
  assert.equal(runtime.hostileIntents().find((row) => row.unitId === 'enemy-a')?.kineticArmor, 0);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.APPLIED_FRACTURE);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'd0', [native('enemy-a', 5)], { actionSurface: 'TECHNIQUE', actualCostsPaid: { ap: 0 }, authoredCosts: { ap: 3 } });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 1);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.APPLIED_FRACTURE);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'd4', [native('enemy-a', 5)], { actionSurface: 'FLEX', actualCostsPaid: { ap: 4 } });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 3);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.COUNTERPRESSURE);
  hostiles(runtime);
  runtime.runTurnStart();
  runtime.resolveInstinct({ ...instinctInputForClass('AEGIS'), associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 3);
  runtime.resolveInstinct({ classId: 'AEGIS', parryAttempted: true, associatedHostileUnitId: 'enemy-b' });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-b'], undefined);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.COUNTERPRESSURE);
  hostiles(runtime);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'HEX_SHOT', reloadQuality: 'CLEAN' });
  const target = Object.keys(runtime.getState().faultline.faultByUnitId)[0];
  assert.ok(target);
  assert.equal(runtime.getState().faultline.faultByUnitId[target], 2);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.LOAD_LIMIT);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'cur', [native('enemy-a', 4)]);
  runtime.resolveCurrent({ ...ordinaryCurrentInput('AEGIS'), associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 1);
  runtime.resolveCurrent({ ...majorCurrentInput('AEGIS'), ordinarySpend: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 1);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.LOAD_LIMIT);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'hex-revolver', 'ult-refill', [native('enemy-a', 4)], { sourceKind: 'ULTIMATE', actionSurface: 'ULTIMATE' });
  runtime.resolveCurrent({ classId: 'HEX_SHOT', ultimateOwnedRefill: true, reloadRestoredRounds: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], undefined);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  hostiles(runtime);
  runtime.runTurnStart();
  runtime.setCombatDepth(2);
  strike(runtime, 'aegis-longsword', 'u1', [native('enemy-a', 10)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'u2', [native('enemy-a', 10)]);
  const a = runtime.hostileIntents().find((row) => row.unitId === 'enemy-a');
  assert.equal(a?.hp, 62);
  assert.equal(runtime.getState().faultline.lastRuptures[0]?.route, 'UNARMORED');
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  grant(runtime, FAULTLINE_SUPPORT_IDS.RESIDUAL_STRESS);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'res1', [native('enemy-a', 10)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'res2', [native('enemy-a', 10)]);
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 1);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  grant(runtime, FAULTLINE_SUPPORT_IDS.HAIRLINE_CASCADE);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'h1', [native('enemy-a', 10)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'h2', [native('enemy-a', 10), native('enemy-b', 10)], { lockedTargetIds: ['enemy-a', 'enemy-b'] });
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-b'], 2);
  assert.ok(runtime.getState().faultline.lastAdditions.some((row) => row.origin === 'HAIRLINE'));
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  grant(runtime, FAULTLINE_MANIFESTATION_ID, { depth: 2 });
  hostiles(runtime, { third: true });
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'c1', [native('enemy-b', 10)], { lockedTargetIds: ['enemy-b'] });
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'c2', [native('enemy-a', 10)], { lockedTargetIds: ['enemy-a'] });
  assert.ok((runtime.getState().faultline.faultByUnitId['enemy-b'] ?? 0) >= 2);
}

{
  const runtime = rt();
  runtime.grantFixture(FAULTLINE_CORE_IDS.STRESS_PATTERN);
  runtime.grantFixture(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  hostiles(runtime);
  runtime.runTurnStart();
  const bound = runtime.getState().counterfate.fateboundUnitId ?? 'enemy-a';
  strike(runtime, 'aegis-longsword', 'cf1', [native(bound, 10)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'cf2', [native(bound, 10)]);
  assert.ok((runtime.getState().counterfate.rawReversal ?? 0) > 0);
  assert.equal(runtime.getState().faultline.lastRuptures.some((row) => row.classification === 'NORMAL'), true);
}

{
  const runtime = rt();
  runtime.grantFixture(FAULTLINE_CORE_IDS.STRESS_PATTERN);
  runtime.grantFixture(RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'm1', [native('enemy-a', 10)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'm2', [native('enemy-a', 10)]);
  assert.ok(runtime.getState().faultline.lastRuptures.length > 0);
  assert.equal(runtime.getState().ritualCadence.pendingFinaleRootId, null);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_VERDICT_ID, { premium: true });
  hostiles(runtime, { ka: 1 });
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'term', [native('enemy-a', 20), native('enemy-b', 20)], {
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  });
  assert.equal(runtime.hostileIntents().find((row) => row.unitId === 'enemy-a')?.kineticArmor, 0);
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'], 2);
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-b'], 2);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  hostiles(runtime);
  runtime.runTurnStart();
  const before = runtime.getState().faultline.faultByUnitId['enemy-a'] ?? 0;
  runtime.previewRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'preview',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
    lockedTargetIds: ['enemy-a'],
  }));
  assert.equal(runtime.getState().faultline.faultByUnitId['enemy-a'] ?? 0, before);
}

{
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'save', [native('enemy-a', 10)]);
  const hydrated = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(runtime.getState())));
  const again = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(hydrated)));
  assert.deepEqual(hydrated.faultline.faultByUnitId, again.faultline.faultByUnitId);
  assert.equal(hydrated.maxAcquisitionWave, 4);
}

{
  const runtime = rt();
  runtime.grantFixture(FAULTLINE_CORE_IDS.STRESS_PATTERN);
  runtime.grantFixture(STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.grantFixture(STILLPOINT_SUPPORT_IDS.RETURN_STROKE);
  hostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'rs1', [native('enemy-a', 10)]);
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'rs2', [native('enemy-a', 10)]);
}

{
  const schema9 = hydrateNineStrainRuntimeState({
    ...createDefaultNineStrainRuntimeState(),
    schemaVersion: 9,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 2,
  });
  assert.equal(schema9.maxAcquisitionWave, 2);
  assert.deepEqual(schema9.faultline.faultByUnitId, {});
}

console.log('Stage D.1 — Faultline passed');
