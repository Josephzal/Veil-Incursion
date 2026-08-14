import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORE_IMPRINTS, NINE_STRAIN_IDS, MAX_NATURAL_CONTACTED_STRAINS } from './nineStrain/strainRegistry';
import { getLiveUniversalBoonDefinitions, indexDefinitions } from './nineStrain/definitionCatalog';
import { TEST_ONLY_UNIVERSAL_BOON_DEFINITIONS, isTestOnlyBoonId } from './nineStrain/testDefinitions';
import { createNineStrainRuntime, weaponFamilyExecutionContext, instinctInputForClass, ordinaryCurrentInput, majorCurrentInput } from './nineStrain/runtime';
import { NINE_PERMANENT_WEAPON_FAMILIES, classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import { resolveInstinctGrade } from './nineStrain/instinctAdapter';
import { resolveCurrentEvent } from './nineStrain/currentAdapter';
import { aggregateNativeByTarget, totalNativeDirectDamage } from './nineStrain/rootAction';
import { TURN_START_PHASES } from './nineStrain/turnStart';
import { hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { createDefaultActiveIncursionState } from '../types/game';
import { hydrateNineStrainIncursionFields } from './nineStrainRunState';
import { resolveHostileHpLoss, resolveVoluntaryHpCost } from './nineStrain/hpLossProvenance';

console.log('Stage A — Nine-Strain runtime foundation');

const catalog = TEST_ONLY_UNIVERSAL_BOON_DEFINITIONS;

function runtime() {
  return createNineStrainRuntime({ definitions: catalog, allowTestOffers: true });
}

assert.equal(CORE_IMPRINTS.length, 4);
assert.deepEqual([...CORE_IMPRINTS], ['ARMAMENT', 'DISCIPLINE', 'INSTINCT', 'CURRENT']);
assert.equal(NINE_STRAIN_IDS.length, 9);
assert.equal(MAX_NATURAL_CONTACTED_STRAINS, 3);

const verdict = catalog.find((row) => row.role === 'VERDICT');
assert.ok(verdict);
assert.equal(verdict.imprint, undefined);

indexDefinitions(catalog);
indexDefinitions(getLiveUniversalBoonDefinitions());
assert.equal(getLiveUniversalBoonDefinitions().length, 16);

const ids = catalog.map((row) => row.id);
assert.equal(new Set(ids).size, ids.length);
assert.ok(ids.every(isTestOnlyBoonId));

const rt = runtime();
assert.ok(rt.commit('TEST_STRAIN_CORE_ARMAMENT').eligible);
assert.ok(rt.commit('TEST_STRAIN_CORE_DISCIPLINE').eligible);
assert.ok(rt.commit('TEST_STRAIN_CORE_INSTINCT').eligible);
const fourth = rt.preview('TEST_STRAIN_CORE_CURRENT');
assert.equal(fourth.eligible, false);
assert.ok(fourth.rejectionReasons.includes('STRAIN_CAP'));
const override = rt.commit('TEST_STRAIN_CORE_CURRENT', { exceptionalSourceId: 'test-exceptional-source' });
assert.equal(override.eligible, true);
assert.equal(rt.getState().exceptionalOverride?.sourceId, 'test-exceptional-source');
assert.equal(rt.getState().contactedStrains.filter((row) => row.exceptional).length, 1);

const overwriteRt = runtime();
assert.ok(overwriteRt.commit('TEST_STRAIN_CORE_ARMAMENT').eligible);
assert.ok(overwriteRt.commit('TEST_STRAIN_SUPPORT_ARMAMENT').eligible);
const illegal = overwriteRt.preview('TEST_STRAIN_CORE_ARMAMENT_FOREIGN');
assert.equal(illegal.eligible, false);
assert.ok(illegal.rejectionReasons.includes('DEPENDENCY_PROTECTION'));
const legalPreview = overwriteRt.preview('TEST_STRAIN_CORE_ARMAMENT_REPLACEMENT');
const legalCommit = overwriteRt.commit('TEST_STRAIN_CORE_ARMAMENT_REPLACEMENT');
assert.equal(legalPreview.eligible, true);
assert.equal(legalCommit.eligible, true);
assert.deepEqual(legalPreview.after.cores, legalCommit.after.cores);
assert.equal(legalCommit.overwrittenCoreId, 'TEST_STRAIN_CORE_ARMAMENT');
assert.ok(legalCommit.dependentEffects.includes('TEST_STRAIN_SUPPORT_ARMAMENT'));
assert.equal(overwriteRt.getState().supports.includes('TEST_STRAIN_SUPPORT_ARMAMENT'), true);

const cancelRt = runtime();
cancelRt.commit('TEST_STRAIN_CORE_ARMAMENT');
const beforeCancel = cancelRt.metric('hits_ARMAMENT');
cancelRt.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', { committed: false }));
assert.equal(cancelRt.metric('hits_ARMAMENT'), beforeCancel);
assert.equal(
  cancelRt.events().some((event) => event.type === 'ROOT_ACTION_COMMITTED' || event.type === 'ROOT_ACTION_RESOLVED'),
  false,
);

const multi = aggregateNativeByTarget([
  { targetId: 'a', damage: 4 },
  { targetId: 'a', damage: 3 },
  { targetId: 'b', damage: 5 },
  { targetId: 'b', damage: 0, miss: true },
]);
assert.equal(multi.length, 2);
assert.equal(multi.find((row) => row.targetId === 'a')?.nativeDirectDamage, 7);
assert.equal(multi.find((row) => row.targetId === 'b')?.hits, 1);
assert.equal(multi.find((row) => row.targetId === 'b')?.misses, 1);
assert.equal(totalNativeDirectDamage(multi), 12);

const multiRt = runtime();
multiRt.commit('TEST_STRAIN_CORE_ARMAMENT');
multiRt.commit('TEST_STRAIN_PER_TARGET');
const rootEvents = multiRt.commitRootAction(weaponFamilyExecutionContext('hex-shotgun', {
  nativeByTarget: multi,
  lockedTargetIds: ['a', 'b'],
  targetPattern: 'SPREAD',
  totalNativeDirectDamage: 12,
  actionId: 'spread-burst',
  rootActionId: 'root-spread-1',
}));
assert.equal(rootEvents.filter((event) => event.type === 'ROOT_ACTION_COMMITTED').length, 1);
assert.equal(rootEvents.filter((event) => event.type === 'ROOT_ACTION_RESOLVED').length, 1);
assert.equal(multiRt.metric('per_target'), 2);
assert.equal(multiRt.metric('hits_ARMAMENT'), 1);

const derivRt = runtime();
derivRt.commit('TEST_STRAIN_DERIVATIVE_SOURCE');
derivRt.commitRootAction(weaponFamilyExecutionContext('envoy-scythe'));
assert.equal(derivRt.metric('derivative_source'), 1);
assert.equal(derivRt.events().filter((event) => event.type === 'DERIVATIVE_RESOLVED').length, 1);

const orderRt = runtime();
orderRt.commit('TEST_STRAIN_CORE_ARMAMENT');
orderRt.commit('TEST_STRAIN_QUEUE_TRACE');
orderRt.commitRootAction(weaponFamilyExecutionContext('aegis-claymore'));
const phases = orderRt.runTurnStart();
assert.deepEqual(phases, [...TURN_START_PHASES]);
assert.equal(orderRt.metric('traces_resolved'), 1);
const replay = runtime();
replay.hydrate(orderRt.serialize());
assert.deepEqual(replay.runTurnStart(), [...TURN_START_PHASES]);

assert.equal(resolveCurrentEvent({ classId: 'AEGIS', preserved: true })?.kind, 'PRESERVED');
assert.notEqual(resolveCurrentEvent({ classId: 'AEGIS', preserved: true })?.kind, 'GAINED');
const preserveRt = runtime();
preserveRt.commit('TEST_STRAIN_CORE_ARMAMENT');
preserveRt.commit('TEST_STRAIN_CORE_DISCIPLINE');
preserveRt.commit('TEST_STRAIN_CORE_CURRENT', { exceptionalSourceId: 'preserve-source' });
preserveRt.resolveCurrent({ classId: 'AEGIS', preserved: true });
assert.equal(preserveRt.events().some((event) => event.type === 'CURRENT_PRESERVED'), true);
assert.equal(preserveRt.events().some((event) => event.type === 'CURRENT_GAINED'), false);

const refill = resolveCurrentEvent({ classId: 'HEX_SHOT', reloadRestoredRounds: true, ultimateOwnedRefill: true });
assert.equal(refill?.excluded, true);
const delayed = resolveCurrentEvent({ classId: 'ENVOY', ordinaryGain: true, delayedRestore: true });
assert.equal(delayed?.excluded, true);

const previewRt = runtime();
previewRt.commit('TEST_STRAIN_CORE_ARMAMENT');
const ctx = weaponFamilyExecutionContext('envoy-vambrace');
const previewed = previewRt.previewRootAction(ctx);
assert.equal(previewRt.metric('hits_ARMAMENT'), 0);
previewRt.commitRootAction(ctx);
assert.deepEqual(previewRt.getState().metrics, previewed.metrics);

const saveRt = runtime();
saveRt.commit('TEST_STRAIN_CORE_ARMAMENT');
saveRt.commitRootAction(weaponFamilyExecutionContext('hex-revolver', { rootActionId: 'r1' }));
const pending = saveRt.getState();
pending.pendingEffects.push({
  id: 'queued-1',
  definitionId: 'TEST_STRAIN_QUEUE_TRACE',
  createdOrder: 3,
  kind: 'TRACE',
});
pending.triggerGuards.perEncounter = ['TEST_STRAIN_MANIFESTATION'];
const resumed = runtime();
resumed.hydrate(JSON.parse(JSON.stringify(pending)));
assert.deepEqual(resumed.getState().cores, pending.cores);
assert.deepEqual(resumed.getState().pendingEffects, pending.pendingEffects);
assert.deepEqual(resumed.getState().triggerGuards.perEncounter, pending.triggerGuards.perEncounter);
const beforeResume = resumed.metric('hits_ARMAMENT');
resumed.commitRootAction(weaponFamilyExecutionContext('hex-revolver', { rootActionId: 'r2' }));
assert.equal(resumed.metric('hits_ARMAMENT'), beforeResume + 1);

assert.equal(resolveInstinctGrade({ classId: 'AEGIS', voidWardPrevented: true }), 'STANDARD');
assert.equal(resolveInstinctGrade({ classId: 'AEGIS', wraithParrySuccess: true, parryAttempted: true }), 'CLEAN');
assert.equal(resolveInstinctGrade({ classId: 'AEGIS', perfectParry: true, parryAttempted: true }), 'PERFECT');
assert.equal(resolveInstinctGrade({ classId: 'AEGIS', parryAttempted: true }), 'FAILED');
assert.equal(resolveInstinctGrade({ classId: 'HEX_SHOT', reloadQuality: 'CLEAN' }), 'CLEAN');
assert.equal(resolveInstinctGrade({ classId: 'HEX_SHOT', reloadQuality: 'PERFECT' }), 'PERFECT');
assert.equal(resolveInstinctGrade({ classId: 'HEX_SHOT', reloadQuality: 'FAILED' }), 'FAILED');
assert.equal(resolveInstinctGrade({ classId: 'ENVOY', riftPreventedDamage: 20, riftWouldReachHp: 100 }), 'STANDARD');
assert.equal(resolveInstinctGrade({ classId: 'ENVOY', riftPreventedDamage: 50, riftWouldReachHp: 100 }), 'CLEAN');
assert.equal(resolveInstinctGrade({ classId: 'ENVOY', riftPreventedDamage: 100, riftWouldReachHp: 100 }), 'PERFECT');
assert.equal(resolveInstinctGrade({ classId: 'ENVOY', riftPreventedDamage: 0, riftWouldReachHp: 40 }), 'FAILED');

const instinctRt = runtime();
instinctRt.commit('TEST_STRAIN_CORE_ARMAMENT');
instinctRt.commit('TEST_STRAIN_CORE_DISCIPLINE');
instinctRt.commit('TEST_STRAIN_CORE_INSTINCT');
instinctRt.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true });
instinctRt.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true });
assert.equal(instinctRt.metric('instinct_payloads'), 1);

