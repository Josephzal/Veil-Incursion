import assert from 'node:assert/strict';
import { getLiveUniversalBoonDefinitions, getSector1ProductionDefinitions } from './nineStrain/definitionCatalog';
import {
  createNineStrainRuntime,
  majorCurrentInput,
  ordinaryCurrentInput,
  weaponFamilyExecutionContext,
} from './nineStrain/runtime';
import {
  createDefaultNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
} from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import {
  WOUNDWEAVE_CORE_IDS,
  WOUNDWEAVE_MANIFESTATION_ID,
  WOUNDWEAVE_SUPPORT_IDS,
  WOUNDWEAVE_VERDICT_ID,
} from '../types/woundweave';
import { STILLPOINT_CORE_IDS } from '../types/stillpoint';
import { COUNTERFATE_CORE_IDS } from '../types/counterfate';
import type { TargetNativeResult } from '../types/nineStrain';
import { directlyAffectedTargetIds, isDirectlyAffectedNative } from './nineStrain/rootAction';

console.log('Stage C.2 — Woundweave');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 66);
assert.equal(getSector1ProductionDefinitions().length, 27);
assert.equal(live.filter((row) => row.strainId === 'WOUNDWEAVE').length, 8);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 11);
assert.equal(live.filter((row) => row.role === 'CONVERGENCE' && row.strainId === 'WOUNDWEAVE').length, 0);

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live, allowSector2Wave: true });
  runtime.hydrate(activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string, extra: { premium?: boolean; depth?: number } = {}) {
  runtime.grantFixture(id);
  const result = runtime.commit(id, {
    allowSector2Wave: true,
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: extra.depth ?? 2,
    equippedWeaponFamilyId: 'aegis-longsword',
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

function twoHostiles(runtime: ReturnType<typeof rt>, extra: { jammed?: boolean; third?: boolean } = {}) {
  const rows = [
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', designation: 'A', hp: 80, maxHp: 80, severity: 'HIGH' }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT', designation: 'B', hp: 80, maxHp: 80, severity: 'MODERATE' }),
  ];
  if (extra.third) {
    rows.push(hostileSnapshotInput({ unitId: 'enemy-c', intentKind: 'STRIKE', hostileTurnOrder: 2, slot: 'BACK_LEFT', designation: 'C', hp: 80, maxHp: 80, severity: 'LOW' }));
  }
  runtime.syncHostileIntents(rows, extra.jammed === true);
}

function loneHostile(runtime: ReturnType<typeof rt>) {
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', designation: 'BOSS', hp: 200, maxHp: 200 }),
  ]);
}

