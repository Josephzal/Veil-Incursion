import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import type { AegisLoadout } from '../types/aegisCombat';
import type { PlayerAccount } from '../types/game';
import type { EnvoyLoadout, HexShotLoadout } from '../types/operativeClass';
import { isResourceItemId } from './resourceRegistry';
import { addToResourceStash } from './resourceStashEngine';

export interface RunExtractionLoadouts {
  aegisLoadout: AegisLoadout;
  hexShotLoadout: HexShotLoadout;
  envoyLoadout: EnvoyLoadout;
}

export interface RunExtractionDeposit {
  resourceStash: PlayerAccount['resourceStash'];
  hubCraftedConsumables: PlayerAccount['hubCraftedConsumables'];
  aegisLoadout: AegisLoadout;
  hexShotLoadout: HexShotLoadout;
  envoyLoadout: EnvoyLoadout;
}

/** Deposits every item from run cargo into persistent hub stash fields. */
export function depositAllCargoToHubAccount(
  cargo: CargoRunState,
  account: Pick<
    PlayerAccount,
    'resourceStash' | 'hubCraftedConsumables' | 'aegisLoadout' | 'hexShotLoadout' | 'envoyLoadout'
  >,
  loadouts: RunExtractionLoadouts,
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
    aegisLoadout: [...loadouts.aegisLoadout] as AegisLoadout,
    hexShotLoadout: [...loadouts.hexShotLoadout] as HexShotLoadout,
    envoyLoadout: [...loadouts.envoyLoadout] as EnvoyLoadout,
  };
}
