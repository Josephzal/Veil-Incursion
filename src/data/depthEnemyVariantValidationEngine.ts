import {
  ALL_DEPTH_ENEMY_VARIANT_KEYS,
  DEPTH_2_VARIANT_KEYS,
  DEPTH_3_ELITE_VARIANT_KEYS,
  DEPTH_ENEMY_VARIANT_META,
} from './depthEnemyVariantCatalog';
import { ENCOUNTER_KEY_TO_ROSTER, ENEMY_BASE_STATS, ENEMY_ARCHETYPE_FOR_KEY } from './enemyCombatConfig';
import { ENEMY_ROSTER } from './enemyRoster';
import { getEnemyDefinition, isDepth3ExclusiveEnemy } from './enemyDefinitions';
import { ORIGIN_WEIGHTS, DEPTH_3_EXCLUSIVE_ENEMY_KEYS } from '../types/encounterSpawn';
import { BIOME_DEPTH_ENEMY_HINTS } from './encounterBiomePools';
import { enemyAllowedAtDepth } from './encounterSpawnGateEngine';
import { ALL_VEIL_BIOMES } from './sectorBiomeBridge';

export interface DepthEnemyVariantIssue {
  code: string;
  message: string;
}

export function validateDepthEnemyVariants(): DepthEnemyVariantIssue[] {
  const issues: DepthEnemyVariantIssue[] = [];

  for (const key of ALL_DEPTH_ENEMY_VARIANT_KEYS) {
    const meta = DEPTH_ENEMY_VARIANT_META[key];
    const def = getEnemyDefinition(key);
    if (!def) {
      issues.push({ code: 'MISSING_DEF', message: `${key} missing from ENEMY_DEFINITIONS` });
      continue;
    }
    if (ENCOUNTER_KEY_TO_ROSTER[key] !== meta.rosterId) {
      issues.push({
        code: 'ROSTER_MAP',
        message: `${key} maps to ${ENCOUNTER_KEY_TO_ROSTER[key]} expected ${meta.rosterId}`,
      });
    }
    if (!ENEMY_ROSTER[meta.rosterId]) {
      issues.push({ code: 'MISSING_ROSTER', message: `${meta.rosterId} missing from ENEMY_ROSTER` });
    }
    if (!(key in ENEMY_BASE_STATS)) {
      issues.push({ code: 'MISSING_BASE', message: `${key} missing ENEMY_BASE_STATS` });
    }
    if (!(key in ENEMY_ARCHETYPE_FOR_KEY)) {
      issues.push({ code: 'MISSING_ARCH', message: `${key} missing ENEMY_ARCHETYPE_FOR_KEY` });
    }
    for (const depth of meta.allowedDepths) {
      if (!enemyAllowedAtDepth(key, depth) && !(meta.anchorOrOperationOnly && depth >= 2)) {
        // Anchor husk is ANCHOR-tier gated — allowedAtDepth only checks depth, not node tier.
        if (!meta.anchorOrOperationOnly) {
          issues.push({
            code: 'DEPTH_GATE',
            message: `${key} blocked at depth ${depth} by spawn gates`,
          });
        }
      }
    }
    if (DEPTH_2_VARIANT_KEYS.includes(key as typeof DEPTH_2_VARIANT_KEYS[number])) {
      if (enemyAllowedAtDepth(key, 1)) {
        issues.push({ code: 'D1_LEAK', message: `Depth 2 variant ${key} allowed on Depth 1` });
      }
    }
    if (DEPTH_3_ELITE_VARIANT_KEYS.includes(key as typeof DEPTH_3_ELITE_VARIANT_KEYS[number])) {
      if (!isDepth3ExclusiveEnemy(key)) {
        issues.push({ code: 'D3_TAG', message: `${key} should be in DEPTH_3_EXCLUSIVE_ENEMY_KEYS` });
      }
      if (enemyAllowedAtDepth(key, 1) || enemyAllowedAtDepth(key, 2)) {
        issues.push({ code: 'D3_LEAK', message: `Depth 3 elite ${key} allowed before Depth 3` });
      }
    }
  }

  for (const key of DEPTH_3_EXCLUSIVE_ENEMY_KEYS) {
    if (enemyAllowedAtDepth(key, 1)) {
      issues.push({ code: 'EXCLUSIVE_D1', message: `D3 exclusive ${key} passes Depth 1 gates` });
    }
  }

  for (const depth of [1, 2, 3] as const) {
    for (const tier of ['NORMAL', 'ELITE'] as const) {
      const rival = ORIGIN_WEIGHTS[depth][tier].RIVAL_MERC;
      const band = depth === 1
        ? [0.25, 0.35]
        : depth === 2
          ? [0.15, 0.25]
          : [0.05, 0.15];
      if (rival < band[0] || rival > band[1]) {
        issues.push({
          code: 'RIVAL_WEIGHT',
          message: `ORIGIN_WEIGHTS D${depth} ${tier} rival=${rival} outside ${band[0]}–${band[1]}`,
        });
      }
    }
  }

  for (const biome of ALL_VEIL_BIOMES) {
    for (const key of BIOME_DEPTH_ENEMY_HINTS[biome][1]) {
      if (isDepth3ExclusiveEnemy(key)) {
        issues.push({
          code: 'POOL_D1',
          message: `D3 exclusive ${key} listed in ${biome} Depth 1 pool`,
        });
      }
    }
  }

  return issues;
}

export function verifyDepthEnemyVariants(): void {
  const issues = validateDepthEnemyVariants();
  if (issues.length > 0) {
    throw new Error(
      `verifyDepthEnemyVariants:\n${issues.map((i) => `- [${i.code}] ${i.message}`).join('\n')}`,
    );
  }
}

export function debugPrintDepthEnemyVariants(): string {
  const lines = ['=== DEPTH ENEMY VARIANTS (Phase E) ==='];
  lines.push('-- Depth 2 --');
  for (const key of DEPTH_2_VARIANT_KEYS) {
    const meta = DEPTH_ENEMY_VARIANT_META[key];
    lines.push(`${key} ← ${meta.parentKey} // ${meta.telegraph}`);
  }
  lines.push('-- Depth 3 elite tags --');
  for (const key of DEPTH_3_ELITE_VARIANT_KEYS) {
    const meta = DEPTH_ENEMY_VARIANT_META[key];
    lines.push(`${key} ← ${meta.parentKey} // ${meta.telegraph}`);
  }
  lines.push(
    `Rival merc weights D1/D2/D3 NORMAL: `
    + `${ORIGIN_WEIGHTS[1].NORMAL.RIVAL_MERC}/`
    + `${ORIGIN_WEIGHTS[2].NORMAL.RIVAL_MERC}/`
    + `${ORIGIN_WEIGHTS[3].NORMAL.RIVAL_MERC}`,
  );
  return lines.join('\n');
}
