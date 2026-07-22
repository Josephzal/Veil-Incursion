import { RESOURCE_REGISTRY } from '../../../data/resourceRegistry';
import { getValueLaneFenceMultiplier } from '../../../data/economyValueLaneEngine';
import { BLACK_MARKET_CARGO_LISTINGS } from '../../../data/blackMarket';
import { hubContrabandPrice, listFenceableStashEntries } from '../../../data/hubSafehouseEngine';
import { isAppraisableSealedResource, listSealedStashEntries } from '../../../data/sealedCargoEngine';
import type { CargoItemId } from '../../../types/cargoGrid';
import type { ResourceItemId } from '../../../types/resourceItem';
import type { PlayerAccount } from '../../../types/game';

/** Source-aware Vendor selection — offer and holding identities never collide. */
export type VendorSelection =
  | { source: 'offer'; listingId: CargoItemId }
  | { source: 'holding'; kind: 'RESOURCE'; resourceId: ResourceItemId }
  | { source: 'holding'; kind: 'SEALED'; stackId: string }
  | null;

/** Player-readable exchange condition — preserves underlying lane multipliers. */
export function formatVendorExchangeCondition(resourceId: ResourceItemId): {
  categoryLabel: string;
  rateLabel: string;
} {
  const category = RESOURCE_REGISTRY[resourceId].category;
  const mult = getValueLaneFenceMultiplier(category);

  let categoryLabel = 'RESOURCE';
  switch (category) {
    case 'STABLE':
      categoryLabel = 'CRAFTING MATERIAL';
      break;
    case 'INTEL':
      categoryLabel = 'INTEL ASSET';
      break;
    case 'UNSTABLE':
      categoryLabel = 'UNSTABLE CARGO';
      break;
    case 'CONTRABAND':
      categoryLabel = 'CONTRABAND';
      break;
    default:
      categoryLabel = String(category).replace(/_/g, ' ');
      break;
  }

  return {
    categoryLabel,
    rateLabel: `MARKET RATE: ${Math.round(mult * 100)}%`,
  };
}

/** Stable initial Vendor selection — first purchasable offer, else first offer, else first holding. */
export function resolveInitialVendorSelection(
  account: PlayerAccount,
  marketDiscount: number,
): VendorSelection {
  const firstAffordable = BLACK_MARKET_CARGO_LISTINGS.find(
    (listing) => account.cabalCredits >= hubContrabandPrice(listing.price, marketDiscount),
  );
  if (firstAffordable) {
    return { source: 'offer', listingId: firstAffordable.id };
  }
  if (BLACK_MARKET_CARGO_LISTINGS[0]) {
    return { source: 'offer', listingId: BLACK_MARKET_CARGO_LISTINGS[0].id };
  }

  const fenceEntries = listFenceableStashEntries(account.resourceStash)
    .filter((entry) => !isAppraisableSealedResource(entry.resourceId));
  if (fenceEntries[0]) {
    return { source: 'holding', kind: 'RESOURCE', resourceId: fenceEntries[0].resourceId };
  }

  const sealedEntries = listSealedStashEntries(
    account.resourceStash,
    account.sealedCargoStacks ?? [],
  );
  if (sealedEntries[0]) {
    return { source: 'holding', kind: 'SEALED', stackId: sealedEntries[0].stackId };
  }

  return null;
}

/** Next selection after a holding is removed from the liquidation feed. */
export function resolveVendorSelectionAfterHoldingRemoved(
  account: PlayerAccount,
  marketDiscount: number,
  removed: VendorSelection,
): VendorSelection {
  const fenceEntries = listFenceableStashEntries(account.resourceStash)
    .filter((entry) => !isAppraisableSealedResource(entry.resourceId));
  const sealedEntries = listSealedStashEntries(
    account.resourceStash,
    account.sealedCargoStacks ?? [],
  );

  if (removed?.source === 'holding' && removed.kind === 'RESOURCE') {
    const nextResource = fenceEntries[0];
    if (nextResource) {
      return { source: 'holding', kind: 'RESOURCE', resourceId: nextResource.resourceId };
    }
    const nextSealed = sealedEntries[0];
    if (nextSealed) {
      return { source: 'holding', kind: 'SEALED', stackId: nextSealed.stackId };
    }
  }

  if (removed?.source === 'holding' && removed.kind === 'SEALED') {
    const stillPresent = sealedEntries.some((entry) => entry.stackId === removed.stackId);
    if (stillPresent) return removed;
    const nextSealed = sealedEntries[0];
    if (nextSealed) {
      return { source: 'holding', kind: 'SEALED', stackId: nextSealed.stackId };
    }
    const nextResource = fenceEntries[0];
    if (nextResource) {
      return { source: 'holding', kind: 'RESOURCE', resourceId: nextResource.resourceId };
    }
  }

  return resolveInitialVendorSelection(account, marketDiscount);
}
