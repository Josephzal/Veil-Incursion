/**
 * Phase 3I — boon synergy / offer weighting tests + seeded simulations.
 */
import assert from 'node:assert/strict';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';
import { getWeaponLoadoutRecommendationProfile } from './weaponLoadoutRecommendationProfiles';
import { validateAffinityVocabulary, distinguishingAffinityTags } from './boonOffer/weaponAffinityVocabulary';
import {
  listFrozenInteractionHooks,
  listRejectedInteractionHooks,
  WEAPON_INTERACTION_HOOK_CONTRACT,
} from './boonOffer/weaponInteractionHookContract';
import { buildBoonOfferContext, buildLoadoutTagLayers } from './boonOffer/boonOfferContext';
import { evaluateHardEligibility } from './boonOffer/boonHardEligibility';
import { computeSoftWeight } from './boonOffer/boonSoftWeighting';
import {
  buildEligibleWeightedPool,
  selectSeededBoonOffers,
  inspectBoonOfferWeight,
} from './boonOffer/boonOfferSelection';
import { listLiveBoonAuditEntries, getLiveBoonAuditEntry } from './boonOffer/boonSynergyInventory';
import { preparePostCombatBoonOffers } from './classBoonEngine';
import { AEGIS_ANCHOR, sanitizeAegisCombatLoadout } from '../utils/aegisLoadoutUtils';
import { getAbilityTags } from './aegisAbilities';

function sampleSlots(weaponId: (typeof ALL_WEAPON_FAMILY_IDS)[number], kind: 0 | 1) {
  return getWeaponLoadoutRecommendationProfile(weaponId).sampleLoadouts[kind].slots;
}

// --- Affinity freeze ---
{
  const issues = validateAffinityVocabulary();
  assert.equal(issues.length, 0, issues.join('; '));
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    assert.ok(distinguishingAffinityTags(id).length >= 1, `${id} distinguishing affinity`);
  });
}

// --- Interaction hooks ---
{
  assert.ok(listFrozenInteractionHooks().length >= 20);
  assert.deepEqual(listRejectedInteractionHooks().sort(), [
    'CROWD_CONTROL',
    'DEFENSIVE_TEMPO',
    'PRIORITY_TARGET',
  ]);
  listFrozenInteractionHooks().forEach((id) => {
    const e = WEAPON_INTERACTION_HOOK_CONTRACT[id];
    assert.ok(e.runtimeProducer && e.runtimeProducer !== '—', id);
  });
}

// --- Hard eligibility before weighting; affinity alone never grants ---
{
  const ctx = buildBoonOfferContext({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-runed-longsword',
    equippedAbilityIds: ['STRIKE', 'DEMONS_LUNG', 'VEIL_PIERCER', 'ASHEN_MANTLE'],
    ownedBoonIds: [],
    seed: 'elig-1',
  });
  // Hex boon wrong class
  const wrong = evaluateHardEligibility('HAIR_TRIGGER', ctx);
  assert.equal(wrong.eligible, false);
  assert.ok(wrong.rejections.includes('WRONG_CLASS_POOL'));

  // Affinity-only: fabricate entry with no tags/hooks but preferred affinity
  const affinityOnly = {
    ...getLiveBoonAuditEntry('ADRENALINE_SPIKE')!,
    id: 'FAKE_AFFINITY_ONLY',
    hardRequiredTags: ['DOES_NOT_EXIST'] as const,
    preferredAffinityTags: ['MELEE'] as const,
    requiredHooks: [] as const,
    requiredAbilityIds: [] as const,
    live: true,
    runtimeImplemented: true,
  };
  const aff = evaluateHardEligibility('FAKE_AFFINITY_ONLY', ctx, affinityOnly as never);
  assert.equal(aff.eligible, false);
  assert.ok(aff.rejections.includes('REQUIRED_TAG_MISSING'));
}

// --- Required ability cannot be satisfied by recommendation profile ---
{
  const entry = {
    ...getLiveBoonAuditEntry('ADRENALINE_SPIKE')!,
    id: 'FAKE_ABILITY_GATED',
    hardRequiredTags: [] as const,
    requiredAbilityIds: ['RUIN'] as const,
    requiredHooks: [] as const,
    live: true,
    runtimeImplemented: true,
  };
  const without = buildBoonOfferContext({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-runed-longsword',
    equippedAbilityIds: ['DEMONS_LUNG', 'VEIL_PIERCER', 'ASHEN_MANTLE'],
    ownedBoonIds: [],
    seed: 'abil-1',
  });
  assert.equal(evaluateHardEligibility('FAKE_ABILITY_GATED', without, entry as never).eligible, false);

  const withRuin = buildBoonOfferContext({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-runed-longsword',
    equippedAbilityIds: ['RUIN', 'VEIL_PIERCER', 'ASHEN_MANTLE'],
    ownedBoonIds: [],
    seed: 'abil-2',
  });
  assert.equal(evaluateHardEligibility('FAKE_ABILITY_GATED', withRuin, entry as never).eligible, true);
}

