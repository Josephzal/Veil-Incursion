import type { PlayerAccount } from '../../types/game';
import type { ResourceItemId } from '../../types/resourceItem';
import type { ResourceQuantity } from '../../types/resourceItem';
import { CRAFTING_REGISTRY, type CraftingRecipe } from '../craftingRegistry';
import { buildRunItemCraftingRecipes } from '../runItemCraftingBridge';
import { getResourceDisplayName, getResourceSourceHint, EXPANSION_RESOURCE_ITEM_IDS } from '../resourceRegistry';
import { canAffordRecipe, getStashCount } from '../resourceStashEngine';
import { getRunItemDefinition } from '../runItemRegistry';
import type { RunItemId } from '../../types/runItem';
import { isRecipeOutputOwned } from '../craftingRegistry';
import { buildWeaponDebriefSummary } from '../runDebriefWeaponEngine';
import type { WeaponDebriefSummary } from '../../types/weapon';
import { getAccountProgressionProfile } from '../progressionDebugEngine';
import {
  listForgeVisibleRecipes,
  resolveRecipeVisibility,
} from '../recipeVisibilityEngine';

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
  discoveryHints: string[];
  note: string | null;
  weaponSummary?: WeaponDebriefSummary | null;
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
        missingParts.push(`${getResourceDisplayName(req.resourceId, true)} ×${gap}`);
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
  incursion?: import('../../types/game').ActiveIncursionState | null,
): CraftingOpportunitySummary {
  const stash = account.resourceStash;
  const profile = getAccountProgressionProfile(account);
  const isOwned = (recipe: CraftingRecipe) => isRecipeOutputOwned(
    recipe.outputId,
    [],
  );

  const runItemRecipes = buildRunItemCraftingRecipes();
  const runItemOutputIds = new Set(runItemRecipes.map((r) => r.outputId));
  /** Prefer run-item recipe when forge CONSUMABLE duplicates the same output. */
  const forgeOnly = CRAFTING_REGISTRY.filter(
    (r) => r.kind === 'AUGMENT' || (r.kind === 'CONSUMABLE' && !runItemOutputIds.has(r.outputId)),
  );
  const allRecipes = [...forgeOnly, ...runItemRecipes].filter((recipe) => (
    resolveRecipeVisibility(profile, account, recipe) === 'KNOWN'
  ));

  const craftableNow = listAffordableRecipes(stash, allRecipes, isOwned).slice(0, 4).map((recipe) => {
    const isRunItem = runItemRecipes.some((r) => r.id === recipe.id);
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

  const extracted = [...new Set(extractedResourceIds ?? [])];
  const expansionExtracted = extracted.filter((id) =>
    (EXPANSION_RESOURCE_ITEM_IDS as readonly ResourceItemId[]).includes(id),
  );
  const highlightResources = [
    ...expansionExtracted,
    ...extracted.filter((id) => !expansionExtracted.includes(id)),
  ].slice(0, 6);

  const discoveryHints = expansionExtracted.slice(0, 4).map((id) => {
    const name = getResourceDisplayName(id, true);
    const hint = getResourceSourceHint(id);
    return `DISCOVERED: ${name} — ${hint}`;
  });

  listForgeVisibleRecipes(profile, account)
    .filter((s) => s.visibility === 'RUMORED')
    .slice(0, 3)
    .forEach((s) => {
      discoveryHints.push(`RUMORED: ${s.recipe.label} — ${s.meta.rumoredPurpose}`);
    });

  const weaponSummary = buildWeaponDebriefSummary(account, incursion ?? null);
  weaponSummary.lines
    .filter((line) => line.kind !== 'EQUIPPED')
    .forEach((line) => {
      if (line.kind === 'NEWLY_UNLOCKABLE') {
        craftableNow.push({
          recipeId: `weapon-${line.label}`,
          label: line.label,
          kind: 'CRAFTABLE_NOW',
          detail: line.detail,
        });
      } else if (line.kind === 'NEARLY_READY') {
        nearlyCraftable.push({
          recipeId: `weapon-${line.label}`,
          label: line.label,
          kind: 'NEARLY_READY',
          detail: line.detail,
        });
      }
    });

  let note: string | null = null;
  if (craftableNow.length === 0 && nearlyCraftable.length === 0 && discoveryHints.length === 0) {
    note = 'No new crafting opportunities detected — extract more resources or complete contracts.';
  }

  return {
    newlyCraftable: craftableNow,
    nearlyCraftable,
    highlightResources,
    discoveryHints,
    note,
    weaponSummary,
  };
}

export function formatCraftingOpportunityLines(summary: CraftingOpportunitySummary): string[] {
  const lines: string[] = [];
  summary.discoveryHints.forEach((hint) => {
    lines.push(hint);
  });
  summary.newlyCraftable.forEach((entry) => {
    lines.push(`CRAFT NOW: ${entry.label}`);
  });
  summary.nearlyCraftable.forEach((entry) => {
    lines.push(`NEARLY READY: ${entry.label} — ${entry.detail}`);
  });
  if (summary.highlightResources.length > 0) {
    lines.push(`Extracted materials: ${summary.highlightResources.map((id) => getResourceDisplayName(id, true)).join(', ')}`);
  }
  if (summary.weaponSummary?.equippedDisplayName) {
    lines.push(`Equipped weapon: ${summary.weaponSummary.equippedDisplayName}`);
  }
  if (summary.note) lines.push(summary.note);
  return lines;
}
