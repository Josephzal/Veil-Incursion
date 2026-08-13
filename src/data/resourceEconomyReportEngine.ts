import type { ResourceItemId } from '../types/resourceItem';
import {
  ALL_RESOURCE_ITEM_IDS,
  EXPANSION_RESOURCE_ITEM_IDS,
  getResourceDisplayName,
  RESOURCE_REGISTRY,
  RESOURCES_BY_CATEGORY,
} from './resourceRegistry';
import { CRAFTING_REGISTRY } from './craftingRegistry';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';
import { WEAPON_REGISTRY } from './weaponRegistry';
import { ENEMY_RESOURCE_DROPS } from './enemyResourceDrops';
import { HOSTILE_ECHO_REWARD_RESOURCE_IDS } from './echoRewardEngine';
import { SEALED_CASKET_REWARD_RESOURCE_IDS } from './sealedCasketOpenEngine';
import { SPECIMEN_JAR_REWARD_RESOURCE_IDS } from './sealedSpecimenJarOpenEngine';
import { RECOMMENDED_SECTORS_BY_RESOURCE } from './contractTemplates';
import { EXPANSION_COMMON_STABLE, EXPANSION_RARE_GATED, EXPANSION_UNCOMMON_STABLE } from './resourceDropIdentityEngine';

