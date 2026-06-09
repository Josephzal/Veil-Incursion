import type { CargoItemId, CargoRunState, ContainmentItem, HarvestYieldTier, PlacedCargoItem } from '../types/cargoGrid';
import {
  CARGO_GRID_DIMENSION,
  CARGO_ITEM_CATALOG,
  CARGO_OCCUPANCY_RESONANCE_THRESHOLD,
  CARGO_RESONANCE_MULTIPLIER,
  DATA_BLEED_VALUE_DRAIN_PCT,
} from '../types/cargoGrid';

let instanceCounter = 0;

export function containmentItemValue(item: ContainmentItem): number {
  return item.currentValue ?? CARGO_ITEM_CATALOG[item.itemId].baseValue;
}

export function createCargoInstanceId(prefix = 'cargo'): string {
  instanceCounter += 1;
  return `${prefix}-${Date.now()}-${instanceCounter}`;
}

export function resetCargoInstanceCounter(): void {
  instanceCounter = 0;
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
  if (originRow + def.height > CARGO_GRID_DIMENSION) return false;
  if (originCol + def.width > CARGO_GRID_DIMENSION) return false;

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

export function placeCargoFromContainment(
  cargo: CargoRunState,
  containmentInstanceId: string,
  originRow: number,
  originCol: number,
): CargoRunState | null {
  const pending = cargo.containment.find((item) => item.instanceId === containmentInstanceId);
  if (!pending) return null;
  if (!canPlaceCargoItem(cargo, pending.itemId, originRow, originCol)) return null;

  const def = CARGO_ITEM_CATALOG[pending.itemId];
  const placed: PlacedCargoItem = {
    instanceId: pending.instanceId,
    itemId: pending.itemId,
    originRow,
    originCol,
    currentValue: containmentItemValue(pending),
  };

  return {
    ...cargo,
    grid: { placed: [...cargo.grid.placed, placed] },
    containment: cargo.containment.filter((item) => item.instanceId !== containmentInstanceId),
  };
}

export function addLootToContainment(
  cargo: CargoRunState,
  itemId: CargoItemId,
  count = 1,
): CargoRunState {
  const additions = Array.from({ length: count }, () => ({
    instanceId: createCargoInstanceId(itemId),
    itemId,
  }));
  return {
    ...cargo,
    containment: [...cargo.containment, ...additions],
  };
}

export function calculateGridOccupancy(cargo: CargoRunState): number {
  const occupiedCells = occupiedCellSet(cargo.grid.placed).size;
  const totalCells = CARGO_GRID_DIMENSION * CARGO_GRID_DIMENSION;
  return occupiedCells / totalCells;
}

export function getCargoResonanceMultiplier(cargo: CargoRunState): number {
  return calculateGridOccupancy(cargo) > CARGO_OCCUPANCY_RESONANCE_THRESHOLD
    ? CARGO_RESONANCE_MULTIPLIER
    : 1;
}

export function calculateCargoMarketValue(cargo: CargoRunState): number {
  const placedValue = cargo.grid.placed.reduce((sum, item) => sum + item.currentValue, 0);
  const containmentValue = cargo.containment.reduce(
    (sum, item) => sum + containmentItemValue(item),
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
    currentValue: Math.max(1, Math.floor(item.currentValue * factor)),
  }));
  const nextContainment = cargo.containment.map((item) => ({
    ...item,
    currentValue: Math.max(1, Math.floor(containmentItemValue(item) * factor)),
  }));

  const after = nextPlaced.reduce((sum, item) => sum + item.currentValue, 0)
    + nextContainment.reduce((sum, item) => sum + containmentItemValue(item), 0);

  return {
    cargo: {
      ...cargo,
      grid: { placed: nextPlaced },
      containment: nextContainment,
    },
    drainedValue: Math.max(0, before - after),
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

export function removePlacedCargoItem(cargo: CargoRunState, instanceId: string): CargoRunState {
  return {
    ...cargo,
    grid: {
      placed: cargo.grid.placed.filter((item) => item.instanceId !== instanceId),
    },
  };
}

export function buildHarvestLoot(
  tier: HarvestYieldTier,
  sectorTier: number,
  isElite: boolean,
  nodesCleared = 0,
): CargoItemId[] {
  const inBreachPerimeter = nodesCleared >= 10 && nodesCleared < 15;
  const loot: CargoItemId[] = inBreachPerimeter && Math.random() < 0.55
    ? ['null-crystal-matrix']
    : ['null-crystal-shard'];
  if (tier === 'FULL' || tier === 'DEEP_GORE') loot.push('rift-iron-cache');
  if (tier === 'DEEP_GORE' || isElite) loot.push('veil-residue-bulk');
  if (inBreachPerimeter && tier !== 'QUICK' && Math.random() < 0.4) {
    loot.push('null-crystal-matrix');
  }
  if (tier === 'DEEP_GORE' && Math.random() < 0.35) loot.push('focusing-ampoule');
  if (sectorTier >= 2 && Math.random() < 0.4) loot.push('gravity-grapple');
  if (tier === 'QUICK') return loot.slice(0, 1);
  if (tier === 'FULL') return loot.slice(0, Math.min(2, loot.length));
  return loot;
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
    currentValue: Math.max(1, Math.floor(item.currentValue * factor)),
  }));
  const nextContainment = cargo.containment.map((item) => ({
    ...item,
    currentValue: Math.max(1, Math.floor(containmentItemValue(item) * factor)),
  }));
  const after = nextPlaced.reduce((sum, item) => sum + item.currentValue, 0)
    + nextContainment.reduce((sum, item) => sum + containmentItemValue(item), 0);

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
  const inGrid = cargo.grid.placed.filter((item) => item.itemId === itemId).length;
  const inContainment = cargo.containment.filter((item) => item.itemId === itemId).length;
  return inGrid + inContainment;
}

export function isCombatConsumableCargoItem(itemId: CargoItemId): boolean {
  return CARGO_ITEM_CATALOG[itemId].usableInCombat === true;
}

export function consumeCargoItem(cargo: CargoRunState, itemId: CargoItemId): CargoRunState | null {
  const containmentIdx = cargo.containment.findIndex((item) => item.itemId === itemId);
  if (containmentIdx >= 0) {
    return {
      ...cargo,
      containment: cargo.containment.filter((_, index) => index !== containmentIdx),
    };
  }
  const placed = cargo.grid.placed.find((item) => item.itemId === itemId);
  if (!placed) return null;
  return removePlacedCargoItem(cargo, placed.instanceId);
}

export function scaledLootCount(yieldPct: number, baseCount: number): number {
  if (yieldPct >= 100) return baseCount;
  if (yieldPct >= 75) return Math.max(1, Math.floor(baseCount * 0.75));
  return Math.max(1, Math.floor(baseCount * 0.5));
}
