import type { EncounterEnemyKey } from './enemyCombatConfig';
import {
  ENCOUNTER_KEY_TO_ROSTER,
  ENEMY_BASE_STATS,
  ENEMY_ARCHETYPE_FOR_KEY,
} from './enemyCombatConfig';
import { ENEMY_ROSTER } from './enemyRoster';
import type { EnemyRosterId } from './enemyRoster';
import {
  ENEMY_DEFINITIONS,
  allDefinedEnemyKeys,
  getEnemyDefinition,
  isDepth3ExclusiveEnemy,
} from './enemyDefinitions';
import { BIOME_DEPTH_ENEMY_HINTS } from './encounterBiomePools';
import { buildEncounterDeck, buildEliteDeck } from './encounterDeckBuilder';
import { enemyAllowedAtDepth } from './encounterSpawnGateEngine';
import type { VeilBiome } from '../types/encounterSpawn';
import { ALL_VEIL_BIOMES } from './sectorBiomeBridge';
import type { SynergySquadSpec } from './synergyEncounterTypes';

const LEGACY_ALIAS_KEYS: readonly EncounterEnemyKey[] = ['RIOT_VANGUARD'];
/** Injected at combat spawn — not drafted into biome squad decks. */
const INJECT_ONLY_ENEMY_KEYS: readonly EncounterEnemyKey[] = ['ANCHOR_HUSK'];

function collectDeckUnitKeys(squads: readonly SynergySquadSpec[]): EncounterEnemyKey[] {
  return squads.flatMap((squad) => squad.roster.map((unit) => unit.type));
}

function assertBiomePoolHints(): void {
  for (const biome of ALL_VEIL_BIOMES) {
    for (const depth of [1, 2, 3] as const) {
      for (const key of BIOME_DEPTH_ENEMY_HINTS[biome][depth]) {
        const def = getEnemyDefinition(key);
        if (!def) {
          throw new Error(`verifyEncounterCatalog: unknown pool enemy ${key} (${biome} D${depth})`);
        }
        if (def.origin === 'VEIL' && !def.biomeTags.includes(biome)) {
          throw new Error(
            `verifyEncounterCatalog: ${key} in ${biome} D${depth} pool but biomeTags=${def.biomeTags.join(',')}`,
          );
        }
        if (!enemyAllowedAtDepth(key, depth) && !LEGACY_ALIAS_KEYS.includes(key)) {
          throw new Error(
            `verifyEncounterCatalog: ${key} listed in ${biome} D${depth} pool but blocked by spawn gates`,
          );
        }
      }
    }
  }
}

function assertDefinitionRosterParity(): void {
  const definedKeys = new Set(allDefinedEnemyKeys());
  for (const key of Object.keys(ENCOUNTER_KEY_TO_ROSTER) as EncounterEnemyKey[]) {
    if (!definedKeys.has(key) && !LEGACY_ALIAS_KEYS.includes(key)) {
      throw new Error(`verifyEncounterCatalog: ${key} missing from ENEMY_DEFINITIONS`);
    }
    const rosterId = ENCOUNTER_KEY_TO_ROSTER[key];
    if (!ENEMY_ROSTER[rosterId]) {
      throw new Error(`verifyEncounterCatalog: ${key} maps to missing roster id ${rosterId}`);
    }
  }

  for (const key of definedKeys) {
    if (LEGACY_ALIAS_KEYS.includes(key)) continue;
    if (!(key in ENCOUNTER_KEY_TO_ROSTER)) {
      throw new Error(`verifyEncounterCatalog: definition ${key} missing ENCOUNTER_KEY_TO_ROSTER mapping`);
    }
    if (!(key in ENEMY_BASE_STATS)) {
      throw new Error(`verifyEncounterCatalog: definition ${key} missing ENEMY_BASE_STATS`);
    }
    if (!(key in ENEMY_ARCHETYPE_FOR_KEY)) {
      throw new Error(`verifyEncounterCatalog: definition ${key} missing ENEMY_ARCHETYPE_FOR_KEY`);
    }
  }
}

function assertRosterOriginAlignment(): void {
  for (const [key, def] of Object.entries(ENEMY_DEFINITIONS) as Array<[EncounterEnemyKey, typeof ENEMY_DEFINITIONS[EncounterEnemyKey]]>) {
    if (LEGACY_ALIAS_KEYS.includes(key)) continue;
    const rosterId = ENCOUNTER_KEY_TO_ROSTER[key];
    const entry = ENEMY_ROSTER[rosterId];
    if (!entry) continue;

    if (def.origin === 'RIVAL_MERC') {
      if (entry.isVeilEntity) {
        throw new Error(`verifyEncounterCatalog: ${key} is RIVAL_MERC in defs but roster has isVeilEntity`);
      }
      if (!entry.isRivalMerc) {
        throw new Error(`verifyEncounterCatalog: ${key} is RIVAL_MERC in defs but roster lacks isRivalMerc`);
      }
    } else if (def.origin === 'VEIL') {
      if (entry.isRivalMerc) {
        throw new Error(`verifyEncounterCatalog: ${key} is VEIL in defs but roster has isRivalMerc`);
      }
    }
  }
}

