import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import type { AegisLoadout } from '../types/aegisCombat';
import type { PlayerAccount } from '../types/game';
import { isResourceItemId } from './resourceRegistry';
import { addToResourceStash } from './resourceStashEngine';

export interface RunExtractionDeposit {
  resourceStash: PlayerAccount['resourceStash'];
  hubCraftedConsumables: PlayerAccount['hubCraftedConsumables'];
  aegisLoadout: AegisLoadout;
}

/** Deposits every item from run cargo into persistent hub stash fields. */
export function depositAllCargoToHubAccount(
  cargo: CargoRunState,
  account: Pick<PlayerAccount, 'resourceStash' | 'hubCraftedConsumables' | 'aegisLoadout'>,
  aegisLoadout: AegisLoadout,
): RunExtractionDeposit {
  let resourceStash = account.resourceStash;
  const hubCraftedConsumables = { ...account.hubCraftedConsumables };
  const itemCounts = new Map<CargoItemId, number>();

  [...cargo.grid.placed, ...cargo.containment].forEach((item) => {
    itemCounts.set(item.itemId, (itemCounts.get(item.itemId) ?? 0) + 1);
  });

  itemCounts.forEach((quantity, itemId) => {
    if (quantity <= 0) return;
    if (isResourceItemId(itemId)) {
      resourceStash = addToResourceStash(resourceStash, itemId, quantity);
    } else {
      hubCraftedConsumables[itemId] = (hubCraftedConsumables[itemId] ?? 0) + quantity;
    }
  });

  return {
    resourceStash,
    hubCraftedConsumables,
    aegisLoadout: [...aegisLoadout] as AegisLoadout,
  };
}
