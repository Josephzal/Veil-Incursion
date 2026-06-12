import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { CraftingRecipe } from './craftingRegistry';
import { isResourceItemId } from './resourceRegistry';

export function createEmptyResourceStash(): ResourceQuantity {
  return {};
}

export function getStashCount(stash: ResourceQuantity, resourceId: ResourceItemId): number {
  return stash[resourceId] ?? 0;
}

export function addToResourceStash(
  stash: ResourceQuantity,
  resourceId: ResourceItemId,
  quantity: number,
): ResourceQuantity {
  if (quantity <= 0) return stash;
  return {
    ...stash,
    [resourceId]: getStashCount(stash, resourceId) + quantity,
  };
}

export function canAffordRecipe(stash: ResourceQuantity, recipe: CraftingRecipe): boolean {
  return recipe.requirements.every(
    (req) => getStashCount(stash, req.resourceId) >= req.quantity,
  );
}

export function deductRecipeFromStash(
  stash: ResourceQuantity,
  recipe: CraftingRecipe,
): ResourceQuantity | null {
  if (!canAffordRecipe(stash, recipe)) return null;
  const next = { ...stash };
  recipe.requirements.forEach((req) => {
    const remaining = getStashCount(next, req.resourceId) - req.quantity;
    if (remaining <= 0) {
      delete next[req.resourceId];
    } else {
      next[req.resourceId] = remaining;
    }
  });
  return next;
}

export function extractResourcesFromCargo(
  cargo: CargoRunState,
  stash: ResourceQuantity,
): { stash: ResourceQuantity; cargo: CargoRunState } {
  let nextStash = stash;
  const resourceIds = new Set<ResourceItemId>();

  cargo.grid.placed.forEach((item) => {
    if (isResourceItemId(item.itemId)) resourceIds.add(item.itemId);
  });
  cargo.containment.forEach((item) => {
    if (isResourceItemId(item.itemId)) resourceIds.add(item.itemId);
  });

  resourceIds.forEach((resourceId) => {
    const total =
      cargo.grid.placed.filter((item) => item.itemId === resourceId).length
      + cargo.containment.filter((item) => item.itemId === resourceId).length;
    if (total > 0) {
      nextStash = addToResourceStash(nextStash, resourceId, total);
    }
  });

  return {
    stash: nextStash,
    cargo: {
      ...cargo,
      grid: {
        placed: cargo.grid.placed.filter((item) => !isResourceItemId(item.itemId)),
      },
      containment: cargo.containment.filter(
        (item) => !isResourceItemId(item.itemId as CargoItemId),
      ),
    },
  };
}
