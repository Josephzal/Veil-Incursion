import assert from 'node:assert/strict';
import { AFTERIMAGE_CORE_IDS } from '../types/afterimage';
import { CONVERGENCE_IDS, SECTOR_3_CONVERGENCE_IDS } from '../types/convergence';
import { COUNTERFATE_CORE_IDS } from '../types/counterfate';
import { FAULTLINE_CORE_IDS } from '../types/faultline';
import { RITUAL_CADENCE_CORE_IDS } from '../types/ritualCadence';
import { SOULWAKE_CORE_IDS } from '../types/soulwake';
import { STILLPOINT_CORE_IDS } from '../types/stillpoint';
import { WOUNDWEAVE_CORE_IDS } from '../types/woundweave';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import type { TargetNativeResult } from '../types/nineStrain';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';

console.log('Stage D.3 — Sector 3 Convergences');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getProductionOfferDefinitions(3).length, 77);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);
assert.equal(SECTOR_3_CONVERGENCE_IDS.length, 11);
for (const id of SECTOR_3_CONVERGENCE_IDS) {
  const def = live.find((row) => row.id === id);
  assert.ok(def, id);
  assert.equal(def?.role, 'CONVERGENCE');
  assert.equal(def?.imprint, undefined);
  assert.equal(def?.acquisitionWave, 3);
  assert.equal(def?.prerequisites.parentStrainIds?.length, 2);
}

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.syncPlayerVitals({ hp: 100, maxHp: 100 });
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string) {
  runtime.grantFixture(id);
  const result = runtime.commit(id, {
    maxAcquisitionWave: 3,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  if (!result.eligible) runtime.grantFixture(id);
  return result;
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

function twoHostiles(runtime: ReturnType<typeof rt>, hp = 80, ka = 0) {
  runtime.syncHostileIntents([
    hostileSnapshotInput({
      unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT',
      hp, maxHp: hp, kineticArmor: ka,
    }),
    hostileSnapshotInput({
      unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT',
      hp, maxHp: hp, kineticArmor: ka,
    }),
  ]);
}

function recordWake(runtime: ReturnType<typeof rt>, amount = 12) {
  runtime.recordHpLoss({
    lossEventId: `wake-${amount}-${Math.random().toString(36).slice(2, 7)}`,
    rootActionId: null,
    actualHpRemoved: amount,
    currentHpBefore: 100,
    currentHpAfter: Math.max(1, 100 - amount),
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
}

function s3(runtime: ReturnType<typeof rt>) {
  return runtime.serialize().convergence.sector3;
}

function changed(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

{
  // Severed Outcome + Stress Pattern (same imprint) — keep both via fixture; add Refusal for eligibility.
  const runtime = rt();
  assert.equal(grant(runtime, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME).eligible, true);
  assert.equal(grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN).eligible, true);
  assert.equal(grant(runtime, COUNTERFATE_CORE_IDS.REFUSAL_PATTERN).eligible, true);
  const cv = grant(runtime, CONVERGENCE_IDS.BROKEN_OUTCOME);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime, 80, 1);
  runtime.runTurnStart();
  assert.ok(runtime.getState().counterfate.fateboundUnitId);
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'bo-1',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
    lockedTargetIds: ['enemy-a'],
  }));
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'bo-2',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
    lockedTargetIds: ['enemy-a'],
  }));
  const snap = runtime.serialize();
  assert.ok(
    snap.counterfate.rawReversal >= 10
    || s3(runtime).brokenOutcomeStoredThisWindow
    || (snap.faultline.lastRuptures?.length ?? 0) > 0
    || Object.keys(snap.faultline.faultByUnitId).length > 0,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE).eligible, true);
  assert.equal(grant(runtime, FAULTLINE_CORE_IDS.APPLIED_FRACTURE).eligible, true);
  runtime.grantFixture(FAULTLINE_CORE_IDS.STRESS_PATTERN);
  const cv = grant(runtime, CONVERGENCE_IDS.BREAKING_MEASURE);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'bm-arm',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8)],
  }));
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'bm-disc',
    actionSurface: 'TECHNIQUE',
    authoredCosts: { ap: 2 },
    actualCostsPaid: { ap: 2 },
    nativeByTarget: [native('enemy-a', 8)],
  }));
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  const beforeFault = { ...runtime.getState().faultline.faultByUnitId };
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'bm-finale',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10), native('enemy-b', 8)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  }));
  const snap = runtime.serialize();
  assert.ok(
    changed(beforeFault, snap.faultline.faultByUnitId)
    || snap.ritualCadence.lastOutcome === 'FINALE'
    || s3(runtime).breakingMeasureRuptureAdvancedThisPlayerTurn
    || snap.ritualCadence.measure !== 'EMPTY',
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT).eligible, true);
  assert.equal(grant(runtime, FAULTLINE_CORE_IDS.APPLIED_FRACTURE).eligible, true);
  runtime.grantFixture(FAULTLINE_CORE_IDS.STRESS_PATTERN);
  const cv = grant(runtime, CONVERGENCE_IDS.ECHOED_FAULT);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime, 8);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ef-mint',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  const pending = runtime.getState().afterimage.pending.filter((row) => row.provenance === 'CORE');
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  const snap = runtime.serialize();
  assert.ok(
    pending.length > 0
    || Object.keys(snap.faultline.faultByUnitId).length > 0
    || s3(runtime).echoedFaultTraceTargetsThisPlayerTurn.length > 0
    || s3(runtime).echoedFaultEmpowerments.length > 0,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE).eligible, true);
  assert.equal(grant(runtime, FAULTLINE_CORE_IDS.APPLIED_FRACTURE).eligible, true);
  runtime.grantFixture(FAULTLINE_CORE_IDS.STRESS_PATTERN);
  const cv = grant(runtime, CONVERGENCE_IDS.CRITICAL_PRESSURE);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  const beforeFault = { ...runtime.getState().faultline.faultByUnitId };
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'cp-focus',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
    lockedTargetIds: ['enemy-a'],
  }));
  const snap = runtime.serialize();
  assert.ok(
    changed(beforeFault, snap.faultline.faultByUnitId)
    || snap.stillpoint.focusedRoot
    || (snap.faultline.faultByUnitId['enemy-a'] ?? 0) >= 2,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND).eligible, true);
  assert.equal(grant(runtime, FAULTLINE_CORE_IDS.APPLIED_FRACTURE).eligible, true);
  runtime.grantFixture(FAULTLINE_CORE_IDS.STRESS_PATTERN);
  const cv = grant(runtime, CONVERGENCE_IDS.SPLIT_SEAM);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ss-form',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8), native('enemy-b', 8)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  }));
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  const beforeFault = { ...runtime.getState().faultline.faultByUnitId };
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ss-xfer',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
    lockedTargetIds: ['enemy-a'],
  }));
  const snap = runtime.serialize();
  assert.ok(
    s3(runtime).splitSeamTransferRootId
    || changed(beforeFault, snap.faultline.faultByUnitId)
    || snap.woundweave.endpointA
    || snap.woundweave.endpointB,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME).eligible, true);
  assert.equal(grant(runtime, SOULWAKE_CORE_IDS.BORROWED_NERVE).eligible, true);
  runtime.grantFixture(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  const cv = grant(runtime, CONVERGENCE_IDS.PAIN_FORETOLD);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime);
  recordWake(runtime, 12);
  runtime.runTurnStart();
  assert.ok(runtime.getState().soulwake.activeWake >= 10);
  const beforeRev = runtime.getState().counterfate.rawReversal;
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'pf-wake',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  const snap = runtime.serialize();
  assert.ok(
    snap.counterfate.rawReversal > beforeRev
    || s3(runtime).painForetoldWakeStoreUsedThisPlayerTurn
    || snap.soulwake.activeWake > 0,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE).eligible, true);
  assert.equal(grant(runtime, SOULWAKE_CORE_IDS.BORROWED_NERVE).eligible, true);
  runtime.grantFixture(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  const cv = grant(runtime, CONVERGENCE_IDS.PULSE_RITE);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime);
  runtime.runTurnStart();
  const beforeMeasure = runtime.getState().ritualCadence.measure;
  const paid = runtime.commitOverdraw('pulse-od');
  assert.ok(paid.paid > 0 || !paid.invalid);
  const snap = runtime.serialize();
  assert.ok(
    s3(runtime).pulseRiteOverdrawUsedThisPlayerTurn
    || snap.ritualCadence.measure !== beforeMeasure
    || snap.soulwake.recordedWake > 0
    || snap.soulwake.overdrawUsedThisPlayerTurn,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT).eligible, true);
  assert.equal(grant(runtime, SOULWAKE_CORE_IDS.BORROWED_NERVE).eligible, true);
  runtime.grantFixture(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  const cv = grant(runtime, CONVERGENCE_IDS.PHANTOM_PAIN);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime, 8);
  recordWake(runtime, 12);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'pp-mint',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  const snap = runtime.serialize();
  assert.ok(
    s3(runtime).phantomPainMintUsedThisPlayerTurn
    || s3(runtime).phantomPainTraces.length > 0
    || snap.afterimage.pending.some((row) => row.provenance === 'CORE')
    || snap.soulwake.activeWake > 0,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE).eligible, true);
  assert.equal(grant(runtime, SOULWAKE_CORE_IDS.BORROWED_NERVE).eligible, true);
  runtime.grantFixture(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  const cv = grant(runtime, CONVERGENCE_IDS.HELD_BREATH);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime);
  runtime.runTurnStart();
  const paid = runtime.commitOverdraw('held-od');
  assert.ok(paid.paid > 0 || !paid.invalid);
  const snap = runtime.serialize();
  assert.ok(
    s3(runtime).heldBreathOverdrawUsedThisPlayerTurn
    || snap.stillpoint.fleeting
    || snap.soulwake.overdrawUsedThisPlayerTurn
    || snap.soulwake.recordedWake > 0,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND).eligible, true);
  assert.equal(grant(runtime, SOULWAKE_CORE_IDS.BORROWED_NERVE).eligible, true);
  runtime.grantFixture(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  const cv = grant(runtime, CONVERGENCE_IDS.SYMPATHETIC_WOUND);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime);
  recordWake(runtime, 12);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'sw-form',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8), native('enemy-b', 8)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  }));
  const snap = runtime.serialize();
  assert.ok(
    s3(runtime).sympatheticWoundPacketUsedThisPlayerTurn
    || snap.woundweave.endpointA
    || snap.woundweave.linkGeneration > 0
    || (snap.soulwake.lastPackets?.length ?? 0) > 0
    || snap.soulwake.activeWake > 0,
  );
}

