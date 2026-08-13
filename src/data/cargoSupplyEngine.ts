import type {
  CargoItemId,
  CargoRunState,
  PlacedCargoItem,
} from '../types/cargoGrid';
import {
  CARGO_GRID_COLS,
  CARGO_GRID_ROWS,
  CARGO_ITEM_CATALOG,
} from '../types/cargoGrid';
import type { RunItemId } from '../types/runItem';
import { ALL_RUN_ITEM_IDS } from '../types/runItem';
import {
  canPlaceCargoItem,
  createCargoInstanceId,
  removePlacedCargoItem,
} from './cargoGridEngine';
import { getRunItemDefinition } from './runItemRegistry';
import { RUN_ITEM_ID_ALIASES } from './runItemIdAliases';

const CANONICAL_SUPPLY_IDS = new Set<CargoItemId>(
  ALL_RUN_ITEM_IDS as readonly CargoItemId[],
);

export type SupplyCargoItemId = RunItemId | CargoItemId;

export function isSupplyCargoItemId(itemId: CargoItemId): boolean {
  if (CANONICAL_SUPPLY_IDS.has(itemId)) return true;
  const definition = CARGO_ITEM_CATALOG[itemId];
  return Boolean(
    definition &&
      (definition.usableInCombat ||
        definition.usableOnScanner ||
        definition.tags.includes('TOOL')),
  );
}

export function isCombatSupplyId(itemId: CargoItemId): boolean {
  if ((ALL_RUN_ITEM_IDS as readonly string[]).includes(itemId)) {
    return getRunItemDefinition(itemId as RunItemId).family === 'COMBAT_CONSUMABLE';
  }
  return Boolean(CARGO_ITEM_CATALOG[itemId]?.usableInCombat);
}

export function isRecoverySupplyId(itemId: CargoItemId): boolean {
  if ((ALL_RUN_ITEM_IDS as readonly string[]).includes(itemId)) {
    return getRunItemDefinition(itemId as RunItemId).tags.includes('HEALING');
  }
  return CARGO_ITEM_CATALOG[itemId]?.tags.includes('HEAL') ?? false;
}

function createPlacedSupply(
  itemId: CargoItemId,
  row: number,
  col: number,
  origin: NonNullable<PlacedCargoItem['supplyOrigin']>,
  temporary: boolean,
): PlacedCargoItem {
  return {
    instanceId: createCargoInstanceId(`supply-${itemId}`),
    itemId,
    originRow: row,
    originCol: col,
    currentValue: CARGO_ITEM_CATALOG[itemId]?.baseValue ?? 0,
    quantity: 1,
    supplyOrigin: origin,
    temporarySupply: temporary || undefined,
  };
}

export function placeSupplyAtCell(
  cargo: CargoRunState,
  itemId: CargoItemId,
  row: number,
  col: number,
  origin: NonNullable<PlacedCargoItem['supplyOrigin']>,
  temporary = false,
): CargoRunState | null {
  if (!isSupplyCargoItemId(itemId)) return null;
  if (!canPlaceCargoItem(cargo, itemId, row, col)) return null;
  return {
    ...cargo,
    grid: {
      placed: [
        ...cargo.grid.placed,
        createPlacedSupply(itemId, row, col, origin, temporary),
      ],
    },
  };
}

export function placeSupplyAtFirstOpenCell(
  cargo: CargoRunState,
  itemId: CargoItemId,
  origin: NonNullable<PlacedCargoItem['supplyOrigin']>,
  temporary = false,
): CargoRunState | null {
  for (let row = 0; row < CARGO_GRID_ROWS; row += 1) {
    for (let col = 0; col < CARGO_GRID_COLS; col += 1) {
      const placed = placeSupplyAtCell(cargo, itemId, row, col, origin, temporary);
      if (placed) return placed;
    }
  }
  return null;
}

/** Creates an incoming transactional instance that must be consumed immediately. */
export function stageImmediateSupplyTransaction(
  cargo: CargoRunState,
  itemId: CargoItemId,
  origin: NonNullable<PlacedCargoItem['supplyOrigin']>,
): CargoRunState | null {
  if (!isSupplyCargoItemId(itemId)) return null;
  return {
    ...cargo,
    grid: {
      placed: [
        ...cargo.grid.placed,
        createPlacedSupply(itemId, -1, -1, origin, false),
      ],
    },
  };
}

export function findSupplyInstance(
  cargo: CargoRunState,
  itemId: CargoItemId,
): PlacedCargoItem | null {
  return cargo.grid.placed.find(
    (instance) => instance.itemId === itemId && isSupplyCargoItemId(instance.itemId),
  ) ?? null;
}

export function hasSupplyInstance(cargo: CargoRunState, itemId: CargoItemId): boolean {
  return findSupplyInstance(cargo, itemId) != null;
}

export function consumeSupplyInstance(
  cargo: CargoRunState,
  instanceId: string,
): { cargo: CargoRunState; consumed: PlacedCargoItem } | null {
  const consumed = cargo.grid.placed.find(
    (instance) =>
      instance.instanceId === instanceId && isSupplyCargoItemId(instance.itemId),
  );
  if (!consumed) return null;
  return {
    cargo: removePlacedCargoItem(cargo, instanceId),
    consumed,
  };
}

