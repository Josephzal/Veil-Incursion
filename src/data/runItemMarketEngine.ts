import type { CargoItemId } from '../types/cargoGrid';
import type { RunItemId } from '../types/runItem';
import { ALL_RUN_ITEM_IDS } from '../types/runItem';
import { getRunItemDefinition } from './runItemRegistry';

export interface RunItemMarketListing {
  id: RunItemId;
  name: string;
  description: string;
  effect: string;
  price: number;
  slotType: 'COMBAT' | 'FIELD';
}

const BUYABLE_RUN_ITEM_IDS: readonly RunItemId[] = ALL_RUN_ITEM_IDS.filter(
  (itemId) => getRunItemDefinition(itemId).canBuy,
);

const COMBAT_MARKET_POOL = BUYABLE_RUN_ITEM_IDS.filter(
  (itemId) => getRunItemDefinition(itemId).slotType === 'COMBAT',
);

const FIELD_MARKET_POOL = BUYABLE_RUN_ITEM_IDS.filter(
  (itemId) => getRunItemDefinition(itemId).slotType === 'FIELD',
);

function shuffle<T>(items: readonly T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function pickRandom<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

/** Depth-aware filter — keep rare items out of shallow markets when flagged. */
function filterByDepth(items: readonly RunItemId[], depth: number): RunItemId[] {
  const rareIds: RunItemId[] = [
    'mirror-salt-vial',
    'bloodwire-tourniquet',
    'null-space-injector',
    'null-lens-filter',
    'dead-drop-token',
    'relay-spike',
  ];
  if (depth <= 1) {
    return items.filter((itemId) => !rareIds.includes(itemId));
  }
  return [...items];
}

/** Rotating run-item subset for Black Market — always includes at least one combat consumable. */
export function rollRunItemMarketStock(depth = 1): RunItemId[] {
  const combatPool = filterByDepth(COMBAT_MARKET_POOL, depth);
  const fieldPool = filterByDepth(FIELD_MARKET_POOL, depth);
  const count = 2 + Math.floor(Math.random() * 2);
  const picked = new Set<RunItemId>();

  const guaranteedCombat = pickRandom(combatPool);
  if (guaranteedCombat) picked.add(guaranteedCombat);

  const combined = shuffle([...combatPool, ...fieldPool]);
  combined.forEach((itemId) => {
    if (picked.size >= count) return;
    picked.add(itemId);
  });

  return [...picked];
}

export function simulateRunItemMarketStock(depth = 1): RunItemId[] {
  return rollRunItemMarketStock(depth);
}

export function runItemMarketListing(itemId: RunItemId): RunItemMarketListing {
  const def = getRunItemDefinition(itemId);
  return {
    id: itemId,
    name: def.name,
    description: def.description,
    effect: `EFFECT: ${def.effectSummary.toUpperCase()} // ${def.slotType} SLOT`,
    price: def.marketPrice,
    slotType: def.slotType,
  };
}

export function isRunItemMarketId(id: CargoItemId): id is RunItemId {
  return BUYABLE_RUN_ITEM_IDS.includes(id as RunItemId);
}

export function resolveRunItemMarketPrice(itemId: RunItemId): number {
  return getRunItemDefinition(itemId).marketPrice;
}

export function listRunItemMarketListings(stock: readonly CargoItemId[]): RunItemMarketListing[] {
  return stock
    .filter((itemId): itemId is RunItemId => isRunItemMarketId(itemId))
    .map((itemId) => runItemMarketListing(itemId));
}
