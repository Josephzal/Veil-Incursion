/**
 * Phase 3K — weapon↔enemy / sector matchup validation suite.
 */
import assert from 'node:assert/strict';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';
import { ALL_SECTOR_IDS, sectorIdToVeilBiome } from './sectorBiomeBridge';
import { allDefinedEnemyKeys } from './enemyDefinitions';
import { WEAPON_DRAWBACK_RECORDS } from './weaponDrawbackEngine';
import { getWeaponLoadoutRecommendationProfile } from './weaponLoadoutRecommendationProfiles';
import { getWeaponGraftRecommendationProfile, validateWeaponGraftRecommendationProfiles } from './graftSynergy/weaponGraftRecommendationProfiles';
import { evaluateGraftCompatibility } from './graftSynergy/graftCompatibilityEngine';
import { buildLoadoutTagLayers, buildBoonOfferContext } from './boonOffer/boonOfferContext';
import { buildEligibleWeightedPool } from './boonOffer/boonOfferSelection';
import {
  assertUniqueLiveEnemyAudit,
  listLiveEnemyAudit,
} from './weaponMatchup/enemyRosterAudit';
import {
  assertSectorDepthDeckIntegrity,
  isObsoleteDepth3BiomeModelUnused,
  auditSectorDepthDecks,
} from './weaponMatchup/sectorDepthDeckAudit';
import {
  assertNoNonviableOrdinaryMatchups,
  assertWeaponHasFavorableAndPressure,
  listWeaponEnemyMatchups,
  summarizeWeaponMatchupSpread,
  getWeaponEnemyMatchup,
} from './weaponMatchup/weaponEnemyMatchupEngine';
import {
  assertAllSectorsViableForAllWeapons,
  listWeaponSectorMatchups,
} from './weaponMatchup/weaponSectorMatchupEngine';
import {
  proveArmorBreakAppliesFracture,
  proveKineticDoesNotHitWards,
  proveOccultDoesNotHitArmor,
  proveTrueDamageIgnoresLayers,
  proveWardBreakAppliesFracture,
  proveMitigationRouting,
} from './weaponMatchup/defenseLayerValidation';
import { inspectWeaponMatchup } from './weaponMatchup/matchupInspectEngine';
import {
  runDeterministicMatchupSimulation,
  summarizeMatchupSimulation,
} from './weaponMatchup/matchupSimulationEngine';
import { DEPTH_3_BIOME_POOL } from './macroBiomeEngine';
import { CLASS_RANK_MAX } from './classRankEngine';

// Enemy audit uniqueness
{
  assert.equal(assertUniqueLiveEnemyAudit().length, 0);
  assert.equal(listLiveEnemyAudit().length, allDefinedEnemyKeys().length);
  assert.equal(listLiveEnemyAudit().length, 51);
  assert.ok(!allDefinedEnemyKeys().includes('RIOT_VANGUARD' as never));
  assert.ok(allDefinedEnemyKeys().includes('ECHOING_BRUTE'));
  assert.ok(!listLiveEnemyAudit().some((e) => e.id === ('RIOT_VANGUARD' as never)));
  assert.ok(listLiveEnemyAudit().every((e) => e.id !== ('RIOT_VANGUARD' as never)));
  assert.equal(
    listLiveEnemyAudit().filter((e) => e.id === 'ECHOING_BRUTE').length,
    1,
  );
}

// Sector × depth decks
{
  assert.equal(assertSectorDepthDeckIntegrity().length, 0, assertSectorDepthDeckIntegrity().join('; '));
  assert.equal(auditSectorDepthDecks().length, 15);
  assert.equal(isObsoleteDepth3BiomeModelUnused(), true);
  assert.ok(DEPTH_3_BIOME_POOL.includes('DEEP_VEIL'));
  // Combat does not leave the selected sector at Depth 3
  ALL_SECTOR_IDS.forEach((sectorId) => {
    const row = auditSectorDepthDecks().find((r) => r.sectorId === sectorId && r.depth === 3)!;
    assert.equal(row.veilBiome, sectorIdToVeilBiome(sectorId));
    assert.equal(row.depth3PreservesSector, true);
  });
}

