import type { IncursionConsumable, IncursionInventoryState } from '../types/incursionInventory';

export const SOUL_CORE_ITEM: IncursionConsumable = {
  id: 'soul-core',
  name: 'Soul Core',
  description: 'Stabilized ley-fragment harvested from anchor chapels. Deploy to restore Soul Anchor integrity.',
  healPercent: 25,
  quantity: 1,
};

export function createDefaultIncursionInventory(): IncursionInventoryState {
  return {
    items: [{ ...SOUL_CORE_ITEM }],
  };
}
