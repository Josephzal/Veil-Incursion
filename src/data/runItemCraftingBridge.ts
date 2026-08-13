import type { CargoItemId } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';
import type { ResourceQuantity } from '../types/resourceItem';
import type { RunItemId } from '../types/runItem';
import { ALL_RUN_ITEM_IDS } from '../types/runItem';
import type { CraftingRecipe } from './craftingRegistry';
import { getStashCount } from './resourceStashEngine';
import { getRunItemDefinition } from './runItemRegistry';

export type RunItemCraftFilter = 'ALL' | 'COMBAT' | 'FIELD';

export function buildRunItemCraftingRecipes(): CraftingRecipe[] {
  return ALL_RUN_ITEM_IDS
    .filter((itemId) => getRunItemDefinition(itemId).canCraft)
    .map((itemId) => {
      const def = getRunItemDefinition(itemId);
      return {
        id: `craft_${itemId.replace(/-/g, '_')}`,
        kind: 'CONSUMABLE' as const,
        label: def.name,
        outputId: itemId,
        description: def.description,
        effectSummary: `${def.effectSummary} // 1×1 ${def.slotType === 'COMBAT' ? 'Combat Supply' : 'Field Tool'} cargo`,
        requirements: def.recipe.map((entry) => ({
          resourceId: entry.resourceId,
          quantity: entry.quantity,
        })),
      };
    });
}

export function filterRunItemCraftingRecipes(
  recipes: readonly CraftingRecipe[],
  filter: RunItemCraftFilter,
): CraftingRecipe[] {
  if (filter === 'ALL') return [...recipes];
  return recipes.filter((recipe) => {
    const def = getRunItemDefinition(recipe.outputId as RunItemId);
    if (filter === 'COMBAT') return def.family === 'COMBAT_CONSUMABLE';
    return def.family === 'FIELD_TOOL';
  });
}

export function canAffordRunItemRecipe(
  stash: ResourceQuantity,
  itemId: RunItemId,
): { affordable: boolean; missing: Array<{ resourceId: ResourceItemId; quantity: number; owned: number }> } {
  const def = getRunItemDefinition(itemId);
  const missing = def.recipe.flatMap((req) => {
    const owned = getStashCount(stash, req.resourceId);
    if (owned >= req.quantity) return [];
    return [{ resourceId: req.resourceId, quantity: req.quantity, owned }];
  });
  return { affordable: missing.length === 0, missing };
}

export function resolveRunItemCraftRecipeId(itemId: RunItemId): string {
  return `craft_${itemId.replace(/-/g, '_')}`;
}

export function isRunItemCraftOutput(outputId: string): outputId is CargoItemId {
  return ALL_RUN_ITEM_IDS.includes(outputId as RunItemId);
}