assert.equal(resolveCurrentEvent({ classId: 'AEGIS', ordinaryGain: true })?.signal, 'ORDINARY');
assert.equal(resolveCurrentEvent({ classId: 'AEGIS', ordinarySpend: true, reserveEntered50: true })?.signal, 'MAJOR');
assert.equal(resolveCurrentEvent({ classId: 'HEX_SHOT', ammoSpent: true })?.signal, 'ORDINARY');
assert.equal(resolveCurrentEvent({ classId: 'HEX_SHOT', ammoSpent: true, perfectReload: true })?.signal, 'MAJOR');
assert.equal(resolveCurrentEvent({ classId: 'ENVOY', ordinarySpend: true })?.signal, 'ORDINARY');
assert.equal(resolveCurrentEvent({ classId: 'ENVOY', ordinarySpend: true, brinkEntered: true })?.signal, 'MAJOR');

const graftRt = runtime();
graftRt.commit('TEST_STRAIN_CORE_ARMAMENT');
graftRt.commitRootAction(weaponFamilyExecutionContext('aegis-paired-blades', {
  finalMechanicalTags: ['STRIKE', 'GRAFT_TRANSFORMED'],
}));
assert.deepEqual(graftRt.lastRootContext()?.finalMechanicalTags, ['STRIKE', 'GRAFT_TRANSFORMED']);

