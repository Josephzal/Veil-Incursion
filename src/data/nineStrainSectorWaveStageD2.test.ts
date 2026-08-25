import assert from 'node:assert/strict';
import { SOULWAKE_CORE_IDS, SOULWAKE_VERDICT_ID } from '../types/soulwake';
import { FAULTLINE_CORE_IDS } from '../types/faultline';
import { SECTOR_3_CONVERGENCE_IDS } from '../types/convergence';
import {
  getLiveUniversalBoonDefinitions,
  getProductionOfferDefinitions,
  getSector1ProductionDefinitions,
} from './nineStrain/definitionCatalog';
import { createNineStrainRuntime } from './nineStrain/runtime';
import {
  createLiveNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
} from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { firstOmenStrainIds, unlockedStrainIds } from './nineStrain/acquisitionDirector';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';

console.log('Stage D.2 — Sector wave gate (post D.3 cutover)');

// Stage E.1: live catalog now includes the 8 wave-4 Gravemark fixtures (77 + 8 = 85). Production
// wave 1/2/3 pools are unchanged — see gravemarkCompatibilityStageE1.test.ts for the full E.1 gate.
const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 108);
assert.equal(getSector1ProductionDefinitions().length, 27);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 77);
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 4);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);
assert.equal(live.filter((row) => row.strainId === 'FAULTLINE' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'SOULWAKE' && row.role !== 'CONVERGENCE').length, 8);
assert.equal(SECTOR_3_CONVERGENCE_IDS.length, 11);
assert.ok(live.filter((row) => row.role === 'CONVERGENCE' && row.acquisitionWave === 3).length === 11);

{
  const fresh = createLiveNineStrainRuntimeState();
  assert.equal(fresh.maxAcquisitionWave, 4);
  assert.equal(unlockedStrainIds(fresh.maxAcquisitionWave).includes('SOULWAKE'), true);
  assert.equal(unlockedStrainIds(fresh.maxAcquisitionWave).includes('FAULTLINE'), true);
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const preview = runtime.preview(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  assert.equal(preview.eligible, true);
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const locked = runtime.preview(SOULWAKE_CORE_IDS.HOLLOW_EDGE, { maxAcquisitionWave: 2 });
  assert.equal(locked.eligible, false);
  assert.ok(locked.rejectionReasons.includes('WAVE_LOCKED'));
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const omen = firstOmenStrainIds(runtime.getState(), 1, 'aegis-longsword', 'd2');
  assert.ok(omen.includes('SOULWAKE') || omen.includes('FAULTLINE') || omen.length >= 2);
}

{
  const schema10 = hydrateNineStrainRuntimeState({
    schemaVersion: 10,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 2,
    cores: { ARMAMENT: FAULTLINE_CORE_IDS.STRESS_PATTERN, DISCIPLINE: null, INSTINCT: null, CURRENT: null },
  });
  assert.equal(schema10.maxAcquisitionWave, 2);
  assert.equal(schema10.cores.ARMAMENT, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  assert.equal(schema10.soulwake.recordedWake, 0);
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const verdict = runtime.preview(SOULWAKE_VERDICT_ID, { maxAcquisitionWave: 3, premiumVerdictSource: true });
  assert.equal(verdict.rejectionReasons.includes('WAVE_LOCKED'), false);
}

console.log('Stage D.2 — Sector wave gate passed');
