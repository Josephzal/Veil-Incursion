import assert from 'node:assert/strict';
import {
  CONVERGENCE_IDS,
  SECTOR_3_CONVERGENCE_IDS,
  SECTOR_3_STRAIN_IDS,
} from '../types/convergence';
import { AFTERIMAGE_CORE_IDS } from '../types/afterimage';
import { FAULTLINE_CORE_IDS } from '../types/faultline';
import { SOULWAKE_CORE_IDS } from '../types/soulwake';
import { STILLPOINT_CORE_IDS } from '../types/stillpoint';
import {
  getLiveUniversalBoonDefinitions,
  getProductionOfferDefinitions,
  getSector1ProductionDefinitions,
  indexDefinitions,
} from './nineStrain/definitionCatalog';
import {
  createDefaultNineStrainRuntimeState,
  createLiveNineStrainRuntimeState,
} from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { unlockedStrainIds } from './nineStrain/acquisitionDirector';
import { applyAcquire, previewAcquire } from './nineStrain/ownership';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';

console.log('Stage D.3 — Sector 3 acquisition');

assert.equal(getSector1ProductionDefinitions().length, 27);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 77);
assert.equal(getLiveUniversalBoonDefinitions().length, 108);
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 4);
assert.equal(SECTOR_3_CONVERGENCE_IDS.length, 11);

{
  const liveRun = createLiveNineStrainRuntimeState();
  assert.equal(liveRun.maxAcquisitionWave, 4);
  const unlocked = unlockedStrainIds(liveRun.maxAcquisitionWave);
  assert.ok(unlocked.includes('FAULTLINE'));
  assert.ok(unlocked.includes('SOULWAKE'));
  for (const id of SECTOR_3_STRAIN_IDS) assert.ok(unlocked.includes(id));
}

{
  const wave2 = activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {});
  assert.equal(wave2.maxAcquisitionWave, 1);
  const defs = indexDefinitions(getLiveUniversalBoonDefinitions());
  const locked = previewAcquire(wave2, defs, FAULTLINE_CORE_IDS.STRESS_PATTERN, { maxAcquisitionWave: 2 });
  assert.equal(locked.eligible, false);
  assert.ok(locked.rejectionReasons.includes('WAVE_LOCKED'));
}

{
  const defs = indexDefinitions(getProductionOfferDefinitions(3));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  // Recurrent Charge is Afterimage but not a hostile ordinary Trace producer.
  state = applyAcquire(state, defs, AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  state = applyAcquire(state, defs, FAULTLINE_CORE_IDS.STRESS_PATTERN, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  const missing = previewAcquire(state, defs, CONVERGENCE_IDS.ECHOED_FAULT, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(missing.eligible, false);
  assert.ok(missing.rejectionReasons.includes('MISSING_PRODUCER'), missing.rejectionReasons.join(','));
}

{
  const defs = indexDefinitions(getProductionOfferDefinitions(3));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  // Phantom Impact (ARMAMENT) + Stress Pattern share imprint — pair with Applied Fracture (DISCIPLINE).
  state = applyAcquire(state, defs, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  state = applyAcquire(state, defs, FAULTLINE_CORE_IDS.APPLIED_FRACTURE, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  const withFracture = previewAcquire(state, defs, CONVERGENCE_IDS.ECHOED_FAULT, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(withFracture.eligible, true, withFracture.rejectionReasons.join(','));
  // Also eligible when Stress Pattern occupies ARMAMENT and a hostile Trace sits in DISCIPLINE.
  state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  state = applyAcquire(state, defs, FAULTLINE_CORE_IDS.STRESS_PATTERN, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  state = applyAcquire(state, defs, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  // Swap to Phantom Impact + Stress Pattern via overwrite on ARMAMENT after placing Stress in DISCIPLINE path:
  // Stress Pattern (ARM) + Phantom Impact requires free imprint — use Stress + Lingering above, then also prove Phantom+Stress via:
  state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  state = applyAcquire(state, defs, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  state = applyAcquire(state, defs, FAULTLINE_CORE_IDS.STRESS_PATTERN, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  // Same-imprint overwrite drops Phantom — restore hostile Trace parent alongside Stress.
  state = applyAcquire(state, defs, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  assert.equal(state.cores.ARMAMENT, FAULTLINE_CORE_IDS.STRESS_PATTERN);
  assert.equal(state.cores.DISCIPLINE, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION);
  const ok = previewAcquire(state, defs, CONVERGENCE_IDS.ECHOED_FAULT, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(ok.eligible, true, ok.rejectionReasons.join(','));
}

{
  const defs = indexDefinitions(getProductionOfferDefinitions(3));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  for (const id of [FAULTLINE_CORE_IDS.STRESS_PATTERN, SOULWAKE_CORE_IDS.BORROWED_NERVE]) {
    const next = applyAcquire(state, defs, id, {
      maxAcquisitionWave: 3,
      equippedWeaponFamilyId: 'aegis-longsword',
    });
    assert.equal(next.eligible, true, id);
    state = next.after;
  }
  const living = previewAcquire(state, defs, CONVERGENCE_IDS.LIVING_FAULT, {
    maxAcquisitionWave: 3,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(living.eligible, true, living.rejectionReasons.join(','));
  const waveLocked = previewAcquire(state, defs, STILLPOINT_CORE_IDS.STORED_FORCE, {
    maxAcquisitionWave: 1,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(waveLocked.eligible, false);
  assert.ok(waveLocked.rejectionReasons.includes('WAVE_LOCKED'));
}

console.log('Stage D.3 — Sector 3 acquisition passed');