function strike(runtime: ReturnType<typeof rt>, family: typeof CANONICAL_WEAPON_FAMILY_IDS[number], rootActionId: string, targets: TargetNativeResult[], extra: Parameters<typeof weaponFamilyExecutionContext>[1] = {}) {
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
  const miss = native('enemy-a', 0, { hits: 0, misses: 1 });
  assert.equal(isDirectlyAffectedNative(miss), false);
  const ctx = weaponFamilyExecutionContext('aegis-longsword', {
    nativeByTarget: [native('enemy-b', 10), native('enemy-a', 10)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  });
  assert.deepEqual(directlyAffectedTargetIds(ctx), ['enemy-a', 'enemy-b']);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'r1', [native('enemy-a', 20)]);
  assert.equal(runtime.getState().woundweave.pendingEndpoint, 'enemy-a');
  assert.equal(runtime.getState().woundweave.selfLink, false);
  strike(runtime, 'aegis-longsword', 'r2', [native('enemy-b', 20)]);
  const ww = runtime.getState().woundweave;
  assert.equal(ww.endpointA, 'enemy-a');
  assert.equal(ww.endpointB, 'enemy-b');
  assert.equal(ww.selfLink, false);
  const mirrors = ww.lastPackets.filter((row) => row.kind === 'MIRROR');
  assert.equal(mirrors.length, 1);
  assert.equal(mirrors[0].targetId, 'enemy-a');
  assert.equal(mirrors[0].occultDamage, 5);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'hex-carbine', 'spread', [
    native('enemy-a', 20),
    native('enemy-b', 20),
  ], { lockedTargetIds: ['enemy-a', 'enemy-b'], targetPattern: 'SPREAD' });
  const ww = runtime.getState().woundweave;
  assert.equal(ww.endpointA, 'enemy-a');
  assert.equal(ww.endpointB, 'enemy-b');
  const mirrors = ww.lastPackets.filter((row) => row.kind === 'MIRROR');
  assert.equal(mirrors.length, 2);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'miss', [native('enemy-a', 0, { hits: 0, misses: 1 })]);
  assert.equal(runtime.getState().woundweave.pendingEndpoint, null);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  twoHostiles(runtime);
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', alive: false, hp: 0 }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT', phased: true }),
  ]);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'dead', [native('enemy-a', 20, { killed: true })]);
  strike(runtime, 'aegis-longsword', 'phase', [native('enemy-b', 20)]);
  assert.equal(runtime.getState().woundweave.endpointA, null);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'form-a', [native('enemy-a', 20)]);
  strike(runtime, 'aegis-longsword', 'form-b', [native('enemy-b', 20)]);
  runtime.runTurnStart();
  assert.equal(runtime.getState().woundweave.endpointA, null);
  assert.equal(runtime.getState().woundweave.lastLog, 'Woundlink expired');
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, WOUNDWEAVE_SUPPORT_IDS.PERSISTENT_STITCH);
  twoHostiles(runtime, { third: true });
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'pa', [native('enemy-a', 20)]);
  strike(runtime, 'aegis-longsword', 'pb', [native('enemy-b', 20)]);
  runtime.runTurnStart();
  assert.ok(runtime.getState().woundweave.endpointA);
  strike(runtime, 'aegis-longsword', 'replace', [native('enemy-c', 20)]);
  const ww = runtime.getState().woundweave;
  assert.equal(ww.endpointA, 'enemy-c');
  assert.equal(ww.endpointB, 'enemy-b');
  runtime.runTurnStart();
  assert.ok(runtime.getState().woundweave.endpointA);
  runtime.runTurnStart();
  assert.equal(runtime.getState().woundweave.endpointA, null);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'deriv',
    classification: 'DERIVATIVE',
    procDepth: 1,
    nativeByTarget: [native('enemy-a', 20), native('enemy-b', 20)],
  }));
  assert.equal(runtime.getState().woundweave.endpointA, null);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  loneHostile(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 's1', [native('enemy-a', 8), native('enemy-a', 8)]);
  assert.equal(runtime.getState().woundweave.selfLink, false);
  strike(runtime, 'aegis-longsword', 's2', [native('enemy-a', 20)]);
  const ww = runtime.getState().woundweave;
  assert.equal(ww.selfLink, true);
  assert.equal(ww.endpointA, 'enemy-a');
  assert.equal(ww.endpointB, null);
  assert.equal(ww.lastPackets.filter((row) => row.kind === 'MIRROR').length, 1);
  assert.equal(ww.lastPackets[0].occultDamage, 2);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  loneHostile(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'c1', [native('enemy-a', 20)]);
  twoHostiles(runtime);
  strike(runtime, 'aegis-longsword', 'c2', [native('enemy-b', 20)]);
  const ww = runtime.getState().woundweave;
  assert.equal(ww.selfLink, false);
  assert.equal(ww.endpointB, 'enemy-b');
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.CROSSED_HEX);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'link', [native('enemy-a', 10), native('enemy-b', 10)]);
  strike(runtime, 'aegis-longsword', 'hex', [native('enemy-a', 1)], {
    actionSurface: 'TECHNIQUE',
    authoredCosts: { ap: 2 },
    actualCostsPaid: { ap: 2 },
  });
  const pulses = runtime.getState().woundweave.lastPackets.filter((row) => row.kind === 'PULSE');
  assert.equal(pulses.length, 2);
  assert.ok(pulses.every((row) => row.occultDamage === 8));
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.REFLEXIVE_AGONY);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'link', [native('enemy-a', 10), native('enemy-b', 10)]);
  runtime.resolveInstinct({ classId: 'AEGIS', voidWardPrevented: true, parryAttempted: true });
  const pulses = runtime.getState().woundweave.lastPackets.filter((row) => row.kind === 'PULSE');
  assert.equal(pulses.length, 2);
  assert.ok(pulses.every((row) => row.occultDamage === 5));
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'link', [native('enemy-a', 10), native('enemy-b', 10)]);
  runtime.resolveCurrent(ordinaryCurrentInput('AEGIS'));
  assert.equal(runtime.getState().woundweave.tightenedCharge?.power, 8);
  strike(runtime, 'aegis-longsword', 'release', [native('enemy-a', 4)]);
  const threads = runtime.getState().woundweave.lastPackets.filter((row) => row.kind === 'THREAD');
  assert.equal(threads.length, 2);
  assert.ok(threads.every((row) => row.occultDamage === 8));
  assert.equal(runtime.getState().woundweave.tightenedCharge, null);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'link', [native('enemy-a', 10), native('enemy-b', 10)]);
  runtime.resolveCurrent(majorCurrentInput('AEGIS'));
  assert.equal(runtime.getState().woundweave.tightenedCharge?.signal, 'MAJOR');
  runtime.runTurnStart();
  assert.equal(runtime.getState().woundweave.tightenedCharge, null);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, WOUNDWEAVE_SUPPORT_IDS.CASCADING_TEAR);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'link', [native('enemy-a', 10), native('enemy-b', 10)]);
  strike(runtime, 'aegis-longsword', 'kill', [native('enemy-a', 80, { killed: true })]);
  const tears = runtime.getState().woundweave.lastPackets.filter((row) => row.kind === 'TEAR');
  assert.equal(tears.length, 1);
  assert.equal(tears[0].targetId, 'enemy-b');
  assert.equal(tears[0].occultDamage, 10);
  assert.equal(runtime.getState().woundweave.emptySlotAwaitingRefill, true);
  twoHostiles(runtime, { third: true });
  strike(runtime, 'aegis-longsword', 'refill', [native('enemy-c', 12)]);
  assert.equal(runtime.getState().woundweave.endpointB, 'enemy-c');
  assert.equal(runtime.getState().woundweave.emptySlotAwaitingRefill, false);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, WOUNDWEAVE_MANIFESTATION_ID, { depth: 2 });
  twoHostiles(runtime, { third: true });
  runtime.setCombatDepth(2);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'body', [native('enemy-a', 20), native('enemy-b', 20)]);
  const ww = runtime.getState().woundweave;
  assert.equal(ww.secondaryEndpointIds.includes('enemy-c'), true);
  const toC = ww.lastPackets.filter((row) => row.targetId === 'enemy-c');
  assert.equal(toC.length, 1);
  assert.equal(toC[0].occultDamage, 5);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_VERDICT_ID, { premium: true });
  twoHostiles(runtime, { third: true });
  runtime.runTurnStart();
  assert.equal(canFireWeaponUltimate('aegis-longsword'), true);
  strike(runtime, 'aegis-longsword', 'grave', [
    native('enemy-a', 20),
    native('enemy-b', 20),
    native('enemy-c', 20),
  ], { sourceKind: 'ULTIMATE', actionSurface: 'ULTIMATE' });
  const grave = runtime.getState().woundweave.lastPackets.filter((row) => row.kind === 'GRAVE');
  assert.equal(grave.reduce((sum, row) => sum + row.occultDamage, 0), 15);
  assert.equal(runtime.getState().woundweave.endpointA, 'enemy-a');
  assert.equal(runtime.getState().woundweave.endpointB, 'enemy-b');
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_VERDICT_ID, { premium: true });
  loneHostile(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'lone-grave', [native('enemy-a', 50)], {
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
  });
  const grave = runtime.getState().woundweave.lastPackets.filter((row) => row.kind === 'GRAVE');
  assert.equal(grave.length, 1);
  assert.equal(grave[0].occultDamage, 6);
  assert.equal(runtime.getState().woundweave.selfLink, false);
  assert.equal(runtime.getState().woundweave.pendingEndpoint, 'enemy-a');
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'p1', [native('enemy-a', 10)]);
  const snap = runtime.serialize();
  const resumed = rt();
  resumed.hydrate(snap);
  twoHostiles(resumed);
  strike(resumed, 'aegis-longsword', 'p2', [native('enemy-b', 10)]);
  assert.equal(resumed.getState().woundweave.endpointB, 'enemy-b');
  resumed.hydrate(resumed.serialize());
  assert.equal(resumed.getState().woundweave.endpointB, 'enemy-b');
}

