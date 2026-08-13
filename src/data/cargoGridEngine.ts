import type { CargoItemId, CargoRunState, ContainmentItem, HarvestYieldTier, PlacedCargoItem } from '../types/cargoGrid';
import {
  CARGO_GRID_COLS,
  CARGO_GRID_ROWS,
  CARGO_GRID_CELL_COUNT,
  CARGO_ITEM_CATALOG,
  CARGO_OCCUPANCY_RESONANCE_THRESHOLD,
  CARGO_RESONANCE_MULTIPLIER,
  DATA_BLEED_VALUE_DRAIN_PCT,
  createDefaultCargoRunState,
} from '../types/cargoGrid';
import {
  blendUnitValues,
  cargoItemQuantity,
  getCargoStackCap,
  stackMarketValue,
  stackRoomRemaining,
  unitCargoValue,
} from './cargoStackEngine';

let instanceCounter = 0;

/** Per-unit containment value (DATA_BLEED erodes this). */
export function containmentItemValue(item: ContainmentItem): number {
  return unitCargoValue(item);
}

export function createCargoInstanceId(prefix = 'cargo'): string {
  instanceCounter += 1;
  return `${prefix}-${Date.now()}-${instanceCounter}`;
}

export function resetCargoInstanceCounter(): void {
  instanceCounter = 0;
}

/** Run-start cargo with debug potions locked to starter grid slots. */
export function createStarterCargoRunState(): CargoRunState {
  return applyIncursionStarterCargo(createDefaultCargoRunState());
}

const INCURSION_STARTER_CARGO: ReadonlyArray<{ itemId: CargoItemId; row: number; col: number }> = [
  { itemId: 'god-mode', row: 0, col: 0 },
  { itemId: 'spectral-salt', row: 0, col: 1 },
  { itemId: 'bitch-potion', row: 0, col: 2 },
  { itemId: 'crit-potion', row: 1, col: 0 },
];

function stripCatalogItemsFromCargo(cargo: CargoRunState, itemIds: readonly CargoItemId[]): CargoRunState {
  const idSet = new Set(itemIds);
  const placed = cargo.grid.placed.filter((item) => !idSet.has(item.itemId));
  const containment = cargo.containment.filter((item) => !idSet.has(item.itemId));
  if (placed.length === cargo.grid.placed.length && containment.length === cargo.containment.length) {
    return cargo;
  }
  return {
    ...cargo,
    grid: { placed },
    containment,
  };
}

function removePlacedItemsOverlappingCell(cargo: CargoRunState, row: number, col: number): CargoRunState {
  const target = `${row},${col}`;
  let working = cargo;
  for (const item of cargo.grid.placed) {
    if (cellsForItem(item.itemId, item.originRow, item.originCol).includes(target)) {
      working = removePlacedCargoItem(working, item.instanceId);
    }
  }
  return working;
}

export function placeCatalogItemAtCell(
  cargo: CargoRunState,
  itemId: CargoItemId,
  originRow: number,
  originCol: number,
): CargoRunState | null {
  if (!canPlaceCargoItem(cargo, itemId, originRow, originCol)) return null;
  const def = CARGO_ITEM_CATALOG[itemId];
  return {
    ...cargo,
    grid: {
      placed: [
        ...cargo.grid.placed,
        {
          instanceId: createCargoInstanceId(itemId),
          itemId,
          originRow,
          originCol,
          currentValue: def.baseValue,
        },
      ],
    },
  };
}

/** Ensures debug starter potions occupy fixed cargo grid cells. */
export function applyIncursionStarterCargo(cargo: CargoRunState): CargoRunState {
  const starterIds = INCURSION_STARTER_CARGO.map((entry) => entry.itemId);
  let working = stripCatalogItemsFromCargo(cargo, starterIds);
  for (const slot of INCURSION_STARTER_CARGO) {
    working = removePlacedItemsOverlappingCell(working, slot.row, slot.col);
  }
  for (const slot of INCURSION_STARTER_CARGO) {
    const placed = placeCatalogItemAtCell(working, slot.itemId, slot.row, slot.col);
    if (placed) working = placed;
  }
  return working;
}

