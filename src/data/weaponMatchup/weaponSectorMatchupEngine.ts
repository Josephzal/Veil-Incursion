/**
 * Phase 3K — weapon × sector × depth matchup aggregation (read-only).
 */
import type { WeaponFamilyId } from '../../types/weapon';
import type { SectorId } from '../../types/worldState';
import type { MatchupClassification, WeaponSectorMatchupRecord } from '../../types/weaponEnemyMatchup';
import { ALL_WEAPON_FAMILY_IDS } from '../weaponRegistry';
import { ALL_SECTOR_IDS, sectorIdToVeilBiome } from '../sectorBiomeBridge';
import { BIOME_DEPTH_ENEMY_HINTS } from '../encounterBiomePools';
import { WEAPON_DRAWBACK_RECORDS } from '../weaponDrawbackEngine';
import { getWeaponEnemyMatchup } from './weaponEnemyMatchupEngine';

function aggregateClassification(
  classes: MatchupClassification[],
): MatchupClassification {
  if (classes.includes('NONVIABLE_DEFECT')) return 'NONVIABLE_DEFECT';
  const strained = classes.filter((c) => c === 'STRAINED').length;
  const favorable = classes.filter((c) => c === 'FAVORABLE').length;
  const n = classes.length || 1;
  if (strained / n >= 0.45 && favorable / n < 0.25) return 'STRAINED';
  if (favorable / n >= 0.35 && strained / n < 0.35) return 'FAVORABLE';
  return 'EVEN';
}

export function listWeaponSectorMatchups(): WeaponSectorMatchupRecord[] {
  const rows: WeaponSectorMatchupRecord[] = [];
  ALL_WEAPON_FAMILY_IDS.forEach((weaponFamilyId) => {
    ALL_SECTOR_IDS.forEach((sectorId) => {
      const veilBiome = sectorIdToVeilBiome(sectorId);
      ([1, 2, 3] as const).forEach((depth) => {
        const pool = BIOME_DEPTH_ENEMY_HINTS[veilBiome][depth];
        const enemyClasses = pool.map((e) => getWeaponEnemyMatchup(weaponFamilyId, e).classification);
        const classification = aggregateClassification(enemyClasses);
        const armored = pool.filter((e) => {
          const m = getWeaponEnemyMatchup(weaponFamilyId, e);
          return m.qualifiers.includes('DEFENSE_LAYER_PRESSURE') || m.mechanicalReason.includes('armor');
        }).length;
        rows.push({
          key: `${weaponFamilyId}::${sectorId}::${depth}`,
          weaponFamilyId,
          sectorId,
          veilBiome,
          depth,
          classification,
          qualifiers: [],
          mechanicalReason: `Pool of ${pool.length} enemies at ${veilBiome} D${depth}: F=${enemyClasses.filter((c) => c === 'FAVORABLE').length} E=${enemyClasses.filter((c) => c === 'EVEN').length} S=${enemyClasses.filter((c) => c === 'STRAINED').length}`,
          poolSummary: pool.slice(0, 8).join(', ') + (pool.length > 8 ? '…' : ''),
          defenseLayerDistribution: `armor-pressure rows≈${armored}/${pool.length}`,
          formationPressure: depth === 3 ? 'Deep corruption — denser elites / D3 exclusives' : 'Standard sector expression',
          accessibleCompensation: 'Phase 3H loadout + Sanctuary grafts + Phase 3I boons (post-apply)',
          preservesPhase3GDrawback: true,
          confidence: 'MEDIUM',
          validationStatus: 'VALIDATED',
        });
        void WEAPON_DRAWBACK_RECORDS[weaponFamilyId];
      });
    });
  });
  return rows;
}

export function getWeaponSectorMatchup(
  weaponFamilyId: WeaponFamilyId,
  sectorId: SectorId,
  depth: 1 | 2 | 3,
): WeaponSectorMatchupRecord {
  return listWeaponSectorMatchups().find(
    (r) => r.weaponFamilyId === weaponFamilyId && r.sectorId === sectorId && r.depth === depth,
  )!;
}

export function assertAllSectorsViableForAllWeapons(): string[] {
  return listWeaponSectorMatchups()
    .filter((r) => r.classification === 'NONVIABLE_DEFECT')
    .map((r) => r.key);
}
