import assert from 'node:assert/strict';
import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions, getSector1ProductionDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime } from './nineStrain/runtime';
import { createDefaultNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { STILLPOINT_CORE_IDS, STILLPOINT_MANIFESTATION_ID, STILLPOINT_VERDICT_ID } from '../types/stillpoint';
import { WOUNDWEAVE_CORE_IDS } from '../types/woundweave';
import { firstOmenStrainIds, resolveNineStrainRewardTrigger } from './nineStrain/acquisitionDirector';
import { SECTOR_1_STRAIN_IDS } from '../types/convergence';

console.log('Stage C.1 — Sector wave gate');

const registered = getLiveUniversalBoonDefinitions();
const sector1 = getSector1ProductionDefinitions();
assert.equal(registered.length, 108);
assert.equal(sector1.length, 27);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(registered.filter((row) => row.strainId === 'STILLPOINT' && row.role === 'CORE').length, 4);
assert.equal(registered.filter((row) => row.strainId === 'STILLPOINT' && row.role === 'SUPPORT').length, 2);
assert.equal(registered.filter((row) => row.strainId === 'STILLPOINT' && row.role === 'MANIFESTATION').length, 1);
assert.equal(registered.filter((row) => row.strainId === 'STILLPOINT' && row.role === 'VERDICT').length, 1);
assert.ok(sector1.every((row) => row.strainId !== 'STILLPOINT' && row.strainId !== 'WOUNDWEAVE'));
assert.equal(registered.filter((row) => row.strainId === 'WOUNDWEAVE' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(registered.filter((row) => row.role === 'CONVERGENCE').length, 36);

{
  const state = activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {});
  const omen = firstOmenStrainIds(state, 1, 'aegis-longsword');
  assert.deepEqual(omen.slice().sort(), [...SECTOR_1_STRAIN_IDS].slice().sort());
  const trigger = resolveNineStrainRewardTrigger(state, {
    nodeType: 'ELITE_COMBAT',
    nodeId: 'e1',
    depth: 1,
    nodesCleared: 3,
    isBoss: false,
    combatVictory: true,
  });
  assert.equal(trigger.kind, 'ELITE_CONTACT');
}

{
  const runtime = createNineStrainRuntime({ definitions: registered });
  runtime.hydrate(activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {}));
  const blocked = runtime.preview(STILLPOINT_CORE_IDS.STORED_FORCE);
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.rejectionReasons.includes('WAVE_LOCKED'));
  const allowed = runtime.preview(STILLPOINT_CORE_IDS.STORED_FORCE, { allowSector2Wave: true });
  assert.equal(allowed.eligible, true);
  const storm = runtime.preview(STILLPOINT_MANIFESTATION_ID, { allowSector2Wave: true, combatDepth: 2 });
  assert.equal(storm.eligible, false);
  const verdict = runtime.preview(STILLPOINT_VERDICT_ID, {
    allowSector2Wave: true,
    premiumVerdictSource: true,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(verdict.eligible, true);
  const wwBlocked = runtime.preview(WOUNDWEAVE_CORE_IDS.SHARED_WOUND);
  assert.equal(wwBlocked.eligible, false);
  assert.ok(wwBlocked.rejectionReasons.includes('WAVE_LOCKED'));
  const wwAllowed = runtime.preview(WOUNDWEAVE_CORE_IDS.SHARED_WOUND, { allowSector2Wave: true });
  assert.equal(wwAllowed.eligible, true);
}

console.log('Stage C.1 — Sector wave gate passed');
