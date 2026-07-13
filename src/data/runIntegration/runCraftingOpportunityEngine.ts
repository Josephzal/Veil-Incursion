import type { PlayerAccount } from '../../types/game';
import type { ResourceItemId } from '../../types/resourceItem';
import type { ResourceQuantity } from '../../types/resourceItem';
import { CRAFTING_REGISTRY, type CraftingRecipe } from '../craftingRegistry';
import { buildRunItemCraftingRecipes } from '../runItemCraftingBridge';
import { canAffordRecipe, getStashCount } from '../resourceStashEngine';
import { getRunItemDefinition } from '../runItemRegistry';
import type { RunItemId } from '../../types/runItem';
import { isRecipeOutputOwned } from '../craftingRegistry';

export interface CraftingOpportunityLine {
  recipeId: string;
  label: string;
  kind: 'CRAFTABLE_NOW' | 'NEARLY_READY';
  detail: string;
}

export interface CraftingOpportunitySummary {
  newlyCraftable: CraftingOpportunityLine[];
  nearlyCraftable: CraftingOpportunityLine[];
  highlightResources: ResourceItemId[];
  note: string | null;
}

function listAffordableRecipes(
  stash: ResourceQuantity,
  recipes: readonly CraftingRecipe[],
  isOwned: (recipe: CraftingRecipe) => boolean,
): CraftingRecipe[] {
  return recipes.filter((recipe) => canAffordRecipe(stash, recipe) && !isOwned(recipe));
}

function listNearlyCraftableRecipes(
  stash: ResourceQuantity,
  recipes: readonly CraftingRecipe[],
  isOwned: (recipe: CraftingRecipe) => boolean,
  maxMissingTotal = 3,
): CraftingOpportunityLine[] {
  const lines: CraftingOpportunityLine[] = [];
  recipes.forEach((recipe) => {
    if (isOwned(recipe)) return;
    if (canAffordRecipe(stash, recipe)) return;
    let missingTotal = 0;
    const missingParts: string[] = [];
    recipe.requirements.forEach((req) => {
      const owned = getStashCount(stash, req.resourceId);
      if (owned < req.quantity) {
        const gap = req.quantity - owned;
        missingTotal += gap;
        missingParts.push(`${req.resourceId.replace(/-/g, ' ')} ×${gap}`);
      }
    });
    if (missingTotal > 0 && missingTotal <= maxMissingTotal) {
      lines.push({
        recipeId: recipe.id,
        label: recipe.label,
        kind: 'NEARLY_READY',
        detail: `Missing: ${missingParts.join(', ')}`,
      });
    }
  });
  return lines.slice(0, 4);
}

export function buildCraftingOpportunitySummary(
  account: PlayerAccount,
  extractedResourceIds?: readonly ResourceItemId[],
): CraftingOpportunitySummary {
  const stash = account.resourceStash;
  const isOwned = (recipe: CraftingRecipe) => isRecipeOutputOwned(
    recipe.outputId,
    account.unlockedBlueprints,
    account.craftedAugments,
  );

  const allRecipes = [
    ...CRAFTING_REGISTRY.filter((r) => r.kind === 'CONSUMABLE' || r.kind === 'AUGMENT'),
    ...buildRunItemCraftingRecipes(),
  ];

  const craftableNow = listAffordableRecipes(stash, allRecipes, isOwned).slice(0, 4).map((recipe) => {
    const isRunItem = buildRunItemCraftingRecipes().some((r) => r.id === recipe.id);
    const label = isRunItem
      ? getRunItemDefinition(recipe.outputId as RunItemId).name
      : recipe.label;
    return {
      recipeId: recipe.id,
      label,
      kind: 'CRAFTABLE_NOW' as const,
      detail: 'Resources available — craft at Fabrication Matrix.',
    };
  });

  const nearlyCraftable = listNearlyCraftableRecipes(stash, allRecipes, isOwned);

  const highlightResources = [...new Set(extractedResourceIds ?? [])].slice(0, 4);

  let note: string | null = null;
  if (craftableNow.length === 0 && nearlyCraftable.length === 0) {
    note = 'No new crafting opportunities detected — extract more resources or complete contracts.';
  }

  return {
    newlyCraftable: craftableNow,
    nearlyCraftable,
    highlightResources,
    note,
  };
}

export function formatCraftingOpportunityLines(summary: CraftingOpportunitySummary): string[] {
  const lines: string[] = [];
  summary.newlyCraftable.forEach((entry) => {
    lines.push(`CRAFT NOW: ${entry.label}`);
  });
  summary.nearlyCraftable.forEach((entry) => {
    lines.push(`NEARLY READY: ${entry.label} — ${entry.detail}`);
  });
  if (summary.highlightResources.length > 0) {
    lines.push(`Extracted materials: ${summary.highlightResources.map((id) => id.replace(/-/g, ' ')).join(', ')}`);
  }
  if (summary.note) lines.push(summary.note);
  return lines;
}