function cellsForItem(itemId: CargoItemId, originRow: number, originCol: number): string[] {
  const def = CARGO_ITEM_CATALOG[itemId];
  const keys: string[] = [];
  for (let row = 0; row < def.height; row += 1) {
    for (let col = 0; col < def.width; col += 1) {
      keys.push(`${originRow + row},${originCol + col}`);
    }
  }
  return keys;
}

function occupiedCellSet(placed: PlacedCargoItem[]): Set<string> {
  const set = new Set<string>();
  placed.forEach((item) => {
    cellsForItem(item.itemId, item.originRow, item.originCol).forEach((key) => set.add(key));
  });
  return set;
}

export function canPlaceCargoItemExcluding(
  cargo: CargoRunState,
  itemId: CargoItemId,
  originRow: number,
  originCol: number,
  excludeInstanceId?: string,
): boolean {
  const def = CARGO_ITEM_CATALOG[itemId];
  if (originRow < 0 || originCol < 0) return false;
  if (originRow + def.height > CARGO_GRID_ROWS) return false;
  if (originCol + def.width > CARGO_GRID_COLS) return false;

  const occupied = new Set<string>();
  cargo.grid.placed.forEach((item) => {
    if (item.instanceId === excludeInstanceId) return;
    cellsForItem(item.itemId, item.originRow, item.originCol).forEach((key) => occupied.add(key));
  });
  return cellsForItem(itemId, originRow, originCol).every((key) => !occupied.has(key));
}

export function canPlaceCargoItem(
  cargo: CargoRunState,
  itemId: CargoItemId,
  originRow: number,
  originCol: number,
): boolean {
  return canPlaceCargoItemExcluding(cargo, itemId, originRow, originCol);
}

/** Places a catalog item in the first open grid cell, if any. */
export function placeCargoAtFirstOpenSlot(
  cargo: CargoRunState,
  itemId: CargoItemId,
): CargoRunState | null {
  for (let row = 0; row < CARGO_GRID_ROWS; row += 1) {
    for (let col = 0; col < CARGO_GRID_COLS; col += 1) {
      if (!canPlaceCargoItem(cargo, itemId, row, col)) continue;
      const def = CARGO_ITEM_CATALOG[itemId];
      return {
        ...cargo,
        grid: {
          placed: [
            ...cargo.grid.placed,
            {
              instanceId: createCargoInstanceId(itemId),
              itemId,
              originRow: row,
              originCol: col,
              currentValue: def.baseValue,
            },
          ],
        },
      };
    }
  }
  return null;
}

export function placeCargoFromContainment(
  cargo: CargoRunState,
  containmentInstanceId: string,
  originRow: number,
  originCol: number,
): CargoRunState | null {
  const pending = cargo.containment.find((item) => item.instanceId === containmentInstanceId);
  if (!pending) return null;

  const mergeTarget = findMergeablePlacedAtCell(
    cargo,
    pending.itemId,
    originRow,
    originCol,
    undefined,
  );
  if (mergeTarget) {
    return mergeCargoInstances(cargo, pending.instanceId, mergeTarget.instanceId);
  }

  if (!canPlaceCargoItem(cargo, pending.itemId, originRow, originCol)) return null;

  const placed: PlacedCargoItem = {
    instanceId: pending.instanceId,
    itemId: pending.itemId,
    originRow,
    originCol,
    currentValue: containmentItemValue(pending),
    quantity: cargoItemQuantity(pending),
  };

  return {
    ...cargo,
    grid: { placed: [...cargo.grid.placed, placed] },
    containment: cargo.containment.filter((item) => item.instanceId !== containmentInstanceId),
  };
}

