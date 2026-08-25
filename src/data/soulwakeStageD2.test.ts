import assert from 'node:assert/strict';
import {
  SOULWAKE_CORE_IDS,
  SOULWAKE_MANIFESTATION_ID,
  SOULWAKE_SUPPORT_IDS,
  SOULWAKE_VERDICT_ID,
} from '../types/soulwake';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, instinctInputForClass, weaponFamilyExecutionContext } from './nineStrain/runtime';
import {
  createLiveNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
} from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import {
  nonlethalPayment as pay,
  percentRequest as req,
  wakeCapFor as cap,
  hollowEdgeDamage,
  painReflexBarrier,
  nerveThresholdMet,
} from './nineStrain/soulwakeEngine';
import { promoteQuietReflexGrade } from './nineStrain/stillpointEngine';
import type { TargetNativeResult } from '../types/nineStrain';

console.log('Stage D.2 — Soulwake');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(live.filter((row) => row.strainId === 'FAULTLINE' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'SOULWAKE' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(live.filter((row) => row.role === 'CONVERGENCE').length, 36);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 4);
assert.equal(cap(100), 20);
assert.equal(req(100, 0.05), 5);
assert.equal(req(10, 0.05), 1);
assert.equal(pay(5, 3), 2);
assert.equal(pay(5, 1), 0);
assert.equal(hollowEdgeDamage(10, 1), 12);
assert.equal(hollowEdgeDamage(20, 3), 24);
assert.equal(painReflexBarrier('STANDARD', 10), 9);
assert.equal(painReflexBarrier('CLEAN', 10), 11);
assert.equal(painReflexBarrier('PERFECT', 10), 14);
assert.equal(painReflexBarrier(promoteQuietReflexGrade('STANDARD'), 10), 11);
assert.equal(nerveThresholdMet(10, 100), true);
assert.equal(nerveThresholdMet(9, 100), false);

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId, hits: 1, misses: 0, crits: 0, nativeDirectDamage: damage, defenseDamage: 0, defenseBreaks: 0,
    fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0, ...extra,
  };
}

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.syncPlayerVitals({ hp: 100, maxHp: 100 });
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 80, maxHp: 80 }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT', hp: 80, maxHp: 80 }),
  ]);
  runtime.setCombatDepth(2);
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string, extra: { premium?: boolean } = {}) {
  const result = runtime.commit(id, {
    maxAcquisitionWave: 3,
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  if (!result.eligible) runtime.grantFixture(id);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.runTurnStart();
  const prevented = runtime.recordHpLoss({
    lossEventId: 'p1',
    rootActionId: null,
    actualHpRemoved: 0,
    currentHpBefore: 100,
    currentHpAfter: 100,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'PARRY',
    overdrawKind: 'NONE',
  });
  assert.equal(prevented.classified, false);
  runtime.recordHpLoss({
    lossEventId: 'h1',
    rootActionId: null,
    actualHpRemoved: 8,
    currentHpBefore: 100,
    currentHpAfter: 92,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  assert.equal(runtime.getState().soulwake.recordedWake, 8);
  runtime.recordHpLoss({
    lossEventId: 'h1',
    rootActionId: null,
    actualHpRemoved: 8,
    currentHpBefore: 92,
    currentHpAfter: 84,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  assert.equal(runtime.getState().soulwake.recordedWake, 8);
  runtime.recordHpLoss({
    lossEventId: 'max1',
    rootActionId: null,
    actualHpRemoved: 5,
    currentHpBefore: 92,
    currentHpAfter: 87,
    maxHpBefore: 100,
    maxHpAfter: 90,
    provenance: 'MAX_HP',
    overdrawKind: 'NONE',
  });
  assert.equal(runtime.getState().soulwake.recordedWake, 8);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'WEAPON',
    actualCostsPaid: { ap: 1, hp: 8 },
    hpLossKind: 'NATIVE_ACTION',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  assert.equal(runtime.getState().soulwake.recordedWake, 5);
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'root:aegis-longsword:2',
    actionSurface: 'WEAPON',
    actualCostsPaid: { ap: 1, hp: 8 },
    hpLossKind: 'NATIVE_ACTION',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  assert.equal(runtime.getState().soulwake.recordedWake, 5);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.runTurnStart();
  const first = runtime.commitOverdraw('od1');
  assert.equal(first.paid, 5);
  assert.equal(runtime.getState().soulwake.recordedWake, 5);
  assert.equal(runtime.getState().soulwake.playerHp, 95);
  const second = runtime.commitOverdraw('od2');
  assert.equal(second.invalid, true);
  const preview = runtime.previewOverdraw();
  assert.equal(preview.actualHp, 0);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.recordHpLoss({
    lossEventId: 'pre',
    rootActionId: null,
    actualHpRemoved: 12,
    currentHpBefore: 100,
    currentHpAfter: 88,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  assert.equal(runtime.getState().soulwake.activeWake, 12);
  assert.equal(runtime.getState().soulwake.recordedWake, 0);
  assert.equal(runtime.getState().soulwake.activeWakeKind, 'NORMAL');
  runtime.recordHpLoss({
    lossEventId: 'during',
    rootActionId: null,
    actualHpRemoved: 4,
    currentHpBefore: 88,
    currentHpAfter: 84,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  assert.equal(runtime.getState().soulwake.recordedWake, 4);
  assert.equal(runtime.getState().soulwake.activeWake, 12);
  runtime.dispatch({
    type: 'ENEMY_CYCLE_STARTED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  runtime.dispatch({
    type: 'ENEMY_CYCLE_ENDED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  assert.equal(runtime.getState().soulwake.activeWake, 0);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.recordHpLoss({
    lossEventId: 'w',
    rootActionId: null,
    actualHpRemoved: 10,
    currentHpBefore: 100,
    currentHpAfter: 90,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  const packets = runtime.getState().soulwake.lastPackets;
  assert.equal(packets.length, 1);
  assert.equal(packets[0]?.targetId, 'enemy-a');
  assert.equal(packets[0]?.damage, 14);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.recordHpLoss({
    lossEventId: 'carbine',
    rootActionId: null,
    actualHpRemoved: 10,
    currentHpBefore: 100,
    currentHpAfter: 90,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('hex-carbine', {
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10), native('enemy-b', 10)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  }));
  assert.equal(runtime.getState().soulwake.lastPackets.length, 1);
  assert.equal(runtime.getState().soulwake.lastPackets[0]?.targetId, 'enemy-a');
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.recordHpLoss({
    lossEventId: 'miss',
    rootActionId: null,
    actualHpRemoved: 10,
    currentHpBefore: 100,
    currentHpAfter: 90,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 0, { hits: 0, misses: 1 })],
  }));
  assert.equal(runtime.getState().soulwake.lastPackets.length, 0);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.BORROWED_NERVE);
  runtime.recordHpLoss({
    lossEventId: 'bn',
    rootActionId: null,
    actualHpRemoved: 10,
    currentHpBefore: 100,
    currentHpAfter: 90,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'TECHNIQUE',
    actualCostsPaid: { ap: 2 },
    startsCooldown: true,
    nativeByTarget: [native('enemy-a', 6)],
  }));
  assert.equal(runtime.metric('ap_refund'), 1);
  assert.equal(runtime.getState().soulwake.lastCooldownAdvanced, true);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.PAIN_REFLEX);
  runtime.recordHpLoss({
    lossEventId: 'pr',
    rootActionId: null,
    actualHpRemoved: 10,
    currentHpBefore: 100,
    currentHpAfter: 90,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.dispatch({
    type: 'ENEMY_CYCLE_STARTED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  runtime.resolveInstinct(instinctInputForClass('AEGIS'));
  assert.equal(runtime.getState().soulwake.lastBarrierGranted, 14);
  runtime.resolveInstinct({ classId: 'AEGIS', parryAttempted: true });
  assert.equal(runtime.metric('soulwake_barrier'), 14);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.OPEN_CONDUIT);
  runtime.recordHpLoss({
    lossEventId: 'oc',
    rootActionId: null,
    actualHpRemoved: 10,
    currentHpBefore: 100,
    currentHpAfter: 90,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  runtime.resolveCurrent({ classId: 'AEGIS', ordinaryGain: true, actualGained: 10, ordinarySpend: true, actualSpent: 8 });
  assert.equal(runtime.metric('soulwake_current_gain'), 5);
  assert.equal(runtime.metric('soulwake_current_preserved'), 2);
  assert.equal(runtime.events().some((event) => event.type === 'CURRENT_PRESERVED'), true);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  grant(runtime, SOULWAKE_SUPPORT_IDS.OPEN_NERVE);
  runtime.recordHpLoss({
    lossEventId: 'on',
    rootActionId: null,
    actualHpRemoved: 10,
    currentHpBefore: 100,
    currentHpAfter: 90,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  assert.equal(runtime.getState().soulwake.activeWake, 10);
  const paid = runtime.commitOverdraw('on-od');
  assert.equal(paid.paid, 5);
  assert.equal(runtime.getState().soulwake.activeWake, 15);
  assert.equal(runtime.getState().soulwake.recordedWake, 0);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  grant(runtime, SOULWAKE_SUPPORT_IDS.PAIN_DIVIDEND);
  runtime.recordHpLoss({
    lossEventId: 'pd',
    rootActionId: null,
    actualHpRemoved: 20,
    currentHpBefore: 100,
    currentHpAfter: 80,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.dispatch({
    type: 'ENEMY_CYCLE_STARTED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  runtime.dispatch({
    type: 'ENEMY_CYCLE_ENDED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  assert.equal(runtime.getState().soulwake.lastDividendHealed, 5);
  assert.equal(runtime.getState().soulwake.playerHp, 85);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  grant(runtime, SOULWAKE_MANIFESTATION_ID);
  runtime.runTurnStart();
  runtime.recordHpLoss({
    lossEventId: 'lb',
    rootActionId: null,
    actualHpRemoved: 12,
    currentHpBefore: 100,
    currentHpAfter: 88,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  assert.equal(runtime.getState().soulwake.activeWake, 12);
  assert.equal(runtime.getState().soulwake.recordedWake, 0);
  runtime.dispatch({
    type: 'ENEMY_CYCLE_STARTED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  runtime.dispatch({
    type: 'ENEMY_CYCLE_ENDED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  assert.equal(runtime.getState().soulwake.activeWake, 6);
  assert.equal(runtime.getState().soulwake.activeWakeKind, 'RESIDUAL');
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  grant(runtime, SOULWAKE_VERDICT_ID, { premium: true });
  runtime.runTurnStart();
  runtime.setLastHeartbeatOverdraw(true);
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    nativeByTarget: [native('enemy-a', 20)],
    lockedTargetIds: ['enemy-a'],
  }));
  assert.equal(runtime.getState().soulwake.playerHp, 90);
  assert.ok((runtime.getState().soulwake.lastPackets[0]?.damage ?? 0) >= 15);
}

{
  const schema10 = hydrateNineStrainRuntimeState({
    schemaVersion: 10,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 2,
    faultline: { faultByUnitId: { 'enemy-a': 2 } },
  });
  assert.equal(schema10.schemaVersion, 15);
  assert.equal(schema10.maxAcquisitionWave, 2);
  assert.equal(schema10.faultline.faultByUnitId['enemy-a'], 2);
  assert.equal(schema10.soulwake.activeWake, 0);
  const again = hydrateNineStrainRuntimeState(schema10);
  assert.deepEqual(again.soulwake, schema10.soulwake);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.recordHpLoss({
    lossEventId: 'save',
    rootActionId: null,
    actualHpRemoved: 9,
    currentHpBefore: 100,
    currentHpAfter: 91,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  const blob = runtime.serialize();
  const resumed = rt();
  resumed.hydrate(blob);
  resumed.runTurnStart();
  assert.equal(resumed.getState().soulwake.activeWake, 9);
}

assert.equal(req(100, 0.2), 20);
assert.equal(cap(100), 20);
assert.equal(pay(10, 1), 0);

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.runTurnStart();
  runtime.recordHpLoss({
    lossEventId: 'cap-a',
    rootActionId: null,
    actualHpRemoved: 12,
    currentHpBefore: 100,
    currentHpAfter: 88,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.recordHpLoss({
    lossEventId: 'cap-b',
    rootActionId: null,
    actualHpRemoved: 12,
    currentHpBefore: 88,
    currentHpAfter: 76,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  assert.equal(runtime.getState().soulwake.recordedWake, 20);
  runtime.recordHpLoss({
    lossEventId: 'graft',
    rootActionId: 'g1',
    actualHpRemoved: 4,
    currentHpBefore: 76,
    currentHpAfter: 72,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'GRAFT',
    overdrawKind: 'NONE',
  });
  assert.equal(runtime.getState().soulwake.recordedWake, 20);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.runTurnStart();
  runtime.recordHpLoss({
    lossEventId: 'prism-a',
    rootActionId: 'root:prism',
    actualHpRemoved: 8,
    currentHpBefore: 100,
    currentHpAfter: 92,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'PRISM_SACRIFICE',
    overdrawKind: 'NONE',
  });
  runtime.recordHpLoss({
    lossEventId: 'root:prism:hp',
    rootActionId: 'root:prism',
    actualHpRemoved: 8,
    currentHpBefore: 92,
    currentHpAfter: 84,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'NATIVE_ACTION',
    overdrawKind: 'NONE',
  });
  assert.equal(runtime.getState().soulwake.recordedWake, 8);
  const over = runtime.commitOverdraw('od-prism');
  assert.equal(over.paid, 5);
  assert.equal(runtime.getState().soulwake.recordedWake, 13);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.runTurnStart();
  const before = runtime.getState().soulwake;
  runtime.previewOverdraw();
  runtime.previewSoulwake(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 10)],
  }));
  assert.deepEqual(runtime.getState().soulwake, before);
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  grant(runtime, SOULWAKE_MANIFESTATION_ID);
  grant(runtime, SOULWAKE_SUPPORT_IDS.PAIN_DIVIDEND);
  runtime.runTurnStart();
  runtime.recordHpLoss({
    lossEventId: 'lb-res',
    rootActionId: null,
    actualHpRemoved: 12,
    currentHpBefore: 100,
    currentHpAfter: 88,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.dispatch({
    type: 'ENEMY_CYCLE_STARTED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  runtime.dispatch({
    type: 'ENEMY_CYCLE_ENDED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  assert.equal(runtime.getState().soulwake.activeWakeKind, 'RESIDUAL');
  assert.equal(runtime.getState().soulwake.lastDividendHealed, 3);
  const hpAfterDividend = runtime.getState().soulwake.playerHp;
  runtime.dispatch({
    type: 'ENEMY_CYCLE_STARTED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  runtime.dispatch({
    type: 'ENEMY_CYCLE_ENDED', sourceId: 'enemy', lineage: [], rootActionId: null, targetId: null, payload: {},
  });
  assert.equal(runtime.getState().soulwake.activeWake, 0);
  assert.equal(runtime.getState().soulwake.playerHp, hpAfterDividend);
}

console.log('Stage D.2 — Soulwake passed');