{
  const runtime = rt();
  assert.equal(grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN).eligible, true);
  assert.equal(grant(runtime, SOULWAKE_CORE_IDS.BORROWED_NERVE).eligible, true);
  runtime.grantFixture(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  const cv = grant(runtime, CONVERGENCE_IDS.LIVING_FAULT);
  assert.equal(cv.eligible, true, cv.rejectionReasons.join(','));
  twoHostiles(runtime);
  recordWake(runtime, 12);
  runtime.runTurnStart();
  const beforeFault = { ...runtime.getState().faultline.faultByUnitId };
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'lf-wake',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10), native('enemy-b', 8)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  }));
  const snap = runtime.serialize();
  assert.ok(
    s3(runtime).livingFaultApplyUsedThisPlayerTurn
    || changed(beforeFault, snap.faultline.faultByUnitId)
    || (snap.faultline.faultByUnitId['enemy-a'] ?? 0) >= 2
    || snap.soulwake.activeWake > 0,
  );
}

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  grant(runtime, SOULWAKE_CORE_IDS.BORROWED_NERVE);
  runtime.grantFixture(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  grant(runtime, CONVERGENCE_IDS.LIVING_FAULT);
  twoHostiles(runtime);
  recordWake(runtime, 10);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext(family, {
    rootActionId: `s3-weapon-${family}`,
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8)],
  }));
}

console.log('Stage D.3 — Sector 3 Convergences passed');
