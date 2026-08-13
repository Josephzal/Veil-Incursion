import type { PlayerAccount } from '../types/game';
import type { ResourceItemId, ResourceCategory } from '../types/resourceItem';
import type { BreachGradeId, ProgressionProfile } from '../types/progression';
import type { SectorId } from '../types/worldState';
import {
  ALL_RESOURCE_ITEM_IDS,
  RESOURCE_REGISTRY,
  RESOURCES_BY_CATEGORY,
  getResourceDisplayName,
} from './resourceRegistry';
import {
  ECONOMY_V1_INTEL_IDS,
  ECONOMY_V1_RESOURCE_IDS,
  ECONOMY_V1_STABLE_IDS,
  ECONOMY_V1_UNSTABLE_IDS,
} from './economyRosterV1';
import { CRAFTING_REGISTRY } from './craftingRegistry';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';
import { WEAPON_REGISTRY } from './weaponRegistry';
import { RECOMMENDED_SECTORS_BY_RESOURCE } from './contractTemplates';
import { CONTRACT_TARGET_RESOURCE_IDS } from './resourceRegistry';
import { SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import { ALL_SECTOR_IDS } from './sectorBiomeBridge';
import {
  createDefaultProgressionProfile,
} from './progressionProfileEngine';
import { getAccountProgressionProfile, withProgressionProfile } from './progressionDebugEngine';
import { addToResourceStash, createEmptyResourceStash } from './resourceStashEngine';
import { validateResourceRegistry } from './resourceValidation';
import { sectorsListingResource } from './sectorResourceTableEngine';
import {
  buildResourceEconomyReport,
  formatResourceEconomyReport,
} from './resourceEconomyReportEngine';
import {
  estimateSectorExtractionRate,
  formatEconomyRunSimReport,
  formatResourceNodeSimReport,
  formatSectorDepthDropSimReport,
  primarySectorsForResource,
  simulateEconomyRuns,
  simulateResourceNodesPerSector,
  simulateSectorDepthDrops,
} from './economySpineSimulationEngine';
import { resolveResourceSourceHint } from './resourceSourceHintEngine';
import { formatSectorResourceTableBrief } from './sectorResourceTableEngine';

/**
 * Phase 2H — economy debug tools + bottleneck report.
 */

function collectRecipeUseCounts(): Map<ResourceItemId, number> {
  const counts = new Map<ResourceItemId, number>();
  const bump = (id: ResourceItemId) => counts.set(id, (counts.get(id) ?? 0) + 1);
  CRAFTING_REGISTRY.forEach((recipe) => {
    recipe.requirements.forEach((req) => bump(req.resourceId));
  });
  buildRunItemCraftingRecipes().forEach((recipe) => {
    recipe.requirements.forEach((req) => bump(req.resourceId));
  });
  Object.values(WEAPON_REGISTRY).forEach((family) => {
    family.unlockRequirement.forEach((req) => bump(req.resourceId));
  });
  return counts;
}

function collectContractCounts(): Map<ResourceItemId, number> {
  const counts = new Map<ResourceItemId, number>();
  CONTRACT_TARGET_RESOURCE_IDS.forEach((id) => {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  Object.keys(RECOMMENDED_SECTORS_BY_RESOURCE).forEach((id) => {
    const rid = id as ResourceItemId;
    counts.set(rid, (counts.get(rid) ?? 0) + 1);
  });
  return counts;
}

function collectOperationCounts(): Map<ResourceItemId, number> {
  const counts = new Map<ResourceItemId, number>();
  SECTOR_WORLD_TEMPLATES.forEach((sector) => {
    sector.operations.forEach((op) => {
      op.targetResourceIds?.forEach((id) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      });
      const emphasis = op.rewardEmphasis?.targetResources;
      if (Array.isArray(emphasis)) {
        emphasis.forEach((raw) => {
          // Some templates use display names — skip non-ids.
          if (typeof raw === 'string' && raw in RESOURCE_REGISTRY) {
            const id = raw as ResourceItemId;
            counts.set(id, (counts.get(id) ?? 0) + 1);
          }
        });
      }
    });
  });
  ALL_RESOURCE_ITEM_IDS.forEach((id) => {
    if (RESOURCE_REGISTRY[id].canBeOperationTarget) {
      counts.set(id, Math.max(counts.get(id) ?? 0, 1));
    }
  });
  return counts;
}

export function debugGrantEconomyResources(
  account: PlayerAccount,
  mode: 'ALL' | 'STABLE' | 'UNSTABLE' | 'INTEL',
  quantity = 8,
): { account: PlayerAccount; logLine: string } {
  const ids =
    mode === 'ALL' ? ECONOMY_V1_RESOURCE_IDS
      : mode === 'STABLE' ? ECONOMY_V1_STABLE_IDS
        : mode === 'UNSTABLE' ? ECONOMY_V1_UNSTABLE_IDS
          : ECONOMY_V1_INTEL_IDS;
  let stash = { ...account.resourceStash };
  ids.forEach((id) => {
    stash = addToResourceStash(stash, id, quantity);
  });
  return {
    account: { ...account, resourceStash: stash },
    logLine: `>> DEBUG ECONOMY — granted ${mode} ×${quantity} (${ids.length} ids) to stash.`,
  };
}

export function debugClearResourceStash(account: PlayerAccount): {
  account: PlayerAccount;
  logLine: string;
} {
  return {
    account: {
      ...account,
      resourceStash: createEmptyResourceStash(),
      sealedCargoStacks: [],
    },
    logLine: '>> DEBUG ECONOMY — cleared resource stash + sealed stacks.',
  };
}

export function debugUnlockAllSectors(account: PlayerAccount): {
  account: PlayerAccount;
  logLine: string;
} {
  const profile = getAccountProgressionProfile(account);
  const sectors = { ...profile.sectors };
  ALL_SECTOR_IDS.forEach((sectorId) => {
    sectors[sectorId] = {
      ...sectors[sectorId]!,
      unlocked: true,
      highestGradeCleared: sectors[sectorId]?.highestGradeCleared ?? 'I',
      accessMandateState: 'COMPLETED',
    };
  });
  const nextProfile: ProgressionProfile = {
    ...profile,
    sectors,
    grantedUnlocks: [
      ...new Set([
        ...profile.grantedUnlocks,
        'sector.null_zone',
        'sector.abyssal_sink',
        'sector.ashen_wastes',
        'sector.slag_works',
        'sector.blackline_terminus',
      ]),
    ],
  };
  return {
    account: withProgressionProfile(account, nextProfile),
    logLine: '>> DEBUG ECONOMY — unlocked all sectors.',
  };
}

/** Bottleneck warnings for tuning (Phase 2H). */
export function buildEconomyBottleneckWarnings(): string[] {
  const warnings: string[] = [];
  const recipeUses = collectRecipeUseCounts();
  const totalRecipes = CRAFTING_REGISTRY.length + buildRunItemCraftingRecipes().length;

  ECONOMY_V1_RESOURCE_IDS.forEach((resourceId) => {
    const uses = recipeUses.get(resourceId) ?? 0;
    const def = RESOURCE_REGISTRY[resourceId];
    const primaries = primarySectorsForResource(resourceId);
    const primary = primaries[0];

    if (uses >= 4 && primary) {
      const rate = estimateSectorExtractionRate(resourceId, primary, {
        districtDepth: Math.max(def.depthRules.minDepth, 2) as 1 | 2 | 3,
        iterations: 40,
      });
      if (rate < 0.6 && uses >= 5) {
        warnings.push(
          `WARNING: ${getResourceDisplayName(resourceId)} used in ${uses} recipes `
          + `but average extraction is ${rate.toFixed(2)} per ${primary.replace(/THE_/g, '').replace(/_/g, ' ')} run.`,
        );
      }
    }

    if (def.depthRules.minDepth >= 3 && uses > 0) {
      const midgame = uses >= 2;
      if (midgame) {
        warnings.push(
          `WARNING: ${getResourceDisplayName(resourceId)} required by recipes `
          + `but only eligible from Depth ${def.depthRules.minDepth}+.`,
        );
      }
    }

    if (resourceId === 'ley-slag' && totalRecipes > 0) {
      const pct = Math.round((uses / Math.max(1, totalRecipes)) * 100);
      if (pct >= 35) {
        warnings.push(`WARNING: Ley-Slag still appears in ${pct}% of craft/unlock recipes.`);
      }
    }

    // Farmable outside Blackline if listed on any sector table band OR identity primary.
    const farmSectors = new Set([
      ...sectorsListingResource(resourceId),
      ...def.primarySectors,
    ]);
    const nonBlacklineFarms = [...farmSectors].filter((id) => id !== 'THE_BLACKLINE_TERMINUS');
    if (
      farmSectors.has('THE_BLACKLINE_TERMINUS')
      && nonBlacklineFarms.length === 0
      && uses > 0
      && def.depthRules.minDepth >= 2
    ) {
      warnings.push(
        `WARNING: ${getResourceDisplayName(resourceId)} has no source before Blackline `
        + 'but appears in craft/contract sinks.',
      );
    }

    if (!def.canBeCraftingIngredient && uses > 0) {
      warnings.push(
        `WARNING: ${getResourceDisplayName(resourceId)} marked non-crafting but used by ${uses} recipe(s).`,
      );
    }
  });

  // Underused craftable mats
  ECONOMY_V1_STABLE_IDS.forEach((id) => {
    const uses = recipeUses.get(id) ?? 0;
    if (RESOURCE_REGISTRY[id].canBeCraftingIngredient && uses === 0) {
      warnings.push(`WARNING: ${getResourceDisplayName(id)} craftable but unused by any recipe/unlock.`);
    }
  });

  return warnings.slice(0, 24);
}

export function formatEconomyBottleneckReport(): string {
  const warnings = buildEconomyBottleneckWarnings();
  return [
    '=== ECONOMY SPINE // PHASE 2H — BOTTLENECK REPORT ===',
    warnings.length ? warnings.join('\n') : '(no bottleneck warnings)',
    '',
    `Warnings: ${warnings.length}`,
  ].join('\n');
}

export function formatEconomySourceTable(): string {
  const profile = createDefaultProgressionProfile();
  ALL_SECTOR_IDS.forEach((id) => {
    profile.sectors[id] = {
      ...profile.sectors[id]!,
      unlocked: true,
      accessMandateState: 'COMPLETED',
      highestGradeCleared: 'I',
    };
  });
  const lines = ['=== ECONOMY SOURCE TABLE ===', ''];
  ECONOMY_V1_RESOURCE_IDS.forEach((id) => {
    const hint = resolveResourceSourceHint(id, { profile, preferContractDirected: false });
    const primaries = primarySectorsForResource(id).join(', ') || '—';
    const depth = `${RESOURCE_REGISTRY[id].depthRules.minDepth}-${RESOURCE_REGISTRY[id].depthRules.maxDepth}`;
    lines.push(
      `${getResourceDisplayName(id).padEnd(22)} D${depth} primary=[${primaries}]`,
    );
    lines.push(`  ${hint.compact}`);
  });
  lines.push('');
  ALL_SECTOR_IDS.forEach((sectorId) => {
    lines.push(formatSectorResourceTableBrief(sectorId));
    lines.push('');
  });
  return lines.join('\n');
}

export function formatEconomyValidationSuite(): string {
  const issues = validateResourceRegistry();
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');
  const lines = [
    '=== ECONOMY VALIDATION SUITE ===',
    `Registry issues: ${issues.length} (${errors.length} errors / ${warns.length} warns)`,
    ...errors.slice(0, 20).map((i) => `  [error] ${i.resourceId ?? '?'}: ${i.message}`),
    ...warns.slice(0, 10).map((i) => `  [warn] ${i.resourceId ?? '?'}: ${i.message}`),
  ];

  // Contract / operation target spot checks
  const missingContract = CONTRACT_TARGET_RESOURCE_IDS.filter((id) => !RESOURCE_REGISTRY[id]);
  const opTargets = ALL_RESOURCE_ITEM_IDS.filter((id) => RESOURCE_REGISTRY[id].canBeOperationTarget);
  lines.push(`Contract target ids: ${CONTRACT_TARGET_RESOURCE_IDS.length} (missing defs: ${missingContract.length})`);
  lines.push(`Operation-target resources: ${opTargets.length}`);
  lines.push(
    errors.length === 0
      ? 'PASS — registry + economy tables validate.'
      : 'FAIL — fix registry/economy validation errors.',
  );
  return lines.join('\n');
}

/** Full Phase 2H economy report with sim averages + bottlenecks. */
export function formatEconomySpinePhase2HReport(opts?: {
  includeSims?: boolean;
  runs?: number;
}): string {
  const includeSims = opts?.includeSims !== false;
  const base = formatResourceEconomyReport();
  const recipeUses = collectRecipeUseCounts();
  const contractUses = collectContractCounts();
  const opUses = collectOperationCounts();

  const byDepth: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
  ECONOMY_V1_RESOURCE_IDS.forEach((id) => {
    const min = RESOURCE_REGISTRY[id].depthRules.minDepth;
    byDepth[String(min)] = (byDepth[String(min)] ?? 0) + 1;
  });

  const noSink = ECONOMY_V1_RESOURCE_IDS.filter((id) => {
    const def = RESOURCE_REGISTRY[id];
    const uses = recipeUses.get(id) ?? 0;
    return uses === 0
      && !def.canBeSoldToFence
      && !def.canBeContractTarget
      && !def.canBeOperationTarget
      && !def.canOpenAtHub;
  });

  const noSource = ECONOMY_V1_RESOURCE_IDS.filter((id) => (
    sectorsListingResource(id).length === 0 && RESOURCE_REGISTRY[id].primarySectors.length === 0
  ));

  const overused = [...recipeUses.entries()]
    .filter(([, n]) => n >= 6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const underused = ECONOMY_V1_RESOURCE_IDS
    .filter((id) => RESOURCE_REGISTRY[id].canBeCraftingIngredient && (recipeUses.get(id) ?? 0) <= 1)
    .slice(0, 10);

  const lines = [
    '=== ECONOMY SPINE // PHASE 2H — FULL REPORT ===',
    '',
    base,
    '',
    'By min depth:',
    ...Object.entries(byDepth).map(([d, n]) => `  - D${d}+: ${n}`),
    '',
    'Contracts / operations per resource (sample):',
    ...ECONOMY_V1_RESOURCE_IDS.slice(0, 12).map((id) => (
      `  ${getResourceDisplayName(id).padEnd(22)} recipes=${recipeUses.get(id) ?? 0} `
      + `contracts=${contractUses.get(id) ?? 0} ops=${opUses.get(id) ?? 0}`
    )),
    '',
    `No sink: ${noSink.length}`,
    ...noSink.map((id) => `  - ${getResourceDisplayName(id)}`),
    `No source (sector tables): ${noSource.length}`,
    ...noSource.map((id) => `  - ${getResourceDisplayName(id)}`),
    'Overused (recipes ≥6):',
    ...overused.map(([id, n]) => `  - ${getResourceDisplayName(id)}: ${n}`),
    'Underused craftables (≤1 recipe):',
    ...underused.map((id) => `  - ${getResourceDisplayName(id)}`),
    '',
    formatEconomyBottleneckReport(),
  ];

  if (includeSims) {
    const runSim = simulateEconomyRuns({ runs: opts?.runs ?? 40, breachGrade: 'II', sectorId: 'THE_NULL_ZONE' });
    lines.push('');
    lines.push(formatEconomyRunSimReport(runSim));
  }

  const issues = validateResourceRegistry().filter((i) => i.severity === 'error');
  lines.push('');
  lines.push(
    issues.length === 0 && noSource.length === 0
      ? 'PASS — Phase 2H economy report ready for tuning.'
      : 'FAIL — economy report found structural gaps.',
  );
  lines.push('Rule: tune from sims + bottlenecks, not vibes.');

  return lines.join('\n');
}

export function formatPhase2HDevToolsIndex(): string {
  return [
    '=== PHASE 2H DEBUG TOOLS ===',
    'Grant: ALL / STABLE / UNSTABLE / INTEL',
    'Clear stash · Unlock all sectors',
    'Sim: sector/depth/grade drops · 100 resource nodes · 100 runs',
    'Validate: registry suite · source table · bottleneck report',
    'Full economy report (includes sim averages)',
  ].join('\n');
}

export {
  formatSectorDepthDropSimReport,
  formatResourceNodeSimReport,
  formatEconomyRunSimReport,
  simulateSectorDepthDrops,
  simulateResourceNodesPerSector,
  simulateEconomyRuns,
  buildResourceEconomyReport,
  formatResourceEconomyReport,
};

export type EconomyGrantMode = 'ALL' | 'STABLE' | 'UNSTABLE' | 'INTEL';

export function categoryLabel(category: ResourceCategory): string {
  return category;
}

export { RESOURCES_BY_CATEGORY };
