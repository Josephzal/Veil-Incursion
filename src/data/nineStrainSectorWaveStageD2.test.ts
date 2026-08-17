import assert from 'node:assert/strict';
import { SOULWAKE_CORE_IDS, SOULWAKE_VERDICT_ID } from '../types/soulwake';
import { FAULTLINE_CORE_IDS } from '../types/faultline';
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

console.log('Stage D.2 — Sector wave gate');

const live = getLiveUniversalBoonDefinitions();
assert.equal(live.length, 66);
assert.equal(getSector1ProductionDefinitions().length, 27);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 66);
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 2);
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 11);
assert.equal(live.filter((row) => row.strainId === 'FAULTLINE').length, 8);
assert.equal(live.filter((row) => row.strainId === 'SOULWAKE').length, 8);
assert.ok(live.every((row) => row.role !== 'CONVERGENCE' || row.acquisitionWave !== 3));

{
  const fresh = createLiveNineStrainRuntimeState();
  assert.equal(fresh.maxAcquisitionWave, 2);
  assert.equal(unlockedStrainIds(fresh.maxAcquisitionWave).includes('SOULWAKE'), false);
  assert.equal(unlockedStrainIds(fresh.maxAcquisitionWave).includes('FAULTLINE'), false);
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const preview = runtime.preview(SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  assert.equal(preview.eligible, false);
  assert.ok(preview.rejectionReasons.includes('WAVE_LOCKED'));
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const granted = runtime.commit(SOULWAKE_CORE_IDS.HOLLOW_EDGE, { maxAcquisitionWave: 3, combatDepth: 1 });
  assert.equal(granted.eligible, true);
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const omen = firstOmenStrainIds(runtime.getState(), 1, 'aegis-longsword', 'd2');
  assert.equal(omen.includes('SOULWAKE'), false);
  assert.equal(omen.includes('FAULTLINE'), false);
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
