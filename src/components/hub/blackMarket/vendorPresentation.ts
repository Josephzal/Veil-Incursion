import { RESOURCE_REGISTRY } from '../../../data/resourceRegistry';
import { getValueLaneFenceMultiplier } from '../../../data/economyValueLaneEngine';
import type { ResourceItemId } from '../../../types/resourceItem';

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