// --- Graft tag layers change eligibility ---
{
  const base = buildLoadoutTagLayers({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-claymore-blade',
    equippedAbilityIds: ['DEVASTATE', 'DEMONS_LUNG', 'RUIN'],
  });
  assert.ok(base.finalTransformedTags.includes('FRACTURE') || base.runtimeBasicTags.includes('FRACTURE'));

  const removed = buildLoadoutTagLayers({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-claymore-blade',
    equippedAbilityIds: ['DEMONS_LUNG', 'ASHEN_MANTLE', 'REAVE'],
    basicActionRuntimeTags: ['MELEE', 'KINETIC', 'FRACTURE', 'HEAVY'],
    graft: { removeTags: ['FRACTURE'] },
  });
  assert.ok(removed.graftRemovedTags.includes('FRACTURE'));
  assert.ok(!removed.finalTransformedTags.includes('FRACTURE'));

  const added = buildLoadoutTagLayers({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-silver-core-sidearm',
    equippedAbilityIds: ['SILVER_CORE_SIDEARM', 'REVENANTS_ECHO', 'RIFT_SNARE', 'ASTRAL_TARGET_LOCK'],
    graft: { addTag: 'ARMOR_PIERCE' },
  });
  assert.ok(added.finalTransformedTags.includes('ARMOR_PIERCE'));
  assert.ok(added.finalTransformedTags.includes('VOID_AMMO'));
}

// --- RUIN AoE tags participate when equipped ---
{
  const tags = getAbilityTags('RUIN');
  assert.ok(tags.length > 0);
  const withRuin = buildLoadoutTagLayers({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-runed-longsword',
    equippedAbilityIds: ['RUIN', 'VEIL_PIERCER', 'ASHEN_MANTLE'],
  });
  tags.forEach((t) => assert.ok(withRuin.finalTransformedTags.includes(t), t));

  const aoeBoon = {
    ...getLiveBoonAuditEntry('ADRENALINE_SPIKE')!,
    id: 'FAKE_AOE_TAG',
    hardRequiredTags: ['AOE'] as const,
    preferredTags: ['AOE'] as const,
    requiredAbilityIds: [] as const,
    requiredHooks: [] as const,
    live: true,
    runtimeImplemented: true,
  };
  const ctxMissing = buildBoonOfferContext({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-runed-longsword',
    equippedAbilityIds: ['DEMONS_LUNG', 'VEIL_PIERCER', 'ASHEN_MANTLE'],
    ownedBoonIds: [],
    seed: 'fault-1',
  });
  const ctxPresent = buildBoonOfferContext({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-runed-longsword',
    equippedAbilityIds: ['RUIN', 'VEIL_PIERCER', 'ASHEN_MANTLE'],
    ownedBoonIds: [],
    seed: 'fault-2',
  });
  assert.equal(evaluateHardEligibility('FAKE_AOE_TAG', ctxMissing, aoeBoon as never).eligible, false);
  assert.equal(evaluateHardEligibility('FAKE_AOE_TAG', ctxPresent, aoeBoon as never).eligible, true);
}

// --- Conflicts reduce weight but do not ban ---
{
  const ctx = buildBoonOfferContext({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-silver-core-sidearm',
    equippedAbilityIds: sampleSlots('hex-silver-core-sidearm', 0) as unknown as string[],
    ownedBoonIds: [],
    seed: 'conflict-1',
  });
  const hard = evaluateHardEligibility('EXTENDED_MAGS', ctx);
  assert.equal(hard.eligible, true);
  const soft = computeSoftWeight('EXTENDED_MAGS', ctx);
  assert.ok(soft.conflictPenalty < 0);
  assert.ok(soft.finalWeight > 0);
  assert.ok(soft.synergyMultiplierClamped >= 0.65);
}

// --- Seeded deterministic + without replacement ---
{
  const args = {
    classId: 'AEGIS' as const,
    weaponFamilyId: 'aegis-runed-longsword' as const,
    equippedAbilityIds: sampleSlots('aegis-runed-longsword', 0) as unknown as string[],
    ownedBoonIds: [] as string[],
    seed: 'det-seed-42',
    isFirstOffer: true,
  };
  const a = selectSeededBoonOffers(buildBoonOfferContext(args));
  const b = selectSeededBoonOffers(buildBoonOfferContext(args));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
  assert.equal(a.length, 3);
}

