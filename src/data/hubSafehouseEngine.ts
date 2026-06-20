import { BLACK_MARKET_CARGO_LISTINGS } from './blackMarket';
import {
  addLootToContainment,
  applyIncursionStarterCargo,
  placeCargoAtFirstOpenSlot,
  placeCatalogItemAtCell,
  removePlacedCargoItem,
} from './cargoGridEngine';
import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import { createDefaultCargoRunState } from '../types/cargoGrid';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import {
  FENCEABLE_RESOURCE_IDS,
  type FenceableResourceId,
} from '../types/resourceItem';
import { getResourceSellValue, isResourceItemId } from './resourceRegistry';
import { getStashCount } from './resourceStashEngine';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';

export const HUB_STASH_CAPACITY = 500;

export type TacticalLoadoutSlots = [CargoItemId | null, CargoItemId | null, CargoItemId | null];

export function createDefaultTacticalLoadout(): TacticalLoadoutSlots {
  return [null, null, null];
}

export function calculateStashUsed(stash: ResourceQuantity): number {
  return Object.values(stash).reduce((sum, count) => sum + (count ?? 0), 0);
}

export function getHubBlackMarketListing(cargoId: CargoItemId) {
  return BLACK_MARKET_CARGO_LISTINGS.find((entry) => entry.id === cargoId) ?? null;
}

export function canPurchaseHubContraband(
  cabalCredits: number,
  cargoId: CargoItemId,
  discountPct = 0,
): boolean {
  const listing = getHubBlackMarketListing(cargoId);
  if (!listing) return false;
  const price = Math.max(1, Math.floor(listing.price * (1 - discountPct / 100)));
  return cabalCredits >= price;
}

export function hubContrabandPrice(basePrice: number, discountPct = 0): number {
  return Math.max(1, Math.floor(basePrice * (1 - discountPct / 100)));
}

export function applyHubContrabandPurchase(
  cabalCredits: number,
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>,
  cargoId: CargoItemId,
  discountPct = 0,
): {
  cabalCredits: number;
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>;
} | null {
  const listing = getHubBlackMarketListing(cargoId);
  if (!listing) return null;
  const price = hubContrabandPrice(listing.price, discountPct);
  if (cabalCredits < price) return null;
  return {
    cabalCredits: cabalCredits - price,
    hubCraftedConsumables: {
      ...hubCraftedConsumables,
      [cargoId]: (hubCraftedConsumables[cargoId] ?? 0) + 1,
    },
  };
}

export function applyFenceSale(
  stash: ResourceQuantity,
  cabalCredits: number,
  resourceId: FenceableResourceId,
  quantity = 1,
): { stash: ResourceQuantity; cabalCredits: number; creditsEarned: number } | null {
  const owned = getStashCount(stash, resourceId);
  if (quantity <= 0 || owned < quantity) return null;
  const unitValue = getResourceSellValue(resourceId);
  const creditsEarned = unitValue * quantity;
  const nextStash = { ...stash };
  const remaining = owned - quantity;
  if (remaining <= 0) {
    delete nextStash[resourceId];
  } else {
    nextStash[resourceId] = remaining;
  }
  return {
    stash: nextStash,
    cabalCredits: cabalCredits + creditsEarned,
    creditsEarned,
  };
}

export function listFenceableStashEntries(
  stash: ResourceQuantity,
): Array<{ resourceId: FenceableResourceId; quantity: number; sellValue: number }> {
  return FENCEABLE_RESOURCE_IDS.flatMap((resourceId) => {
    const quantity = getStashCount(stash, resourceId);
    if (quantity <= 0) return [];
    return [{
      resourceId,
      quantity,
      sellValue: getResourceSellValue(resourceId),
    }];
  });
}

export function loadStashResourceIntoCargo(
  stash: ResourceQuantity,
  cargo: CargoRunState,
  resourceId: ResourceItemId,
): {
  stash: ResourceQuantity;
  cargo: CargoRunState;
} | null {
  if (getStashCount(stash, resourceId) <= 0) return null;
  const nextCargo = placeCargoAtFirstOpenSlot(cargo, resourceId as CargoItemId)
    ?? addLootToContainment(cargo, resourceId as CargoItemId, 1);
  if (nextCargo === cargo) return null;

  const nextStash = { ...stash };
  const remaining = getStashCount(stash, resourceId) - 1;
  if (remaining <= 0) {
    delete nextStash[resourceId];
  } else {
    nextStash[resourceId] = remaining;
  }
  return { stash: nextStash, cargo: nextCargo };
}

export function loadStashResourceIntoCargoAtCell(
  stash: ResourceQuantity,
  cargo: CargoRunState,
  resourceId: ResourceItemId,
  row: number,
  col: number,
): {
  stash: ResourceQuantity;
  cargo: CargoRunState;
} | null {
  if (getStashCount(stash, resourceId) <= 0) return null;
  const nextCargo = placeCatalogItemAtCell(cargo, resourceId as CargoItemId, row, col)
    ?? addLootToContainment(cargo, resourceId as CargoItemId, 1);
  if (nextCargo === cargo) return null;

  const nextStash = { ...stash };
  const remaining = getStashCount(stash, resourceId) - 1;
  if (remaining <= 0) {
    delete nextStash[resourceId];
  } else {
    nextStash[resourceId] = remaining;
  }
  return { stash: nextStash, cargo: nextCargo };
}

