import type { ResourceItemId } from '../types/resourceItem';

export interface CraftingRecipeRequirement {
  resourceId: ResourceItemId;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  label: string;
  outputId: string;
  requirements: ReadonlyArray<CraftingRecipeRequirement>;
  description?: string;
}

export const CRAFTING_REGISTRY: CraftingRecipe[] = [
  {
    id: 'craft_pulse_rifle',
    label: 'Pulse Rifle Frame',
    outputId: 'riftshot_pulse_rifle',
    description: 'Terran-grid pulse lattice — Riftshot class weapon blueprint.',
    requirements: [
      { resourceId: 'legion-blood-iron', quantity: 2 },
      { resourceId: 'encrypted-grid-drive', quantity: 1 },
    ],
  },
  {
    id: 'craft_veil_lancer',
    label: 'Veil Lancer Prototype',
    outputId: 'aegis_claymore',
    description: 'Solaris occult channeler — Aegis claymore blueprint.',
    requirements: [
      { resourceId: 'sanguine-ampoule', quantity: 2 },
      { resourceId: 'ossified-ley-knot', quantity: 1 },
      { resourceId: 'ley-slag', quantity: 4 },
    ],
  },
  {
    id: 'craft_null_breach_kit',
    label: 'Null Breach Kit',
    outputId: 'veil-ash-grenade',
    description: 'Fabricates Veil-Ash Grenade cargo consumables.',
    requirements: [
      { resourceId: 'echo-glass-shard', quantity: 5 },
      { resourceId: 'veil-ash-canister', quantity: 1 },
    ],
  },
  {
    id: 'craft_containment_rig',
    label: 'Containment Rig',
    outputId: 'envoy_hex',
    description: 'Diplomatic hex sigil — Envoy class weapon blueprint.',
    requirements: [
      { resourceId: 'anomalous-core', quantity: 1 },
      { resourceId: 'legion-blood-iron', quantity: 1 },
    ],
  },
];

export function getCraftingRecipe(id: string): CraftingRecipe | undefined {
  return CRAFTING_REGISTRY.find((recipe) => recipe.id === id);
}