{
  const schema7 = hydrateNineStrainRuntimeState({
    schemaVersion: 7,
    boonSystemMode: 'NINE_STRAIN',
    stillpoint: { nativeStillness: 2, hostileApDisruptionThisPlayerTurn: true },
  });
  assert.equal(schema7.schemaVersion, 11);
  assert.equal(schema7.stillpoint.nativeStillness, 2);
  assert.equal(schema7.stillpoint.hostileApDisruptionThisPlayerTurn, true);
  assert.equal(schema7.woundweave.endpointA, null);
  const again = hydrateNineStrainRuntimeState(schema7);
  assert.equal(again.stillpoint.nativeStillness, 2);
  assert.equal(again.woundweave.linkGeneration, 0);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  twoHostiles(runtime);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 2 });
  runtime.runTurnStart();
  const preview = runtime.previewRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'focus-ww',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 40), native('enemy-b', 40)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
    totalNativeDirectDamage: 80,
  }));
  strike(runtime, 'aegis-longsword', 'focus-ww', [native('enemy-a', 40), native('enemy-b', 40)]);
  assert.equal(preview.woundweave.endpointA, runtime.getState().woundweave.endpointA);
  assert.ok((runtime.getState().metrics.condensed_impact ?? 0) > 0);
  assert.equal(runtime.getState().woundweave.selfLink, false);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  twoHostiles(runtime);
  runtime.runTurnStart();
  strike(runtime, 'aegis-longsword', 'phase-a', [native('enemy-a', 10), native('enemy-b', 10)]);
  runtime.setWoundweavePhaseSuccessor('enemy-a', 'enemy-a-p2');
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a-p2', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 80, maxHp: 80 }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT', hp: 80, maxHp: 80 }),
  ]);
  strike(runtime, 'aegis-longsword', 'after-phase', [native('enemy-b', 8)]);
  assert.equal(runtime.getState().woundweave.endpointA, 'enemy-a-p2');
}