/** Purchases and places a catalog item directly on the cargo grid at the given cell. */
export function placePurchasedCargoAtCell(
  cargo: CargoRunState,
  itemId: CargoItemId,
  originRow: number,
  originCol: number,
): CargoRunState | null {
  if (!canPlaceCargoItem(cargo, itemId, originRow, originCol)) return null;
  const def = CARGO_ITEM_CATALOG[itemId];
  return {
    ...cargo,
    grid: {
      placed: [
        ...cargo.grid.placed,
        {
          instanceId: createCargoInstanceId(itemId),
          itemId,
          originRow,
          originCol,
          currentValue: def.baseValue,
        },
      ],
    },
  };
}

/** Places a black-market listing on-grid without charging — pending bind. */
export function placeStagedBlackMarketCargoAtCell(
  cargo: CargoRunState,
  itemId: CargoItemId,
  originRow: number,
  originCol: number,
): CargoRunState | null {
  if (!canPlaceCargoItem(cargo, itemId, originRow, originCol)) return null;
  const def = CARGO_ITEM_CATALOG[itemId];
  return {
    ...cargo,
    grid: {
      placed: [
        ...cargo.grid.placed,
        {
          instanceId: createCargoInstanceId(itemId),
          itemId,
          originRow,
          originCol,
          currentValue: def.baseValue,
          quantity: def.subtype === 'SUPPLY' ? 1 : undefined,
          supplyOrigin: def.subtype === 'SUPPLY' ? 'MARKET' : undefined,
          blackMarketStaged: true,
        },
      ],
    },
  };
}

export function clearBlackMarketStagedFlags(cargo: CargoRunState): CargoRunState {
  return {
    ...cargo,
    grid: {
      placed: cargo.grid.placed.map((item) => (
        item.blackMarketStaged ? { ...item, blackMarketStaged: undefined } : item
      )),
    },
  };
}

export function listStagedBlackMarketPlacements(cargo: CargoRunState): PlacedCargoItem[] {
  return cargo.grid.placed.filter((item) => item.blackMarketStaged === true);
}

export interface AddLootToContainmentResult {
  cargo: CargoRunState;
  mergedQuantity: number;
  newStackCount: number;
  stagedInstanceIds: string[];
}

export interface AddLootToContainmentOptions {
  /**
   * Harvest / field spawn — each unit is its own physical containment instance (qty 1).
   * Does not auto-merge into existing grid or containment stacks.
   * Stacking still happens when the player places items into cargo.
   */
  asSeparatePhysicalUnits?: boolean;
}

/**
 * Phase 2A — add loot units into cargo stacks.
 * Default: fills incomplete grid stacks first, then containment stacks, then creates new stacks.
 * With `asSeparatePhysicalUnits`: creates one containment instance per unit (no auto-merge).
 */