function assertDeckCoverage(): void {
  const synergy = buildEncounterDeck();
  const elite = buildEliteDeck();
  const usedKeys = new Set(collectDeckUnitKeys([...synergy, ...elite]));

  for (const key of allDefinedEnemyKeys()) {
    if (LEGACY_ALIAS_KEYS.includes(key) || INJECT_ONLY_ENEMY_KEYS.includes(key)) continue;
    const def = getEnemyDefinition(key)!;
    if (def.origin === 'RIVAL_MERC') {
      if (!usedKeys.has(key)) {
        throw new Error(`verifyEncounterCatalog: rival merc ${key} never appears in synergy/elite decks`);
      }
      continue;
    }
    const inAnyBiomePool = ALL_VEIL_BIOMES.some((biome) =>
      ([1, 2, 3] as const).some((depth) =>
        BIOME_DEPTH_ENEMY_HINTS[biome][depth].includes(key),
      ),
    );
    if (!inAnyBiomePool) {
      throw new Error(`verifyEncounterCatalog: veil enemy ${key} missing from all biome pool hints`);
    }
  }
}

function assertVeilBiomeDeckReachability(): void {
  const synergy = buildEncounterDeck();
  for (const biome of ALL_VEIL_BIOMES) {
    for (const depth of [1, 2, 3] as const) {
      const pool = synergy.filter(
        (squad) => (squad.veilBiome === biome || squad.veilBiome == null)
          && squad.allowedDepths.includes(depth),
      );
      if (pool.length === 0) {
        throw new Error(`verifyEncounterCatalog: no reachable squads for ${biome} D${depth}`);
      }
    }
  }
}

function assertShallowDepthExclusiveViolations(squads: readonly SynergySquadSpec[], label: string): void {
  for (const squad of squads) {
    for (const depth of squad.allowedDepths) {
      if (depth >= 3) continue;
      for (const unit of squad.roster) {
        if (isDepth3ExclusiveEnemy(unit.type)) {
          throw new Error(
            `verifyEncounterCatalog: D3 exclusive ${unit.type} in ${label} squad ${squad.id} at D${depth}`,
          );
        }
      }
    }
  }
}

function assertNoLegacySquadIds(squads: readonly SynergySquadSpec[]): void {
  for (const squad of squads) {
    if (squad.id.startsWith('CABAL_') || squad.id.startsWith('CORRUPT_') || squad.id.startsWith('SQUAD_')) {
      throw new Error(`verifyEncounterCatalog: legacy squad id ${squad.id} still in catalog`);
    }
  }
}

/** Phase 7 — cross-catalog integrity: defs ↔ roster ↔ decks ↔ biome pools. */
export function verifyEncounterCatalog(): void {
  assertDefinitionRosterParity();
  assertBiomePoolHints();
  assertRosterOriginAlignment();

  const synergy = buildEncounterDeck();
  const elite = buildEliteDeck();

  assertShallowDepthExclusiveViolations(synergy, 'synergy');
  assertShallowDepthExclusiveViolations(elite, 'elite');
  assertNoLegacySquadIds(synergy);
  assertNoLegacySquadIds(elite);
  assertDeckCoverage();
  assertVeilBiomeDeckReachability();

  for (const key of collectDeckUnitKeys([...synergy, ...elite])) {
    if (!getEnemyDefinition(key)) {
      throw new Error(`verifyEncounterCatalog: deck unit ${key} has no enemy definition`);
    }
    const rosterId = ENCOUNTER_KEY_TO_ROSTER[key];
    if (!rosterId || !ENEMY_ROSTER[rosterId as EnemyRosterId]) {
      throw new Error(`verifyEncounterCatalog: deck unit ${key} has no roster entry`);
    }
  }
}

export function auditReportEncounterCatalog(): {
  definedEnemies: number;
  synergySquads: number;
  eliteSquads: number;
  biomePools: Record<VeilBiome, Record<1 | 2 | 3, number>>;
} {
  const synergy = buildEncounterDeck();
  const elite = buildEliteDeck();
  const biomePools = {} as Record<VeilBiome, Record<1 | 2 | 3, number>>;
  for (const biome of ALL_VEIL_BIOMES) {
    biomePools[biome] = { 1: 0, 2: 0, 3: 0 };
    for (const depth of [1, 2, 3] as const) {
      biomePools[biome][depth] = BIOME_DEPTH_ENEMY_HINTS[biome][depth].filter(
        (key) => enemyAllowedAtDepth(key, depth),
      ).length;
    }
  }
  return {
    definedEnemies: allDefinedEnemyKeys().length,
    synergySquads: synergy.length,
    eliteSquads: elite.length,
    biomePools,
  };
}
