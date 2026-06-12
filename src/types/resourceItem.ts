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
  | 'sealed-containment-casket';

export type ResourceItemType = 'RESOURCE';

export interface ResourceItemDefinition {
  id: ResourceItemId;
  name: string;
  gridWidth: number;
  gridHeight: number;
  maxStack: number;
  baseCapitalValue: number;
  itemType: ResourceItemType;
}

export type ResourceQuantity = Partial<Record<ResourceItemId, number>>;

export interface ResourceBundle {
  items: ReadonlyArray<{ id: ResourceItemId; quantity: number }>;
}

export type ResourceCacheId = 'smuggling_drop_stealth';
