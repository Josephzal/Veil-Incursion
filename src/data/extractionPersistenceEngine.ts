import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import type { AegisLoadout } from '../types/aegisCombat';
import type { PlayerAccount } from '../types/game';
import type { EnvoyLoadout, HexShotLoadout } from '../types/operativeClass';
import { countVeilResidueInCargo, stripVeilResidueFromCargo } from './cargoGridEngine';
import { isResourceItemId } from './resourceRegistry';
import type { ResourceItemId } from '../types/resourceItem';
import type { RunPhysicalBankSnapshot } from '../types/runResourceLedger';
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

/** Session canister + unpacked bulk residue in cargo — all vault to safehouse balance on extract. */
export function resolveExtractionVeilResidueDeposit(
  cargo: CargoRunState,
  sessionCollected: number,
): { totalDeposit: number; cargoForStash: CargoRunState } {
  const cargoResidue = countVeilResidueInCargo(cargo);
  const totalDeposit = Math.max(0, Math.floor(sessionCollected)) + cargoResidue;
  return {
    totalDeposit,
    cargoForStash: stripVeilResidueFromCargo(cargo),
  };
}

/** Deposits safehouse-banked physical cargo into persistent hub stash fields. */
export function depositPhysicalBankSnapshot(
  bank: RunPhysicalBankSnapshot,
  account: Pick<PlayerAccount, 'resourceStash' | 'hubCraftedConsumables'>,
): Pick<PlayerAccount, 'resourceStash' | 'hubCraftedConsumables'> {
  let resourceStash = account.resourceStash;
  const hubCraftedConsumables = { ...account.hubCraftedConsumables };

  (Object.entries(bank.resources) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      resourceStash = addToResourceStash(resourceStash, resourceId, quantity);
    },
  );

  (Object.entries(bank.consumables) as Array<[CargoItemId, number | undefined]>).forEach(
    ([itemId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      hubCraftedConsumables[itemId] = (hubCraftedConsumables[itemId] ?? 0) + quantity;
    },
  );

  return { resourceStash, hubCraftedConsumables };
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
