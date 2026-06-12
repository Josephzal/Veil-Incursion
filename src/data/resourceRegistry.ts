import type { ResourceItemDefinition, ResourceItemId } from '../types/resourceItem';

export const RESOURCE_REGISTRY: Record<ResourceItemId, ResourceItemDefinition> = {
  'ley-slag': {
    id: 'ley-slag',
    name: 'Ley-Slag',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 5,
    baseCapitalValue: 28,
    itemType: 'RESOURCE',
  },
  'sanguine-ampoule': {
    id: 'sanguine-ampoule',
    name: 'Sanguine Ampoule',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 3,
    baseCapitalValue: 42,
    itemType: 'RESOURCE',
  },
  'encrypted-grid-drive': {
    id: 'encrypted-grid-drive',
    name: 'Encrypted Grid-Drive',
    gridWidth: 1,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 125,
    itemType: 'RESOURCE',
  },
  'legion-blood-iron': {
    id: 'legion-blood-iron',
    name: 'Legion Blood-Iron',
    gridWidth: 2,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 118,
    itemType: 'RESOURCE',
  },
  'anomalous-core': {
    id: 'anomalous-core',
    name: 'Anomalous Core',
    gridWidth: 2,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 280,
    itemType: 'RESOURCE',
  },
  'echo-glass-shard': {
    id: 'echo-glass-shard',
    name: 'Echo-Glass Shard',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 10,
    baseCapitalValue: 18,
    itemType: 'RESOURCE',
  },
  'veil-ash-canister': {
    id: 'veil-ash-canister',
    name: 'Veil-Ash Canister',
    gridWidth: 1,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 58,
    itemType: 'RESOURCE',
  },
  'smugglers-ledger': {
    id: 'smugglers-ledger',
    name: "The Smuggler's Ledger",
    gridWidth: 2,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 98,
    itemType: 'RESOURCE',
  },
  'ossified-ley-knot': {
    id: 'ossified-ley-knot',
    name: 'Ossified Ley-Knot',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 88,
    itemType: 'RESOURCE',
  },
  'sealed-containment-casket': {
    id: 'sealed-containment-casket',
    name: 'Sealed Containment Casket',
    gridWidth: 3,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 340,
    itemType: 'RESOURCE',
  },
};

export const ALL_RESOURCE_ITEM_IDS = Object.keys(RESOURCE_REGISTRY) as ResourceItemId[];

export function getResourceDefinition(id: ResourceItemId): ResourceItemDefinition {
  return RESOURCE_REGISTRY[id];
}

export function isResourceItemId(id: string): id is ResourceItemId {
  return id in RESOURCE_REGISTRY;
}