export function addLootToContainmentDetailed(
  cargo: CargoRunState,
  itemId: CargoItemId,
  count = 1,
  stagedInstanceIds?: string[],
  options?: AddLootToContainmentOptions,
): AddLootToContainmentResult {
  let remaining = Math.max(0, count);
  if (remaining <= 0) {
    return { cargo, mergedQuantity: 0, newStackCount: 0, stagedInstanceIds: [] };
  }

  const unitValue = CARGO_ITEM_CATALOG[itemId].baseValue;
  let mergedQuantity = 0;
  let working = cargo;
  const staged: string[] = [];
  const separateUnits = options?.asSeparatePhysicalUnits === true;

  if (!separateUnits) {
    const fillPlaced = (items: PlacedCargoItem[]): PlacedCargoItem[] => items.map((item) => {
      if (remaining <= 0 || item.itemId !== itemId) return item;
      const qty = cargoItemQuantity(item);
      const room = stackRoomRemaining(itemId, qty);
      if (room <= 0) return item;
      const take = Math.min(room, remaining);
      remaining -= take;
      mergedQuantity += take;
      return {
        ...item,
        quantity: qty + take,
        currentValue: blendUnitValues(qty, unitCargoValue(item), take, unitValue),
      };
    });

    const fillContainment = (items: ContainmentItem[]): ContainmentItem[] => items.map((item) => {
      if (remaining <= 0 || item.itemId !== itemId) return item;
      const qty = cargoItemQuantity(item);
      const room = stackRoomRemaining(itemId, qty);
      if (room <= 0) return item;
      const take = Math.min(room, remaining);
      remaining -= take;
      mergedQuantity += take;
      return {
        ...item,
        quantity: qty + take,
        currentValue: blendUnitValues(qty, unitCargoValue(item), take, unitValue),
      };
    });

    working = {
      ...working,
      grid: { placed: fillPlaced(working.grid.placed) },
      containment: fillContainment(working.containment),
    };
  }

  // New containment instances are always physical units (qty 1).
  // Multi-unit stacks form only by merging into existing stacks (when allowed)
  // or when the player places items into the cargo grid.
  const additions: ContainmentItem[] = [];
  while (remaining > 0) {
    remaining -= 1;
    const instanceId = createCargoInstanceId(itemId);
    staged.push(instanceId);
    additions.push({
      instanceId,
      itemId,
      currentValue: unitValue,
      quantity: 1,
    });
  }

  stagedInstanceIds?.push(...staged);
  return {
    cargo: {
      ...working,
      containment: [...working.containment, ...additions],
    },
    mergedQuantity,
    newStackCount: additions.length,
    stagedInstanceIds: staged,
  };
}

export function addLootToContainment(
  cargo: CargoRunState,
  itemId: CargoItemId,
  count = 1,
  stagedInstanceIds?: string[],
  options?: AddLootToContainmentOptions,
): CargoRunState {
  return addLootToContainmentDetailed(cargo, itemId, count, stagedInstanceIds, options).cargo;
}

export function calculateGridOccupancy(cargo: CargoRunState): number {
  const occupiedCells = occupiedCellSet(cargo.grid.placed).size;
  const totalCells = CARGO_GRID_CELL_COUNT;
  return occupiedCells / totalCells;
}

export function getCargoResonanceMultiplier(cargo: CargoRunState): number {
  const occupancy = calculateGridOccupancy(cargo);
  return occupancy >= CARGO_OCCUPANCY_RESONANCE_THRESHOLD
    ? CARGO_RESONANCE_MULTIPLIER
    : 1;
}

export function calculateCargoMarketValue(cargo: CargoRunState): number {
  const placedValue = cargo.grid.placed.reduce((sum, item) => sum + stackMarketValue(item), 0);
  const containmentValue = cargo.containment.reduce(
    (sum, item) => sum + stackMarketValue(item),
    0,
  );
  return placedValue + containmentValue;
}

export function applyDataBleedToCargo(cargo: CargoRunState): { cargo: CargoRunState; drainedValue: number } {
  if (!cargo.dataBleedActive) return { cargo, drainedValue: 0 };

  const before = calculateCargoMarketValue(cargo);
  if (before <= 0) return { cargo, drainedValue: 0 };

  const factor = 1 - DATA_BLEED_VALUE_DRAIN_PCT / 100;
  const nextPlaced = cargo.grid.placed.map((item) => ({
    ...item,
    currentValue: Math.max(1, Math.floor(unitCargoValue(item) * factor)),
  }));
  const nextContainment = cargo.containment.map((item) => ({
    ...item,
    currentValue: Math.max(1, Math.floor(unitCargoValue(item) * factor)),
  }));

  const after = nextPlaced.reduce((sum, item) => sum + stackMarketValue(item), 0)
    + nextContainment.reduce((sum, item) => sum + stackMarketValue(item), 0);

  return {
    cargo: {
      ...cargo,
      grid: { placed: nextPlaced },
      containment: nextContainment,
    },
    drainedValue: Math.max(0, before - after),
  };
}

