import type { ResourceBundle, ResourceCacheId } from '../types/resourceItem';

export const RESOURCE_CACHE_BUNDLES: Record<ResourceCacheId, ResourceBundle> = {
  smuggling_drop_stealth: {
    items: [
      { id: 'ley-slag', quantity: 3 },
      { id: 'smugglers-ledger', quantity: 1 },
    ],
  },
};

export function getResourceCacheBundle(cacheId: ResourceCacheId): ResourceBundle {
  return RESOURCE_CACHE_BUNDLES[cacheId];
}
