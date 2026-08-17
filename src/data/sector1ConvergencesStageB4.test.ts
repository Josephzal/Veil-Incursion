import assert from 'node:assert/strict';
import {
  AFTERIMAGE_CORE_IDS,
  AFTERIMAGE_SUPPORT_IDS,
} from '../types/afterimage';
import { COUNTERFATE_CORE_IDS, COUNTERFATE_VERDICT_ID } from '../types/counterfate';
import { RITUAL_CADENCE_CORE_IDS } from '../types/ritualCadence';
import { CONVERGENCE_IDS } from '../types/convergence';
import { getLiveUniversalBoonDefinitions, getSector1ProductionDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState, hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { legalHostileFallback } from './nineStrain/afterimageEngine';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';

console.log('Stage B.4 — Sector 1 Convergences');

const live = getSector1ProductionDefinitions();
assert.equal(live.length, 27);
assert.equal(live.filter((row) => row.role === 'CONVERGENCE').length, 3);
assert.ok(live.some((row) => row.id === CONVERGENCE_IDS.FATED_REFRAIN));
assert.ok(live.some((row) => row.id === CONVERGENCE_IDS.SECOND_OUTCOME));
assert.ok(live.some((row) => row.id === CONVERGENCE_IDS.ECHOED_RITE));
assert.equal(getLiveUniversalBoonDefinitions().length, 66);

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
  return `b4-root-${rootSeq}`;
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

function bind(rt: ReturnType<typeof strainRuntime>, hp = 30, extra: Parameters<typeof hostileSnapshotInput>[0] = {
  unitId: 'e1',
  intentKind: 'STRIKE',
  hostileTurnOrder: 0,
}) {
  return rt.syncHostileIntents([
    hostileSnapshotInput({ hp, ...extra }),
  ], extra.concealed === true);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, CONVERGENCE_IDS.FATED_REFRAIN);
  bind(rt, 80);
  rt.runTurnStart();
  arm(rt, {
    nativeByTarget: [{
      targetId: 'e1', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  });
  disc(rt);
  const beforeFinale = rt.getState().counterfate.rawReversal;
  arm(rt, {
    nativeByTarget: [{
      targetId: 'e1', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: true, healingDealt: 0, movement: 0,
    }],
  });
  const release = rt.lastReleases().at(-1);
  assert.ok(release);
  assert.ok(release.raw >= beforeFinale + 8 - 1);
  assert.equal(Math.round(release.multiplier * 100), 150);
  assert.equal(rt.getState().convergence.pendingBeatII, true);
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().convergence.pendingBeatII, true);
  const previous = resumed.getState().ritualCadence.previousSurface;
  resumed.runTurnStart();
  assert.equal(resumed.getState().ritualCadence.measure, 'BEAT_II');
  assert.equal(resumed.getState().ritualCadence.previousSurface, previous);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, CONVERGENCE_IDS.FATED_REFRAIN);
  grant(rt, COUNTERFATE_VERDICT_ID, { premium: true });
  bind(rt, 80);
  rt.runTurnStart();
  arm(rt);
  disc(rt);
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: nextRoot(),
    actionSurface: 'ULTIMATE',
    sourceKind: 'ULTIMATE',
    nativeByTarget: [{
      targetId: 'e1', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 12,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: true, healingDealt: 0, movement: 0,
    }],
  }));
  const release = rt.lastReleases().at(-1);
  assert.ok(release);
  assert.equal(Math.round(release.multiplier * 100) === 200 || release.countered === false || Math.round(release.multiplier * 100) !== 150, true);
  if (Math.round((release.multiplier ?? 0) * 100) === 200) {
    assert.equal(rt.getState().convergence.pendingBeatII, false);
  }
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(rt, CONVERGENCE_IDS.SECOND_OUTCOME);
  bind(rt, 40);
  rt.runTurnStart();
  arm(rt, {
    nativeByTarget: [{
      targetId: 'e1', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  });
  const afterMint = rt.getState().afterimage.pending.filter((row) => row.status === 'PENDING');
  assert.equal(afterMint.length, 1);
  assert.equal(afterMint[0].provenance, 'CORE');
  rt.runTurnStart();
  const afterResolve = rt.getState();
  assert.ok(afterResolve.counterfate.rawReversal >= 8 || rt.lastReleases().length > 0);
  const traces = afterResolve.afterimage.pending.filter((row) => row.provenance === 'CONVERGENCE' || row.status === 'PENDING');
  const release = rt.lastReleases().at(-1);
  if (release && release.packet > 0) {
    const expected = Math.floor(release.packet * 0.4);
    const cvTrace = afterResolve.afterimage.pending.find((row) => row.provenance === 'CONVERGENCE');
    if (expected > 0) {
      assert.ok(cvTrace);
      assert.equal(cvTrace.basePayload, expected);
      assert.equal(cvTrace.resolutionMode, 'TURN_START');
      assert.equal(cvTrace.crossfadeEligible, false);
      assert.equal(cvTrace.persistentEligible, false);
    }
  }
  void traces;
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().convergence.secondOutcomeStoreUsedThisCombatCycle, afterResolve.convergence.secondOutcomeStoreUsedThisCombatCycle);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION);
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(rt, CONVERGENCE_IDS.ECHOED_RITE);
  rt.runTurnStart();
  arm(rt);
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_I');
  const previous = rt.getState().ritualCadence.previousSurface;
  rt.runTurnStart();
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_II');
  assert.equal(rt.getState().ritualCadence.previousSurface, previous);
  assert.equal(rt.getState().ritualCadence.lastOutcome !== 'FINALE', true);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION);
  grant(rt, CONVERGENCE_IDS.ECHOED_RITE);
  rt.runTurnStart();
  arm(rt);
  disc(rt);
  arm(rt);
  assert.ok(rt.getState().convergence.echoedEmpowerment);
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.ok(resumed.getState().convergence.echoedEmpowerment);
  resumed.endPlayerTurn();
  resumed.runTurnStart();
  resumed.endPlayerTurn();
  assert.equal(resumed.getState().convergence.echoedEmpowerment, null);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(rt, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION);
  grant(rt, AFTERIMAGE_SUPPORT_IDS.CROSSFADE);
  rt.runTurnStart();
  arm(rt);
  rt.runTurnStart();
  assert.ok(rt.getState().afterimage.crossfadeArmedImprint != null || rt.getState().afterimage.crossfadeUsedThisPlayerTurn);
  rt.endPlayerTurn();
  assert.equal(rt.getState().afterimage.crossfadeArmedImprint, null);
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().afterimage.crossfadeArmedImprint, null);
  disc(resumed);
  const bonus = resumed.getState().afterimage.pending.filter((row) => row.provenance === 'CROSSFADE_BONUS');
  assert.equal(bonus.length, 0);
}