/** Find a same-type incomplete stack whose footprint covers (row, col). */
export function findMergeablePlacedAtCell(
  cargo: CargoRunState,
  itemId: CargoItemId,
  row: number,
  col: number,
  excludeInstanceId?: string,
): PlacedCargoItem | null {
  const cap = getCargoStackCap(itemId);
  if (cap <= 1) return null;
  const key = `${row},${col}`;
  for (const item of cargo.grid.placed) {
    if (item.instanceId === excludeInstanceId) continue;
    if (item.itemId !== itemId) continue;
    if (stackRoomRemaining(itemId, cargoItemQuantity(item)) <= 0) continue;
    if (cellsForItem(item.itemId, item.originRow, item.originCol).includes(key)) {
      return item;
    }
  }
  return null;
}

/** Any placed item whose footprint covers (row, col). */
export function findPlacedItemAtCell(
  cargo: CargoRunState,
  row: number,
  col: number,
  excludeInstanceId?: string,
): PlacedCargoItem | null {
  const key = `${row},${col}`;
  for (const item of cargo.grid.placed) {
    if (item.instanceId === excludeInstanceId) continue;
    if (cellsForItem(item.itemId, item.originRow, item.originCol).includes(key)) {
      return item;
    }
  }
  return null;
}

function findCargoInstance(
  cargo: CargoRunState,
  instanceId: string,
): { location: 'grid' | 'containment'; item: PlacedCargoItem | ContainmentItem } | null {
  const placed = cargo.grid.placed.find((entry) => entry.instanceId === instanceId);
  if (placed) return { location: 'grid', item: placed };
  const pending = cargo.containment.find((entry) => entry.instanceId === instanceId);
  if (pending) return { location: 'containment', item: pending };
  return null;
}

/** Merge source instance into target instance (same itemId). Leftover stays on source if over cap. */
export function mergeCargoInstances(
  cargo: CargoRunState,
  sourceInstanceId: string,
  targetInstanceId: string,
): CargoRunState | null {
  if (sourceInstanceId === targetInstanceId) return null;
  const sourceRef = findCargoInstance(cargo, sourceInstanceId);
  const targetRef = findCargoInstance(cargo, targetInstanceId);
  if (!sourceRef || !targetRef) return null;
  if (sourceRef.item.itemId !== targetRef.item.itemId) return null;

  const itemId = sourceRef.item.itemId;
  const sourceQty = cargoItemQuantity(sourceRef.item);
  const targetQty = cargoItemQuantity(targetRef.item);
  const room = stackRoomRemaining(itemId, targetQty);
  if (room <= 0) return null;

  const take = Math.min(room, sourceQty);
  const leftover = sourceQty - take;
  const blended = blendUnitValues(
    targetQty,
    unitCargoValue(targetRef.item),
    take,
    unitCargoValue(sourceRef.item),
  );

  let nextPlaced = cargo.grid.placed.map((item) => {
    if (item.instanceId === targetInstanceId) {
      return { ...item, quantity: targetQty + take, currentValue: blended };
    }
    if (item.instanceId === sourceInstanceId) {
      if (leftover <= 0) return null;
      return { ...item, quantity: leftover };
    }
    return item;
  }).filter((item): item is PlacedCargoItem => item != null);

  let nextContainment = cargo.containment.map((item) => {
    if (item.instanceId === targetInstanceId) {
      return { ...item, quantity: targetQty + take, currentValue: blended };
    }
    if (item.instanceId === sourceInstanceId) {
      if (leftover <= 0) return null;
      return { ...item, quantity: leftover };
    }
    return item;
  }).filter((item): item is ContainmentItem => item != null);

  if (leftover <= 0) {
    nextPlaced = nextPlaced.filter((item) => item.instanceId !== sourceInstanceId);
    nextContainment = nextContainment.filter((item) => item.instanceId !== sourceInstanceId);
  }

  return {
    ...cargo,
    grid: { placed: nextPlaced },
    containment: nextContainment,
  };
}

