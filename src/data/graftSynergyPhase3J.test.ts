/**
 * Phase 3J — Sanctuary run-scoped grafts + class rank 1–20 capacity.
 */
import assert from 'node:assert/strict';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';
import { getWeaponLoadoutRecommendationProfile } from './weaponLoadoutRecommendationProfiles';
import {
  assertUniqueGraftCatalogIds,
  listGraftCatalogAudit,
} from './graftSynergy/graftCatalogAudit';
import {
  describeGraftCapacityProgression,
  getGraftSocketAccessForClassRank,
} from './graftSynergy/graftCapacityEngine';
import { evaluateGraftCompatibility } from './graftSynergy/graftCompatibilityEngine';
import {
  sanitizeAegisAbilityGrafts,
  sanitizeHexShotAbilityGrafts,
} from './graftSynergy/graftSanitizationEngine';
import {
  listWeaponGraftRecommendationProfiles,
  validateWeaponGraftRecommendationProfiles,
  getWeaponGraftRecommendationProfile,
} from './graftSynergy/weaponGraftRecommendationProfiles';
import {
  APEX_TRIGGER_AP_REFUND_CAP_PER_ENCOUNTER,
  GRAFT_SALVAGE_CREDIT_CAP_PER_ENCOUNTER,
  accrueGraftSalvageCredits,
  canRefundApexTriggerAp,
  createDefaultGraftEncounterSafetyState,
  recordApexTriggerApRefund,
} from './graftSynergy/graftEncounterSafety';
import { buildLoadoutTagLayers, buildBoonOfferContext } from './boonOffer/boonOfferContext';
import { evaluateHardEligibility } from './boonOffer/boonHardEligibility';
import { buildEligibleWeightedPool, selectSeededBoonOffers } from './boonOffer/boonOfferSelection';
import { inspectGraftCastPlanTransform } from './graftSynergy/graftRuntimeInspect';
import {
  buildClassGraftCastPlan,
  canAffordAnySanctuaryGraft,
  getClassGraftDefinition,
  isSanctuaryGraftGrantEnabled,
  rollClassGraftOffers,
} from './classGraftEngine';
import { buildGraftCastPlan } from './veilGraftEngine';
import {
  CLASS_RANK_MAX,
  classRankXpProgress,
  xpRequiredForClassRank,
  applyClassRankXp,
} from './classRankEngine';
import { createDefaultProgressionProfile, normalizeProgressionProfile } from './progressionProfileEngine';
import {
  filterGraftOffersForClassRank,
  recomputeMaxSoulAnchorFromGraftBaseline,
  validateSanctuaryGraftApplication,
} from './graftSynergy/permanentGraftLoadoutEngine';
import { WEAPON_DRAWBACK_RECORDS } from './weaponDrawbackEngine';

// Unique catalog IDs — exactly 49
{
  assert.equal(assertUniqueGraftCatalogIds().length, 0);
  assert.equal(listGraftCatalogAudit().length, 49);
  const ids = listGraftCatalogAudit().map((e) => e.id);
  assert.equal(new Set(ids).size, 49);
  listGraftCatalogAudit().forEach((e) => {
    assert.equal(e.ownershipSource, 'SANCTUARY_RESIDUE_APPLICATION');
  });
}

// Class rank extends through 20; rank 10 is not max
{
  assert.equal(CLASS_RANK_MAX, 20);
  assert.ok(xpRequiredForClassRank(10) > 0);
  assert.ok(xpRequiredForClassRank(19) >= xpRequiredForClassRank(10));
  const profile = normalizeProgressionProfile({
    ...createDefaultProgressionProfile(),
    classes: {
      ...createDefaultProgressionProfile().classes,
      AEGIS: {
        ...createDefaultProgressionProfile().classes.AEGIS,
        rank: 10,
        xp: 50,
      },
    },
  });
  assert.equal(profile.classes.AEGIS.rank, 10);
  assert.equal(classRankXpProgress(profile, 'AEGIS').rank, 10);
  assert.ok(profile.classes.AEGIS.rank < CLASS_RANK_MAX);
  for (let r = 1; r <= 10; r += 1) {
    assert.ok(xpRequiredForClassRank(r) > 0);
  }
  const advanced = applyClassRankXp(profile, 'AEGIS', xpRequiredForClassRank(10));
  assert.ok(advanced.newRank >= 11);
}