const FAMILIES = CANONICAL_WEAPON_FAMILY_IDS;
assert.equal(FAMILIES.length, 9);

{
  let fixture = 0;
  for (const family of FAMILIES) {
    for (const core of Object.values(WOUNDWEAVE_CORE_IDS)) {
      const runtime = rt();
      grant(runtime, core);
      twoHostiles(runtime);
      runtime.runTurnStart();
      strike(runtime, family, `ww-${family}-${core}`, [native('enemy-a', 16), native('enemy-b', 16)]);
      if (core === WOUNDWEAVE_CORE_IDS.REFLEXIVE_AGONY) {
        const classId = classIdForWeaponFamily(family);
        runtime.resolveInstinct(classId === 'HEX_SHOT'
          ? { classId, reloadQuality: 'CLEAN' }
          : classId === 'ENVOY'
            ? { classId, riftPreventedDamage: 6, riftWouldReachHp: 10 }
            : { classId, wraithParrySuccess: true, parryAttempted: true });
      } else if (core === WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD) {
        runtime.resolveCurrent(ordinaryCurrentInput(classIdForWeaponFamily(family)));
        strike(runtime, family, `rel-${family}`, [native('enemy-a', 4)]);
      } else if (core === WOUNDWEAVE_CORE_IDS.CROSSED_HEX) {
        strike(runtime, family, `hex-${family}`, [native('enemy-a', 1)], {
          actionSurface: 'TECHNIQUE',
          actualCostsPaid: { ap: 1 },
        });
      }
      assert.ok(runtime.getState().woundweave.endpointA);
      fixture += 1;
    }
  }
  assert.equal(fixture, 36);
}