/** Jettison overlapping placed items and place source at cell (replace pickup UX). */
export function replaceCargoAtCell(
  cargo: CargoRunState,
  sourceInstanceId: string,
  originRow: number,
  originCol: number,
): CargoRunState | null {
  const sourceRef = findCargoInstance(cargo, sourceInstanceId);
  if (!sourceRef) return null;

  const footprint = cellsForItem(sourceRef.item.itemId, originRow, originCol);
  let working: CargoRunState = {
    ...cargo,
    grid: {
      placed: cargo.grid.placed.filter((item) => {
        if (item.instanceId === sourceInstanceId) return true;
        const keys = cellsForItem(item.itemId, item.originRow, item.originCol);
        return !keys.some((key) => footprint.includes(key));
      }),
    },
  };

  // Temporarily remove source so canPlace checks clean cells.
  working = {
    ...working,
    grid: {
      placed: working.grid.placed.filter((item) => item.instanceId !== sourceInstanceId),
    },
    containment: working.containment.filter((item) => item.instanceId !== sourceInstanceId),
  };

  if (!canPlaceCargoItem(working, sourceRef.item.itemId, originRow, originCol)) return null;

  const placed: PlacedCargoItem = {
    instanceId: sourceInstanceId,
    itemId: sourceRef.item.itemId,
    originRow,
    originCol,
    currentValue: unitCargoValue(sourceRef.item),
    quantity: cargoItemQuantity(sourceRef.item),
    blackMarketStaged: sourceRef.location === 'grid'
      ? (sourceRef.item as PlacedCargoItem).blackMarketStaged
      : undefined,
  };

  return {
    ...working,
    grid: { placed: [...working.grid.placed, placed] },
  };
}

export function movePlacedCargoItem(
  cargo: CargoRunState,
  instanceId: string,
  originRow: number,
  originCol: number,
): CargoRunState | null {
  const item = cargo.grid.placed.find((entry) => entry.instanceId === instanceId);
  if (!item) return null;
  if (item.originRow === originRow && item.originCol === originCol) return cargo;

  const mergeTarget = findMergeablePlacedAtCell(
    cargo,
    item.itemId,
    originRow,
    originCol,
    instanceId,
  );
  if (mergeTarget) {
    return mergeCargoInstances(cargo, instanceId, mergeTarget.instanceId);
  }

  if (!canPlaceCargoItemExcluding(cargo, item.itemId, originRow, originCol, instanceId)) return null;

  return {
    ...cargo,
    grid: {
      placed: cargo.grid.placed.map((entry) =>
        entry.instanceId === instanceId
          ? { ...entry, originRow, originCol }
          : entry,
      ),
    },
  };
}

export function relocateCargoItem(
  cargo: CargoRunState,
  instanceId: string,
  originRow: number,
  originCol: number,
): CargoRunState | null {
  const fromContainment = placeCargoFromContainment(cargo, instanceId, originRow, originCol);
  if (fromContainment) return fromContainment;
  return movePlacedCargoItem(cargo, instanceId, originRow, originCol);
}

/** True when drop cell can accept a merge even if free placement is blocked. */
export function canMergeCargoAtCell(
  cargo: CargoRunState,
  itemId: CargoItemId,
  row: number,
  col: number,
  excludeInstanceId?: string,
): boolean {
  return findMergeablePlacedAtCell(cargo, itemId, row, col, excludeInstanceId) != null;
}

export function hasOpenCargoFootprint(cargo: CargoRunState, itemId: CargoItemId): boolean {
  for (let row = 0; row < CARGO_GRID_ROWS; row += 1) {
    for (let col = 0; col < CARGO_GRID_COLS; col += 1) {
      if (canPlaceCargoItem(cargo, itemId, row, col)) return true;
    }
  }
  return false;
}

export function removePlacedCargoItem(cargo: CargoRunState, instanceId: string): CargoRunState {
  return {
    ...cargo,
    grid: {
      placed: cargo.grid.placed.filter((item) => item.instanceId !== instanceId),
    },
  };
}