// Defense routing
{
  assert.equal(proveTrueDamageIgnoresLayers(), true);
  assert.equal(proveKineticDoesNotHitWards(), true);
  assert.equal(proveOccultDoesNotHitArmor(), true);
  const armorBreak = proveArmorBreakAppliesFracture();
  assert.equal(armorBreak.broke, true);
  assert.equal(armorBreak.fractured, true);
  const wardBreak = proveWardBreakAppliesFracture();
  assert.equal(wardBreak.broke, true);
  assert.equal(wardBreak.fractured, true);
  const kineticOnArmor = proveMitigationRouting('KINETIC', 2, 0, 100);
  assert.ok(kineticOnArmor.reduced > 0);
}

// Matchup matrix gates
{
  assert.equal(listWeaponEnemyMatchups().length, 9 * 51);
  assert.ok(!listWeaponEnemyMatchups().some((r) => String(r.enemyId) === 'RIOT_VANGUARD'));
  assert.equal(
    listWeaponEnemyMatchups().filter((r) => r.enemyId === 'ECHOING_BRUTE').length,
    9,
  );
  // Legacy alias input canonicalizes to ECHOING_BRUTE matchup
  assert.equal(
    getWeaponEnemyMatchup('aegis-longsword', 'RIOT_VANGUARD').enemyId,
    'ECHOING_BRUTE',
  );
  assert.equal(
    getWeaponEnemyMatchup('aegis-longsword', 'RIOT_VANGUARD').key,
    getWeaponEnemyMatchup('aegis-longsword', 'ECHOING_BRUTE').key,
  );
  assert.equal(assertNoNonviableOrdinaryMatchups().length, 0);
  assert.equal(assertAllSectorsViableForAllWeapons().length, 0);
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    assert.equal(assertWeaponHasFavorableAndPressure(id).length, 0, assertWeaponHasFavorableAndPressure(id).join('; '));
    assert.ok(WEAPON_DRAWBACK_RECORDS[id].compensationMustNotErase.length > 0);
  });
}

// Phase 3H loadouts remain legal (class-specific combat structures)
{
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const p = getWeaponLoadoutRecommendationProfile(id);
    assert.equal(p.sampleLoadouts.length, 2);
    // Aegis / Hex W.2: 3 persisted flex/technique slots (weapon actions family-derived).
    // Envoy: 4-slot deck (fixed basic + 3 flex).
    const expectedSlots = getWeaponFamily(id).classId === 'ENVOY' ? 4 : 3;
    p.sampleLoadouts.forEach((s) => assert.equal(s.slots.length, expectedSlots, `${id} ${s.kind}`));
  });
}

// Phase 3J Sanctuary configs remain legal
{
  assert.equal(validateWeaponGraftRecommendationProfiles().length, 0);
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const p = getWeaponGraftRecommendationProfile(id);
    const classId = getWeaponFamily(id).classId;
    [p.configurations[0], p.configurations[1]].forEach((cfg) => {
      const map: Record<string, string> = {};
      cfg.assignments.forEach((a) => {
        const compat = evaluateGraftCompatibility({
          classId,
          abilityId: a.abilityId,
          graftId: a.graftId,
          runDepthBand: cfg.assignments.length > 1 ? 3 : 1,
          equippedMap: map,
          graftAvailable: true,
        });
        assert.equal(compat.ok, true, `${id} ${a.graftId}: ${compat.rejections.join(',')}`);
        map[a.abilityId] = a.graftId;
      });
    });
  });
}

// Natural vs grafted matchup inspection distinct
{
  const natural = inspectWeaponMatchup({
    weaponFamilyId: 'hex-shotgun',
    enemyId: 'WARDEN',
    buildState: 'NATURAL_UNGRAFTED_UNBOONED',
  });
  const grafted = inspectWeaponMatchup({
    weaponFamilyId: 'hex-shotgun',
    enemyId: 'WARDEN',
    abilityGrafts: { SINGULARITY_SLUG: 'GHOST_BEAM_GRAFT' },
    buildState: 'RANK3_SANCTUARY_GRAFT',
  });
  assert.ok(natural.finalTags != null);
  assert.ok(grafted.finalTransformedProperties.some((l) => l.includes('ARMOR_PIERCE') || l.includes('graftAdded')));
  assert.ok(grafted.classificationReasons.some((r) => r.includes('GHOST_BEAM') || r.includes('graft')));
}

