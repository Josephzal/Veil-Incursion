import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AFTERIMAGE_CORE_IDS,
  AFTERIMAGE_MANIFESTATION_ID,
  AFTERIMAGE_SUPPORT_IDS,
  AFTERIMAGE_VERDICT_ID,
} from '../types/afterimage';
import { COUNTERFATE_CORE_IDS, COUNTERFATE_VERDICT_ID } from '../types/counterfate';
import {
  RITUAL_CADENCE_CORE_IDS,
  RITUAL_CADENCE_SUPPORT_IDS,
  RITUAL_CADENCE_VERDICT_ID,
} from '../types/ritualCadence';
import { getSector1ProductionDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState, hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { WEAPON_ULTIMATE_BY_FAMILY, canFireWeaponUltimate } from './weaponUltimateRegistry';
import { NINE_PERMANENT_WEAPON_FAMILIES } from './nineStrain/classWeaponAdapter';
import { createDefaultActiveIncursionState } from '../types/game';
import { hydrateNineStrainIncursionFields } from './nineStrainRunState';

console.log('Stage B.3 — Afterimage vertical slice');

const live = getSector1ProductionDefinitions();
assert.equal(live.length, 27);
assert.equal(live.filter((row) => row.strainId === 'AFTERIMAGE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'AFTERIMAGE' && row.role === 'CORE').length, 4);
assert.equal(live.filter((row) => row.strainId === 'AFTERIMAGE' && row.role === 'SUPPORT').length, 2);
assert.equal(live.filter((row) => row.strainId === 'AFTERIMAGE' && row.role === 'MANIFESTATION').length, 1);
assert.equal(live.filter((row) => row.strainId === 'AFTERIMAGE' && row.role === 'VERDICT').length, 1);
assert.equal(live.filter((row) => row.role === 'CONVERGENCE').length, 3);

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
  return `ai-root-${rootSeq}`;
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

function pending(rt: ReturnType<typeof strainRuntime>) {
  return rt.getState().afterimage.pending.filter((row) => row.status === 'PENDING' || row.status === 'READY');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  arm(rt);
  rt.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true });
  assert.equal(rt.getState().ritualCadence.measure, 'BEAT_II');
  arm(rt);
  assert.equal(rt.getState().ritualCadence.lastOutcome, 'FINALE');
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  grant(rt, RITUAL_CADENCE_CORE_IDS.HELD_RESONANCE);
  arm(rt);
  disc(rt);
  arm(rt, { primaryResource: { gained: 0, spent: 8, preserved: 0, converted: 0 } });
  assert.equal(rt.events().some((event) => event.type === 'CURRENT_PRESERVED'), false);
  disc(rt);
  arm(rt);
  disc(rt, { primaryResource: { gained: 0, spent: 9, preserved: 0, converted: 0 }, actualCostsPaid: { ap: 2, reserve: 9 } });
  assert.equal(rt.events().some((event) => event.type === 'CURRENT_PRESERVED' && event.payload.preserved === 9), true);
}

for (const familyId of NINE_PERMANENT_WEAPON_FAMILIES) {
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.runTurnStart();
  const preview = rt.previewRootAction(weaponFamilyExecutionContext(familyId, {
    rootActionId: nextRoot(),
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  rt.commitRootAction(weaponFamilyExecutionContext(familyId, {
    rootActionId: nextRoot(),
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const traces = pending(rt);
  assert.equal(traces.length, 1, familyId);
  assert.equal(traces[0].basePayload, 3, familyId);
  assert.equal(preview.afterimage.pending.some((row) => row.basePayload === 3), true, familyId);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('hex-carbine', {
    rootActionId: nextRoot(),
    actionSurface: 'WEAPON',
    nativeByTarget: [
      { targetId: 'a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10, defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0 },
      { targetId: 'missed', hits: 0, misses: 1, crits: 0, nativeDirectDamage: 0, defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0 },
    ],
  }));
  const map = pending(rt)[0].targetAndDamageMap;
  assert.equal(map.length, 1);
  assert.equal(map[0].originalTargetId, 'a');
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext('aegis-paired-blades', {
    rootActionId: nextRoot(),
    actionSurface: 'WEAPON',
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      kineticNativeDamage: 10, occultNativeDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  const row = pending(rt)[0].targetAndDamageMap[0];
  assert.equal(row.nativeDirectDamage, 7);
  assert.equal(row.kineticNativeDamage + row.occultNativeDamage, 7);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION);
  rt.runTurnStart();
  disc(rt, { authoredCosts: { ap: 2 }, actualCostsPaid: { ap: 2 } });
  assert.equal(pending(rt)[0].basePayload, 11);
  assert.equal(pending(rt)[0].payloadKind, 'OCCULT_ACTION_BUDGET');
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION);
  rt.runTurnStart();
  disc(rt, { lingeringRole: 'UTILITY', lockedTargetIds: [], nativeByTarget: [], totalNativeDirectDamage: 0 });
  assert.equal(pending(rt)[0].payloadKind, 'BARRIER');
  assert.equal(pending(rt)[0].basePayload, 11);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.REFLEX_REMNANT);
  rt.runTurnStart();
  rt.resolveInstinct({ classId: 'AEGIS', wraithParrySuccess: true, parryAttempted: true });
  assert.equal(pending(rt)[0].basePayload, 10);
  assert.equal(pending(rt)[0].resolutionMode, 'NEXT_COMMITTED_ACTION');
  rt.runTurnStart();
  assert.equal(rt.getState().afterimage.pending.some((row) => row.status === 'READY'), true);
  arm(rt);
  assert.equal(rt.events().some((event) => event.type === 'DERIVATIVE_RESOLVED' && event.payload.delayedOrigin === true), true);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE);
  rt.runTurnStart();
  rt.resolveCurrent({ classId: 'ENVOY', ordinaryGain: true, actualGained: 20 });
  assert.equal(pending(rt)[0].payloadKind, 'FLUX_RESTORE');
  assert.equal(pending(rt)[0].basePayload, 8);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE);
  rt.runTurnStart();
  rt.resolveCurrent({ classId: 'AEGIS', ordinaryGain: true, actualGained: 20 });
  assert.equal(pending(rt)[0].payloadKind, 'RESERVE_RESTORE');
  assert.equal(pending(rt)[0].basePayload, 8);
  rt.runTurnStart();
  assert.equal(rt.events().some((event) => event.type === 'CURRENT_GAINED' && event.payload.delayedRestore === true), false);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE);
  rt.runTurnStart();
  rt.resolveCurrent({ classId: 'HEX_SHOT', ordinaryGain: true, reloadRestoredRounds: true, reloadRestoredCount: 3, selectedAmmoType: 'hollow' });
  assert.equal(pending(rt)[0].payloadKind, 'MATCHING_AMMO');
  assert.equal(pending(rt)[0].ammoType, 'hollow');
  rt.setAfterimageCapacity({ ammo: 0 });
  rt.runTurnStart();
  assert.equal(rt.events().some((event) => event.payload.restored === 0 && event.payload.ammoType === 'hollow'), true);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE);
  rt.runTurnStart();
  rt.resolveCurrent({ classId: 'HEX_SHOT', ordinaryGain: true, reloadRestoredRounds: true, reloadRestoredCount: 2, selectedAmmoType: 'hollow' });
  assert.equal(pending(rt).length, 0);
  rt.resolveCurrent({ classId: 'HEX_SHOT', ordinaryGain: true, ultimateOwnedRefill: true, reloadRestoredCount: 6, selectedAmmoType: 'hollow' });
  assert.equal(pending(rt).length, 0);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(rt, AFTERIMAGE_SUPPORT_IDS.DEFERRED_EXPOSURE);
  rt.runTurnStart();
  arm(rt);
  rt.runTurnStart();
  assert.equal(rt.getState().afterimage.deferredChoicePending, true);
  const option = rt.deferredExposureOptions()[0];
  const saved = rt.serialize();
  rt.confirmDeferredExposure(option.traceId);
  assert.equal(rt.getState().afterimage.pending[0].delayCount, 1);
  assert.equal(rt.getState().afterimage.pending[0].duePlayerTurn, option.delayedDue);
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().afterimage.deferredChoicePending, true);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(rt, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION);
  grant(rt, AFTERIMAGE_SUPPORT_IDS.CROSSFADE);
  rt.runTurnStart();
  arm(rt);
  rt.runTurnStart();
  assert.equal(rt.getState().afterimage.crossfadeArmedImprint, 'ARMAMENT');
  disc(rt);
  const bonus = pending(rt).find((row) => row.provenance === 'CROSSFADE_BONUS');
  assert.ok(bonus);
  assert.equal(bonus.originImprint, 'DISCIPLINE');
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.setCombatDepth(2);
  grant(rt, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION);
  grant(rt, AFTERIMAGE_MANIFESTATION_ID, { depth: 2 });
  rt.runTurnStart();
  arm(rt);
  rt.runTurnStart();
  const secondary = pending(rt).find((row) => row.provenance === 'PERSISTENT_SECONDARY');
  assert.ok(secondary);
  assert.equal(secondary.basePayload, 1);
}

for (const familyId of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(canFireWeaponUltimate(familyId), true, familyId);
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_VERDICT_ID, { premium: true, family: familyId });
  rt.runTurnStart();
  rt.commitRootAction(weaponFamilyExecutionContext(familyId, {
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    actionId: WEAPON_ULTIMATE_BY_FAMILY[familyId].id,
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  }));
  assert.equal(pending(rt)[0].basePayload, 10, familyId);
  assert.equal(pending(rt)[0].provenance, 'VERDICT', familyId);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.runTurnStart();
  arm(rt, {
    nativeByTarget: [{
      targetId: 'ghost', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 10,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  });
  rt.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'ghost', intentKind: 'STRIKE', countdown: 1, hostileTurnOrder: 0, slot: 'FL_0', alive: false }),
  ], false);
  rt.runTurnStart();
  assert.equal(rt.events().some((event) => event.payload.fizzled === true), true);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.grantFixture(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', countdown: 1, hostileTurnOrder: 0, slot: 'FL_0', hp: 2, severity: 'HIGH' }),
  ], false);
  rt.runTurnStart();
  arm(rt, {
    nativeByTarget: [{
      targetId: 'enemy-a', hits: 1, misses: 0, crits: 0, nativeDirectDamage: 20,
      defenseDamage: 0, defenseBreaks: 0, fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0,
    }],
  });
  rt.runTurnStart();
  assert.ok(rt.lastReleases().length >= 1);
  assert.equal(rt.getState().ritualCadence.measure, 'EMPTY');
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  grant(rt, RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION);
  grant(rt, RITUAL_CADENCE_SUPPORT_IDS.DOWNBEAT);
  arm(rt);
  disc(rt);
  rt.runTurnStart();
  rt.runTurnStart();
  assert.equal(rt.getState().ritualCadence.downbeatProtected, false);
}

