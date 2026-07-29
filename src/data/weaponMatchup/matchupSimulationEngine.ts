/**
 * Phase 3K — deterministic matchup simulation summaries (not combat monte-carlo).
 * Records configuration legality, tags, matchup class, and compensation routes.
 */
import type { WeaponFamilyId } from '../../types/weapon';
import type { SectorId } from '../../types/worldState';
import type { EncounterEnemyKey } from '../enemyCombatConfig';
import type { MatchupBuildState, MatchupClassification } from '../../types/weaponEnemyMatchup';
import { ALL_WEAPON_FAMILY_IDS } from '../weaponRegistry';
import { ALL_SECTOR_IDS } from '../sectorBiomeBridge';
import { getWeaponLoadoutRecommendationProfile } from '../weaponLoadoutRecommendationProfiles';
import { getWeaponGraftRecommendationProfile } from '../graftSynergy/weaponGraftRecommendationProfiles';
import { evaluateGraftCompatibility } from '../graftSynergy/graftCompatibilityEngine';
import { getWeaponFamily } from '../weaponRegistry';
import { buildLoadoutTagLayers } from '../boonOffer/boonOfferContext';
import { getWeaponEnemyMatchup } from './weaponEnemyMatchupEngine';
import { getWeaponSectorMatchup } from './weaponSectorMatchupEngine';
import { BIOME_DEPTH_ENEMY_HINTS } from '../encounterBiomePools';
import { sectorIdToVeilBiome } from '../sectorBiomeBridge';
import { WEAPON_DRAWBACK_RECORDS } from '../weaponDrawbackEngine';
import { allDefinedEnemyKeys } from '../enemyDefinitions';

export type MatchupSimRow = {
  seed: string;
  weaponFamilyId: WeaponFamilyId;
  buildState: MatchupBuildState;
  loadoutKind: string;
  sectorId: SectorId | null;
  depth: 1 | 2 | 3 | null;
  enemyId: EncounterEnemyKey | null;
  configLegal: boolean;
  finalTags: readonly string[];
  matchupClassification: MatchupClassification;
  compensationRoute: string;
  drawbackPreserved: boolean;
  notes: string;
};

function graftsForBuild(
  weaponFamilyId: WeaponFamilyId,
  buildState: MatchupBuildState,
): Record<string, string> {
  if (buildState === 'NATURAL_UNGRAFTED_UNBOONED' || buildState === 'PHASE_3H_LOADOUT' || buildState === 'PHASE_3I_BOON_STATE') {
    return {};
  }
  const profile = getWeaponGraftRecommendationProfile(weaponFamilyId);
  const cfg = buildState === 'RANK3_SANCTUARY_GRAFT'
    ? profile.configurations[0]
    : profile.configurations[1];
  const map: Record<string, string> = {};
  cfg.assignments.forEach((a) => {
    map[a.abilityId] = a.graftId;
  });
  return map;
}

function validateGraftMap(
  weaponFamilyId: WeaponFamilyId,
  buildState: MatchupBuildState,
  map: Record<string, string>,
): boolean {
  if (Object.keys(map).length === 0) return true;
  const classId = getWeaponFamily(weaponFamilyId).classId;
  const rank = buildState === 'RANK3_SANCTUARY_GRAFT' ? 3 : 17;
  const equipped: Record<string, string> = {};
  for (const [abilityId, graftId] of Object.entries(map)) {
    const compat = evaluateGraftCompatibility({
      classId,
      abilityId,
      graftId,
      classRank: rank,
      equippedMap: equipped,
      graftAvailable: true,
    });
    if (!compat.ok) return false;
    equipped[abilityId] = graftId;
  }
  return true;
}