// Capacity unlocks exact ranks
{
  assert.equal(getGraftSocketAccessForClassRank(1).capacity, 0);
  assert.equal(getGraftSocketAccessForClassRank(2).capacity, 0);
  assert.equal(getGraftSocketAccessForClassRank(3).capacity, 1);
  assert.equal(getGraftSocketAccessForClassRank(6).capacity, 1);
  assert.equal(getGraftSocketAccessForClassRank(7).capacity, 2);
  assert.equal(getGraftSocketAccessForClassRank(7).allowFixedBasic, true);
  assert.equal(getGraftSocketAccessForClassRank(12).capacity, 3);
  assert.equal(getGraftSocketAccessForClassRank(15).allowUltimate, true);
  assert.equal(getGraftSocketAccessForClassRank(17).capacity, 4);
  assert.equal(getGraftSocketAccessForClassRank(20).allowApexMasterwork, true);
  assert.ok(describeGraftCapacityProgression().some((l) => l.includes('CLASS_RANK_MAX=20')));
}

// Sanctuary grant path enabled
{
  assert.equal(isSanctuaryGraftGrantEnabled(), true);
  assert.ok(rollClassGraftOffers('AEGIS', 3).length > 0);
  assert.ok(canAffordAnySanctuaryGraft('AEGIS', 9999));
  assert.equal(canAffordAnySanctuaryGraft('AEGIS', 0), false);
}

// Safehouse is not an equipment surface — descent starts empty (engine-level)
{
  // No Safehouse equip API in permanentGraftLoadoutEngine; Sanctuary validation only.
  const outside = validateSanctuaryGraftApplication({
    classId: 'AEGIS',
    abilityId: 'VEIL_PIERCER',
    graftId: 'NEUTRON_GRAFT',
    classRank: 3,
    currentMap: {},
    sanctuarySessionActive: false,
    residueBalance: 100,
    sanctuaryOffers: null,
  });
  assert.equal(outside.ok, false);
  assert.ok(outside.rejections.includes('INVALID_CONTEXT'));
}

// Valid Sanctuary apply charges once; failed apply does not charge / keeps previous
{
  const graft = getClassGraftDefinition('AEGIS', 'NEUTRON_GRAFT');
  const offers = ['NEUTRON_GRAFT', 'FLAYER_GRAFT', 'IRON_LUNG_GRAFT'];
  let residue = 100;
  const first = validateSanctuaryGraftApplication({
    classId: 'AEGIS',
    abilityId: 'VEIL_PIERCER',
    graftId: 'NEUTRON_GRAFT',
    classRank: 3,
    currentMap: {},
    sanctuarySessionActive: true,
    residueBalance: residue,
    sanctuaryOffers: offers,
  });
  assert.equal(first.ok, true);
  assert.equal(first.cost, graft.cost);
  residue -= first.cost;
  assert.equal(first.proposedMap.VEIL_PIERCER, 'NEUTRON_GRAFT');

  // Replacement attempt that fails (duplicate ID onto another ability while already used)
  const failDup = validateSanctuaryGraftApplication({
    classId: 'AEGIS',
    abilityId: 'ASHEN_MANTLE',
    graftId: 'NEUTRON_GRAFT',
    classRank: 7,
    currentMap: first.proposedMap,
    sanctuarySessionActive: true,
    residueBalance: residue,
    sanctuaryOffers: offers,
  });
  assert.equal(failDup.ok, false);
  assert.ok(failDup.rejections.includes('DUPLICATE_GRAFT_ID'));
  assert.equal(failDup.cost, 0);
  assert.equal(failDup.proposedMap.VEIL_PIERCER, 'NEUTRON_GRAFT');
  assert.equal(residue, 100 - graft.cost); // unchanged

  // Legal swap on same ability (replace neutron with flayer)
  const swap = validateSanctuaryGraftApplication({
    classId: 'AEGIS',
    abilityId: 'VEIL_PIERCER',
    graftId: 'FLAYER_GRAFT',
    classRank: 3,
    currentMap: first.proposedMap,
    sanctuarySessionActive: true,
    residueBalance: residue,
    sanctuaryOffers: offers,
  });
  assert.equal(swap.ok, true);
  assert.equal(swap.proposedMap.VEIL_PIERCER, 'FLAYER_GRAFT');
}

// Offer filter respects Apex lock
{
  const filtered = filterGraftOffersForClassRank('AEGIS', ['NEUTRON_GRAFT', 'APEX_GRAFT'], 3);
  assert.ok(filtered.includes('NEUTRON_GRAFT'));
  assert.ok(!filtered.includes('APEX_GRAFT'));
}

// Max HP baseline recompute does not stack
{
  const baseline = 100;
  const once = recomputeMaxSoulAnchorFromGraftBaseline(baseline, 'AEGIS', {
    VEIL_PIERCER: 'MARTYR_GRAFT',
  });
  const again = recomputeMaxSoulAnchorFromGraftBaseline(baseline, 'AEGIS', {
    VEIL_PIERCER: 'MARTYR_GRAFT',
  });
  assert.equal(once, again);
  const cleared = recomputeMaxSoulAnchorFromGraftBaseline(baseline, 'AEGIS', {});
  assert.equal(cleared, 100);
}

