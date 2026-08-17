import assert from 'node:assert/strict';
import { COUNTERFATE_CORE_IDS, COUNTERFATE_VERDICT_ID } from '../types/counterfate';
import { RITUAL_CADENCE_CORE_IDS, RITUAL_CADENCE_VERDICT_ID } from '../types/ritualCadence';
import { AFTERIMAGE_CORE_IDS, AFTERIMAGE_VERDICT_ID } from '../types/afterimage';
import { CONVERGENCE_IDS } from '../types/convergence';
import { createDefaultActiveIncursionState } from '../types/game';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createDefaultNineStrainRuntimeState, createLiveNineStrainRuntimeState, hydrateNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hydrateNineStrainIncursionFields } from './nineStrainRunState';
import {
  composeThreeCardOffer,
  elitePreviewRevealed,
  firstOmenStrainIds,
  markRewardConsumed,
  parseContactStrainOfferId,
  previewEliteContactStrain,
  resolveNineStrainRewardTrigger,
  sealPendingOffer,
  selectPendingStrain,
  shouldPresentNineStrainReward,
} from './nineStrain/acquisitionDirector';
import { createNineStrainRuntime } from './nineStrain/runtime';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';

console.log('Stage B.4 — Nine-Strain acquisition');

const live = getLiveUniversalBoonDefinitions();

function liveState() {
  return activateNineStrainAcquisition(createDefaultNineStrainRuntimeState(), {});
}

{
  const fresh = hydrateNineStrainIncursionFields(createDefaultActiveIncursionState());
  assert.equal(fresh.nineStrainRuntime.boonSystemMode, 'LEGACY_CLASS_CATALOG');
  const liveRun = createLiveNineStrainRuntimeState();
  assert.equal(liveRun.boonSystemMode, 'NINE_STRAIN');
  const hydratedLegacy = hydrateNineStrainRuntimeState({ boonSystemMode: 'LEGACY_CLASS_CATALOG' });
  assert.equal(hydratedLegacy.boonSystemMode, 'LEGACY_CLASS_CATALOG');
}

{
  const state = liveState();
  const omen = resolveNineStrainRewardTrigger(state, {
    nodeType: 'STANDARD_COMBAT',
    nodeId: 'n1',
    depth: 1,
    nodesCleared: 0,
    isBoss: false,
    combatVictory: true,
  });
  assert.equal(omen.kind, 'FIRST_OMEN_STRAIN');
  const sealed = sealPendingOffer(state, {
    nodeType: 'STANDARD_COMBAT',
    nodeId: 'n1',
    depth: 1,
    nodesCleared: 0,
    isBoss: false,
    combatVictory: true,
  }, 'FIRST_OMEN_STRAIN', 'aegis-longsword');
  assert.equal(sealed.acquisition.pendingOffer?.cardIds.length, 3);
  assert.ok(sealed.acquisition.pendingOffer?.cardIds.every((id) => parseContactStrainOfferId(id)));
  const strains = firstOmenStrainIds(state, 1, 'aegis-longsword');
  assert.equal(strains.length, 3);
  const afterPick = selectPendingStrain(sealed, 'COUNTERFATE', 'aegis-longsword');
  assert.equal(afterPick.acquisition.pendingOffer?.cardIds.length, 3);
  assert.equal(new Set(afterPick.acquisition.pendingOffer?.cardIds).size, 3);
  const cores = afterPick.acquisition.pendingOffer?.cardIds
    .map((id) => live.find((row) => row.id === id))
    .filter((row) => row?.role === 'CORE') ?? [];
  assert.ok(cores.length >= 2);
  assert.ok(new Set(cores.map((row) => row?.imprint)).size >= 2);
  const reloaded = hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(afterPick)));
  assert.deepEqual(reloaded.acquisition.pendingOffer?.cardIds, afterPick.acquisition.pendingOffer?.cardIds);
}

{
  const state = liveState();
  const depth3 = resolveNineStrainRewardTrigger(state, {
    nodeType: 'BOSS_COMBAT',
    nodeId: 'boss3',
    depth: 3,
    nodesCleared: 20,
    isBoss: true,
    combatVictory: true,
  });
  assert.equal(depth3.offer, false);
}

