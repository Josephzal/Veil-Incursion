import assert from 'node:assert/strict';
import { CONVERGENCE_IDS, SECTOR_1_STRAIN_IDS, SECTOR_2_CONVERGENCE_IDS, SECTOR_2_STRAIN_IDS } from '../types/convergence';
import { COUNTERFATE_CORE_IDS } from '../types/counterfate';
import { RITUAL_CADENCE_CORE_IDS } from '../types/ritualCadence';
import { AFTERIMAGE_CORE_IDS } from '../types/afterimage';
import { STILLPOINT_CORE_IDS } from '../types/stillpoint';
import { WOUNDWEAVE_CORE_IDS } from '../types/woundweave';
import {
  getLiveUniversalBoonDefinitions,
  getProductionOfferDefinitions,
  getSector1ProductionDefinitions,
  indexDefinitions,
} from './nineStrain/definitionCatalog';
import {
  createDefaultNineStrainRuntimeState,
  createLiveNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
} from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import {
  firstOmenStrainIds,
  parseContactStrainOfferId,
  sealPendingOffer,
  selectPendingStrain,
  unlockedStrainIds,
} from './nineStrain/acquisitionDirector';
import { applyAcquire, previewAcquire } from './nineStrain/ownership';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';

console.log('Stage C.3 — Sector 2 acquisition');

assert.equal(getSector1ProductionDefinitions().length, 27);
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getLiveUniversalBoonDefinitions().length, 66);
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 2);

{
  const schema8 = hydrateNineStrainRuntimeState({
    schemaVersion: 8,
    boonSystemMode: 'NINE_STRAIN',
    maxAcquisitionWave: 2,
    acquisition: {
      pendingOffer: {
        kind: 'CONTACT',
        sourceId: 'STANDARD_COMBAT:n1:d1',
        nodeId: 'n1',
        depth: 1,
        strainId: 'COUNTERFATE',
        cardIds: ['CF_CORE_SEVERED_OUTCOME', 'CF_CORE_REFUSAL_PATTERN', 'CF_SUPPORT_CHOSEN_FATE'],
        seed: 'sealed',
        rngCursor: 2,
        replacementPreview: {},
        failClosedDiagnostic: null,
      },
    },
  });
  assert.equal(schema8.maxAcquisitionWave, 1);
  assert.deepEqual(schema8.acquisition.pendingOffer?.cardIds, [
    'CF_CORE_SEVERED_OUTCOME',
    'CF_CORE_REFUSAL_PATTERN',
    'CF_SUPPORT_CHOSEN_FATE',
  ]);
}

{
  const liveRun = createLiveNineStrainRuntimeState();
  assert.equal(liveRun.maxAcquisitionWave, 2);
  assert.equal(unlockedStrainIds(liveRun.maxAcquisitionWave).length, 5);
  const omen = firstOmenStrainIds(liveRun, 1, 'aegis-longsword', 'seed-a');
  assert.equal(omen.length, 3);
  assert.equal(new Set(omen).size, 3);
  const seen = new Set<string>();
  for (let seed = 0; seed < 80; seed += 1) {
    for (const id of firstOmenStrainIds(liveRun, 1, 'aegis-longsword', `s${seed}`)) seen.add(id);
  }
  for (const id of [...SECTOR_1_STRAIN_IDS, ...SECTOR_2_STRAIN_IDS]) {
    assert.ok(seen.has(id), `reachable ${id}`);
  }
}

{
  const wave1 = activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {});
  assert.equal(wave1.maxAcquisitionWave, 1);
  const omen = firstOmenStrainIds(wave1, 1, 'aegis-longsword');
  assert.deepEqual(omen.slice().sort(), [...SECTOR_1_STRAIN_IDS].slice().sort());
  const defs = indexDefinitions(getLiveUniversalBoonDefinitions());
  const locked = previewAcquire(wave1, defs, STILLPOINT_CORE_IDS.STORED_FORCE, { maxAcquisitionWave: 1 });
  assert.equal(locked.eligible, false);
  assert.ok(locked.rejectionReasons.includes('WAVE_LOCKED'));
}

{
  const state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  const sealed = sealPendingOffer(state, {
    nodeType: 'STANDARD_COMBAT',
    nodeId: 'n1',
    depth: 1,
    nodesCleared: 0,
    isBoss: false,
    combatVictory: true,
  }, 'FIRST_OMEN_STRAIN', 'aegis-longsword');
  assert.equal(sealed.acquisition.pendingOffer?.cardIds.length, 3);
  const pick = parseContactStrainOfferId(sealed.acquisition.pendingOffer?.cardIds[0] ?? '');
  assert.ok(pick);
  const after = selectPendingStrain(sealed, pick, 'aegis-longsword');
  assert.equal(after.acquisition.pendingOffer?.cardIds.length, 3);
  const cores = after.acquisition.pendingOffer?.cardIds
    .map((id) => getLiveUniversalBoonDefinitions().find((row) => row.id === id))
    .filter((row) => row?.role === 'CORE') ?? [];
  assert.ok(cores.length >= 2);
}

{
  const defs = indexDefinitions(getProductionOfferDefinitions(2));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  const cf = applyAcquire(state, defs, COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(cf.eligible, true);
  state = cf.after;
  const sp = applyAcquire(state, defs, STILLPOINT_CORE_IDS.PATIENT_INVOCATION, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(sp.eligible, true);
  state = sp.after;
  const stayed = previewAcquire(state, defs, CONVERGENCE_IDS.STAYED_SENTENCE, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(stayed.eligible, true, stayed.rejectionReasons.join(','));
  const missing = previewAcquire(cf.after, defs, CONVERGENCE_IDS.STAYED_SENTENCE, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(missing.eligible, false);
}

{
  const defs = indexDefinitions(getProductionOfferDefinitions(2));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  for (const id of [COUNTERFATE_CORE_IDS.SEVERED_OUTCOME, STILLPOINT_CORE_IDS.PATIENT_INVOCATION, CONVERGENCE_IDS.STAYED_SENTENCE]) {
    const next = applyAcquire(state, defs, id, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' });
    assert.equal(next.eligible, true, id);
    state = next.after;
  }
  const overwrite = previewAcquire(state, defs, RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(overwrite.eligible, false);
  assert.ok(overwrite.rejectionReasons.includes('DEPENDENCY_PROTECTION'));
  assert.ok(overwrite.dependentDisplayNames.includes('Stayed Sentence'));
}

{
  const defs = indexDefinitions(getProductionOfferDefinitions(2));
  let state = activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {});
  state = applyAcquire(state, defs, AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' }).after;
  state = applyAcquire(state, defs, WOUNDWEAVE_CORE_IDS.SHARED_WOUND, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' }).after;
  const ghost = previewAcquire(state, defs, CONVERGENCE_IDS.GHOST_THREAD, { maxAcquisitionWave: 2, equippedWeaponFamilyId: 'aegis-longsword' });
  assert.equal(ghost.eligible, true);
}

assert.equal(SECTOR_2_CONVERGENCE_IDS.includes(CONVERGENCE_IDS.DRAWN_TENSION), true);
assert.ok(RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);

console.log('Stage C.3 — Sector 2 acquisition passed');