{
  const rt = strainRuntime();
  grant(rt, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  const blocked = rt.preview(AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  assert.equal(blocked.eligible, true);
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  assert.equal(rt.getState().cores.ARMAMENT, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
}

{
  const rt = strainRuntime();
  grant(rt, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  grant(rt, COUNTERFATE_VERDICT_ID, { premium: true });
  assert.equal(rt.preview(AFTERIMAGE_VERDICT_ID, { premiumVerdictSource: true, equippedWeaponFamilyId: 'aegis-longsword' }).eligible, false);
  assert.equal(rt.preview(RITUAL_CADENCE_VERDICT_ID, { premiumVerdictSource: true, equippedWeaponFamilyId: 'aegis-longsword' }).eligible, false);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.runTurnStart();
  arm(rt);
  rt.completeCombat();
  assert.equal(pending(rt).length, 0);
}

{
  const rt = strainRuntime();
  grant(rt, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  rt.runTurnStart();
  arm(rt);
  const saved = rt.serialize();
  const resumed = strainRuntime();
  resumed.hydrate(saved);
  assert.equal(resumed.getState().afterimage.pending.length, 1);
  resumed.runTurnStart();
  assert.equal(resumed.getState().afterimage.pending[0].status, 'RESOLVED');
}

{
  const legacy = createNineStrainRuntime({ definitions: live });
  assert.equal(legacy.preview(AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT).eligible, false);
}

{
  const fresh = hydrateNineStrainIncursionFields(createDefaultActiveIncursionState());
  assert.equal(fresh.nineStrainRuntime.boonSystemMode, 'LEGACY_CLASS_CATALOG');
  const migrated = hydrateNineStrainRuntimeState({ schemaVersion: 4, ritualCadence: { measure: 'BEAT_I' } });
  assert.equal(migrated.schemaVersion, 11);
  assert.equal(migrated.ritualCadence.measure, 'BEAT_I');
  assert.equal(migrated.afterimage.pending.length, 0);
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

console.log('Stage B.3 — Afterimage vertical slice passed');