export function runDeterministicMatchupSimulation(seed = 'phase3k'): MatchupSimRow[] {
  const rows: MatchupSimRow[] = [];
  const builds: MatchupBuildState[] = [
    'NATURAL_UNGRAFTED_UNBOONED',
    'PHASE_3H_LOADOUT',
    'RANK3_SANCTUARY_GRAFT',
    'MATURE_SANCTUARY_GRAFT',
  ];

  ALL_WEAPON_FAMILY_IDS.forEach((weaponFamilyId) => {
    const loadoutProfile = getWeaponLoadoutRecommendationProfile(weaponFamilyId);
    const drawback = WEAPON_DRAWBACK_RECORDS[weaponFamilyId];
    builds.forEach((buildState) => {
      const grafts = graftsForBuild(weaponFamilyId, buildState);
      const legal = validateGraftMap(weaponFamilyId, buildState, grafts);
      loadoutProfile.sampleLoadouts.forEach((sample) => {
        const layers = buildLoadoutTagLayers({
          classId: getWeaponFamily(weaponFamilyId).classId,
          weaponFamilyId,
          equippedAbilityIds: sample.slots as unknown as string[],
          abilityGrafts: grafts,
        });

        // Per-enemy sample (first 3 + one armored if present)
        const enemies = allDefinedEnemyKeys();
        const sampleEnemies = [enemies[0]!, enemies[Math.floor(enemies.length / 2)]!, enemies[enemies.length - 1]!];
        sampleEnemies.forEach((enemyId) => {
          const m = getWeaponEnemyMatchup(weaponFamilyId, enemyId);
          rows.push({
            seed: `${seed}:${weaponFamilyId}:${buildState}:${sample.kind}:${enemyId}`,
            weaponFamilyId,
            buildState,
            loadoutKind: sample.kind,
            sectorId: null,
            depth: null,
            enemyId,
            configLegal: legal,
            finalTags: layers.finalTransformedTags,
            matchupClassification: m.classification,
            compensationRoute: m.accessibleCompensation,
            drawbackPreserved: drawback.compensationMustNotErase.length > 0,
            notes: m.mechanicalReason,
          });
        });

        // Sector-depth aggregates
        ALL_SECTOR_IDS.forEach((sectorId) => {
          ([1, 2, 3] as const).forEach((depth) => {
            const sector = getWeaponSectorMatchup(weaponFamilyId, sectorId, depth);
            const pool = BIOME_DEPTH_ENEMY_HINTS[sectorIdToVeilBiome(sectorId)][depth];
            rows.push({
              seed: `${seed}:${weaponFamilyId}:${buildState}:${sample.kind}:${sectorId}:D${depth}`,
              weaponFamilyId,
              buildState,
              loadoutKind: sample.kind,
              sectorId,
              depth,
              enemyId: pool[0] ?? null,
              configLegal: legal,
              finalTags: layers.finalTransformedTags,
              matchupClassification: sector.classification,
              compensationRoute: sector.accessibleCompensation,
              drawbackPreserved: true,
              notes: sector.mechanicalReason,
            });
          });
        });
      });
    });
  });

  return rows;
}

export function summarizeMatchupSimulation(rows: MatchupSimRow[]): {
  total: number;
  illegalConfigs: number;
  nonviable: number;
  byWeapon: Record<string, { favorable: number; strained: number; even: number }>;
} {
  const byWeapon: Record<string, { favorable: number; strained: number; even: number }> = {};
  let illegalConfigs = 0;
  let nonviable = 0;
  rows.forEach((r) => {
    if (!r.configLegal) illegalConfigs += 1;
    if (r.matchupClassification === 'NONVIABLE_DEFECT') nonviable += 1;
    if (!byWeapon[r.weaponFamilyId]) byWeapon[r.weaponFamilyId] = { favorable: 0, strained: 0, even: 0 };
    if (r.matchupClassification === 'FAVORABLE') byWeapon[r.weaponFamilyId]!.favorable += 1;
    else if (r.matchupClassification === 'STRAINED') byWeapon[r.weaponFamilyId]!.strained += 1;
    else byWeapon[r.weaponFamilyId]!.even += 1;
  });
  return { total: rows.length, illegalConfigs, nonviable, byWeapon };
}
