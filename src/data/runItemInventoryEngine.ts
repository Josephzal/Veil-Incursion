import type { CargoItemId } from '../types/cargoGrid';
import type {
  RunItemId,
  RunItemOfferResolution,
  RunItemPendingOffer,
  RunItemSlotType,
  RunItemsSlotState,
} from '../types/runItem';
import { getRunItemDefinition } from './runItemRegistry';
import { isRunItemId, tryNormalizeRunItemId } from './runItemIdAliases';
import { findOpenRunItemSlotIndex } from './runItemRunState';

export function cloneRunItemsSlots(slots: RunItemsSlotState): RunItemsSlotState {
  return {
    combatSlots: [...slots.combatSlots] as RunItemsSlotState['combatSlots'],
    fieldSlots: [...slots.fieldSlots] as RunItemsSlotState['fieldSlots'],
  };
}

export function getRunItemInCombatSlot(
  slots: RunItemsSlotState,
  itemId: RunItemId,
): number | null {
  const index = slots.combatSlots.findIndex((slot) => slot === itemId);
  return index >= 0 ? index : null;
}

export function getRunItemInFieldSlot(
  slots: RunItemsSlotState,
  itemId: RunItemId,
): number | null {
  const index = slots.fieldSlots.findIndex((slot) => slot === itemId);
  return index >= 0 ? index : null;
}

export function setRunItemInSlot(
  slots: RunItemsSlotState,
  slotType: RunItemSlotType,
  slotIndex: number,
  itemId: RunItemId | null,
): RunItemsSlotState {
  const next = cloneRunItemsSlots(slots);
  if (slotType === 'COMBAT') {
    next.combatSlots[slotIndex as 0 | 1] = itemId;
  } else {
    next.fieldSlots[slotIndex as 0 | 1] = itemId;
  }
  return next;
}

export function replaceRunItemAtSlot(
  slots: RunItemsSlotState,
  slotType: RunItemSlotType,
  slotIndex: number,
  newItemId: RunItemId,
): { slots: RunItemsSlotState; displaced: RunItemId | null } {
  const bucket = slotType === 'COMBAT' ? slots.combatSlots : slots.fieldSlots;
  const displaced = bucket[slotIndex as 0 | 1] ?? null;
  return {
    slots: setRunItemInSlot(slots, slotType, slotIndex, newItemId),
    displaced,
  };
}

export function clearRunItemAtSlot(
  slots: RunItemsSlotState,
  slotType: RunItemSlotType,
  slotIndex: number,
): { slots: RunItemsSlotState; removed: RunItemId | null } {
  const bucket = slotType === 'COMBAT' ? slots.combatSlots : slots.fieldSlots;
  const removed = bucket[slotIndex as 0 | 1] ?? null;
  return {
    slots: setRunItemInSlot(slots, slotType, slotIndex, null),
    removed,
  };
}

export function tryAutoPlaceRunItem(
  slots: RunItemsSlotState,
  itemId: RunItemId,
): { placed: true; slots: RunItemsSlotState } | { placed: false; slotType: RunItemSlotType } {
  const def = getRunItemDefinition(itemId);
  const openIndex = findOpenRunItemSlotIndex(slots, def.slotType);
  if (openIndex == null) {
    return { placed: false, slotType: def.slotType };
  }
  return {
    placed: true,
    slots: setRunItemInSlot(slots, def.slotType, openIndex, itemId),
  };
}

export function consumeRunItemFromCombatSlot(
  slots: RunItemsSlotState,
  itemId: RunItemId,
): RunItemsSlotState | null {
  const slotIndex = getRunItemInCombatSlot(slots, itemId);
  if (slotIndex == null) return null;
  return setRunItemInSlot(slots, 'COMBAT', slotIndex, null);
}

export function consumeRunItemFromFieldSlot(
  slots: RunItemsSlotState,
  itemId: RunItemId,
): RunItemsSlotState | null {
  const slotIndex = getRunItemInFieldSlot(slots, itemId);
  if (slotIndex == null) return null;
  return setRunItemInSlot(slots, 'FIELD', slotIndex, null);
}

export function resolveRunItemOffer(
  slots: RunItemsSlotState,
  offer: RunItemPendingOffer,
  resolution: RunItemOfferResolution,
  slotIndex?: number,
): {
  slots: RunItemsSlotState;
  displaced: RunItemId | null;
  consumedFromSlot: boolean;
} {
  if (resolution === 'discard' || resolution === 'cancel_purchase') {
    return { slots, displaced: null, consumedFromSlot: false };
  }

  if (resolution === 'use_now') {
    return { slots, displaced: null, consumedFromSlot: true };
  }

  if (resolution === 'replace') {
    if (slotIndex == null) {
      return { slots, displaced: null, consumedFromSlot: false };
    }
    const replaced = replaceRunItemAtSlot(slots, offer.slotType, slotIndex, offer.itemId);
    return {
      slots: replaced.slots,
      displaced: replaced.displaced,
      consumedFromSlot: false,
    };
  }

  return { slots, displaced: null, consumedFromSlot: false };
}

export function listOccupiedRunItemSlots(
  slots: RunItemsSlotState,
  slotType: RunItemSlotType,
): Array<{ slotIndex: number; itemId: RunItemId }> {
  const bucket = slotType === 'COMBAT' ? slots.combatSlots : slots.fieldSlots;
  return bucket.flatMap((itemId, slotIndex) => (
    itemId ? [{ slotIndex, itemId }] : []
  ));
}

export function coerceToRunItemId(id: string): RunItemId | null {
  return tryNormalizeRunItemId(id);
}

export function isRunItemCatalogId(id: string): boolean {
  return isRunItemId(id) || tryNormalizeRunItemId(id) != null;
}

export function resolveRunItemSlotType(itemId: string): RunItemSlotType | null {
  const normalized = tryNormalizeRunItemId(itemId);
  if (!normalized) return null;
  return getRunItemDefinition(normalized).slotType;
}

/** Hub stash ids may still use legacy catalog aliases. */
export function normalizeHubRunItemId(id: CargoItemId): RunItemId | null {
  return tryNormalizeRunItemId(id);
}

export function filterNonRunItemsFromTacticalLoadout(
  tacticalLoadout: readonly (CargoItemId | null)[],
): CargoItemId[] {
  return tacticalLoadout.filter((itemId): itemId is CargoItemId => (
    itemId != null && !isRunItemCatalogId(itemId)
  ));
}

export function migrateTacticalRunItemsToLoadout(
  tacticalLoadout: readonly (CargoItemId | null)[],
  runItemLoadout: RunItemsSlotState,
): {
  runItemLoadout: RunItemsSlotState;
  tacticalLoadout: readonly (CargoItemId | null)[];
} {
  let nextRunItems = cloneRunItemsSlots(runItemLoadout);
  const nextTactical = [...tacticalLoadout] as (CargoItemId | null)[];

  nextTactical.forEach((itemId, index) => {
    if (!itemId) return;
    const runItemId = tryNormalizeRunItemId(itemId);
    if (!runItemId) return;
    const placed = tryAutoPlaceRunItem(nextRunItems, runItemId);
    if (placed.placed) {
      nextRunItems = placed.slots;
      nextTactical[index] = null;
    }
  });

  return { runItemLoadout: nextRunItems, tacticalLoadout: nextTactical };
}