/** Move a placed grid item back into the containment / field floor. */
export function returnCargoToContainment(
  cargo: CargoRunState,
  instanceId: string,
): CargoRunState | null {
  const placed = cargo.grid.placed.find((item) => item.instanceId === instanceId);
  if (!placed) return null;

  const containmentItem: ContainmentItem = {
    instanceId: placed.instanceId,
    itemId: placed.itemId,
    currentValue: unitCargoValue(placed),
    quantity: cargoItemQuantity(placed),
  };

  return {
    ...cargo,
    grid: {
      placed: cargo.grid.placed.filter((item) => item.instanceId !== instanceId),
    },
    containment: [...cargo.containment, containmentItem],
  };
}

export function buildHarvestLoot(
  _tier: HarvestYieldTier,
  _sectorTier: number,
  _isElite: boolean,
  _nodesCleared = 0,
): CargoItemId[] {
  return ['veil-residue-bulk'];
}

export function isVeilResidueCargoItem(itemId: CargoItemId): boolean {
  return itemId === 'veil-residue-bulk';
}

export function countVeilResidueInCargo(cargo: CargoRunState): number {
  const inContainment = cargo.containment
    .filter((item) => isVeilResidueCargoItem(item.itemId))
    .reduce((sum, item) => sum + cargoItemQuantity(item), 0);
  const inGrid = cargo.grid.placed
    .filter((item) => isVeilResidueCargoItem(item.itemId))
    .reduce((sum, item) => sum + cargoItemQuantity(item), 0);
  return inContainment + inGrid;
}

export function stripVeilResidueFromCargo(cargo: CargoRunState): CargoRunState {
  return {
    ...cargo,
    containment: cargo.containment.filter((item) => !isVeilResidueCargoItem(item.itemId)),
    grid: {
      placed: cargo.grid.placed.filter((item) => !isVeilResidueCargoItem(item.itemId)),
    },
  };
}

/** Purges everything still in the harvest bay. Only packed grid cargo survives. */
export function finalizeHarvestCargoState(
  cargo: CargoRunState,
  _stagingInstanceIds?: ReadonlySet<string>,
): CargoRunState {
  return {
    ...cargo,
    containment: [],
    grid: {
      placed: cargo.grid.placed.filter((item) => !isVeilResidueCargoItem(item.itemId)),
    },
  };
}

export function applyEmergencyExtractBleed(
  cargo: CargoRunState,
  bleedPct: number,
): { cargo: CargoRunState; drainedValue: number } {
  const before = calculateCargoMarketValue(cargo);
  if (before <= 0) return { cargo, drainedValue: 0 };

  const factor = 1 - bleedPct / 100;
  const nextPlaced = cargo.grid.placed.map((item) => ({
    ...item,
    currentValue: Math.max(1, Math.floor(unitCargoValue(item) * factor)),
  }));
  const nextContainment = cargo.containment.map((item) => ({
    ...item,
    currentValue: Math.max(1, Math.floor(unitCargoValue(item) * factor)),
  }));
  const after = nextPlaced.reduce((sum, item) => sum + stackMarketValue(item), 0)
    + nextContainment.reduce((sum, item) => sum + stackMarketValue(item), 0);

  return {
    cargo: {
      ...cargo,
      grid: { placed: nextPlaced },
      containment: nextContainment,
    },
    drainedValue: Math.max(0, before - after),
  };
}

export function hasCargoItem(cargo: CargoRunState, itemId: CargoItemId): boolean {
  return countCargoItemInstances(cargo, itemId) > 0;
}

export function countCargoItemInstances(cargo: CargoRunState, itemId: CargoItemId): number {
  const inGrid = cargo.grid.placed
    .filter((item) => item.itemId === itemId)
    .reduce((sum, item) => sum + cargoItemQuantity(item), 0);
  const inContainment = cargo.containment
    .filter((item) => item.itemId === itemId)
    .reduce((sum, item) => sum + cargoItemQuantity(item), 0);
  return inGrid + inContainment;
}

export function combatConsumableApCost(itemId: CargoItemId): number {
  return CARGO_ITEM_CATALOG[itemId]?.apCost ?? 2;
}

