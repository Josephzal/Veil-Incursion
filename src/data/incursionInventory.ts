import type { IncursionConsumable, IncursionInventoryState } from '../types/incursionInventory';

export const SOUL_CORE_ITEM: IncursionConsumable = {
  id: 'soul-core',
  name: 'Soul Core',
  description: 'Stabilized ley-fragment harvested from anchor chapels. Deploy to restore Soul Anchor integrity.',
  healPercent: 25,
  quantity: 1,
  effect: 'heal',
};

export const VEIL_SHARD_ITEM: IncursionConsumable = {
  id: 'veil-shard',
  name: 'Veil Shard',
  description: 'Crystallized veil interference. Deploy to stagger a hostile, shatter World-Ender channels, and force a skipped turn.',
  quantity: 1,
  effect: 'stun',
};

export function createDefaultIncursionInventory(): IncursionInventoryState {
  return {
    items: [{ ...SOUL_CORE_ITEM }, { ...VEIL_SHARD_ITEM }],
  };
}
