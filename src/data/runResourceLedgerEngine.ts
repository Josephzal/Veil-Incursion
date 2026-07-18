import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type {
  RunPhysicalBankSnapshot,
  RunResourceLedger,
} from '../types/runResourceLedger';
import {
  createEmptyRunPhysicalBankSnapshot,
  createEmptyRunResourceLedger,
} from '../types/runResourceLedger';
import { addLootToContainment, removePlacedCargoItem } from './cargoGridEngine';
import { isResourceItemId } from './resourceRegistry';
import { addToResourceStash } from './resourceStashEngine';

export function mergeResourceQuantities(
  base: ResourceQuantity,
  delta: ResourceQuantity,
): ResourceQuantity {
  const next = { ...base };
  Object.entries(delta).forEach(([id, quantity]) => {
    if (!quantity || quantity <= 0) return;
    const resourceId = id as ResourceItemId;
    next[resourceId] = (next[resourceId] ?? 0) + quantity;
  });
  return next;
}

export function countAllCargoItems(cargo: CargoRunState): Map<CargoItemId, number> {
  const counts = new Map<CargoItemId, number>();
  [...cargo.grid.placed, ...cargo.containment].forEach((item) => {
    const qty = Math.max(1, item.quantity ?? 1);
    counts.set(item.itemId, (counts.get(item.itemId) ?? 0) + qty);
  });
  return counts;
}

export function countResourcesInCargo(cargo: CargoRunState): ResourceQuantity {
  const resources: ResourceQuantity = {};
  countAllCargoItems(cargo).forEach((quantity, itemId) => {
    if (!isResourceItemId(itemId) || quantity <= 0) return;
    resources[itemId] = quantity;
  });
  return resources;
}

export function countConsumablesInCargo(
  cargo: CargoRunState,
): Partial<Record<CargoItemId, number>> {
  const consumables: Partial<Record<CargoItemId, number>> = {};
  countAllCargoItems(cargo).forEach((quantity, itemId) => {
    if (isResourceItemId(itemId) || quantity <= 0) return;
    consumables[itemId] = quantity;
  });
  return consumables;
}

export function recordResourcesCollected(
  ledger: RunResourceLedger,
  resources: ResourceQuantity,
): RunResourceLedger {
  if (Object.keys(resources).length === 0) return ledger;
  return {
    ...ledger,
    collected: mergeResourceQuantities(ledger.collected, resources),
  };
}

export function recordResourcesCollectedFromCargo(
  ledger: RunResourceLedger,
  cargo: CargoRunState,
): RunResourceLedger {
  return recordResourcesCollected(ledger, countResourcesInCargo(cargo));
}

export function recordResourcesCollectedById(
  ledger: RunResourceLedger,
  resourceId: ResourceItemId,
  quantity: number,
): RunResourceLedger {
  if (quantity <= 0) return ledger;
  return recordResourcesCollected(ledger, { [resourceId]: quantity });
}

export function recordResourcesBanked(
  ledger: RunResourceLedger,
  resources: ResourceQuantity,
): RunResourceLedger {
  if (Object.keys(resources).length === 0) return ledger;
  return {
    ...ledger,
    bankedAtSafehouse: mergeResourceQuantities(ledger.bankedAtSafehouse, resources),
  };
}

export function recordSafehouseBankAction(ledger: RunResourceLedger): RunResourceLedger {
  return {
    ...ledger,
    safehouseBankActions: ledger.safehouseBankActions + 1,
  };
}

export function recordResourcesExtracted(
  ledger: RunResourceLedger,
  resources: ResourceQuantity,
): RunResourceLedger {
  if (Object.keys(resources).length === 0) return ledger;
  return {
    ...ledger,
    extracted: mergeResourceQuantities(ledger.extracted, resources),
  };
}

export function recordResourcesLostOnDeath(
  ledger: RunResourceLedger,
  resources: ResourceQuantity,
): RunResourceLedger {
  if (Object.keys(resources).length === 0) return ledger;
  return {
    ...ledger,
    lostOnDeath: mergeResourceQuantities(ledger.lostOnDeath, resources),
  };
}

export function recordResourcesConsumed(
  ledger: RunResourceLedger,
  resources: ResourceQuantity,
): RunResourceLedger {
  if (Object.keys(resources).length === 0) return ledger;
  return {
    ...ledger,
    consumed: mergeResourceQuantities(ledger.consumed, resources),
  };
}

/** Moves every physical item from run cargo into the in-run safehouse bank snapshot. */
export function bankAllPhysicalRunCargo(
  cargo: CargoRunState,
  bank: RunPhysicalBankSnapshot,
): {
  cargo: CargoRunState;
  bank: RunPhysicalBankSnapshot;
  bankedResources: ResourceQuantity;
  bankedConsumables: Partial<Record<CargoItemId, number>>;
} {
  const counts = countAllCargoItems(cargo);
  if (counts.size === 0) {
    return {
      cargo,
      bank,
      bankedResources: {},
      bankedConsumables: {},
    };
  }

  let nextResources = { ...bank.resources };
  const nextConsumables = { ...bank.consumables };
  const bankedResources: ResourceQuantity = {};
  const bankedConsumables: Partial<Record<CargoItemId, number>> = {};

  counts.forEach((quantity, itemId) => {
    if (quantity <= 0) return;
    if (isResourceItemId(itemId)) {
      nextResources = addToResourceStash(nextResources, itemId, quantity);
      bankedResources[itemId] = quantity;
    } else {
      nextConsumables[itemId] = (nextConsumables[itemId] ?? 0) + quantity;
      bankedConsumables[itemId] = quantity;
    }
  });

  return {
    cargo: {
      ...cargo,
      grid: { placed: [] },
      containment: [],
    },
    bank: {
      resources: nextResources,
      consumables: nextConsumables,
    },
    bankedResources,
    bankedConsumables,
  };
}