{
  let state = liveState();
  state = { ...state, acquisition: { ...state.acquisition, firstOmenClaimed: true, combatVictories: 1 } };
  const guaranteed = resolveNineStrainRewardTrigger(state, {
    nodeType: 'STANDARD_COMBAT',
    nodeId: 'd1-std',
    depth: 1,
    nodesCleared: 2,
    isBoss: false,
    combatVictory: true,
  });
  assert.equal(guaranteed.kind, 'CONTACT');
  const elite = resolveNineStrainRewardTrigger(state, {
    nodeType: 'ELITE_COMBAT',
    nodeId: 'elite-1',
    depth: 1,
    nodesCleared: 3,
    isBoss: false,
    combatVictory: true,
  });
  assert.equal(elite.kind, 'ELITE_CONTACT');
  const veil = resolveNineStrainRewardTrigger(state, {
    nodeType: 'VEIL_BLEED_BOON',
    nodeId: 'veil-1',
    depth: 1,
    nodesCleared: 4,
    isBoss: false,
    combatVictory: false,
  });
  assert.equal(veil.kind, 'CONTACT');
}

{
  assert.equal(elitePreviewRevealed('RELIABLE'), true);
  assert.equal(elitePreviewRevealed('DEGRADED'), false);
  assert.equal(elitePreviewRevealed('STRANGE'), false);
  const label = previewEliteContactStrain({ certainty: 'RELIABLE', nodeId: 'e1', seed: 's' });
  assert.ok(
    label === 'Counterfate'
    || label === 'Ritual Cadence'
    || label === 'Afterimage'
    || label === 'Stillpoint'
    || label === 'Woundweave',
  );
  assert.equal(previewEliteContactStrain({ certainty: 'DEGRADED', nodeId: 'e1', seed: 's' }), null);
}

