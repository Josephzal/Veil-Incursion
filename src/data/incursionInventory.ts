import type { IncursionConsumable, IncursionInventoryState } from '../types/incursionInventory';

export const SOUL_CORE_ITEM: IncursionConsumable = {
  id: 'soul-core',
  name: 'Soul Core',
  description: 'Stabilized ley-fragment harvested from anchor chapels. Deploy to restore Soul Anchor integrity.',
  healPercent: 50,
  quantity: 0,
  effect: 'heal',
};

export const VEIL_SHARD_ITEM: IncursionConsumable = {
  id: 'veil-shard',
  name: 'Veil Shard',
  description: 'Crystallized veil interference. Deploy to stagger a hostile, shatter World-Ender channels, and force a skipped turn.',
  quantity: 0,
  effect: 'stun',
};

export const TARGET_FRAGMENT_ITEM: IncursionConsumable = {
  id: 'target-fragment',
  name: 'Target Fragment',
  description: 'Unstable targeting lattice — field deployment protocols pending operative clearance.',
  quantity: 0,
  effect: 'unimplemented',
};

export function createDefaultIncursionInventory(): IncursionInventoryState {
  return { items: [] };
}

export function catalogItemForId(id: IncursionConsumable['id']): IncursionConsumable {
  switch (id) {
    case 'soul-core':
      return { ...SOUL_CORE_ITEM };
    case 'veil-shard':
      return { ...VEIL_SHARD_ITEM };
    case 'target-fragment':
      return { ...TARGET_FRAGMENT_ITEM };
    default:
      return { ...SOUL_CORE_ITEM };
  }
}