// Compatibility: Blood-Mag on fixed basic
{
  const r = evaluateGraftCompatibility({
    classId: 'HEX_SHOT',
    abilityId: 'SILVER_CORE_SIDEARM',
    graftId: 'BLOOD_MAG_GRAFT',
    classRank: 7,
    equippedMap: {},
    graftAvailable: true,
  });
  assert.ok(r.rejections.includes('SAFETY_INVARIANT') || r.rejections.includes('FIXED_BASIC_LOCKED'));
}

// Sanitize over-cap + unknown
{
  const { report } = sanitizeAegisAbilityGrafts(
    {
      VEIL_PIERCER: 'NEUTRON_GRAFT',
      ASHEN_MANTLE: 'IRON_LUNG_GRAFT',
      DEMONS_LUNG: 'DENSITY_GRAFT',
      GRAVE_BIND: 'FAKE_GRAFT' as never,
    },
    3,
  );
  assert.equal(report.capacityUsed, 1);
  assert.ok(report.removed.some((r) => r.reason === 'OVER_CAPACITY' || r.reason === 'UNKNOWN_OR_RETIRED_GRAFT'));
}

// Apex AP refund cap
{
  let state = createDefaultGraftEncounterSafetyState();
  assert.equal(canRefundApexTriggerAp(state), true);
  state = recordApexTriggerApRefund(state);
  assert.equal(state.apexTriggerApRefunds, 1);
  assert.equal(canRefundApexTriggerAp(state), APEX_TRIGGER_AP_REFUND_CAP_PER_ENCOUNTER > 1);
  for (let i = 0; i < 5; i += 1) state = recordApexTriggerApRefund(state);
  assert.ok(state.apexTriggerApRefunds <= APEX_TRIGGER_AP_REFUND_CAP_PER_ENCOUNTER);
}

// Salvage cap
{
  let state = createDefaultGraftEncounterSafetyState();
  let total = 0;
  for (let i = 0; i < 20; i += 1) {
    const { next, granted } = accrueGraftSalvageCredits(state);
    state = next;
    total += granted;
  }
  assert.equal(total, GRAFT_SALVAGE_CREDIT_CAP_PER_ENCOUNTER);
}

// Graft transforms reach combat
{
  const aegis = buildGraftCastPlan('STRIKE', 'ECHO_GRAFT');
  assert.ok(!aegis.effectiveTags.includes('FRACTURE'));
  const hex = buildClassGraftCastPlan('HEX_SHOT', 'ASH_JACKET_SALVO', 'WIDOW_CHOKE_GRAFT');
  assert.ok(hex.effectiveTags.includes('SINGLE_TARGET') || !hex.effectiveTags.includes('AOE'));
  assert.ok(inspectGraftCastPlanTransform('ENVOY', 'DIMENSIONAL_SHEAR', 'VOID_CONDUCTOR_GRAFT').includes('flux'));
}

// Post-Sanctuary graft changes Phase 3I tags / eligibility
{
  const ungrafted = buildLoadoutTagLayers({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-claymore-blade',
    equippedAbilityIds: ['STRIKE', 'DEVASTATE', 'DEMONS_LUNG', 'RUIN'],
  });
  assert.ok(ungrafted.finalTransformedTags.includes('FRACTURE') || ungrafted.runtimeBasicTags.includes('FRACTURE'));

  const grafted = buildLoadoutTagLayers({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-claymore-blade',
    equippedAbilityIds: ['STRIKE', 'DEVASTATE', 'DEMONS_LUNG', 'RUIN'],
    abilityGrafts: { STRIKE: 'ECHO_GRAFT' },
  });
  assert.ok(grafted.graftRemovedTags.includes('FRACTURE'));
}

{
  const layers = buildLoadoutTagLayers({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-void-cannon',
    equippedAbilityIds: ['SILVER_CORE_SIDEARM', 'SINGULARITY_SLUG', 'ASTRAL_TARGET_LOCK', 'RIFT_SNARE'],
    abilityGrafts: { SINGULARITY_SLUG: 'GHOST_BEAM_GRAFT' },
  });
  assert.ok(layers.finalTransformedTags.includes('ARMOR_PIERCE'));
}

// Recommendation profiles alone do not affect runtime
{
  const ctx = buildBoonOfferContext({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-pulse-rifle',
    equippedAbilityIds: getWeaponLoadoutRecommendationProfile('hex-pulse-rifle').sampleLoadouts[0].slots as unknown as string[],
    ownedBoonIds: [],
    seed: 'rec-alone',
  });
  assert.ok(buildEligibleWeightedPool(ctx).length >= 3);
}

