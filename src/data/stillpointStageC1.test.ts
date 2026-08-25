import assert from 'node:assert/strict';
import { getLiveUniversalBoonDefinitions, getSector1ProductionDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import {
  createDefaultNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
} from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import {
  STILLPOINT_CORE_IDS,
  STILLPOINT_MANIFESTATION_ID,
  STILLPOINT_SUPPORT_IDS,
  STILLPOINT_VERDICT_ID,
} from '../types/stillpoint';
import { usablePlayerAp as usableAp } from './nineStrain/stillpointEngine';
import { COUNTERFATE_CORE_IDS } from '../types/counterfate';
import { eliteStrainIntelLine, elitePreviewRevealed } from './nineStrain/acquisitionDirector';
import { formatScannerNodeIntel } from './descentEngine';
import type { IncursionNode } from '../types/game';

console.log('Stage C.1 — Stillpoint / Fleeting Stillness');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getSector1ProductionDefinitions().length, 27);
assert.equal(live.filter((row) => row.strainId === 'STILLPOINT' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);

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

function chargeNative(runtime: ReturnType<typeof rt>, n = 1) {
  for (let i = 0; i < n; i += 1) {
    runtime.runTurnStart();
    runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 2 });
  }
}

{
  assert.equal(usableAp({ remainingAp: 3 }), 3);
  assert.equal(usableAp({ remainingAp: 3, apDisabledByEnemy: true }), 0);
  assert.equal(usableAp({ remainingAp: 3, apRemovedByEnemy: true }), 0);
  assert.equal(usableAp({ remainingAp: 3, reservedAp: 1 }), 2);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  const preview = runtime.previewEndTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  assert.equal(preview.gain, true);
  assert.equal(runtime.getState().stillpoint.nativeStillness, 0);
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  assert.equal(runtime.getState().stillpoint.nativeStillness, 1);
  assert.ok(runtime.events().some((row) => row.type === 'NATIVE_STILLNESS_GAINED'));
}

{
  const reasons = ['FORCED', 'STUN', 'TIMEOUT', 'DEFEAT', 'INVALIDATION', 'SCRIPT', 'ENCOUNTER_COMPLETE', 'UI_OPEN'] as const;
  for (const reason of reasons) {
    const runtime = rt();
    grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
    runtime.runTurnStart();
    runtime.endPlayerTurn({ reason, usableAp: 3 });
    assert.equal(runtime.getState().stillpoint.nativeStillness, 0, reason);
    assert.equal(runtime.events().some((row) => row.type === 'NATIVE_STILLNESS_GAINED'), false, reason);
  }
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  assert.equal(runtime.getState().stillpoint.nativeStillness, 2);
  const before = runtime.events().filter((row) => row.type === 'NATIVE_STILLNESS_GAINED').length;
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 2 });
  assert.equal(runtime.getState().stillpoint.nativeStillness, 2);
  assert.equal(runtime.events().filter((row) => row.type === 'NATIVE_STILLNESS_GAINED').length, before);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  assert.equal(runtime.grantFleetingStillness('TEST_FLEETING'), true);
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'fleeting-now',
    actionSurface: 'WEAPON',
  }));
  assert.equal(runtime.getState().stillpoint.focusedRoot?.chargeSource, 'FLEETING');
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  assert.equal(runtime.grantFleetingStillness('TEST_FLEETING'), true);
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 0 });
  runtime.runTurnStart();
  const fleeting = runtime.getState().stillpoint.fleeting;
  assert.ok(fleeting && !fleeting.spent);
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 0 });
  assert.equal(runtime.getState().stillpoint.fleeting, null);
}

const FAMILIES = CANONICAL_WEAPON_FAMILY_IDS;
assert.equal(FAMILIES.length, 9);

