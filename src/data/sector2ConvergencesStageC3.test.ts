import assert from 'node:assert/strict';
import { AFTERIMAGE_CORE_IDS } from '../types/afterimage';
import { CONVERGENCE_IDS, SECTOR_2_CONVERGENCE_IDS } from '../types/convergence';
import { COUNTERFATE_CORE_IDS } from '../types/counterfate';
import { RITUAL_CADENCE_CORE_IDS } from '../types/ritualCadence';
import { STILLPOINT_CORE_IDS } from '../types/stillpoint';
import { WOUNDWEAVE_CORE_IDS } from '../types/woundweave';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState, hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import type { TargetNativeResult } from '../types/nineStrain';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';

console.log('Stage C.3 — Sector 2 Convergences');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);
assert.equal(SECTOR_2_CONVERGENCE_IDS.length, 7);
for (const id of SECTOR_2_CONVERGENCE_IDS) {
  const def = live.find((row) => row.id === id);
  assert.ok(def, id);
  assert.equal(def?.role, 'CONVERGENCE');
  assert.equal(def?.imprint, undefined);
  assert.equal(def?.prerequisites.parentStrainIds?.length, 2);
}

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live, allowSector2Wave: true });
  runtime.hydrate(activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string) {
  runtime.grantFixture(id);
  const result = runtime.commit(id, {
    allowSector2Wave: true,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  if (!result.eligible) runtime.grantFixture(id);
}

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId,
    hits: 1,
    misses: 0,
    crits: 0,
    nativeDirectDamage: damage,
    defenseDamage: 0,
    defenseBreaks: extra.defenseBreaks ?? 0,
    fractures: 0,
    statusesApplied: 0,
    killed: extra.killed === true,
    healingDealt: 0,
    movement: 0,
    ...extra,
  };
}

function twoHostiles(runtime: ReturnType<typeof rt>, hp = 80) {
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp, maxHp: hp }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT', hp, maxHp: hp }),
  ]);
}

{
  const runtime = rt();
  grant(runtime, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(runtime, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, CONVERGENCE_IDS.STAYED_SENTENCE);
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  assert.ok(runtime.getState().counterfate.rawReversal >= 10);
  assert.equal(runtime.getState().convergence.stayedSentenceNativeUsedThisCombatCycle, true);
  runtime.dispatch({
    type: 'ENEMY_CYCLE_STARTED',
    sourceId: 'enemy',
    lineage: [],
    rootActionId: null,
    targetId: null,
    payload: {},
  });
  runtime.resolveInstinct({
    classId: 'AEGIS',
    perfectParry: true,
    parryAttempted: true,
    preventedFateboundIntentDamage: true,
  });
  assert.equal(runtime.getState().stillpoint.stayedSentenceFreeFocus, true);
  assert.equal(runtime.getState().convergence.stayedSentenceInstinctUsedThisEnemyCycle, true);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'stayed-free',
    actionSurface: 'WEAPON',
  }));
  assert.equal(runtime.getState().stillpoint.focusedRoot?.chargeSource, 'STAYED_SENTENCE_FREE');
  assert.equal(runtime.getState().stillpoint.stayedSentenceFreeFocus, false);
}

{
  const runtime = rt();
  grant(runtime, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, CONVERGENCE_IDS.MEASURED_SILENCE);
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  assert.equal(runtime.getState().ritualCadence.measure, 'BEAT_I');
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ms-arm-1',
    actionSurface: 'WEAPON',
  }));
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ms-disc-1',
    actionSurface: 'TECHNIQUE',
    authoredCosts: { ap: 2 },
    actualCostsPaid: { ap: 2 },
  }));
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ms-finale',
    actionSurface: 'WEAPON',
  }));
  assert.ok(
    runtime.getState().stillpoint.fleeting
    || runtime.getState().convergence.measuredSilenceRetainUsedThisPlayerTurn
    || runtime.getState().ritualCadence.lastOutcome !== 'FINALE',
  );
}

{
  const runtime = rt();
  grant(runtime, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, CONVERGENCE_IDS.SUSPENDED_ECHO);
  twoHostiles(runtime, 8);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'echo-root',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  const empowered = runtime.getState().afterimage.pending.find((row) => row.provenance === 'CORE');
  assert.ok(empowered);
  assert.equal(runtime.getState().convergence.suspendedEchoUsedThisCombatCycle, true);
  const snap = runtime.serialize();
  const resumed = rt();
  resumed.hydrate(snap);
  assert.equal(resumed.getState().convergence.suspendedEchoLineages.length, 1);
}

{
  const runtime = rt();
  grant(runtime, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, CONVERGENCE_IDS.ENTANGLED_FATE);
  twoHostiles(runtime);
  runtime.runTurnStart();
  assert.equal(runtime.getState().woundweave.pendingEndpoint, runtime.getState().counterfate.fateboundUnitId);
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ef-hit',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10), native('enemy-b', 10)],
  }));
  assert.ok(runtime.getState().counterfate.rawReversal >= 6);
}

{
  const runtime = rt();
  grant(runtime, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, CONVERGENCE_IDS.TWOFOLD_RITE);
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'tf-form',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8), native('enemy-b', 8)],
  }));
  assert.equal(runtime.getState().convergence.twofoldFormationUsedThisPlayerTurn, true);
  assert.ok(runtime.getState().ritualCadence.measure === 'BEAT_I' || runtime.getState().ritualCadence.measure === 'BEAT_II');
}

{
  const runtime = rt();
  grant(runtime, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, CONVERGENCE_IDS.GHOST_THREAD);
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'gt-form',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8), native('enemy-b', 8)],
  }));
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'gt-trace',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  assert.ok(runtime.getState().convergence.ghostThreadCapture || runtime.getState().convergence.ghostThreadUsedThisPlayerTurn);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, CONVERGENCE_IDS.DRAWN_TENSION);
  twoHostiles(runtime, 12);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'dt-form',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8), native('enemy-b', 8)],
  }));
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'dt-kill',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 40, { killed: true, defenseBreaks: 1 })],
  }));
  assert.ok(
    runtime.getState().stillpoint.fleeting
    || runtime.getState().convergence.drawnTensionFleetingUsedThisPlayerTurn,
  );
}

{
  const runtime = rt();
  grant(runtime, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, CONVERGENCE_IDS.STAYED_SENTENCE);
  grant(runtime, CONVERGENCE_IDS.ENTANGLED_FATE);
  grant(runtime, CONVERGENCE_IDS.GHOST_THREAD);
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'fuzz-1',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 9), native('enemy-b', 9)],
  }));
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  const snap = runtime.serialize();
  const resumed = hydrateNineStrainRuntimeState(snap);
  assert.equal(resumed.schemaVersion, 15);
  assert.equal(resumed.stillpoint.nativeStillness, snap.stillpoint.nativeStillness);
  assert.equal(resumed.woundweave.linkGeneration, snap.woundweave.linkGeneration);
}

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, CONVERGENCE_IDS.DRAWN_TENSION);
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext(family, {
    rootActionId: `cv-weapon-${family}`,
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8), native('enemy-b', 8)],
  }));
}

console.log('Stage C.3 — Sector 2 Convergences passed');
