import type { BoundRequisitionId } from '../types/boundRequisition';
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

export const CRAFTING_REGISTRY: CraftingRecipe[] = [
  {
    id: 'craft_chalk_line_ward',
    kind: 'AUGMENT',
    label: 'Chalk-Line Ward',
    outputId: 'CHALK_LINE_WARD',
    description: 'Occult suppressor sigil — Solaris ward augment.',
    effectSummary: 'First 3 Depths generate 0 Resonance from scans.',
    requirements: [
      { resourceId: 'sanguine-ampoule', quantity: 2 },
      { resourceId: 'ley-slag', quantity: 1 },
    ],
  },

  // Hub augments (permanent passive rule-benders)
  {
    id: 'craft_adrenaline_primer',
    kind: 'AUGMENT',
    label: 'Adrenaline Primer',
    outputId: 'ADRENALINE_PRIMER',
    effectSummary: '+1 AP on the first turn of combat (×3 combats).',
    requirements: [{ resourceId: 'legion-blood-iron', quantity: 1 }],
  },
  {
    id: 'craft_blood_price',
    kind: 'AUGMENT',
    label: 'Blood Price',
    outputId: 'BLOOD_PRICE',
    effectSummary: 'Start run with a random powerful Ley-Scar; begin at −25% Max HP.',
    requirements: [
      { resourceId: 'ossified-ley-knot', quantity: 1 },
      { resourceId: 'sanguine-ampoule', quantity: 2 },
    ],
  },
  {
    id: 'craft_smugglers_pockets',
    kind: 'AUGMENT',
    label: "Smuggler's Pockets",
    outputId: 'SMUGGLERS_POCKETS',
    effectSummary: '+2 permanent Cargo Grid slots; scans add +5% Resonance.',
    requirements: [
      { resourceId: 'veil-ash-canister', quantity: 2 },
      { resourceId: 'nullcrete-shard', quantity: 3 },
      { resourceId: 'ley-slag', quantity: 2 },
    ],
  },
  {
    id: 'craft_kinetic_battery',
    kind: 'AUGMENT',
    label: 'Kinetic Battery',
    outputId: 'KINETIC_BATTERY',
    effectSummary: 'Defending boosts your next attack damage.',
    requirements: [
      { resourceId: 'encrypted-grid-drive', quantity: 2 },
      { resourceId: 'combustion-cylinder', quantity: 1 },
    ],
  },
  {
    id: 'craft_dead_drop_tracker',
    kind: 'AUGMENT',
    label: 'Dead-Drop Tracker',
    outputId: 'DEAD_DROP_TRACKER',
    effectSummary: 'Forces a high-tier loot cache within the first 7 Depths.',
    requirements: [
      { resourceId: 'echo-glass-shard', quantity: 5 },
      { resourceId: 'encrypted-grid-drive', quantity: 1 },
    ],
  },

  // Consumable / run-item recipes live in runItemRegistry (via buildRunItemCraftingRecipes).
  // Do not duplicate them here — double-counting skews economy tuning + bottleneck shares.
];

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

/** Permanent hub augments — passive rule-benders forged at the Fabrication Matrix. */
export const PERMANENT_AUGMENTS: readonly CraftingRecipe[] = getRecipesByKind('AUGMENT');

export function isAugmentOutputId(outputId: string): outputId is BoundRequisitionId {
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
  craftedAugments: readonly BoundRequisitionId[],
): boolean {
  const recipe = getCraftingRecipeByOutput(outputId);
  if (!recipe) return false;
  if (recipe.kind === 'AUGMENT') {
    return craftedAugments.includes(outputId as BoundRequisitionId);
  }
  return false;
}
