import type { DepthIdentityRollContext, DepthIdentityState } from '../types/depthIdentity';
import type { VeilBiome } from '../types/encounterSpawn';
import type { EnemyCombatProfile } from '../types/run';
import type { DepthEnemyVariantKey } from './depthEnemyVariantCatalog';
import { DEPTH_ENEMY_VARIANT_META } from './depthEnemyVariantCatalog';
import { ENEMY_ROSTER, spawnRosterUnit } from './enemyRoster';
import { BIOME_DEPTH_ENEMY_HINTS } from './encounterBiomePools';
import { ALL_VEIL_BIOMES } from './sectorBiomeBridge';
import { getEnemyDefinition } from './enemyDefinitions';
import {
  allSectorDepthThemeEntries,
  formatSectorDepthFlavorLine,
  SECTOR_DEPTH_VISUAL_THEMES,
} from './sectorDepthVisualCatalog';
import { rollVeilDistortionForRun } from './veilDistortionEngine';
import { rollDeepVeilLawForRun } from './deepVeilLawEngine';
import { ALL_TWISTED_TEMPLATE_IDS } from './twistedTemplateCatalog';
import { verifyHardCounterDeck } from './encounterSpawnValidationEngine';
import { verifyEncounterCatalog } from './encounterCatalogAuditEngine';
import { verifyDepthEnemyVariants } from './depthEnemyVariantValidationEngine';
import { verifyScannerLabelCertainty } from './scannerLabelCertaintyValidationEngine';

let debugForcedDepthEnemyVariant: DepthEnemyVariantKey | null = null;

export function setDebugForcedDepthEnemyVariant(key: DepthEnemyVariantKey | null): void {
  debugForcedDepthEnemyVariant = key;
}

export function getDebugForcedDepthEnemyVariant(): DepthEnemyVariantKey | null {
  return debugForcedDepthEnemyVariant;
}

export function debugForceDepthEnemyVariant(key: DepthEnemyVariantKey | null): void {
  setDebugForcedDepthEnemyVariant(key);
}

/** Swap one non-boss unit for a forced Phase E variant (dev). */
export function maybeInjectForcedDepthVariant(
  squad: EnemyCombatProfile[],
  options: {
    nodeIndex: number;
    district: 1 | 2 | 3;
    isElite?: boolean;
    resonancePercent?: number;
  },
): EnemyCombatProfile[] {
  const forced = debugForcedDepthEnemyVariant;
  if (!forced || squad.length === 0) return squad;
  const meta = DEPTH_ENEMY_VARIANT_META[forced];
  if (!meta.allowedDepths.includes(options.district)) return squad;
  if (squad.some((unit) => unit.rosterId === meta.rosterId)) return squad;

  const candidates = squad
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) => unit.currentHp > 0 && !unit.isBoss);
  if (candidates.length === 0) return squad;

  const pick = candidates[0]!;
  const spawned = spawnRosterUnit(ENEMY_ROSTER[meta.rosterId], options.nodeIndex, {
    resonancePercent: options.resonancePercent,
    forcedElite: options.isElite === true,
    district: options.district,
  });
  const next = [...squad];
  const wide = forced === 'CORE_SICK_AMALGAM';
  next[pick.index] = {
    ...spawned,
    unitId: pick.unit.unitId ?? spawned.unitId,
    gridSlot: pick.unit.gridSlot,
    occupiedSlots: wide ? ['FL_0', 'FL_1'] : pick.unit.occupiedSlots,
    gridWidth: wide ? 2 : 1,
  };
  return next;
}

export function debugPrintBiomeDepthPools(): string {
  const lines = ['=== BIOME × DEPTH ENEMY POOLS ==='];
  for (const biome of ALL_VEIL_BIOMES) {
    lines.push(`-- ${biome} --`);
    for (const depth of [1, 2, 3] as const) {
      const pool = BIOME_DEPTH_ENEMY_HINTS[biome][depth];
      lines.push(`D${depth} (${pool.length}): ${pool.join(', ')}`);
    }
  }
  return lines.join('\n');
}

