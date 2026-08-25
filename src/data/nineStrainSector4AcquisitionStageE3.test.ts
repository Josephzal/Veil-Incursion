import assert from 'node:assert/strict';
import {
  CONVERGENCE_IDS,
  SECTOR_4_CONVERGENCE_IDS,
  SECTOR_4_STRAIN_IDS,
} from '../types/convergence';
import { AFTERIMAGE_CORE_IDS } from '../types/afterimage';
import { GRAVEMARK_CORE_IDS } from '../types/gravemark';
import { SHARDSKIN_CORE_IDS } from '../types/shardskin';
import { COUNTERFATE_CORE_IDS } from '../types/counterfate';
import { WOUNDWEAVE_CORE_IDS } from '../types/woundweave';
import {
  getLiveUniversalBoonDefinitions,
  getProductionOfferDefinitions,
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

console.log('Stage E.3 — Sector 4 acquisition, eligibility, and overwrite protection');

assert.equal(getProductionOfferDefinitions(4).length, 108);
assert.equal(getLiveUniversalBoonDefinitions().length, 108);
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 4);
assert.equal(SECTOR_4_CONVERGENCE_IDS.length, 15);

{
  const liveRun = createLiveNineStrainRuntimeState();
  assert.equal(liveRun.maxAcquisitionWave, 4);
  const unlocked = unlockedStrainIds(liveRun.maxAcquisitionWave);
  for (const id of SECTOR_4_STRAIN_IDS) assert.ok(unlocked.includes(id), `${id} unlocked at wave 4`);
}

// --- Wave lock: Sector 4 (Gravemark/Shardskin) content is unreachable below wave 4 ---
{
  const defs = indexDefinitions(getLiveUniversalBoonDefinitions());
  const state = activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {});
  const locked = previewAcquire(state, defs, GRAVEMARK_CORE_IDS.IMPACT_VECTOR, { maxAcquisitionWave: 3 });
  assert.equal(locked.eligible, false);
  assert.ok(locked.rejectionReasons.includes('WAVE_LOCKED'));
  const cvLocked = previewAcquire(state, defs, CONVERGENCE_IDS.IMPACT_LATTICE, { maxAcquisitionWave: 3 });
  assert.equal(cvLocked.eligible, false);
  assert.ok(cvLocked.rejectionReasons.includes('WAVE_LOCKED'));
}