for (const familyId of NINE_PERMANENT_WEAPON_FAMILIES) {
  const familyRt = runtime();
  familyRt.commit('TEST_STRAIN_CORE_ARMAMENT');
  familyRt.commit('TEST_STRAIN_CORE_DISCIPLINE');
  familyRt.commit('TEST_STRAIN_CORE_INSTINCT');
  const classId = classIdForWeaponFamily(familyId);
  familyRt.commitRootAction(weaponFamilyExecutionContext(familyId, {
    finalMechanicalTags: ['STRIKE', `family:${familyId}`],
  }));
  familyRt.resolveInstinct(instinctInputForClass(classId));
  familyRt.resolveCurrent(ordinaryCurrentInput(classId));
  familyRt.resolveCurrent(majorCurrentInput(classId));
  assert.equal(familyRt.metric('hits_ARMAMENT'), 1, familyId);
  assert.equal(familyRt.metric('instinct_payloads'), 1, familyId);
  assert.ok(familyRt.metric('instinct_payloads') >= 1, familyId);
  assert.equal(familyRt.lastRootContext()?.weaponFamilyId, familyId);
  assert.equal(familyRt.lastRootContext()?.classId, classId);
}

const engineDir = join(import.meta.dirname, 'nineStrain');
for (const file of readdirSync(engineDir)) {
  if (!file.endsWith('.ts')) continue;
  const source = readFileSync(join(engineDir, file), 'utf8');
  assert.equal(source.includes('displayName ==='), false, file);
  assert.equal(source.includes('Longsword'), false, file);
  assert.equal(source.includes('Paired Blades'), false, file);
  assert.equal(source.includes('Silver-Core'), false, file);
  assert.equal(/switch\s*\(\s*def\.id/.test(source), false, file);
  assert.equal(/switch\s*\(\s*boon/.test(source), false, file);
}

const liveBlock = createNineStrainRuntime({ definitions: catalog, allowTestOffers: false });
assert.equal(liveBlock.preview('TEST_STRAIN_CORE_ARMAMENT').eligible, false);
assert.ok(liveBlock.preview('TEST_STRAIN_CORE_ARMAMENT').rejectionReasons.includes('TEST_ONLY_BLOCKED'));

const migrated = hydrateNineStrainRuntimeState({
  schemaVersion: 0,
  revelations: ['legacy-revelation'],
  cores: { ARMAMENT: 'TEST_STRAIN_CORE_ARMAMENT', VERDICT: 'TEST_STRAIN_VERDICT' },
  contactedStrains: ['COUNTERFATE'],
});
assert.equal(migrated.schemaVersion, 4);
assert.ok(migrated.manifestations.includes('legacy-revelation'));
assert.equal(migrated.boundVerdict, 'TEST_STRAIN_VERDICT');
assert.equal(migrated.cores.ARMAMENT, 'TEST_STRAIN_CORE_ARMAMENT');
assert.equal('VERDICT' in migrated.cores, false);

const incursion = hydrateNineStrainIncursionFields(createDefaultActiveIncursionState());
assert.equal(incursion.nineStrainRuntime.schemaVersion, 4);
assert.equal(incursion.nineStrainRuntime.boonSystemMode, 'LEGACY_CLASS_CATALOG');
assert.equal(incursion.leyLineMutations.length, 0);

const hostile = resolveHostileHpLoss({
  incoming: 20,
  ordinaryMitigationAndBarrier: 5,
  parryOrRiftPrevention: 4,
  shardsAbsorb: 3,
  soulAnchorHp: 20,
});
assert.equal(hostile.hpLost, 8);
assert.equal(hostile.qualifiesAsEnemyDamageHpLoss, true);
const voluntary = resolveVoluntaryHpCost({ cost: 5, currentHp: 6, lethalPaymentPermitted: false });
assert.equal(voluntary.paid, 5);
assert.equal(voluntary.remainingHp, 1);
const lethalBlock = resolveVoluntaryHpCost({ cost: 6, currentHp: 6, lethalPaymentPermitted: false });
assert.equal(lethalBlock.rejected, true);

assert.ok(rt.commit('TEST_STRAIN_VERDICT', { premiumVerdictSource: true }).eligible);
assert.equal(rt.getState().boundVerdict, 'TEST_STRAIN_VERDICT');
assert.equal(rt.preview('TEST_STRAIN_VERDICT', { premiumVerdictSource: true }).eligible, false);

console.log('Stage A — Nine-Strain runtime foundation passed');