function collectRecipeUses(): Map<ResourceItemId, number> {
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

function collectDropSourceIds(): Set<ResourceItemId> {
  const ids = new Set<ResourceItemId>();
  Object.values(ENEMY_RESOURCE_DROPS).forEach((entry) => {
    if (!entry) return;
    ids.add(entry.primary);
    entry.bonus?.forEach((id) => ids.add(id));
  });
  HOSTILE_ECHO_REWARD_RESOURCE_IDS.forEach((id) => ids.add(id));
  SEALED_CASKET_REWARD_RESOURCE_IDS.forEach((id) => ids.add(id));
  SPECIMEN_JAR_REWARD_RESOURCE_IDS.forEach((id) => ids.add(id));
  [
    ...EXPANSION_COMMON_STABLE,
    ...EXPANSION_UNCOMMON_STABLE,
    ...EXPANSION_RARE_GATED,
  ].forEach((id) => ids.add(id));
  ALL_RESOURCE_ITEM_IDS.forEach((id) => {
    if (RESOURCE_REGISTRY[id].sourceHint.trim().length > 0) {
      ids.add(id);
    }
  });
  return ids;
}

function hasEconomyUse(id: ResourceItemId): boolean {
  const def = RESOURCE_REGISTRY[id];
  return (
    def.canBeSoldToFence
    || def.canBeContractTarget
    || def.canBeOperationTarget
    || def.canOpenAtHub
    || Boolean(RECOMMENDED_SECTORS_BY_RESOURCE[id]?.length)
  );
}

export interface ResourceEconomyReport {
  total: number;
  byCategory: Record<string, number>;
  byRarity: Record<string, number>;
  bySector: Record<string, number>;
  recipeUses: Array<{ resourceId: ResourceItemId; count: number }>;
  noRecipeUse: ResourceItemId[];
  noDropSource: ResourceItemId[];
  noEconomyUse: ResourceItemId[];
  invalidRecipeRefs: string[];
  bottleneckHints: ResourceItemId[];
}

export function buildResourceEconomyReport(): ResourceEconomyReport {
  const byCategory: Record<string, number> = {};
  Object.entries(RESOURCES_BY_CATEGORY).forEach(([category, ids]) => {
    byCategory[category] = ids.length;
  });

  const byRarity: Record<string, number> = {};
  ALL_RESOURCE_ITEM_IDS.forEach((id) => {
    const rarity = RESOURCE_REGISTRY[id].rarity;
    byRarity[rarity] = (byRarity[rarity] ?? 0) + 1;
  });

  const bySector: Record<string, number> = {};
  ALL_RESOURCE_ITEM_IDS.forEach((id) => {
    RESOURCE_REGISTRY[id].validSectorIds.forEach((sectorId) => {
      bySector[sectorId] = (bySector[sectorId] ?? 0) + 1;
    });
  });

  const recipeUseMap = collectRecipeUses();
  const recipeUses = [...recipeUseMap.entries()]
    .map(([resourceId, count]) => ({ resourceId, count }))
    .sort((a, b) => b.count - a.count);

  const dropSources = collectDropSourceIds();
  const noRecipeUse = ALL_RESOURCE_ITEM_IDS.filter((id) => {
    const def = RESOURCE_REGISTRY[id];
    if (!def.canBeCraftingIngredient) return false;
    return (recipeUseMap.get(id) ?? 0) === 0;
  });
  const noDropSource = ALL_RESOURCE_ITEM_IDS.filter((id) => !dropSources.has(id));
  const noEconomyUse = ALL_RESOURCE_ITEM_IDS.filter((id) => !hasEconomyUse(id) && (recipeUseMap.get(id) ?? 0) === 0);

  const invalidRecipeRefs: string[] = [];
  const known = new Set(ALL_RESOURCE_ITEM_IDS);
  CRAFTING_REGISTRY.forEach((recipe) => {
    recipe.requirements.forEach((req) => {
      if (!known.has(req.resourceId)) {
        invalidRecipeRefs.push(`${recipe.id} → ${req.resourceId}`);
      }
    });
  });

  const bottleneckHints = recipeUses
    .filter((entry) => entry.count >= 4)
    .slice(0, 6)
    .map((entry) => entry.resourceId);

  return {
    total: ALL_RESOURCE_ITEM_IDS.length,
    byCategory,
    byRarity,
    bySector,
    recipeUses,
    noRecipeUse,
    noDropSource,
    noEconomyUse,
    invalidRecipeRefs,
    bottleneckHints,
  };
}

export function formatResourceEconomyReport(): string {
  const report = buildResourceEconomyReport();
  const lines = [
    'RESOURCE ECONOMY REPORT',
    `Resource Count: ${report.total}`,
    `Stable: ${report.byCategory.STABLE ?? 0}`,
    `Unstable: ${report.byCategory.UNSTABLE ?? 0}`,
    `Intel: ${report.byCategory.INTEL ?? 0}`,
    `Contraband: ${report.byCategory.CONTRABAND ?? 0}`,
    '',
    'By rarity:',
    ...Object.entries(report.byRarity).map(([rarity, count]) => `  - ${rarity}: ${count}`),
    '',
    'By sector validity:',
    ...Object.entries(report.bySector).map(([sector, count]) => `  - ${sector}: ${count}`),
    '',
    'Recipes per resource (top):',
    ...report.recipeUses.slice(0, 12).map(
      (entry) => `  - ${getResourceDisplayName(entry.resourceId)}: ${entry.count}`,
    ),
    '',
    `Expansion roster: ${EXPANSION_RESOURCE_ITEM_IDS.length}`,
    ...EXPANSION_RESOURCE_ITEM_IDS.map((id) => {
      const uses = report.recipeUses.find((entry) => entry.resourceId === id)?.count ?? 0;
      return `  - ${getResourceDisplayName(id)} // recipes=${uses} // ${RESOURCE_REGISTRY[id].sourceHint}`;
    }),
    '',
    `Resources with no recipe use (craftable): ${report.noRecipeUse.length}`,
    ...report.noRecipeUse.map((id) => `  - ${getResourceDisplayName(id)}`),
    `Resources with no drop/source footprint: ${report.noDropSource.length}`,
    ...report.noDropSource.map((id) => `  - ${getResourceDisplayName(id)}`),
    `Resources with no sell/contract/op/craft use: ${report.noEconomyUse.length}`,
    ...report.noEconomyUse.map((id) => `  - ${getResourceDisplayName(id)}`),
    `Invalid recipe refs: ${report.invalidRecipeRefs.length}`,
    ...report.invalidRecipeRefs.map((ref) => `  - ${ref}`),
    '',
    'Estimated bottlenecks:',
    ...report.bottleneckHints.map((id) => `  - ${getResourceDisplayName(id)}`),
  ];
  return lines.join('\n');
}