// Recommendation / matchup data alone — zero runtime weight on boon pool
{
  const ctx = buildBoonOfferContext({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-carbine',
    equippedAbilityIds: getWeaponLoadoutRecommendationProfile('hex-carbine').sampleLoadouts[0].slots as unknown as string[],
    ownedBoonIds: [],
    seed: '3k-rec-alone',
  });
  assert.ok(buildEligibleWeightedPool(ctx).length >= 3);
  // Calling matchup inspect must not mutate pool
  inspectWeaponMatchup({ weaponFamilyId: 'hex-carbine', enemyId: 'MIASMA_SWARM' });
  assert.ok(buildEligibleWeightedPool(ctx).length >= 3);
}

// Sanctuary graft changes subsequent tag layers (Phase 3I feed)
{
  const before = buildLoadoutTagLayers({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-shotgun',
    equippedAbilityIds: getWeaponLoadoutRecommendationProfile('hex-shotgun').sampleLoadouts[0].slots as unknown as string[],
  });
  const after = buildLoadoutTagLayers({
    classId: 'HEX_SHOT',
    weaponFamilyId: 'hex-shotgun',
    equippedAbilityIds: getWeaponLoadoutRecommendationProfile('hex-shotgun').sampleLoadouts[0].slots as unknown as string[],
    abilityGrafts: { SINGULARITY_SLUG: 'GHOST_BEAM_GRAFT' },
  });
  assert.ok(after.finalTransformedTags.includes('ARMOR_PIERCE'));
  assert.ok(after.finalTransformedTags.includes('ARMOR_PIERCE') || after.graftAddedTags.includes('ARMOR_PIERCE') || before.finalTransformedTags.includes('ARMOR_PIERCE'));
}

// Sibling starters not universally optimal / specialists not obsolete starters
{
  const longsword = summarizeWeaponMatchupSpread('aegis-longsword');
  const claymore = summarizeWeaponMatchupSpread('aegis-claymore');
  assert.ok(longsword.STRAINED > 0);
  assert.ok(claymore.FAVORABLE > longsword.FAVORABLE || claymore.STRAINED > 0);
  const sidearm = summarizeWeaponMatchupSpread('hex-revolver');
  const pulse = summarizeWeaponMatchupSpread('hex-carbine');
  const nullbreach = summarizeWeaponMatchupSpread('hex-shotgun');
  assert.ok(sidearm.STRAINED > 0);
  assert.ok(pulse.FAVORABLE > 0 && pulse.STRAINED > 0);
  assert.ok(nullbreach.STRAINED > 0);
  const conduit = summarizeWeaponMatchupSpread('envoy-scythe');
  const prism = summarizeWeaponMatchupSpread('envoy-sanguine-prism');
  assert.ok(conduit.FAVORABLE > 0 && conduit.STRAINED > 0);
  assert.ok(prism.STRAINED > 0);
}

// Pulse missing-target redirect absent (carry 3J invariant)
{
  const m = getWeaponEnemyMatchup('hex-carbine', 'WARDEN');
  assert.notEqual(m.classification, 'NONVIABLE_DEFECT');
}

// Sector coverage for all weapons
{
  assert.equal(listWeaponSectorMatchups().length, 9 * 5 * 3);
}

// Deterministic simulation
{
  const rows = runDeterministicMatchupSimulation('phase3k-test');
  const summary = summarizeMatchupSimulation(rows);
  assert.ok(summary.total > 100);
  assert.equal(summary.illegalConfigs, 0);
  assert.equal(summary.nonviable, 0);
}

// Phase 3J rank max still 20 (lifecycle preserved)
{
  assert.equal(CLASS_RANK_MAX, 20);
}

console.log('weaponEnemyMatchupPhase3K.test.ts: OK');
console.log(`enemies=${listLiveEnemyAudit().length} matchups=${listWeaponEnemyMatchups().length} sectorRows=${listWeaponSectorMatchups().length}`);