export function loadHubConsumableIntoCargoAtCell(
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>,
  cargo: CargoRunState,
  itemId: CargoItemId,
  row: number,
  col: number,
): {
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>;
  cargo: CargoRunState;
} | null {
  const available = hubCraftedConsumables[itemId] ?? 0;
  if (available <= 0) return null;
  const nextCargo = placeCatalogItemAtCell(cargo, itemId, row, col)
    ?? addLootToContainment(cargo, itemId, 1);
  if (nextCargo === cargo) return null;

  const nextConsumables = { ...hubCraftedConsumables };
  const remaining = available - 1;
  if (remaining <= 0) {
    delete nextConsumables[itemId];
  } else {
    nextConsumables[itemId] = remaining;
  }
  return { hubCraftedConsumables: nextConsumables, cargo: nextCargo };
}

export function returnCargoResourceToStash(
  stash: ResourceQuantity,
  cargo: CargoRunState,
  instanceId: string,
): {
  stash: ResourceQuantity;
  cargo: CargoRunState;
  resourceId?: ResourceItemId;
} | null {
  const placed = cargo.grid.placed.find((item) => item.instanceId === instanceId);
  if (!placed || !isResourceItemId(placed.itemId)) return null;
  const resourceId = placed.itemId;
  const nextStash = { ...stash };
  nextStash[resourceId] = (nextStash[resourceId] ?? 0) + 1;
  return {
    stash: nextStash,
    cargo: removePlacedCargoItem(cargo, instanceId),
    resourceId,
  };
}

/** Return any hub-stashable cargo item (resource or consumable) from grid or containment to home stash. */
export function returnCargoItemToHubStash(
  resourceStash: ResourceQuantity,
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>,
  cargo: CargoRunState,
  instanceId: string,
): {
  resourceStash: ResourceQuantity;
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>;
  cargo: CargoRunState;
  itemId: CargoItemId;
} | null {
  const placed = cargo.grid.placed.find((item) => item.instanceId === instanceId);
  const contained = cargo.containment.find((item) => item.instanceId === instanceId);
  const item = placed ?? contained;
  if (!item) return null;

  let nextResourceStash = resourceStash;
  const nextConsumables = { ...hubCraftedConsumables };

  if (isResourceItemId(item.itemId)) {
    nextResourceStash = { ...resourceStash };
    nextResourceStash[item.itemId] = (nextResourceStash[item.itemId] ?? 0) + 1;
  } else {
    nextConsumables[item.itemId] = (nextConsumables[item.itemId] ?? 0) + 1;
  }

  const nextCargo = placed
    ? removePlacedCargoItem(cargo, instanceId)
    : {
        ...cargo,
        containment: cargo.containment.filter((entry) => entry.instanceId !== instanceId),
      };

  return {
    resourceStash: nextResourceStash,
    hubCraftedConsumables: nextConsumables,
    cargo: nextCargo,
    itemId: item.itemId,
  };
}

export function equipTacticalFromHub(
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>,
  tacticalLoadout: TacticalLoadoutSlots,
  slotIndex: 0 | 1 | 2,
  itemId: CargoItemId,
): {
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>;
  tacticalLoadout: TacticalLoadoutSlots;
} | null {
  const available = hubCraftedConsumables[itemId] ?? 0;
  if (available <= 0) return null;
  const nextLoadout: TacticalLoadoutSlots = [...tacticalLoadout];
  const previous = nextLoadout[slotIndex];
  const nextConsumables = { ...hubCraftedConsumables };
  nextConsumables[itemId] = available - 1;
  if (nextConsumables[itemId] <= 0) delete nextConsumables[itemId];
  if (previous) {
    nextConsumables[previous] = (nextConsumables[previous] ?? 0) + 1;
  }
  nextLoadout[slotIndex] = itemId;
  return { hubCraftedConsumables: nextConsumables, tacticalLoadout: nextLoadout };
}

export function clearTacticalSlotState(
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>,
  tacticalLoadout: TacticalLoadoutSlots,
  slotIndex: 0 | 1 | 2,
): {
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>;
  tacticalLoadout: TacticalLoadoutSlots;
} {
  const nextLoadout: TacticalLoadoutSlots = [...tacticalLoadout];
  const itemId = nextLoadout[slotIndex];
  if (!itemId) {
    return { hubCraftedConsumables, tacticalLoadout: nextLoadout };
  }
  nextLoadout[slotIndex] = null;
  const nextConsumables = { ...hubCraftedConsumables };
  nextConsumables[itemId] = (nextConsumables[itemId] ?? 0) + 1;
  return { hubCraftedConsumables: nextConsumables, tacticalLoadout: nextLoadout };
}

export function finalizeDescentLoadout(
  preRunCargo: CargoRunState,
  tacticalLoadout: TacticalLoadoutSlots,
): CargoRunState {
  let cargo = preRunCargo.grid.placed.length > 0 || preRunCargo.containment.length > 0
    ? { ...preRunCargo, grid: { placed: [...preRunCargo.grid.placed] }, containment: [...preRunCargo.containment] }
    : createDefaultCargoRunState();
  tacticalLoadout.forEach((itemId) => {
    if (itemId) {
      cargo = addLootToContainment(cargo, itemId, 1);
    }
  });
  return applyIncursionStarterCargo(cargo);
}

export function isHubCraftableConsumable(itemId: CargoItemId): boolean {
  return itemId in CARGO_ITEM_CATALOG
    && (CARGO_ITEM_CATALOG[itemId].tags.includes('CONSUMABLE')
      || CARGO_ITEM_CATALOG[itemId].usableOnScanner === true);
}

export function listHubStagedConsumables(
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>,
): Array<{ itemId: CargoItemId; quantity: number; name: string }> {
  return Object.entries(hubCraftedConsumables).flatMap(([id, quantity]) => {
    if (!quantity || quantity <= 0) return [];
    const itemId = id as CargoItemId;
    return [{
      itemId,
      quantity,
      name: CARGO_ITEM_CATALOG[itemId]?.name ?? id,
    }];
  });
}