// --- First-offer composition has direct synergy when available ---
{
  const ctx = buildBoonOfferContext({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-silver-core-sidearm',
    equippedAbilityIds: sampleSlots('hex-silver-core-sidearm', 0) as unknown as string[],
    ownedBoonIds: [],
    seed: 'first-1',
    isFirstOffer: true,
  });
  const pool = buildEligibleWeightedPool(ctx);
  assert.ok(pool.some((c) => c.isDirect));
  const offer = selectSeededBoonOffers(ctx);
  const inspects = offer.map((id) => inspectBoonOfferWeight(id, ctx));
  assert.ok(inspects.some((i) => (i.soft?.directLoadoutContribution ?? 0) > 0));
}

// --- Dead/retired cannot be offered ---
{
  const dead = listLiveBoonAuditEntries().filter((e) => !e.live);
  dead.forEach((e) => {
    const ctx = buildBoonOfferContext({
      classId: e.classId,
      weaponFamilyId:
        e.classId === 'HEX_SHOT'
          ? 'hex-silver-core-sidearm'
          : e.classId === 'ENVOY'
            ? 'envoy-null-conduit'
            : 'aegis-runed-longsword',
      equippedAbilityIds:
        e.classId === 'HEX_SHOT'
          ? sampleSlots('hex-silver-core-sidearm', 0)
          : e.classId === 'ENVOY'
            ? sampleSlots('envoy-null-conduit', 0)
            : sampleSlots('aegis-runed-longsword', 0),
      ownedBoonIds: [],
      seed: `dead-${e.id}`,
    } as never);
    assert.equal(evaluateHardEligibility(e.id, ctx, e).eligible, false);
  });
}

// --- Legacy Hex: VOID_AMMO tag path does not restore deprecated ability IDs ---
{
  const ctx = buildBoonOfferContext({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-void-cannon',
    equippedAbilityIds: sampleSlots('hex-void-cannon', 0) as unknown as string[],
    ownedBoonIds: [],
    seed: 'legacy-1',
  });
  assert.ok(ctx.tagLayers.finalTransformedTags.includes('VOID_AMMO'));
  assert.ok(!ctx.equippedAbilityIds.includes('WRAITH_PIERCER_ROUND'));
  const voidBoon = evaluateHardEligibility('VOID_BANDOLEER', ctx);
  assert.equal(voidBoon.eligible, true);
}

// --- Aegis weapon basic remains reachable (derived; not a technique slot) ---
{
  const sanitized = sanitizeAegisCombatLoadout(['DEMONS_LUNG', 'VEIL_PIERCER', 'ASHEN_MANTLE', 'GRAVE_BIND']);
  assert.equal(sanitized.length, 3);
  assert.ok(!sanitized.includes(AEGIS_ANCHOR as never));
  const ctx = buildBoonOfferContext({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-rift-edge',
    equippedAbilityIds: sanitized,
    ownedBoonIds: [],
    seed: 'aegis-basic',
  });
  // Anchor STRIKE is still the boon-context basic identity; not persisted in technique loadout.
  assert.ok(ctx.reachableHooks.includes('WEAPON_BASIC'));
}

// --- Equipped overrides advisory anti-synergy (no hard ban) ---
{
  const ctx = buildBoonOfferContext({
    classId: 'AEGIS',
    weaponFamilyId: 'aegis-runed-longsword',
    equippedAbilityIds: ['STRIKE', 'REAVE', 'DEMONS_LUNG', 'ASHEN_MANTLE'],
    ownedBoonIds: [],
    seed: 'anti-1',
  });
  // REAVE is advisory anti on Longsword — melee boons still eligible
  const pool = buildEligibleWeightedPool(ctx);
  assert.ok(pool.length > 0);
  assert.ok(pool.every((c) => c.soft.finalWeight > 0));
}

// --- Weapon-family exclusivity limited ---
{
  const exclusives = listLiveBoonAuditEntries().filter((e) => e.weaponFamilyExclusive);
  assert.equal(exclusives.length, 0, 'no ordinary weapon-ID exclusive boons in live catalog');
}

// --- Weighted prepare path ---
{
  const offers = preparePostCombatBoonOffers(
    'ENVOY',
    [],
    [],
    [],
    3,
    {
      weaponFamilyId: 'envoy-echo-lantern',
      equippedAbilityIds: sampleSlots('envoy-echo-lantern', 0) as unknown as string[],
      seed: 'weighted-envoy-1',
      isFirstOffer: true,
    },
  );
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map((o) => o.id)).size, 3);
}