export function isCombatConsumableCargoItem(itemId: CargoItemId): boolean {
  return CARGO_ITEM_CATALOG[itemId].usableInCombat === true;
}

export function isCombatDeployableCargoItem(itemId: CargoItemId): boolean {
  const def = CARGO_ITEM_CATALOG[itemId];
  return def.usableInCombat === true && def.combatEffect !== 'unimplemented';
}

export function combatConsumableDescription(itemId: CargoItemId): string {
  const def = CARGO_ITEM_CATALOG[itemId];
  const apCost = def.apCost ?? 2;
  const apNote = `Costs ${apCost} AP — does not end your turn.`;
  switch (def.combatEffect) {
    case 'heal':
      return `Restores ${def.healPercent ?? 0}% of maximum Soul Anchor integrity. ${apNote}`;
    case 'stun':
    case 'max_fracture':
      return `Maxes hostile Fracture Gauge and shatters charge channels. ${apNote}`;
    case 'stamina_ap_surge':
      return 'Overclocks stamina to maximum and grants +1 action point this turn.';
    case 'shatter_armor':
      return 'Shatters up to 2 layers of kinetic armor on the targeted hostile.';
    case 'strip_wards':
      return 'Burns up to 2 layers of occult wards off the targeted hostile.';
    case 'clear_debuffs':
      return `Clears operative debuffs and restores ${def.healPercent ?? 10}% Soul Anchor integrity.`;
    case 'max_abyssal':
      return 'Overcharges Abyssal Reserve to maximum for this combat.';
    case 'absorb_hit':
      return 'Absorbs the next incoming health damage completely.';
    case 'spectral_imbue':
      return 'Imbues kinetic weapon strikes to bypass spectral resistance this combat.';
    case 'sanguine_coagulant':
      return 'Restores 50% Soul Anchor and purges BLEEDING / FRACTURED operative debuffs.';
    case 'veil_ash_grenade':
      return 'Blinds frontline hostiles for 2 turns (−30% accuracy).';
    case 'god_mode':
      return 'Overclocks operative systems — every attack deals 1000 true damage (armor bypass, guaranteed hit), resources locked at max. Free deploy.';
    case 'set_hp_to_one':
      return 'Reduces Soul Anchor integrity to 1. Free deploy.';
    case 'full_crit':
      return 'Locks operative targeting to 100% critical strike chance. Free deploy.';
    default:
      return 'Field deployment protocols pending operative clearance.';
  }
}

export function consumeCargoItem(cargo: CargoRunState, itemId: CargoItemId): CargoRunState | null {
  const containmentIdx = cargo.containment.findIndex((item) => item.itemId === itemId);
  if (containmentIdx >= 0) {
    const target = cargo.containment[containmentIdx]!;
    const qty = cargoItemQuantity(target);
    if (qty > 1) {
      return {
        ...cargo,
        containment: cargo.containment.map((item, index) => (
          index === containmentIdx ? { ...item, quantity: qty - 1 } : item
        )),
      };
    }
    return {
      ...cargo,
      containment: cargo.containment.filter((_, index) => index !== containmentIdx),
    };
  }
  const placed = cargo.grid.placed.find((item) => item.itemId === itemId);
  if (!placed) return null;
  const qty = cargoItemQuantity(placed);
  if (qty > 1) {
    return {
      ...cargo,
      grid: {
        placed: cargo.grid.placed.map((item) => (
          item.instanceId === placed.instanceId
            ? { ...item, quantity: qty - 1 }
            : item
        )),
      },
    };
  }
  return removePlacedCargoItem(cargo, placed.instanceId);
}

export function scaledLootCount(yieldPct: number, baseCount: number): number {
  if (yieldPct >= 100) return baseCount;
  if (yieldPct >= 75) return Math.max(1, Math.floor(baseCount * 0.75));
  return Math.max(1, Math.floor(baseCount * 0.5));
}
