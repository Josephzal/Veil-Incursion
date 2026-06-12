export type IncursionConsumableId = 'soul-core' | 'veil-shard' | 'target-fragment' | 'spectral-salt';

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

export type PlayerCombatDebuffId = 'BLEEDING' | 'FRACTURED';

export interface IncursionConsumableUseResult {
  itemId: IncursionConsumableId | import('./cargoGrid').CargoItemId;
  healAmount: number;
  stunsEnemy: boolean;
  shatterKineticArmor?: number;
  stripOccultWards?: number;
  clearDebuffs?: boolean;
  clearPlayerDebuffs?: PlayerCombatDebuffId[];
  frontlineBlindTurns?: number;
  maxAbyssalReserve?: boolean;
  grantBonusAp?: number;
  restoreStaminaPct?: number;
  absorbNextHit?: boolean;
  logLine: string;
}