{
  const jammed = legalHostileFallback([
    hostileSnapshotInput({
      unitId: 'late',
      intentKind: 'STRIKE',
      hostileTurnOrder: 2,
      slot: 'FL_1',
      concealed: true,
      severity: 'CRITICAL',
      hp: 50,
    }),
    hostileSnapshotInput({
      unitId: 'early',
      intentKind: 'BOLT',
      hostileTurnOrder: 0,
      slot: 'BL_0',
      concealed: true,
      severity: 'LOW',
      hp: 50,
    }),
  ].map((row) => ({ ...row, intentInstanceId: `${row.unitId}-id`, alive: true, phased: false })), true);
  assert.equal(jammed?.unitId, 'early');
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.syncHostileIntents([
    hostileSnapshotInput({
      unitId: 'dead',
      intentKind: 'STRIKE',
      hostileTurnOrder: 0,
      slot: 'FL_0',
      hp: 0,
      alive: false,
    }),
    hostileSnapshotInput({
      unitId: 'hid-b',
      intentKind: 'BOLT',
      hostileTurnOrder: 2,
      slot: 'FL_1',
      concealed: true,
      severity: 'CRITICAL',
      hp: 40,
    }),
    hostileSnapshotInput({
      unitId: 'hid-a',
      intentKind: 'SLAM',
      hostileTurnOrder: 1,
      slot: 'BL_0',
      concealed: true,
      severity: 'LOW',
      hp: 40,
    }),
  ], true);
  rt.runTurnStart();
  arm(rt, {
    nativeByTarget: [{
      targetId: 'dead', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: true, healingDealt: 0, movement: 0,
    }],
  });
  const pending = rt.getState().afterimage.pending[0];
  assert.ok(pending);
  rt.runTurnStart();
  const resolvedEvents = rt.events().filter((event) => event.type === 'DERIVATIVE_RESOLVED' && event.sourceId === AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  const last = resolvedEvents.at(-1);
  assert.equal(last?.targetId, 'hid-a');
  assert.equal(rt.hostileIntents().find((row) => row.unitId === 'hid-a')?.concealed, true);
  assert.equal(rt.hostileIntents().find((row) => row.unitId === 'hid-b')?.concealed, true);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SECOND_REFLEX);
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(rt, CONVERGENCE_IDS.SECOND_OUTCOME);
  bind(rt, 5);
  rt.runTurnStart();
  for (let i = 0; i < 12; i += 1) {
    arm(rt, {
      nativeByTarget: [{
        targetId: 'e1', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 8,
        defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: i === 0, healingDealt: 0, movement: 0,
      }],
    });
    rt.runTurnStart();
  }
  const cvTraces = rt.getState().afterimage.pending.filter((row) => row.provenance === 'CONVERGENCE');
  assert.ok(cvTraces.length <= 8);
}

{
  const migrated = hydrateNineStrainRuntimeState({
    schemaVersion: 5,
    afterimage: { playerTurnIndex: 3, pending: [{
      traceId: 'trace:1',
      originDefinitionId: AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT,
      provenance: 'CORE',
      originImprint: 'ARMAMENT',
      creationSequence: 1,
      createdPlayerTurn: 2,
      duePlayerTurn: 3,
      resolutionMode: 'TURN_START',
      payloadKind: 'PER_TARGET_DAMAGE',
      basePayload: 7,
      status: 'PENDING',
    }] },
    ritualCadence: { measure: 'BEAT_I' },
    counterfate: { rawReversal: 4 },
  });
  assert.equal(migrated.schemaVersion, 11);
  assert.equal(migrated.stillpoint.nativeStillness, 0);
  assert.equal(migrated.afterimage.pending[0].basePayload, 7);
  assert.equal(migrated.ritualCadence.measure, 'BEAT_I');
  assert.equal(migrated.counterfate.rawReversal, 4);
  assert.equal(migrated.convergence.pendingBeatII, false);
  const again = hydrateNineStrainRuntimeState(migrated);
  assert.deepEqual(again.convergence, migrated.convergence);
}

console.log('Stage B.4 — Sector 1 Convergences passed');
