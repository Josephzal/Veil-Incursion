import type { BoundRequisitionId } from '../types/boundRequisition';
import type { CargoItemId } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';
import { isBlueprintId } from '../types/equipmentBlueprint';

export type CraftingRecipeKind = 'LOADOUT' | 'AUGMENT' | 'CONSUMABLE';

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
  // Loadouts & weapon blueprints
  {
    id: 'craft_pulse_rifle',
    kind: 'LOADOUT',
    label: 'Pulse Rifle Frame',
    outputId: 'riftshot_pulse_rifle',
    description: 'Terran-grid pulse lattice — Riftshot class weapon blueprint.',
    effectSummary: 'Unlocks the Riftshot Pulse Rifle combat loadout.',
    requirements: [
      { resourceId: 'encrypted-grid-drive', quantity: 3 },
      { resourceId: 'ley-slag', quantity: 10 },
    ],
  },
  {
    id: 'craft_claymore',
    kind: 'LOADOUT',
    label: 'Claymore Strike',
    outputId: 'aegis_claymore',
    description: 'Legion heavy melee lattice — Aegis claymore blueprint.',
    effectSummary: 'Unlocks the Aegis Claymore combat loadout.',
    requirements: [
      { resourceId: 'legion-blood-iron', quantity: 3 },
      { resourceId: 'ley-slag', quantity: 5 },
    ],
  },
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
  {
    id: 'craft_containment_rig',
    kind: 'LOADOUT',
    label: 'Containment Rig',
    outputId: 'envoy_hex',
    description: 'Diplomatic hex sigil — Envoy class weapon blueprint.',
    effectSummary: 'Unlocks the Envoy Hex combat loadout.',
    requirements: [
      { resourceId: 'anomalous-core', quantity: 1 },
      { resourceId: 'legion-blood-iron', quantity: 1 },
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
      { resourceId: 'ley-slag', quantity: 5 },
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

  // Tactical consumables (hub-crafted, staged for run loadout)
  {
    id: 'craft_standard_coagulant',
    kind: 'CONSUMABLE',
    label: 'Standard Coagulant',
    outputId: 'coagulation-stitch',
    effectSummary: 'Heals 25 HP in combat.',
    requirements: [{ resourceId: 'ley-slag', quantity: 2 }],
  },
  {
    id: 'craft_trauma_patch',
    kind: 'CONSUMABLE',
    label: 'Trauma Patch',
    outputId: 'sanguine-coagulant',
    effectSummary: 'Heals 50% HP and clears Bleed / Fracture.',
    requirements: [{ resourceId: 'sanguine-ampoule', quantity: 3 }],
  },
  {
    id: 'craft_kinetic_hollow_points',
    kind: 'CONSUMABLE',
    label: 'Veil-Vial',
    outputId: 'kinetic-hollow-points',
    effectSummary: 'Next attack deals +15 damage.',
    requirements: [
      { resourceId: 'ley-slag', quantity: 3 },
      { resourceId: 'combustion-cylinder', quantity: 1 },
    ],
  },
  {
    id: 'craft_veil_ash_grenade',
    kind: 'CONSUMABLE',
    label: 'Veil-Ash Grenade',
    outputId: 'veil-ash-grenade',
    effectSummary: 'AoE blind to the entire enemy frontline.',
    requirements: [
      { resourceId: 'veil-ash-canister', quantity: 1 },
      { resourceId: 'echo-glass-shard', quantity: 3 },
    ],
  },
  {
    id: 'craft_sonar_ping',
    kind: 'CONSUMABLE',
    label: 'Sonar-Ping',
    outputId: 'sonar-ping',
    effectSummary: 'Guarantees a clean extraction node on next scan window.',
    requirements: [{ resourceId: 'echo-glass-shard', quantity: 5 }],
  },
];

export function getCraftingRecipe(id: string): CraftingRecipe | undefined {
  return CRAFTING_REGISTRY.find((recipe) => recipe.id === id);
}

export function getRecipesByKind(kind: CraftingRecipeKind): CraftingRecipe[] {
  return CRAFTING_REGISTRY.filter((recipe) => recipe.kind === kind);
}

export function isAugmentOutputId(outputId: string): outputId is BoundRequisitionId {
  return getCraftingRecipeByOutput(outputId)?.kind === 'AUGMENT';
}

export function isConsumableOutputId(outputId: string): outputId is CargoItemId {
  return getCraftingRecipeByOutput(outputId)?.kind === 'CONSUMABLE';
}

export function isLoadoutOutputId(outputId: string): boolean {
  const recipe = getCraftingRecipeByOutput(outputId);
  return recipe?.kind === 'LOADOUT' || isBlueprintId(outputId);
}

function getCraftingRecipeByOutput(outputId: string): CraftingRecipe | undefined {
  return CRAFTING_REGISTRY.find((recipe) => recipe.outputId === outputId);
}

export function isRecipeOutputOwned(
  outputId: string,
  unlockedBlueprints: readonly string[],
  craftedAugments: readonly BoundRequisitionId[],
): boolean {
  const recipe = getCraftingRecipeByOutput(outputId);
  if (!recipe) return false;
  if (recipe.kind === 'LOADOUT') {
    return unlockedBlueprints.includes(outputId);
  }
  if (recipe.kind === 'AUGMENT') {
    return craftedAugments.includes(outputId as BoundRequisitionId);
  }
  return false;
}
