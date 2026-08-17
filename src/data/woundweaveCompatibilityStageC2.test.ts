import assert from 'node:assert/strict';
import { getLiveUniversalBoonDefinitions, getSector1ProductionDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { WOUNDWEAVE_CORE_IDS, WOUNDWEAVE_SUPPORT_IDS, WOUNDWEAVE_VERDICT_ID } from '../types/woundweave';
import { STILLPOINT_CORE_IDS, STILLPOINT_SUPPORT_IDS } from '../types/stillpoint';
import { COUNTERFATE_CORE_IDS } from '../types/counterfate';
import { AFTERIMAGE_CORE_IDS } from '../types/afterimage';
import { RITUAL_CADENCE_CORE_IDS } from '../types/ritualCadence';
import type { TargetNativeResult } from '../types/nineStrain';

console.log('Stage C.2 — Woundweave compatibility');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 66);
assert.equal(getSector1ProductionDefinitions().length, 27);

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live, allowSector2Wave: true });
  runtime.hydrate(activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string, extra: { premium?: boolean } = {}) {
  runtime.grantFixture(id);
  runtime.commit(id, {
    allowSector2Wave: true,
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
}

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId,
    hits: 1,
    misses: 0,
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

function field(runtime: ReturnType<typeof rt>) {
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 90, maxHp: 90 }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT', hp: 90, maxHp: 90 }),
  ]);
}

{
  const mixed = rt();
  grant(mixed, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(mixed, WOUNDWEAVE_CORE_IDS.CROSSED_HEX);
  assert.equal(mixed.getState().cores.ARMAMENT, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  assert.equal(mixed.getState().cores.DISCIPLINE, WOUNDWEAVE_CORE_IDS.CROSSED_HEX);
  mixed.grantFixture(WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  mixed.commit(WOUNDWEAVE_CORE_IDS.SHARED_WOUND, {
    allowSector2Wave: true,
    combatDepth: 2,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(mixed.getState().cores.ARMAMENT, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
}

{
  for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
    const runtime = rt();
    grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
    grant(runtime, STILLPOINT_CORE_IDS.QUIET_REFLEX);
    grant(runtime, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
    field(runtime);
    runtime.runTurnStart();
    runtime.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `mix-${family}`,
      actionSurface: 'WEAPON',
      nativeByTarget: [native('enemy-a', 24), native('enemy-b', 24)],
      lockedTargetIds: ['enemy-a', 'enemy-b'],
      totalNativeDirectDamage: 48,
    }));
    assert.ok(runtime.getState().woundweave.endpointA, family);
    runtime.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `trace-${family}`,
      classification: 'DERIVATIVE',
      procDepth: 1,
      nativeByTarget: [native('enemy-a', 99)],
    }));
    assert.equal(runtime.getState().woundweave.linkGeneration >= 1, true);
  }
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, STILLPOINT_SUPPORT_IDS.RETURN_STROKE);
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  field(runtime);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'rs-ww',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 20), native('enemy-b', 20, { killed: true })],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
    kills: 1,
  }));
  assert.ok((runtime.getState().metrics.ap_refund ?? 0) + (runtime.getState().stillpoint.lastApRefund) >= 1);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD);
  runtime.commit(STILLPOINT_CORE_IDS.SILENT_RESERVOIR, { allowSector2Wave: true, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(runtime.getState().cores.CURRENT, STILLPOINT_CORE_IDS.SILENT_RESERVOIR);
  const agony = rt();
  grant(agony, WOUNDWEAVE_CORE_IDS.REFLEXIVE_AGONY);
  agony.commit(STILLPOINT_CORE_IDS.QUIET_REFLEX, { allowSector2Wave: true, combatDepth: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(agony.getState().cores.INSTINCT, STILLPOINT_CORE_IDS.QUIET_REFLEX);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_VERDICT_ID, { premium: true });
  const other = runtime.preview('CF_VERDICT_FINAL_REVISION', {
    allowSector2Wave: true,
    premiumVerdictSource: true,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(other.eligible, false);
}

{
  const runtime = rt();
  grant(runtime, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(runtime, WOUNDWEAVE_CORE_IDS.CROSSED_HEX);
  field(runtime);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'measure-ww',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 12), native('enemy-b', 12)],
  }));
  const measureBefore = runtime.getState().ritualCadence.measure;
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'ww-deriv-measure',
    classification: 'DERIVATIVE',
    procDepth: 1,
    nativeByTarget: [native('enemy-a', 40)],
  }));
  assert.equal(runtime.getState().ritualCadence.measure, measureBefore);
}

{
  const runtime = rt();
  grant(runtime, WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  grant(runtime, WOUNDWEAVE_SUPPORT_IDS.CASCADING_TEAR);
  field(runtime);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('hex-carbine', {
    rootActionId: 'multi-hit',
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 8), native('enemy-a', 8), native('enemy-b', 16)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  }));
  const mirrors = runtime.getState().woundweave.lastPackets.filter((row) => row.kind === 'MIRROR');
  assert.ok(mirrors.length <= 2);
}

console.log('Stage C.2 — Woundweave compatibility passed');
