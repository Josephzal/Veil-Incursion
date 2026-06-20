import type { ResourceItemDefinition, ResourceItemId } from '../types/resourceItem';

export const RESOURCE_REGISTRY: Record<ResourceItemId, ResourceItemDefinition> = {
  'ley-slag': {
    id: 'ley-slag',
    name: 'Ley-Slag',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 5,
    baseCapitalValue: 28,
    sellValue: 5,
    ipValue: 1,
    itemType: 'RESOURCE',
  },
  'echo-glass-shard': {
    id: 'echo-glass-shard',
    name: 'Echo-Glass Shard',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 10,
    baseCapitalValue: 18,
    sellValue: 2,
    ipValue: 2,
    itemType: 'RESOURCE',
  },
  'tarnished-dog-tags': {
    id: 'tarnished-dog-tags',
    name: 'Tarnished Dog Tags',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 10,
    baseCapitalValue: 22,
    sellValue: 15,
    ipValue: 0,
    itemType: 'RESOURCE',
  },
  'sanguine-ampoule': {
    id: 'sanguine-ampoule',
    name: 'Sanguine Ampoule',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 3,
    baseCapitalValue: 42,
    sellValue: 20,
    ipValue: 5,
    itemType: 'RESOURCE',
  },
  'ossified-ley-knot': {
    id: 'ossified-ley-knot',
    name: 'Ossified Ley-Knot',
    gridWidth: 1,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 88,
    sellValue: 45,
    ipValue: 0,
    itemType: 'RESOURCE',
  },
  'encrypted-grid-drive': {
    id: 'encrypted-grid-drive',
    name: 'Encrypted Grid-Drive',
    gridWidth: 1,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 125,
    sellValue: 30,
    ipValue: 25,
    itemType: 'RESOURCE',
  },
  'legion-blood-iron': {
    id: 'legion-blood-iron',
    name: 'Legion Blood-Iron',
    gridWidth: 2,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 118,
    sellValue: 30,
    ipValue: 25,
    itemType: 'RESOURCE',
  },
  'combustion-cylinder': {
    id: 'combustion-cylinder',
    name: 'Combustion Cylinder',
    gridWidth: 1,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 95,
    sellValue: 25,
    ipValue: 25,
    itemType: 'RESOURCE',
  },
  'veil-ash-canister': {
    id: 'veil-ash-canister',
    name: 'Veil-Ash Canister',
    gridWidth: 1,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 58,
    sellValue: 20,
    ipValue: 20,
    itemType: 'RESOURCE',
  },
  'smugglers-ledger': {
    id: 'smugglers-ledger',
    name: "The Smuggler's Ledger",
    gridWidth: 2,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 98,
    sellValue: 250,
    ipValue: 100,
    itemType: 'RESOURCE',
  },
  'anomalous-core': {
    id: 'anomalous-core',
    name: 'Anomalous Core',
    gridWidth: 2,
    gridHeight: 2,
    maxStack: 1,
    baseCapitalValue: 280,
    sellValue: 500,
    ipValue: 500,
    itemType: 'RESOURCE',
  },
  'sealed-containment-casket': {
    id: 'sealed-containment-casket',
    name: 'Sealed Containment Casket',
    gridWidth: 3,
    gridHeight: 1,
    maxStack: 1,
    baseCapitalValue: 340,
    sellValue: 100,
    ipValue: 0,
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

export function getResourceSellValue(id: ResourceItemId): number {
  return RESOURCE_REGISTRY[id].sellValue;
}

export function getResourceIpValue(id: ResourceItemId): number {
  return RESOURCE_REGISTRY[id].ipValue;
}

export function calculateDonationIpYield(
  items: ReadonlyArray<{ id: ResourceItemId; quantity: number }>,
): number {
  return items.reduce(
    (total, entry) => total + getResourceIpValue(entry.id) * entry.quantity,
    0,
  );
}
