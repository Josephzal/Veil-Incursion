import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { createNineStrainCombatBridge } from './nineStrain/combatBridge';
import { dispatchLiveWeaponFamilyBasic, makeLiveDispatchSquad } from './nineStrain/liveWeaponDispatch';
import { TEST_ONLY_UNIVERSAL_BOON_DEFINITIONS } from './nineStrain/testDefinitions';
import { getLiveUniversalBoonDefinitions, getSector1ProductionDefinitions } from './nineStrain/definitionCatalog';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import { instinctInputForClass, ordinaryCurrentInput, majorCurrentInput } from './nineStrain/runtime';
import { hydrateNineStrainIncursionFields } from './nineStrainRunState';
import { createDefaultActiveIncursionState } from '../types/game';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { createDefaultNineStrainRuntimeState } from './nineStrain/persistence';

console.log('Stage A.1 — live Hub integration and boon-system mode');

assert.equal(getSector1ProductionDefinitions().length, 27);
assert.equal(getLiveUniversalBoonDefinitions().length, 66);

const liveBridge = createNineStrainCombatBridge();
const beforeMetrics = { ...liveBridge.serialize().metrics };
const squad = makeLiveDispatchSquad();

for (const familyId of CANONICAL_WEAPON_FAMILY_IDS) {
  const result = dispatchLiveWeaponFamilyBasic(liveBridge, familyId, squad);
  const ctx = liveBridge.lastRootContext();
  assert.equal(result.familyId, familyId);
  assert.ok(ctx);
  assert.equal(ctx.weaponFamilyId, familyId);
  assert.equal(ctx.classId, classIdForWeaponFamily(familyId));
  assert.equal(ctx.committed, true);
  assert.equal(liveBridge.events().filter((event) => (
    event.type === 'ROOT_ACTION_COMMITTED' && event.rootActionId === ctx.rootActionId
  )).length, 1);
  liveBridge.noteInstinct(instinctInputForClass(ctx.classId));
  liveBridge.noteCurrent(ordinaryCurrentInput(ctx.classId));
  liveBridge.noteCurrent(majorCurrentInput(ctx.classId));
}

assert.deepEqual(liveBridge.serialize().metrics, beforeMetrics);

const carbineBridge = createNineStrainCombatBridge();
const carbine = dispatchLiveWeaponFamilyBasic(carbineBridge, 'hex-carbine', squad);
assert.equal(carbine.delivery, 'SPREAD');
assert.ok(carbine.uniqueTargets >= 2);
assert.equal(
  carbineBridge.events().filter((event) => event.type === 'ROOT_ACTION_COMMITTED').length,
  1,
);
assert.equal(
  carbineBridge.events().filter((event) => event.type === 'PER_TARGET_RESULT').length,
  carbine.uniqueTargets,
);

const shotgunBridge = createNineStrainCombatBridge();
const shotgun = dispatchLiveWeaponFamilyBasic(shotgunBridge, 'hex-shotgun', squad);
assert.equal(shotgun.delivery, 'BREACH');
assert.equal(shotgun.innateArmorPressureLayers, 1);
assert.equal(shotgun.uniqueTargets, 1);
assert.equal(
  shotgunBridge.events().filter((event) => event.type === 'ROOT_ACTION_COMMITTED').length,
  1,
);

const cancelBridge = createNineStrainCombatBridge();
dispatchLiveWeaponFamilyBasic(cancelBridge, 'aegis-longsword', squad, { commit: false });
assert.equal(
  cancelBridge.events().some((event) => event.type === 'ROOT_ACTION_COMMITTED'),
  false,
);

const observer = createNineStrainCombatBridge({
  definitions: TEST_ONLY_UNIVERSAL_BOON_DEFINITIONS,
  allowTestOffers: true,
});
assert.ok(observer.runtime.commit('TEST_STRAIN_CORE_ARMAMENT').eligible);
dispatchLiveWeaponFamilyBasic(observer, 'envoy-scythe', squad);
assert.ok(observer.runtime.metric('hits_ARMAMENT') >= 1);
assert.equal(observer.runtime.preview('TEST_STRAIN_CORE_DISCIPLINE').rejectionReasons.includes('TEST_ONLY_BLOCKED') === false, true);

