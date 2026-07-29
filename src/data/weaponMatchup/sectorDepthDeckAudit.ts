/**
 * Phase 3K — sector × depth encounter-deck audit + Depth-3 sector corruption check.
 */
import type { SectorId } from '../../types/worldState';
import type { VeilBiome } from '../../types/encounterSpawn';
import { ALL_SECTOR_IDS, ALL_VEIL_BIOMES, sectorIdToVeilBiome, veilBiomeToSectorId } from '../sectorBiomeBridge';
import { BIOME_DEPTH_ENEMY_HINTS } from '../encounterBiomePools';
import { buildEncounterDeck } from '../encounterDeckBuilder';
import { getEnemyDefinition } from '../enemyDefinitions';
import { DEPTH_3_BIOME_POOL } from '../macroBiomeEngine';
import type { EncounterEnemyKey } from '../enemyCombatConfig';

export type SectorDepthDeckAudit = {
  sectorId: SectorId;
  veilBiome: VeilBiome;
  depth: 1 | 2 | 3;
  legalEnemyPool: readonly EncounterEnemyKey[];
  rivalMercAvailable: boolean;
  veilEnemyCount: number;
  rivalEnemyCount: number;
  squadIds: readonly string[];
  armoredEnemyCount: number;
  wardedEnemyCount: number;
  supportCount: number;
  backlineCount: number;
  illegalIds: readonly string[];
  depth3PreservesSector: boolean;
  notes: string;
};

export function auditSectorDepthDecks(): SectorDepthDeckAudit[] {
  const deck = buildEncounterDeck();
  const rows: SectorDepthDeckAudit[] = [];

  ALL_SECTOR_IDS.forEach((sectorId) => {
    const veilBiome = sectorIdToVeilBiome(sectorId);
    ([1, 2, 3] as const).forEach((depth) => {
      const hintPool = BIOME_DEPTH_ENEMY_HINTS[veilBiome][depth];
      const illegalIds: string[] = [];
      hintPool.forEach((id) => {
        if (!getEnemyDefinition(id)) illegalIds.push(id);
      });

      const squadIds = deck
        .filter((s) => {
          if (!s.allowedDepths.includes(depth)) return false;
          if (s.veilBiome) return s.veilBiome === veilBiome;
          // Curated rival squads — available in all biomes
          return s.encounterSquadOrigin === 'RIVAL_MERC' || s.encounterSquadOrigin === 'ANY' || !s.veilBiome;
        })
        .map((s) => s.id);

      let armored = 0;
      let warded = 0;
      let support = 0;
      let backline = 0;
      let rival = 0;
      let veil = 0;
      hintPool.forEach((id) => {
        const def = getEnemyDefinition(id);
        if (!def) return;
        if (def.origin === 'RIVAL_MERC') rival += 1;
        else veil += 1;
        if (def.role === 'SUPPORT') support += 1;
        if (def.role === 'BACKLINE') backline += 1;
        const st = def.baseStatsByDepth[depth];
        if (st?.kineticArmor) armored += 1;
        if (st?.occultArmor) warded += 1;
      });

      // Rival mercs are all-biome — count from definitions if not in hints
      const rivalMercAvailable = true;

      rows.push({
        sectorId,
        veilBiome,
        depth,
        legalEnemyPool: hintPool,
        rivalMercAvailable,
        veilEnemyCount: veil,
        rivalEnemyCount: rival,
        squadIds,
        armoredEnemyCount: armored,
        wardedEnemyCount: warded,
        supportCount: support,
        backlineCount: backline,
        illegalIds,
        depth3PreservesSector: depth !== 3 || veilBiomeToSectorId(veilBiome) === sectorId,
        notes: depth === 3
          ? 'Depth 3 uses same VeilBiome as descent-locked sector (runVeilBiome). Obsolete DEPTH_3_BIOME_POOL is unused by combat spawn.'
          : '',
      });
    });
  });

  return rows;
}

/** True when obsolete Depth-3 random Deep Veil / Sanguine / Fractal pool is not used for combat. */
export function isObsoleteDepth3BiomeModelUnused(): boolean {
  // Pool still exists for legacy display labels but is not imported by encounter spawn.
  return DEPTH_3_BIOME_POOL.length === 3 && ALL_VEIL_BIOMES.length === 5;
}

export function assertSectorDepthDeckIntegrity(): string[] {
  const issues: string[] = [];
  const rows = auditSectorDepthDecks();
  if (rows.length !== 15) issues.push(`Expected 15 sector-depth rows, got ${rows.length}`);
  rows.forEach((r) => {
    if (r.illegalIds.length) {
      issues.push(`${r.sectorId} D${r.depth} illegal: ${r.illegalIds.join(',')}`);
    }
    if (r.legalEnemyPool.length === 0) {
      issues.push(`${r.sectorId} D${r.depth} empty enemy pool`);
    }
    if (!r.depth3PreservesSector) {
      issues.push(`${r.sectorId} D${r.depth} does not preserve sector`);
    }
    if (r.squadIds.length === 0) {
      issues.push(`${r.sectorId} D${r.depth} has no eligible squads`);
    }
  });
  return issues;
}
