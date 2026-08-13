import type { CargoItemId } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';

export type CraftingRecipeKind = 'AUGMENT' | 'CONSUMABLE';

export interface CraftingRecipeRequirement {
  resourceId: ResourceItemId;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  label: string;
  kind: CraftingRecipeKind;
  outputId: string;
  requirements: ReadonlyArray<CraftingRecipeRequirement>;
  description?: string;
  effectSummary?: string;
}

// Legacy stackable Bound-passive recipes were retired in Stage III-B.
// Consumable / Supply recipes remain sourced through buildRunItemCraftingRecipes.
export const CRAFTING_REGISTRY: CraftingRecipe[] = [];

function getRunItemCraftRecipes(): CraftingRecipe[] {
  return buildRunItemCraftingRecipes();
}

export function getCraftingRecipe(id: string): CraftingRecipe | undefined {
  return CRAFTING_REGISTRY.find((recipe) => recipe.id === id)
    ?? getRunItemCraftRecipes().find((recipe) => recipe.id === id);
}

export function getRecipesByKind(kind: CraftingRecipeKind): CraftingRecipe[] {
  return CRAFTING_REGISTRY.filter((recipe) => recipe.kind === kind);
}

/** @deprecated Stage III-B retirement compatibility; always empty. */
export const PERMANENT_AUGMENTS: readonly CraftingRecipe[] = getRecipesByKind('AUGMENT');

export function isAugmentOutputId(outputId: string): boolean {
  return getCraftingRecipeByOutput(outputId)?.kind === 'AUGMENT';
}

export function isConsumableOutputId(outputId: string): outputId is CargoItemId {
  return getCraftingRecipeByOutput(outputId)?.kind === 'CONSUMABLE';
}

export function isLoadoutOutputId(_outputId: string): boolean {
  return false;
}

function getCraftingRecipeByOutput(outputId: string): CraftingRecipe | undefined {
  return CRAFTING_REGISTRY.find((recipe) => recipe.outputId === outputId)
    ?? getRunItemCraftRecipes().find((recipe) => recipe.outputId === outputId);
}

export function isRecipeOutputOwned(
  outputId: string,
  _unlockedBlueprints: readonly string[],
): boolean {
  const recipe = getCraftingRecipeByOutput(outputId);
  if (!recipe) return false;
  return false;
}
