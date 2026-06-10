export type IncursionConsumableId = 'soul-core' | 'veil-shard' | 'target-fragment';

export type IncursionConsumableEffect = 'heal' | 'stun' | 'unimplemented';

export interface IncursionConsumable {
  id: IncursionConsumableId;
  name: string;
  description: string;
  quantity: number;
  effect: IncursionConsumableEffect;
  /** Percent of max Soul Anchor restored — heal items only. */
  healPercent?: number;
}

export interface IncursionInventoryState {
  items: IncursionConsumable[];
}

export interface IncursionConsumableUseResult {
  itemId: IncursionConsumableId;
  healAmount: number;
  stunsEnemy: boolean;
  shatterKineticArmor?: number;
  stripOccultWards?: number;
  clearDebuffs?: boolean;
  maxAbyssalReserve?: boolean;
  grantBonusAp?: number;
  restoreStaminaPct?: number;
  absorbNextHit?: boolean;
  logLine: string;
}