{
  const rt = createNineStrainRuntime({ definitions: live });
  rt.hydrate(liveState());
  rt.commit(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.commit(RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION);
  const preview = rt.preview(CONVERGENCE_IDS.FATED_REFRAIN);
  assert.equal(preview.eligible, true);
  const missing = createNineStrainRuntime({ definitions: live });
  missing.hydrate(liveState());
  missing.commit(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  assert.equal(missing.preview(CONVERGENCE_IDS.FATED_REFRAIN).eligible, false);
}

{
  const rt = createNineStrainRuntime({ definitions: live });
  rt.hydrate(liveState());
  rt.commit(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.commit(RITUAL_CADENCE_CORE_IDS.MEASURED_INVOCATION);
  rt.commit(CONVERGENCE_IDS.FATED_REFRAIN);
  const blocked = rt.preview(AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.rejectionReasons.includes('DEPENDENCY_PROTECTION'));
  rt.commit(COUNTERFATE_CORE_IDS.BORROWED_ENDING);
  const allowed = rt.preview(AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  assert.equal(allowed.eligible, true);
}

{
  const rt = createNineStrainRuntime({ definitions: live });
  rt.hydrate(liveState());
  rt.commit(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  const dup = rt.preview(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  assert.equal(dup.eligible, false);
  assert.ok(dup.rejectionReasons.includes('ALREADY_OWNED'));
}

{
  const state = liveState();
  const composed = composeThreeCardOffer(state, 'COUNTERFATE', 'seed-a', {
    boss: false,
    depth: 1,
    weaponFamilyId: 'aegis-longsword',
    firstOffer: true,
  });
  assert.equal(composed.cardIds.length, 3);
  assert.equal(new Set(composed.cardIds).size, 3);
}

{
  const rt = createNineStrainRuntime({ definitions: live });
  rt.hydrate(liveState());
  rt.commit(COUNTERFATE_CORE_IDS.SEVERED_OUTCOME);
  rt.commit(RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
  rt.commit(AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT);
  const cap = rt.preview(COUNTERFATE_CORE_IDS.REFUSAL_PATTERN);
  assert.equal(cap.rejectionReasons.includes('STRAIN_CAP'), false);
  const fourthStrain = rt.preview('STILLPOINT' as string);
  void fourthStrain;
}

{
  for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
    assert.equal(canFireWeaponUltimate(family), true);
    const rt = createNineStrainRuntime({ definitions: live });
    rt.hydrate(liveState());
    rt.commit(COUNTERFATE_CORE_IDS.SECOND_REFLEX);
    const verdict = rt.preview(COUNTERFATE_VERDICT_ID, {
      premiumVerdictSource: true,
      equippedWeaponFamilyId: family,
    });
    assert.equal(verdict.eligible, true, family);
    const ritual = rt.preview(RITUAL_CADENCE_VERDICT_ID, {
      premiumVerdictSource: true,
      equippedWeaponFamilyId: family,
    });
    assert.equal(ritual.eligible, false);
    rt.commit(RITUAL_CADENCE_CORE_IDS.CLOSING_STRIKE);
    const ritualOk = rt.preview(RITUAL_CADENCE_VERDICT_ID, {
      premiumVerdictSource: true,
      equippedWeaponFamilyId: family,
    });
    assert.equal(ritualOk.eligible, true, `rc ${family}`);
    rt.commit(COUNTERFATE_VERDICT_ID, { premiumVerdictSource: true, equippedWeaponFamilyId: family });
    const image = rt.preview(AFTERIMAGE_VERDICT_ID, {
      premiumVerdictSource: true,
      equippedWeaponFamilyId: family,
    });
    assert.equal(image.eligible, false, `ai occupied ${family}`);
    const imageReplace = rt.preview(AFTERIMAGE_VERDICT_ID, {
      premiumVerdictSource: true,
      allowVerdictReplace: true,
      equippedWeaponFamilyId: family,
    });
    assert.equal(imageReplace.eligible, true, `ai replace ${family}`);
  }
}

{
  let state = liveState();
  state = sealPendingOffer(state, {
    nodeType: 'BOSS_COMBAT',
    nodeId: 'boss1',
    depth: 1,
    nodesCleared: 8,
    isBoss: true,
    combatVictory: true,
  }, 'BOSS_PREMIUM', 'aegis-longsword', 'COUNTERFATE');
  if (state.acquisition.pendingOffer?.cardIds.length === 3) {
    const consumed = markRewardConsumed({
      ...state,
      acquisition: {
        ...state.acquisition,
        pendingOffer: state.acquisition.pendingOffer,
      },
    });
    assert.ok(consumed.acquisition.consumedRewardSourceIds.length >= 1);
  }
}

{
  const legacy = createDefaultNineStrainRuntimeState();
  assert.equal(shouldPresentNineStrainReward(legacy, {
    nodeType: 'ELITE_COMBAT',
    nodeId: 'x',
    depth: 1,
    nodesCleared: 1,
    isBoss: false,
    combatVictory: true,
  }), false);
}

{
  const state = liveState();
  const vendor = resolveNineStrainRewardTrigger(state, {
    nodeType: 'BLACK_MARKET',
    nodeId: 'vendor-1',
    depth: 1,
    nodesCleared: 0,
    isBoss: false,
    combatVictory: false,
  });
  assert.equal(vendor.kind, null);
  const sanctuary = resolveNineStrainRewardTrigger(state, {
    nodeType: 'SANCTUARY',
    nodeId: 'sanctuary-1',
    depth: 1,
    nodesCleared: 1,
    isBoss: false,
    combatVictory: false,
  });
  assert.equal(sanctuary.kind, 'FIRST_OMEN_STRAIN');
  const sealed = sealPendingOffer(state, {
    nodeType: 'SANCTUARY',
    nodeId: 'sanctuary-1',
    depth: 1,
    nodesCleared: 1,
    isBoss: false,
    combatVictory: false,
  }, 'FIRST_OMEN_STRAIN', 'aegis-longsword');
  const again = resolveNineStrainRewardTrigger(sealed, {
    nodeType: 'RESOURCE_HARVEST',
    nodeId: 'res-1',
    depth: 1,
    nodesCleared: 2,
    isBoss: false,
    combatVictory: false,
  });
  assert.equal(again.kind, 'FIRST_OMEN_STRAIN');
  assert.equal(again.offer, true);
}

{
  assert.equal(elitePreviewRevealed('JAMMED'), false);
  assert.equal(elitePreviewRevealed(undefined), false);
}

console.log('Stage B.4 — Nine-Strain acquisition passed');