{
  const grades = [
    { classId: 'AEGIS' as const, input: { classId: 'AEGIS' as const, voidWardPrevented: true, parryAttempted: true }, expect: 5 },
    { classId: 'AEGIS' as const, input: { classId: 'AEGIS' as const, wraithParrySuccess: true, parryAttempted: true }, expect: 8 },
    { classId: 'AEGIS' as const, input: { classId: 'AEGIS' as const, perfectParry: true, parryAttempted: true }, expect: 12 },
    { classId: 'HEX_SHOT' as const, input: { classId: 'HEX_SHOT' as const, reloadQuality: 'CLEAN' as const }, expect: 8 },
    { classId: 'HEX_SHOT' as const, input: { classId: 'HEX_SHOT' as const, reloadQuality: 'PERFECT' as const }, expect: 12 },
    { classId: 'ENVOY' as const, input: { classId: 'ENVOY' as const, riftPreventedDamage: 4, riftWouldReachHp: 10 }, expect: 5 },
    { classId: 'ENVOY' as const, input: { classId: 'ENVOY' as const, riftPreventedDamage: 6, riftWouldReachHp: 10 }, expect: 8 },
    { classId: 'ENVOY' as const, input: { classId: 'ENVOY' as const, riftPreventedDamage: 10, riftWouldReachHp: 10 }, expect: 12 },
  ];
  for (const row of grades) {
    const runtime = rt();
    grant(runtime, WOUNDWEAVE_CORE_IDS.REFLEXIVE_AGONY);
    twoHostiles(runtime);
    runtime.runTurnStart();
    strike(runtime, 'aegis-longsword', `agony-${row.classId}-${row.expect}`, [native('enemy-a', 10), native('enemy-b', 10)]);
    runtime.resolveInstinct(row.input);
    const pulse = runtime.getState().woundweave.lastPackets.find((packet) => packet.kind === 'PULSE');
    assert.equal(pulse?.occultDamage, row.expect, `${row.classId} ${row.expect}`);
  }
}

{
  for (const family of FAMILIES) {
    const classId = classIdForWeaponFamily(family);
    const runtime = rt();
    grant(runtime, WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD);
    twoHostiles(runtime);
    runtime.runTurnStart();
    strike(runtime, family, `th-${family}`, [native('enemy-a', 10), native('enemy-b', 10)]);
    runtime.resolveCurrent(ordinaryCurrentInput(classId));
    assert.equal(runtime.getState().woundweave.tightenedCharge?.power, 8, family);
    const major = rt();
    grant(major, WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD);
    twoHostiles(major);
    major.runTurnStart();
    strike(major, family, `thm-${family}`, [native('enemy-a', 10), native('enemy-b', 10)]);
    major.resolveCurrent(majorCurrentInput(classId));
    assert.equal(major.getState().woundweave.tightenedCharge?.power, 12, family);
  }
}

{
  for (const family of FAMILIES) {
    const runtime = rt();
    grant(runtime, WOUNDWEAVE_VERDICT_ID, { premium: true });
    twoHostiles(runtime);
    runtime.runTurnStart();
    assert.equal(canFireWeaponUltimate(family), true);
    strike(runtime, family, `ult-${family}`, [native('enemy-a', 20), native('enemy-b', 20)], {
      sourceKind: 'ULTIMATE',
      actionSurface: 'ULTIMATE',
    });
    assert.ok(runtime.getState().woundweave.lastPackets.some((row) => row.kind === 'GRAVE'), family);
    assert.equal(runtime.getState().woundweave.endpointA, 'enemy-a', family);
  }
}

{
  for (const family of FAMILIES) {
    const runtime = rt();
    grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
    grant(runtime, WOUNDWEAVE_SUPPORT_IDS.PERSISTENT_STITCH);
    grant(runtime, WOUNDWEAVE_SUPPORT_IDS.CASCADING_TEAR);
    grant(runtime, WOUNDWEAVE_MANIFESTATION_ID, { depth: 2 });
    twoHostiles(runtime, { third: true });
    runtime.setCombatDepth(2);
    runtime.runTurnStart();
    strike(runtime, family, `sup-${family}`, [native('enemy-a', 20), native('enemy-b', 20)]);
    assert.ok(runtime.getState().woundweave.persistent, family);
    assert.ok(runtime.getState().woundweave.secondaryEndpointIds.length >= 1, family);
  }
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.noteHostileApDisruption();
  assert.equal(runtime.previewEndTurn({ reason: 'VOLUNTARY', usableAp: 2 }).gain, false);
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 2 });
  assert.equal(runtime.getState().stillpoint.nativeStillness, 0);
}

console.log('Stage C.2 — Woundweave passed');