// --- CONVERGENCE_PARENTS: contacted-only is insufficient; a live Core from BOTH parents is
// required at both offer preview and acceptance ---
{
  const defs = indexDefinitions(getProductionOfferDefinitions(4));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  // No parent Cores owned at all — Fate Out of Place (Counterfate x Gravemark) is ineligible.
  const noParents = previewAcquire(state, defs, CONVERGENCE_IDS.FATE_OUT_OF_PLACE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(noParents.eligible, false);
  assert.ok(noParents.rejectionReasons.includes('CONVERGENCE_PARENTS'), noParents.rejectionReasons.join(','));

  // Only ONE parent Core owned — still insufficient (both parent Strains must have a live Core).
  state = applyAcquire(state, defs, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  const onePOnly = previewAcquire(state, defs, CONVERGENCE_IDS.FATE_OUT_OF_PLACE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(onePOnly.eligible, false);
  assert.ok(onePOnly.rejectionReasons.includes('CONVERGENCE_PARENTS'), onePOnly.rejectionReasons.join(','));

  // Both parent Cores live -> eligible.
  state = applyAcquire(state, defs, GRAVEMARK_CORE_IDS.MASS_TRANSFER, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  const bothParents = previewAcquire(state, defs, CONVERGENCE_IDS.FATE_OUT_OF_PLACE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(bothParents.eligible, true, bothParents.rejectionReasons.join(','));

  // Accept must revalidate: acquiring succeeds and the definition is now owned.
  state = applyAcquire(state, defs, CONVERGENCE_IDS.FATE_OUT_OF_PLACE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  assert.ok(state.convergences.includes(CONVERGENCE_IDS.FATE_OUT_OF_PLACE));

  // Duplicates remain ALREADY_OWNED.
  const duplicate = previewAcquire(state, defs, CONVERGENCE_IDS.FATE_OUT_OF_PLACE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(duplicate.eligible, false);
  assert.ok(duplicate.rejectionReasons.includes('ALREADY_OWNED'));
}

// --- Additional producer gate: Parallax Echo requires a currently owned Afterimage Core/loadout
// path capable of creating a hostile ordinary Core Trace. Fails MISSING_PRODUCER otherwise. ---
{
  const defs = indexDefinitions(getProductionOfferDefinitions(4));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  // Recurrent Charge is Afterimage but does not produce a hostile ordinary Core Trace.
  state = applyAcquire(state, defs, AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  state = applyAcquire(state, defs, GRAVEMARK_CORE_IDS.IMPACT_VECTOR, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  const missing = previewAcquire(state, defs, CONVERGENCE_IDS.PARALLAX_ECHO, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(missing.eligible, false);
  assert.ok(missing.rejectionReasons.includes('MISSING_PRODUCER'), missing.rejectionReasons.join(','));

  // Swap in an actual hostile ordinary Core Trace producer (Phantom Impact, ARMAMENT) -> eligible.
  // Pair with a DIFFERENT-imprint Gravemark Core (Folded Space, DISCIPLINE) so it does not overwrite it.
  let state2 = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  state2 = applyAcquire(state2, defs, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  state2 = applyAcquire(state2, defs, GRAVEMARK_CORE_IDS.FOLDED_SPACE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  const withProducer = previewAcquire(state2, defs, CONVERGENCE_IDS.PARALLAX_ECHO, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(withProducer.eligible, true, withProducer.rejectionReasons.join(','));
}

// --- Overwrite protection: cannot remove the last live Core producer required by an owned
// Sector 4 Convergence unless another qualifying Core from that parent Strain remains ---
{
  const defs = indexDefinitions(getProductionOfferDefinitions(4));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  // Crossed Hex (DISCIPLINE) so it does not collide with Crystal Edge's ARMAMENT imprint slot.
  state = applyAcquire(state, defs, WOUNDWEAVE_CORE_IDS.CROSSED_HEX, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  state = applyAcquire(state, defs, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  state = applyAcquire(state, defs, CONVERGENCE_IDS.CRYSTAL_LIGATURE, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  assert.ok(state.convergences.includes(CONVERGENCE_IDS.CRYSTAL_LIGATURE));

  // Attempting to overwrite the only Shardskin Core (CRYSTAL_EDGE is the sole ARMAMENT-imprint
  // Shardskin producer here) with another ARMAMENT Core from a different Strain must be blocked
  // because it would leave the owned Crystal Ligature Convergence without a live Shardskin producer.
  const preview = previewAcquire(state, defs, GRAVEMARK_CORE_IDS.IMPACT_VECTOR, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  assert.equal(preview.overwrittenCoreId, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, 'Impact Vector and Crystal Edge share the ARMAMENT imprint slot');
  assert.equal(preview.eligible, false, 'overwrite must be blocked — it is the last live Shardskin producer for an owned Convergence');
  assert.ok(preview.rejectionReasons.includes('DEPENDENCY_PROTECTION'), preview.rejectionReasons.join(','));
  assert.ok(preview.dependentDisplayNames.some((name) => name.includes('Crystal Ligature')), 'preview names the affected dependent by display name');

  // Adding a SECOND qualifying Shardskin Core first means the overwrite no longer removes the
  // last live producer, so it becomes legal again. Perfect Facet (INSTINCT) avoids colliding with
  // Crossed Hex's (DISCIPLINE) or Crystal Edge's (ARMAMENT) imprint slots.
  let state2 = state;
  state2 = applyAcquire(state2, defs, SHARDSKIN_CORE_IDS.PERFECT_FACET, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  }).after;
  const previewWithSecondProducer = previewAcquire(state2, defs, GRAVEMARK_CORE_IDS.IMPACT_VECTOR, {
    maxAcquisitionWave: 4,
    equippedWeaponFamilyId: 'aegis-longsword',
  });
  if (previewWithSecondProducer.overwrittenCoreId === SHARDSKIN_CORE_IDS.CRYSTAL_EDGE) {
    assert.equal(previewWithSecondProducer.eligible, true, 'a remaining qualifying Shardskin Core producer allows the overwrite');
  }
}

console.log('Stage E.3 — Sector 4 acquisition, eligibility, and overwrite protection passed');