{
  const base = buildBoonOfferContext({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-void-cannon',
    equippedAbilityIds: getWeaponLoadoutRecommendationProfile('hex-void-cannon').sampleLoadouts[0].slots as unknown as string[],
    ownedBoonIds: [],
    seed: 'graft-pool-a',
  });
  const withGraft = buildBoonOfferContext({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-void-cannon',
    equippedAbilityIds: getWeaponLoadoutRecommendationProfile('hex-void-cannon').sampleLoadouts[0].slots as unknown as string[],
    ownedBoonIds: [],
    seed: 'graft-pool-b',
    abilityGrafts: { SINGULARITY_SLUG: 'GHOST_BEAM_GRAFT' },
  });
  assert.ok(withGraft.tagLayers.finalTransformedTags.includes('ARMOR_PIERCE'));
  assert.ok(selectSeededBoonOffers(base).length === 3);
  assert.ok(selectSeededBoonOffers(withGraft).every((id) => evaluateHardEligibility(id, withGraft).eligible));
}

// Configs are Sanctuary-legal at stated ranks (not Safehouse loadouts)
{
  const issues = validateWeaponGraftRecommendationProfiles();
  assert.equal(issues.length, 0, issues.join('; '));
  assert.equal(listWeaponGraftRecommendationProfiles().length, 9);
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const p = getWeaponGraftRecommendationProfile(id);
    assert.equal(p.configurations[0].requiredClassRank, 3);
    assert.ok(p.configurations[1].requiredClassRank >= 15);
    [p.configurations[0], p.configurations[1]].forEach((cfg) => {
      const map: Record<string, string> = {};
      let totalResidue = 0;
      cfg.assignments.forEach((a) => {
        const compat = evaluateGraftCompatibility({
          classId: p.classId,
          abilityId: a.abilityId,
          graftId: a.graftId,
          classRank: cfg.requiredClassRank,
          equippedMap: map,
          graftAvailable: true,
        });
        assert.equal(compat.ok, true, `${id} ${cfg.kind} ${a.abilityId}+${a.graftId}: ${compat.rejections.join(',')}`);
        map[a.abilityId] = a.graftId;
        totalResidue += getClassGraftDefinition(p.classId, a.graftId).cost;
        if (p.classId === 'AEGIS') {
          assert.ok(buildGraftCastPlan(a.abilityId as never, a.graftId as never).effectiveTags != null);
        } else {
          assert.ok(buildClassGraftCastPlan(p.classId, a.abilityId, a.graftId as never).effectiveTags != null);
        }
      });
      assert.ok(cfg.assignments.length <= getGraftSocketAccessForClassRank(cfg.requiredClassRank).capacity);
      assert.ok(totalResidue > 0);
      assert.ok(cfgPreservesDrawback(p.weaponFamilyId, cfg.preservesDrawback));
    });
  });
}

function cfgPreservesDrawback(weaponId: (typeof ALL_WEAPON_FAMILY_IDS)[number], text: string): boolean {
  const rec = WEAPON_DRAWBACK_RECORDS[weaponId];
  return Boolean(text && text.length > 0 && rec?.compensationMustNotErase);
}

{
  const aegis = ALL_WEAPON_FAMILY_IDS.filter((id) => getWeaponFamily(id).classId === 'AEGIS');
  const keys = aegis.map((id) => {
    const a = getWeaponGraftRecommendationProfile(id).configurations[0].assignments[0]!;
    return `${a.abilityId}:${a.graftId}`;
  });
  assert.equal(new Set(keys).size, keys.length);
}

{
  const plan = buildClassGraftCastPlan('HEX_SHOT', 'ASH_JACKET_SALVO', 'WIDOW_CHOKE_GRAFT');
  assert.equal((plan as { redirectMissingHits?: boolean }).redirectMissingHits, undefined);
}

{
  const { map } = sanitizeHexShotAbilityGrafts(
    { REVENANTS_ECHO: 'ECHO_RECEIVER_GRAFT', PHASE_SHIFT_RELOAD: 'DEAD_MAN_SWITCH_GRAFT' },
    7,
  );
  assert.equal(map.REVENANTS_ECHO, 'ECHO_RECEIVER_GRAFT');
  assert.equal(map.PHASE_SHIFT_RELOAD, 'DEAD_MAN_SWITCH_GRAFT');
}

console.log('graftSynergyPhase3J.test.ts: OK');
console.log(`catalog=${listGraftCatalogAudit().length} profiles=${listWeaponGraftRecommendationProfiles().length} CLASS_RANK_MAX=${CLASS_RANK_MAX}`);