// --- Per-weapon direct support where catalog allows ---
{
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const def = getWeaponFamily(id);
    const slots = sampleSlots(id, 0);
    const ctx = buildBoonOfferContext({
      classId: def.classId,
      weaponFamilyId: id,
      equippedAbilityIds: slots as unknown as string[],
      ownedBoonIds: [],
      seed: `support-${id}`,
      isFirstOffer: true,
    });
    const pool = buildEligibleWeightedPool(ctx);
    assert.ok(pool.length >= 3, `${id} eligible pool`);
    assert.ok(pool.some((c) => c.isDirect), `${id} has direct synergy candidate`);
  });
}

// --- Seeded simulations ---
type SimRow = {
  weapon: string;
  sample: number;
  phase: string;
  pool: number;
  directRate: number;
  nonConflictRate: number;
  deadRate: number;
  allConflictPanels: number;
  offers: string[];
};

const simRows: SimRow[] = [];
const offerCounts = new Map<string, number>();
let allConflictWhenAlternative = 0;
let firstOfferMissingDirect = 0;

ALL_WEAPON_FAMILY_IDS.forEach((weapon) => {
  const def = getWeaponFamily(weapon);
  ([0, 1] as const).forEach((sample) => {
    const slots = sampleSlots(weapon, sample);
    (
      [
        { phase: 'opening', owned: [], engines: [], depth: 1 as const, first: true },
        { phase: 'early', owned: [], engines: [], depth: 1 as const, first: false },
        {
          phase: 'depth2-engine',
          owned: [] as string[],
          engines: ['BALLISTIC', 'SPELL', 'MELEE_FRACTURE', 'VOID_AMMO', 'RELOAD', 'CURSE', 'FLUX'],
          depth: 2 as const,
          first: false,
        },
        { phase: 'depth3', owned: [] as string[], engines: ['BALLISTIC', 'SPELL'], depth: 3 as const, first: false },
      ] as const
    ).forEach((phase, pi) => {
      const ctx = buildBoonOfferContext({
        classId: def.classId,
        weaponFamilyId: weapon,
        equippedAbilityIds: slots as unknown as string[],
        ownedBoonIds: phase.owned,
        acquiredEngineFamilies: phase.engines,
        depthBand: phase.depth,
        isFirstOffer: phase.first,
        seed: `sim:${weapon}:${sample}:${phase.phase}:${pi}`,
      });
      const pool = buildEligibleWeightedPool(ctx);
      const offer = selectSeededBoonOffers(ctx);
      offer.forEach((id) => offerCounts.set(id, (offerCounts.get(id) ?? 0) + 1));
      const inspects = offer.map((id) => inspectBoonOfferWeight(id, ctx));
      assert.ok(inspects.every((i) => i.hard.eligible), 'zero hard-ineligible offers');
      assert.equal(new Set(offer).size, offer.length, 'no duplicates');
      const directN = inspects.filter((i) => (i.soft?.directLoadoutContribution ?? 0) > 0).length;
      const nonConflictN = inspects.filter((i) => (i.soft?.conflictPenalty ?? 0) >= 0).length;
      const allConflict = inspects.every((i) => (i.soft?.conflictPenalty ?? 0) < 0);
      if (allConflict && pool.some((c) => !c.isConflict)) allConflictWhenAlternative += 1;
      if (phase.first && directN < 1 && pool.some((c) => c.isDirect)) firstOfferMissingDirect += 1;
      simRows.push({
        weapon,
        sample,
        phase: phase.phase,
        pool: pool.length,
        directRate: directN / Math.max(1, offer.length),
        nonConflictRate: nonConflictN / Math.max(1, offer.length),
        deadRate: 0,
        allConflictPanels: allConflict ? 1 : 0,
        offers: offer,
      });
    });
  });
});

assert.equal(allConflictWhenAlternative, 0, 'zero all-conflict panels when alternative exists');
assert.equal(firstOfferMissingDirect, 0, 'first offer always has direct when available');

const neverOffered = listLiveBoonAuditEntries()
  .filter((e) => e.live)
  .filter((e) => !offerCounts.has(e.id))
  .map((e) => e.id);

console.log('boonOfferPhase3I.test.ts: OK');
console.log(`sim panels=${simRows.length} neverOffered≈${neverOffered.length}`);
console.log(`top offered=${[...offerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}:${v}`).join(', ')}`);