{
  let fixture = 0;
  for (const family of FAMILIES) {
    for (const core of Object.values(STILLPOINT_CORE_IDS)) {
      const runtime = rt();
      grant(runtime, core);
      chargeNative(runtime, 1);
      runtime.runTurnStart();
      if (core === STILLPOINT_CORE_IDS.QUIET_REFLEX) {
        const classId = family.startsWith('hex') ? 'HEX_SHOT' : family.startsWith('envoy') ? 'ENVOY' : 'AEGIS';
        runtime.resolveInstinct(classId === 'HEX_SHOT'
          ? { classId, reloadQuality: 'CLEAN' }
          : classId === 'ENVOY'
            ? { classId, riftPreventedDamage: 6, riftWouldReachHp: 10 }
            : { classId, wraithParrySuccess: true, parryAttempted: true });
      } else if (core === STILLPOINT_CORE_IDS.SILENT_RESERVOIR) {
        runtime.commitRootAction(weaponFamilyExecutionContext(family, {
          rootActionId: `sr-${family}`,
          actionSurface: 'WEAPON',
        }));
        runtime.resolveCurrent(family.startsWith('hex')
          ? { classId: 'HEX_SHOT', ammoSpent: true, selectedAmmoType: 'STANDARD' }
          : { classId: family.startsWith('envoy') ? 'ENVOY' : 'AEGIS', ordinarySpend: true, actualSpent: 4 });
      } else if (core === STILLPOINT_CORE_IDS.PATIENT_INVOCATION) {
        const preview = runtime.previewRootAction(weaponFamilyExecutionContext(family, {
          rootActionId: `pi-${family}`,
          actionSurface: 'TECHNIQUE',
          authoredCosts: { ap: 2 },
          actualCostsPaid: { ap: 2 },
          startsCooldown: true,
        }));
        assert.equal(preview.stillpoint.focusedRoot?.consumed || preview.events.some((row) => row.type === 'ROOT_ACTION_COMMITTED'), true);
        runtime.commitRootAction(weaponFamilyExecutionContext(family, {
          rootActionId: `pi-e-${family}`,
          actionSurface: 'TECHNIQUE',
          authoredCosts: { ap: 2 },
          actualCostsPaid: { ap: 2 },
          startsCooldown: true,
        }));
      } else {
        runtime.commitRootAction(weaponFamilyExecutionContext(family, {
          rootActionId: `sf-${family}`,
          actionSurface: 'WEAPON',
          nativeByTarget: [{
            targetId: 'enemy-a',
            hits: 2,
            misses: 0,
            crits: 0,
            nativeDirectDamage: 40,
            defenseDamage: 0,
            defenseBreaks: 0,
            fractures: 0,
            statusesApplied: 0,
            killed: false,
            healingDealt: 0,
            movement: 0,
            kineticNativeDamage: 40,
            occultNativeDamage: 0,
          }],
          totalNativeDirectDamage: 40,
        }));
      }
      fixture += 1;
    }
  }
  assert.equal(fixture, 36);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    committed: false,
    actionSurface: 'WEAPON',
  }));
  assert.equal(runtime.getState().stillpoint.nativeStillness, 0);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, STILLPOINT_CORE_IDS.SILENT_RESERVOIR);
  chargeNative(runtime, 1);
  runtime.runTurnStart();
  const before = runtime.getState().stillpoint.nativeStillness;
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'multi-surface',
    actionSurface: 'WEAPON',
  }));
  runtime.resolveCurrent({ classId: 'AEGIS', ordinarySpend: true, actualSpent: 4 });
  assert.equal(runtime.getState().stillpoint.nativeStillness, before - 1);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  chargeNative(runtime, 1);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'deriv',
    classification: 'DERIVATIVE',
    actionSurface: 'WEAPON',
    procDepth: 1,
  }));
  assert.equal(runtime.getState().stillpoint.nativeStillness, 1);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.setCombatDepth(1);
  chargeNative(runtime, 1);
  runtime.runTurnStart();
  runtime.syncHostileIntents([hostileSnapshotInput({
    unitId: 'enemy-a',
    intentKind: 'STRIKE',
    countdown: 1,
    hostileTurnOrder: 0,
    hp: 100,
  })]);
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'cap',
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'enemy-a',
      hits: 1,
      misses: 0,
      crits: 0,
      nativeDirectDamage: 80,
      defenseDamage: 0,
      defenseBreaks: 0,
      fractures: 0,
      statusesApplied: 0,
      killed: false,
      healingDealt: 0,
      movement: 0,
      kineticNativeDamage: 80,
      occultNativeDamage: 0,
    }],
    totalNativeDirectDamage: 80,
  }));
  assert.equal(runtime.metric('condensed_impact'), 12);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  chargeNative(runtime, 1);
  runtime.runTurnStart();
  runtime.syncHostileIntents([hostileSnapshotInput({
    unitId: 'enemy-a',
    intentKind: 'STRIKE',
    countdown: 1,
    hostileTurnOrder: 0,
    hp: 0,
    alive: false,
  })]);
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'dead-primary',
    actionSurface: 'WEAPON',
    lockedTargetIds: ['enemy-a'],
  }));
  assert.equal(runtime.metric('condensed_impact'), 0);
}

