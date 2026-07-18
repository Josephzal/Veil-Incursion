import type { CargoItemId, CargoRunState, ContainmentItem, PlacedCargoItem } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';
import { getResourceDefinition, isResourceItemId } from './resourceRegistry';
import { isRouteIntelResourceId } from './sectorAccessMandateEngine';

/** Effective stack quantity for a cargo instance (legacy items omit quantity). */
export function cargoItemQuantity(item: { quantity?: number }): number {
  return Math.max(1, item.quantity ?? 1);
}

/** Cargo stack cap for a catalog item — resources use registry; consumables are 1. */
export function getCargoStackCap(itemId: CargoItemId): number {
  if (isResourceItemId(itemId)) {
    return Math.max(1, getResourceDefinition(itemId).cargoStackCap);
  }
  return 1;
}

export function getStashStackCap(resourceId: ResourceItemId): number {
  return Math.max(1, getResourceDefinition(resourceId).stashStackCap);
}

export function isCargoStackable(itemId: CargoItemId): boolean {
  return getCargoStackCap(itemId) > 1;
}

export function stackRoomRemaining(itemId: CargoItemId, quantity: number): number {
  return Math.max(0, getCargoStackCap(itemId) - Math.max(0, quantity));
}

export function unitCargoValue(item: PlacedCargoItem | ContainmentItem): number {
  if ('currentValue' in item && typeof item.currentValue === 'number') {
    return Math.max(1, item.currentValue);
  }
  return Math.max(1, CARGO_ITEM_CATALOG[item.itemId].baseValue);
}

export function stackMarketValue(item: PlacedCargoItem | ContainmentItem): number {
  return unitCargoValue(item) * cargoItemQuantity(item);
}

/** Blend per-unit values when merging stacks that may have different DATA_BLEED erosion. */
export function blendUnitValues(
  qtyA: number,
  unitA: number,
  qtyB: number,
  unitB: number,
): number {
  const total = qtyA + qtyB;
  if (total <= 0) return Math.max(1, unitA);
  return Math.max(1, Math.floor((unitA * qtyA + unitB * qtyB) / total));
}

export function isProgressionProtectedCargo(itemId: CargoItemId): boolean {
  return isRouteIntelResourceId(itemId);
}

export function isRareOrApexCargo(itemId: CargoItemId): boolean {
  if (!isResourceItemId(itemId)) return false;
  const rarity = getResourceDefinition(itemId).rarity;
  return rarity === 'RARE' || rarity === 'APEX';
}

export type CargoLootPickupDecision =
  | 'MERGE'
  | 'REPLACE'
  | 'LEAVE_BEHIND'
  | 'CANCEL';

export interface CargoMergePreview {
  targetInstanceId: string;
  targetLocation: 'grid' | 'containment';
  canMergeQty: number;
  overflowQty: number;
  stackCap: number;
  currentQty: number;
}

export interface CargoLootPickupPreview {
  itemId: CargoItemId;
  itemName: string;
  quantity: number;
  stackCap: number;
  /** Incomplete stacks that can absorb some/all of the pickup. */
  mergeTargets: CargoMergePreview[];
  mergeableQty: number;
  /** Units that still need a new stack after merges. */
  newStackQty: number;
  /** True when a new stack is needed and the grid has no free footprint (containment still accepts). */
  gridFullForNewStack: boolean;
  progressionProtected: boolean;
  rareOrApex: boolean;
}

function listIncompleteStacks(
  cargo: CargoRunState,
  itemId: CargoItemId,
): CargoMergePreview[] {
  const cap = getCargoStackCap(itemId);
  if (cap <= 1) return [];

  const targets: CargoMergePreview[] = [];
  cargo.grid.placed.forEach((item) => {
    if (item.itemId !== itemId) return;
    const qty = cargoItemQuantity(item);
    const room = stackRoomRemaining(itemId, qty);
    if (room <= 0) return;
    targets.push({
      targetInstanceId: item.instanceId,
      targetLocation: 'grid',
      canMergeQty: room,
      overflowQty: 0,
      stackCap: cap,
      currentQty: qty,
    });
  });
  cargo.containment.forEach((item) => {
    if (item.itemId !== itemId) return;
    const qty = cargoItemQuantity(item);
    const room = stackRoomRemaining(itemId, qty);
    if (room <= 0) return;
    targets.push({
      targetInstanceId: item.instanceId,
      targetLocation: 'containment',
      canMergeQty: room,
      overflowQty: 0,
      stackCap: cap,
      currentQty: qty,
    });
  });
  return targets;
}

/** Preview merge / overflow for a pending loot grant (containment always accepts leftovers). */
export function previewCargoLootPickup(
  cargo: CargoRunState,
  itemId: CargoItemId,
  quantity: number,
  gridHasOpenFootprint: (itemId: CargoItemId) => boolean,
): CargoLootPickupPreview {
  const qty = Math.max(0, quantity);
  const stackCap = getCargoStackCap(itemId);
  const mergeTargets = listIncompleteStacks(cargo, itemId);
  let remaining = qty;
  let mergeableQty = 0;
  const annotated = mergeTargets.map((target) => {
    const take = Math.min(target.canMergeQty, remaining);
    remaining -= take;
    mergeableQty += take;
    return { ...target, canMergeQty: take, overflowQty: remaining };
  });

  return {
    itemId,
    itemName: CARGO_ITEM_CATALOG[itemId]?.name ?? itemId,
    quantity: qty,
    stackCap,
    mergeTargets: annotated.filter((t) => t.canMergeQty > 0),
    mergeableQty,
    newStackQty: remaining,
    gridFullForNewStack: remaining > 0 && !gridHasOpenFootprint(itemId),
    progressionProtected: isProgressionProtectedCargo(itemId),
    rareOrApex: isRareOrApexCargo(itemId),
  };
}