/** Banks a single cargo instance into the in-run safehouse snapshot. */
export function bankSingleCargoInstance(
  cargo: CargoRunState,
  bank: RunPhysicalBankSnapshot,
  instanceId: string,
): {
  cargo: CargoRunState;
  bank: RunPhysicalBankSnapshot;
  bankedResources: ResourceQuantity;
} | null {
  const placed = cargo.grid.placed.find((item) => item.instanceId === instanceId);
  const contained = cargo.containment.find((item) => item.instanceId === instanceId);
  const item = placed ?? contained;
  if (!item) return null;

  const quantity = Math.max(1, item.quantity ?? 1);

  let nextCargo = cargo;
  if (placed) {
    nextCargo = removePlacedCargoItem(nextCargo, instanceId);
  } else {
    nextCargo = {
      ...nextCargo,
      containment: nextCargo.containment.filter((entry) => entry.instanceId !== instanceId),
    };
  }

  const bankedResources: ResourceQuantity = {};
  let nextResources = { ...bank.resources };
  const nextConsumables = { ...bank.consumables };

  if (isResourceItemId(item.itemId)) {
    nextResources = addToResourceStash(nextResources, item.itemId, quantity);
    bankedResources[item.itemId] = quantity;
  } else {
    nextConsumables[item.itemId] = (nextConsumables[item.itemId] ?? 0) + quantity;
  }

  return {
    cargo: nextCargo,
    bank: {
      resources: nextResources,
      consumables: nextConsumables,
    },
    bankedResources,
  };
}

/** Rehydrates banked physical items back into run cargo (for extraction deposit). */
export function mergeBankSnapshotIntoCargo(
  bank: RunPhysicalBankSnapshot,
  cargo: CargoRunState,
): CargoRunState {
  let merged = cargo;

  (Object.entries(bank.resources) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      const count = quantity ?? 0;
      for (let i = 0; i < count; i += 1) {
        merged = addLootToContainment(merged, resourceId, 1);
      }
    },
  );

  (Object.entries(bank.consumables) as Array<[CargoItemId, number | undefined]>).forEach(
    ([itemId, quantity]) => {
      const count = quantity ?? 0;
      for (let i = 0; i < count; i += 1) {
        merged = addLootToContainment(merged, itemId, 1);
      }
    },
  );

  return merged;
}

export function summarizeBankSnapshot(bank: RunPhysicalBankSnapshot): {
  resourceCount: number;
  consumableCount: number;
} {
  const resourceCount = Object.values(bank.resources).reduce((sum, qty) => sum + (qty ?? 0), 0);
  const consumableCount = Object.values(bank.consumables).reduce((sum, qty) => sum + (qty ?? 0), 0);
  return { resourceCount, consumableCount };
}

export function resolveRunDeathResourceState(
  cargo: CargoRunState,
  bank: RunPhysicalBankSnapshot,
  ledger: RunResourceLedger,
): {
  ledger: RunResourceLedger;
  lostResources: ResourceQuantity;
  bankedResources: ResourceQuantity;
} {
  const lostResources = countResourcesInCargo(cargo);
  return {
    lostResources,
    bankedResources: { ...bank.resources },
    ledger: recordResourcesLostOnDeath(ledger, lostResources),
  };
}

export function resolveRunExtractionResourceState(
  cargo: CargoRunState,
  bank: RunPhysicalBankSnapshot,
  ledger: RunResourceLedger,
): {
  mergedCargo: CargoRunState;
  ledger: RunResourceLedger;
  extractedResources: ResourceQuantity;
} {
  const mergedCargo = mergeBankSnapshotIntoCargo(bank, cargo);
  const extractedResources = countResourcesInCargo(mergedCargo);
  return {
    mergedCargo,
    extractedResources,
    ledger: recordResourcesExtracted(ledger, extractedResources),
  };
}

export function recordNewResourcesFromCargoDelta(
  ledger: RunResourceLedger,
  before: CargoRunState,
  after: CargoRunState,
): RunResourceLedger {
  const beforeCounts = countResourcesInCargo(before);
  const afterCounts = countResourcesInCargo(after);
  const delta: ResourceQuantity = {};

  const allIds = new Set([
    ...Object.keys(beforeCounts),
    ...Object.keys(afterCounts),
  ]) as Set<ResourceItemId>;

  allIds.forEach((resourceId) => {
    const diff = (afterCounts[resourceId] ?? 0) - (beforeCounts[resourceId] ?? 0);
    if (diff > 0) delta[resourceId] = diff;
  });

  return recordResourcesCollected(ledger, delta);
}

export {
  createEmptyRunPhysicalBankSnapshot,
  createEmptyRunResourceLedger,
};