const productionOffers = createNineStrainCombatBridge({
  definitions: TEST_ONLY_UNIVERSAL_BOON_DEFINITIONS,
  allowTestOffers: false,
});
assert.ok(productionOffers.runtime.preview('TEST_STRAIN_CORE_ARMAMENT').rejectionReasons.includes('TEST_ONLY_BLOCKED'));

const refill = createNineStrainCombatBridge();
refill.beginRootAttempt({
  actionId: 'SIXTH_SEAL',
  classId: 'HEX_SHOT',
  weaponFamilyId: 'hex-revolver',
  sourceKind: 'ULTIMATE',
});
refill.markCommitted({ ultimateOwnedRefill: true });
refill.markUltimateOwnedRefill();
refill.noteCurrent({ classId: 'HEX_SHOT', reloadRestoredRounds: true, ultimateOwnedRefill: true });
refill.finishRootAttempt();
assert.equal(refill.events().some((event) => event.type === 'CURRENT_GAINED'), false);
assert.equal(refill.lastRootContext()?.ultimateOwnedRefill, true);

const fresh = hydrateNineStrainIncursionFields(createDefaultActiveIncursionState());
assert.equal(fresh.nineStrainRuntime.boonSystemMode, 'LEGACY_CLASS_CATALOG');

const legacySave = hydrateNineStrainIncursionFields({
  leyLineMutations: ['UNSTOPPABLE_FORCE'],
  hexShotBoons: [],
  envoyBoons: [],
});
assert.equal(legacySave.nineStrainRuntime.boonSystemMode, 'LEGACY_CLASS_CATALOG');
assert.equal(legacySave.nineStrainRuntime.boonSystemConflict, null);
assert.deepEqual(legacySave.leyLineMutations, ['UNSTOPPABLE_FORCE']);

const strainOwned = createDefaultNineStrainRuntimeState();
strainOwned.cores.ARMAMENT = 'future-core';
strainOwned.contactedStrains = [{ strainId: 'COUNTERFATE', order: 0 }];
const future = hydrateNineStrainIncursionFields({
  nineStrainRuntime: strainOwned,
  leyLineMutations: [],
  hexShotBoons: [],
  envoyBoons: [],
});
assert.equal(future.nineStrainRuntime.boonSystemMode, 'NINE_STRAIN');

const conflict = hydrateNineStrainIncursionFields({
  leyLineMutations: ['UNSTOPPABLE_FORCE'],
  nineStrainRuntime: strainOwned,
});
assert.ok(conflict.nineStrainRuntime.boonSystemConflict);
assert.deepEqual(conflict.leyLineMutations, ['UNSTOPPABLE_FORCE']);
assert.equal(conflict.nineStrainRuntime.cores.ARMAMENT, 'future-core');

const activated = activateNineStrainAcquisition(
  createDefaultNineStrainRuntimeState(),
  { leyLineMutations: [], hexShotBoons: [], envoyBoons: [] },
);
assert.equal(activated.boonSystemMode, 'NINE_STRAIN');
const blockedActivate = activateNineStrainAcquisition(
  createDefaultNineStrainRuntimeState(),
  { leyLineMutations: ['UNSTOPPABLE_FORCE'] },
);
assert.ok(blockedActivate.boonSystemConflict);

const engineDir = join(import.meta.dirname, 'nineStrain');
for (const file of readdirSync(engineDir)) {
  if (!file.endsWith('.ts')) continue;
  const source = readFileSync(join(engineDir, file), 'utf8');
  assert.equal(source.includes('displayName ==='), false, file);
  assert.equal(/switch\s*\(\s*def\.id/.test(source), false, file);
}

const hubSource = readFileSync(join(import.meta.dirname, '../components/TacticalCombatHub.tsx'), 'utf8');
assert.ok(hubSource.includes('beginRootAttempt'));
assert.ok(hubSource.includes('finishRootAttempt'));
assert.ok(hubSource.includes('HEX_ULTIMATE_OWNED_MAGAZINE_REFILL'));
assert.ok(hubSource.includes('markUltimateOwnedRefill'));

console.log('Stage A.1 — live Hub integration and boon-system mode passed');
