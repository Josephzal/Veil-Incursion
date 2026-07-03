export type ResourceItemId =
  | 'ley-slag'
  | 'sanguine-ampoule'
  | 'encrypted-grid-drive'
  | 'legion-blood-iron'
  | 'anomalous-core'
  | 'echo-glass-shard'
  | 'veil-ash-canister'
  | 'smugglers-ledger'
  | 'ossified-ley-knot'
  | 'sealed-containment-casket'
  | 'tarnished-dog-tags'
  | 'combustion-cylinder';

export type ResourceItemType = 'RESOURCE';

export interface ResourceItemDefinition {
  id: ResourceItemId;
  name: string;
  gridWidth: number;
  gridHeight: number;
  maxStack: number;
  /** In-run cargo extraction / market friction value. */
  baseCapitalValue: number;
  /** Hub fence sell price in Cabal Credits. */
  sellValue: number;
  /** Legacy influence yield metadata (deprecated donation system). */
  ipValue: number;
  itemType: ResourceItemType;
}

export type ResourceQuantity = Partial<Record<ResourceItemId, number>>;

export interface ResourceBundle {
  items: ReadonlyArray<{ id: ResourceItemId; quantity: number }>;
}

export type ResourceCacheId = 'smuggling_drop_stealth';

/** Resources the hub fence will buy for Credits. */
export const FENCEABLE_RESOURCE_IDS = [
  'ley-slag',
  'tarnished-dog-tags',
  'smugglers-ledger',
] as const satisfies readonly ResourceItemId[];

export type FenceableResourceId = (typeof FENCEABLE_RESOURCE_IDS)[number];