{
  const mappings: Array<{ classId: 'AEGIS' | 'HEX_SHOT' | 'ENVOY'; input: Parameters<ReturnType<typeof rt>['resolveInstinct']>[0]; expect: string }> = [
    { classId: 'AEGIS', input: { classId: 'AEGIS', voidWardPrevented: true, parryAttempted: true }, expect: 'CLEAN' },
    { classId: 'AEGIS', input: { classId: 'AEGIS', wraithParrySuccess: true, parryAttempted: true }, expect: 'PERFECT' },
    { classId: 'AEGIS', input: { classId: 'AEGIS', perfectParry: true, parryAttempted: true, riftPreventedDamage: 10 }, expect: 'PERFECT' },
    { classId: 'AEGIS', input: { classId: 'AEGIS', parryAttempted: true }, expect: 'FAILED' },
    { classId: 'HEX_SHOT', input: { classId: 'HEX_SHOT', reloadQuality: 'CLEAN' }, expect: 'PERFECT' },
    { classId: 'HEX_SHOT', input: { classId: 'HEX_SHOT', reloadQuality: 'PERFECT', primaryNumeric: 4 }, expect: 'PERFECT' },
    { classId: 'HEX_SHOT', input: { classId: 'HEX_SHOT', reloadQuality: 'FAILED' }, expect: 'FAILED' },
    { classId: 'ENVOY', input: { classId: 'ENVOY', riftPreventedDamage: 3, riftWouldReachHp: 10 }, expect: 'CLEAN' },
    { classId: 'ENVOY', input: { classId: 'ENVOY', riftPreventedDamage: 6, riftWouldReachHp: 10 }, expect: 'PERFECT' },
    { classId: 'ENVOY', input: { classId: 'ENVOY', riftPreventedDamage: 10, riftWouldReachHp: 10, primaryNumeric: 10 }, expect: 'PERFECT' },
    { classId: 'ENVOY', input: { classId: 'ENVOY', riftPreventedDamage: 0, riftWouldReachHp: 10 }, expect: 'FAILED' },
  ];
  for (const row of mappings) {
    const runtime = rt();
    grant(runtime, STILLPOINT_CORE_IDS.QUIET_REFLEX);
    chargeNative(runtime, 1);
    runtime.runTurnStart();
    const result = runtime.resolveInstinct(row.input);
    assert.equal(result.grade, row.expect, `${row.classId} ${JSON.stringify(row.input)}`);
  }
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.QUIET_REFLEX);
  chargeNative(runtime, 2);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', wraithParrySuccess: true, parryAttempted: true });
  const second = runtime.resolveInstinct({ classId: 'AEGIS', voidWardPrevented: true, parryAttempted: true });
  assert.equal(second.grade, 'STANDARD');
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.SILENT_RESERVOIR);
  chargeNative(runtime, 1);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'gain-root',
    actionSurface: 'WEAPON',
  }));
  runtime.resolveCurrent({ classId: 'AEGIS', ordinaryGain: true, actualGained: 8 });
  assert.equal(runtime.metric('silent_reservoir_gain'), 4);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_SUPPORT_IDS.SHELTERED_PAUSE);
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 1 });
  assert.equal(runtime.metric('sheltered_pause_barrier'), 8);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'FORCED', usableAp: 3 });
  assert.equal(runtime.getState().stillpoint.lastBarrierGranted, 0);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, STILLPOINT_SUPPORT_IDS.RETURN_STROKE);
  chargeNative(runtime, 1);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'kill',
    actionSurface: 'WEAPON',
    kills: 1,
    nativeByTarget: [{
      targetId: 'enemy-a',
      hits: 1,
      misses: 0,
      crits: 0,
      nativeDirectDamage: 12,
      defenseDamage: 0,
      defenseBreaks: 0,
      fractures: 0,
      statusesApplied: 0,
      killed: true,
      healingDealt: 0,
      movement: 0,
    }],
  }));
  assert.equal(runtime.metric('ap_refund'), 1);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  grant(runtime, STILLPOINT_MANIFESTATION_ID);
  chargeNative(runtime, 2);
  runtime.runTurnStart();
  assert.equal(runtime.getState().stillpoint.stormFreeFocusAvailable, true);
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'storm-1',
    actionSurface: 'WEAPON',
  }));
  assert.equal(runtime.getState().stillpoint.stormFreeFocusAvailable, false);
  assert.equal(runtime.getState().stillpoint.nativeStillness, 2);
}

