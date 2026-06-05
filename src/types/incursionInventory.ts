export type IncursionConsumableId = 'soul-core';

export interface IncursionConsumable {
  id: IncursionConsumableId;
  name: string;
  description: string;
  healPercent: number;
  quantity: number;
}

export interface IncursionInventoryState {
  items: IncursionConsumable[];
}

export interface IncursionConsumableUseResult {
  healAmount: number;
  logLine: string;
}
