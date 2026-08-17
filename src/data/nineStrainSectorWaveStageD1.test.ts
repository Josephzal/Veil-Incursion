import assert from 'node:assert/strict';
import { FAULTLINE_CORE_IDS, FAULTLINE_VERDICT_ID } from '../types/faultline';
import { STILLPOINT_CORE_IDS } from '../types/stillpoint';
import {
  getLiveUniversalBoonDefinitions,
  getProductionOfferDefinitions,
  getSector1ProductionDefinitions,
} from './nineStrain/definitionCatalog';
import { createNineStrainRuntime } from './nineStrain/runtime';
import {
  createDefaultNineStrainRuntimeState,
  createLiveNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
} from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { firstOmenStrainIds, unlockedStrainIds } from './nineStrain/acquisitionDirector';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';

console.log('Stage D.1 — Sector wave gate');

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
  assert.equal(unlockedStrainIds(fresh.maxAcquisitionWave).includes('FAULTLINE'), false);
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const locked = runtime.preview(FAULTLINE_CORE_IDS.STRESS_PATTERN, { equippedWeaponFamilyId: 'aegis-longsword' });
  assert.ok(locked.rejectionReasons.includes('WAVE_LOCKED'));
  const opened = runtime.preview(FAULTLINE_CORE_IDS.STRESS_PATTERN, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(opened.rejectionReasons.includes('WAVE_LOCKED'), false);
  const stillpoint = runtime.preview(STILLPOINT_CORE_IDS.STORED_FORCE, { allowSector2Wave: true });
  assert.equal(stillpoint.rejectionReasons.includes('WAVE_LOCKED'), false);
  const faultViaBoolean = runtime.preview(FAULTLINE_CORE_IDS.STRESS_PATTERN, { allowSector2Wave: true });
  assert.ok(faultViaBoolean.rejectionReasons.includes('WAVE_LOCKED'));
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  const omen = firstOmenStrainIds(runtime.getState(), 1, 'aegis-longsword', 'd1');
  assert.equal(omen.includes('FAULTLINE'), false);
  assert.equal(omen.length, 3);
}

{
  const schema9 = hydrateNineStrainRuntimeState({
    schemaVersion: 9,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 2,
    cores: { ARMAMENT: STILLPOINT_CORE_IDS.STORED_FORCE, DISCIPLINE: null, INSTINCT: null, CURRENT: null },
    supports: [],
    manifestations: [],
    convergences: [],
    boundVerdict: null,
    contactedStrains: [{ strainId: 'STILLPOINT', order: 1 }],
  });
  assert.equal(schema9.maxAcquisitionWave, 2);
  assert.equal(schema9.cores.ARMAMENT, STILLPOINT_CORE_IDS.STORED_FORCE);
  const twice = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(schema9)));
  assert.equal(twice.maxAcquisitionWave, 2);
  assert.deepEqual(twice.faultline.faultByUnitId, {});
}

{
  const sealed = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  const withOffer = {
    ...sealed,
    acquisition: {
      ...sealed.acquisition,
      pendingOffer: {
        kind: 'CONTACT' as const,
        sourceId: 'VEIL_BLEED_BOON:n:d1',
        nodeId: 'n',
        depth: 1,
        strainId: 'COUNTERFATE' as const,
        cardIds: ['CF_CORE_SEVERED_OUTCOME', 'CF_CORE_REFUSAL_PATTERN', 'CF_SUPPORT_CHOSEN_FATE'],
        seed: 'keep',
        rngCursor: 0,
        replacementPreview: {},
        failClosedDiagnostic: null,
      },
    },
  };
  const migrated = hydrateNineStrainRuntimeState(withOffer);
  assert.deepEqual(migrated.acquisition.pendingOffer?.cardIds, withOffer.acquisition.pendingOffer.cardIds);
}

{
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(createDefaultNineStrainRuntimeState());
  const inactive = runtime.preview(FAULTLINE_VERDICT_ID, {
    maxAcquisitionWave: 3,
    premiumVerdictSource: true,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.ok(inactive.rejectionReasons.includes('BOON_SYSTEM_INACTIVE'));
}

console.log('Stage D.1 — Sector wave gate passed');