export function countPackedHubStockSupply(
  cargo: CargoRunState,
  itemId: CargoItemId,
): number {
  return cargo.grid.placed.filter(
    (instance) =>
      instance.itemId === itemId &&
      instance.supplyOrigin === 'HUB_STOCK' &&
      !instance.temporarySupply,
  ).length;
}

export function commitPackedSupplyStock(
  stock: Partial<Record<CargoItemId, number>>,
  cargo: CargoRunState,
): { stock: Partial<Record<CargoItemId, number>>; cargo: CargoRunState } | null {
  const deductions = new Map<CargoItemId, number>();
  cargo.grid.placed.forEach((instance) => {
    if (
      instance.supplyOrigin !== 'HUB_STOCK' ||
      instance.temporarySupply ||
      !isSupplyCargoItemId(instance.itemId)
    ) {
      return;
    }
    deductions.set(instance.itemId, (deductions.get(instance.itemId) ?? 0) + 1);
  });
  for (const [itemId, count] of deductions) {
    if ((stock[itemId] ?? 0) < count) return null;
  }
  const next = { ...stock };
  deductions.forEach((count, itemId) => {
    const remaining = (next[itemId] ?? 0) - count;
    if (remaining > 0) next[itemId] = remaining;
    else delete next[itemId];
  });
  return { stock: next, cargo };
}

export function accountOwnsRecoverySupply(
  stock: Partial<Record<CargoItemId, number>>,
): boolean {
  return Object.entries(stock).some(
    ([itemId, quantity]) =>
      (quantity ?? 0) > 0 && isRecoverySupplyId(itemId as CargoItemId),
  );
}

export function canOfferTemporaryCoagulant(
  stock: Partial<Record<CargoItemId, number>>,
  cargo: CargoRunState,
): boolean {
  return !accountOwnsRecoverySupply(stock) &&
    !cargo.grid.placed.some((instance) => instance.temporarySupply);
}

export function applyRecoverySupplyMarketFloor(
  stock: readonly CargoItemId[],
  pending: boolean,
): CargoItemId[] {
  if (!pending || stock.includes('standard-coagulant')) return [...stock];
  return ['standard-coagulant', ...stock];
}

export function stripTemporarySupplies(cargo: CargoRunState): CargoRunState {
  return {
    ...cargo,
    grid: {
      placed: cargo.grid.placed.filter((instance) => !instance.temporarySupply),
    },
    containment: cargo.containment.filter((instance) => !instance.temporarySupply),
  };
}

export interface StoredSupplyAccountInput {
  hubCraftedConsumables?: Partial<Record<string, number>>;
  preRunCargo?: CargoRunState;
  tacticalLoadout?: readonly (CargoItemId | null)[];
  runItemLoadout?: {
    combatSlots?: readonly (string | null)[];
    fieldSlots?: readonly (string | null)[];
  };
}

const warnedUnknownSupplyIds = new Set<string>();

function warnUnknownSupplyId(itemId: string): void {
  if (warnedUnknownSupplyIds.has(itemId)) return;
  warnedUnknownSupplyIds.add(itemId);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[cargo_supply_unknown_id]', { itemId });
  }
}

export function normalizeSupplyAccount(input: StoredSupplyAccountInput): {
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>;
  preRunCargo: CargoRunState;
} {
  const stock: Partial<Record<CargoItemId, number>> = {};
  Object.entries(input.hubCraftedConsumables ?? {}).forEach(([rawId, rawQuantity]) => {
    const itemId = (RUN_ITEM_ID_ALIASES[rawId] ?? rawId) as CargoItemId;
    if (!(itemId in CARGO_ITEM_CATALOG)) {
      warnUnknownSupplyId(rawId);
      return;
    }
    const quantity = Math.max(0, Math.floor(rawQuantity ?? 0));
    if (quantity > 0) stock[itemId] = (stock[itemId] ?? 0) + quantity;
  });

  const addStock = (rawId: string): void => {
    const itemId = (RUN_ITEM_ID_ALIASES[rawId] ?? rawId) as CargoItemId;
    if (!(itemId in CARGO_ITEM_CATALOG)) {
      warnUnknownSupplyId(rawId);
      return;
    }
    stock[itemId] = (stock[itemId] ?? 0) + 1;
  };

  input.tacticalLoadout?.forEach((itemId) => {
    if (itemId) addStock(itemId);
  });
  input.runItemLoadout?.combatSlots?.forEach((itemId) => {
    if (itemId) addStock(itemId);
  });
  input.runItemLoadout?.fieldSlots?.forEach((itemId) => {
    if (itemId) addStock(itemId);
  });

  const source = input.preRunCargo ?? {
    grid: { placed: [] },
    containment: [],
    dataBleedActive: false,
    outsideHook: null,
  };
  const placed = source.grid.placed.flatMap((instance) => {
    if (!(instance.itemId in CARGO_ITEM_CATALOG)) {
      warnUnknownSupplyId(instance.itemId);
      return [];
    }
    if (
      isSupplyCargoItemId(instance.itemId) &&
      !instance.supplyOrigin &&
      !instance.temporarySupply
    ) {
      addStock(instance.itemId);
      return [{ ...instance, quantity: 1, supplyOrigin: 'HUB_STOCK' as const }];
    }
    return [{ ...instance }];
  });

  return {
    hubCraftedConsumables: stock,
    preRunCargo: {
      ...source,
      grid: { placed },
      containment: source.containment.filter(
        (instance) => !isSupplyCargoItemId(instance.itemId),
      ),
    },
  };
}