{
  for (const family of FAMILIES) {
    const runtime = rt();
    grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
    grant(runtime, STILLPOINT_SUPPORT_IDS.RETURN_STROKE);
    grant(runtime, STILLPOINT_MANIFESTATION_ID);
    chargeNative(runtime, 2);
    runtime.runTurnStart();
    runtime.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `storm-${family}`,
      actionSurface: 'WEAPON',
      kills: 1,
      nativeByTarget: [{
        targetId: 'enemy-a',
        hits: 1,
        misses: 0,
        crits: 0,
        nativeDirectDamage: 10,
        defenseDamage: 0,
        defenseBreaks: 0,
        fractures: 0,
        statusesApplied: 0,
        killed: true,
        healingDealt: 0,
        movement: 0,
      }],
    }));
    assert.ok(runtime.getState().stillpoint.focusedRoot);
  }
}

{
  for (const family of FAMILIES) {
    assert.equal(canFireWeaponUltimate(family), true, family);
    const runtime = rt();
    grant(runtime, STILLPOINT_VERDICT_ID, { premium: true, depth: 2 });
    chargeNative(runtime, 2);
    runtime.runTurnStart();
    runtime.syncHostileIntents([
      hostileSnapshotInput({
        unitId: 'tele',
        intentKind: 'WINDUP',
        countdown: 2,
        hostileTurnOrder: 0,
      }),
      hostileSnapshotInput({
        unitId: 'now',
        intentKind: 'STRIKE',
        countdown: 0,
        hostileTurnOrder: 1,
      }),
      hostileSnapshotInput({
        unitId: 'boss',
        intentKind: 'PHASE',
        countdown: 3,
        hostileTurnOrder: 2,
        protectedPhase: true,
      }),
    ]);
    const before = runtime.hostileIntents();
    runtime.commitRootAction(weaponFamilyExecutionContext(family, {
      rootActionId: `zh-${family}`,
      sourceKind: 'ULTIMATE',
      actionSurface: 'ULTIMATE',
      nativeByTarget: [{
        targetId: 'tele',
        hits: 1,
        misses: 0,
        crits: 0,
        nativeDirectDamage: 50,
        defenseDamage: 0,
        defenseBreaks: 0,
        fractures: 0,
        statusesApplied: 0,
        killed: false,
        healingDealt: 0,
        movement: 0,
      }],
      totalNativeDirectDamage: 50,
    }));
    assert.equal(runtime.getState().stillpoint.nativeStillness, 0);
    assert.equal(runtime.metric('zero_hour_charges'), 2);
    runtime.dispatch({
      type: 'ENEMY_CYCLE_STARTED',
      sourceId: 'turn',
      lineage: [],
      rootActionId: null,
      targetId: null,
      payload: {},
    });
    const after = runtime.hostileIntents();
    const tele = after.find((row) => row.unitId === 'tele');
    const immediate = after.find((row) => row.unitId === 'now');
    const boss = after.find((row) => row.unitId === 'boss');
    assert.equal(tele?.countdown, 2, family);
    assert.equal(immediate?.countdown, 0, family);
    assert.equal(boss?.countdown, 2, family);
    assert.equal(tele?.intentInstanceId, before.find((row) => row.unitId === 'tele')?.intentInstanceId);
  }
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.grantFixture(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  chargeNative(runtime, 1);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', { actionSurface: 'WEAPON', rootActionId: 'mix' }));
  assert.equal(runtime.getState().stillpoint.nativeStillness, 0);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  chargeNative(runtime, 1);
  runtime.runTurnStart();
  const snap = runtime.serialize();
  const resumed = rt();
  resumed.hydrate(snap);
  assert.equal(resumed.getState().stillpoint.nativeStillness, 1);
  resumed.hydrate(resumed.serialize());
  assert.equal(resumed.getState().stillpoint.nativeStillness, 1);
}

{
  const legacy = hydrateNineStrainRuntimeState({
    schemaVersion: 6,
    boonSystemMode: 'NINE_STRAIN',
    cores: { ARMAMENT: COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, DISCIPLINE: null, INSTINCT: null, CURRENT: null },
  });
  assert.equal(legacy.stillpoint.nativeStillness, 0);
  assert.equal(legacy.schemaVersion, 15);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.completeCombat();
  assert.equal(runtime.getState().stillpoint.nativeStillness, 0);
}

{
  assert.equal(elitePreviewRevealed('RELIABLE'), true);
  assert.equal(eliteStrainIntelLine({
    nodeType: 'ELITE_COMBAT',
    certainty: 'RELIABLE',
    nodeId: 'e1',
    seed: 's',
  })?.startsWith('> IDENTIFIED STRAIN:'), true);
  assert.equal(eliteStrainIntelLine({
    nodeType: 'ELITE_COMBAT',
    certainty: 'DEGRADED',
    nodeId: 'e1',
    seed: 's',
  }), null);
  const node: IncursionNode = {
    id: 'elite-node',
    encounterIndex: 2,
    index: 2,
    encounterType: 'COMBAT',
    type: 'ELITE_COMBAT',
    label: 'VECTOR 2',
    isCompleted: false,
    scannerLabelCertainty: 'RELIABLE',
  };
  const lines = formatScannerNodeIntel(node, null, 0, null, null);
  assert.ok(lines.some((line) => line.startsWith('> IDENTIFIED STRAIN:')));
  const hidden: IncursionNode = { ...node, scannerLabelCertainty: 'STRANGE', scannerLabelCorrupt: true, scannerStrangeLabel: 'WANE SIGNAL' };
  const hiddenLines = formatScannerNodeIntel(hidden, null, 0, null, null);
  assert.equal(hiddenLines.some((line) => line.includes('IDENTIFIED STRAIN')), false);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  const preview = runtime.previewEndTurn({ reason: 'VOLUNTARY', usableAp: 2 });
  assert.equal(preview.gain, true);
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 2 });
  assert.equal(runtime.getState().stillpoint.nativeStillness, 1);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.noteHostileApDisruption();
  assert.equal(runtime.previewEndTurn({ reason: 'VOLUNTARY', usableAp: 2 }).gain, false);
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 2 });
  assert.equal(runtime.getState().stillpoint.nativeStillness, 0);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 3, apRemovedByEnemy: true });
  assert.equal(runtime.getState().stillpoint.nativeStillness, 0);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: usableAp({ remainingAp: 3, reservedAp: 1 }) });
  assert.equal(runtime.getState().stillpoint.nativeStillness, 1);
}

{
  const runtime = rt();
  grant(runtime, STILLPOINT_CORE_IDS.STORED_FORCE);
  runtime.runTurnStart();
  runtime.noteHostileApDisruption();
  const snap = runtime.serialize();
  assert.equal(snap.stillpoint.hostileApDisruptionThisPlayerTurn, true);
  const resumed = rt();
  resumed.hydrate(snap);
  assert.equal(resumed.getState().stillpoint.hostileApDisruptionThisPlayerTurn, true);
  assert.equal(resumed.previewEndTurn({ reason: 'VOLUNTARY', usableAp: 2 }).gain, false);
  resumed.runTurnStart();
  assert.equal(resumed.getState().stillpoint.hostileApDisruptionThisPlayerTurn, false);
  assert.equal(resumed.previewEndTurn({ reason: 'VOLUNTARY', usableAp: 2 }).gain, true);
  resumed.endPlayerTurn({ reason: 'VOLUNTARY', usableAp: 2 });
  assert.equal(resumed.getState().stillpoint.nativeStillness, 1);
}

console.log('Stage C.1 — Stillpoint passed');