export function debugPrintSectorDepthFlavor(): string {
  const lines = ['=== SECTOR × DEPTH FLAVOR ==='];
  for (const entry of allSectorDepthThemeEntries()) {
    lines.push(`${entry.biome} // ${formatSectorDepthFlavorLine(entry.biome, entry.depth)}`);
  }
  return lines.join('\n');
}

export function debugSimulateDepthIdentityGeneration(
  ctx: DepthIdentityRollContext,
): string {
  const distortion = rollVeilDistortionForRun(null, ctx.veilBiome, ctx.seed);
  const law = rollDeepVeilLawForRun(null, ctx.veilBiome, distortion, ctx.seed);
  return [
    '=== SIMULATE DEPTH IDENTITY GEN ===',
    `seed: ${ctx.seed}`,
    `biome: ${ctx.veilBiome ?? 'none'}`,
    `anchor: ${ctx.anchorType ?? 'none'}`,
    `op: ${ctx.operationKind ?? 'none'}`,
    `echo: ${ctx.echoActivity ?? 'none'}`,
    `D2 Distortion: ${distortion}`,
    `D3 Law: ${law.lawId}${law.intensified ? ' (intensified)' : ''}`,
  ].join('\n');
}

export function debugListMissingTwistedTemplates(
  state: DepthIdentityState | null | undefined,
): string {
  const seen = new Set(state?.twistedTemplatesSeen ?? []);
  const unseen = ALL_TWISTED_TEMPLATE_IDS.filter((id) => !seen.has(id));
  return [
    '=== TWISTED TEMPLATES NOT YET SEEN ===',
    unseen.length === 0 ? '(none — all seen this run)' : unseen.join(', '),
  ].join('\n');
}

export interface PhaseGValidationIssue {
  code: string;
  message: string;
}

export function validatePhaseGHardRules(): PhaseGValidationIssue[] {
  const issues: PhaseGValidationIssue[] = [];

  for (const entry of allSectorDepthThemeEntries()) {
    if (!entry.theme.label.trim() || !entry.theme.flavor.trim()) {
      issues.push({
        code: 'FLAVOR_EMPTY',
        message: `${entry.biome} D${entry.depth} missing flavor`,
      });
    }
  }

  for (const biome of Object.keys(SECTOR_DEPTH_VISUAL_THEMES) as VeilBiome[]) {
    for (const depth of [1, 2, 3] as const) {
      if (!SECTOR_DEPTH_VISUAL_THEMES[biome][depth]) {
        issues.push({ code: 'THEME_MISSING', message: `${biome} D${depth} missing` });
      }
    }
  }

  for (const key of ['CONCRETE_GARGOYLE', 'WEEPING_GARGOYLE'] as const) {
    const def = getEnemyDefinition(key);
    if (!def) {
      issues.push({ code: 'GARGOYLE_DEF', message: `${key} missing definition` });
      continue;
    }
    if (def.biomeTags.length !== 1 || def.biomeTags[0] !== 'NULL_ZONE') {
      issues.push({
        code: 'GARGOYLE_BIOME',
        message: `${key} biomeTags=${def.biomeTags.join(',')} expected NULL_ZONE only`,
      });
    }
    for (const biome of ALL_VEIL_BIOMES) {
      for (const depth of [1, 2, 3] as const) {
        if (biome === 'NULL_ZONE') continue;
        if (BIOME_DEPTH_ENEMY_HINTS[biome][depth].includes(key)) {
          issues.push({
            code: 'GARGOYLE_POOL',
            message: `${key} listed in ${biome} D${depth} pool`,
          });
        }
      }
    }
  }

  return issues;
}

export function verifyPhaseGHardRules(): void {
  const issues = validatePhaseGHardRules();
  if (issues.length > 0) {
    throw new Error(
      `verifyPhaseGHardRules:\n${issues.map((i) => `- [${i.code}] ${i.message}`).join('\n')}`,
    );
  }
}

/** Consolidated Phase G DevTest validate — flavor/Gargoyle + hard-counter/catalog/variant/scanner. */
export function debugValidatePhaseG(): string {
  try {
    verifyPhaseGHardRules();
    verifyHardCounterDeck();
    verifyEncounterCatalog();
    verifyDepthEnemyVariants();
    verifyScannerLabelCertainty();
    return 'OK — Phase G hard rules + catalog/hard-counter/variant/scanner checks passed.';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
