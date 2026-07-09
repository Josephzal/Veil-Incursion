import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';

export const POST_RUN_ROUTING_TEST_LEDGER: ResourceQuantity = {
  'ley-slag': 8,
  'echo-glass-shard': 12,
  'smugglers-ledger': 1,
  'tarnished-dog-tags': 3,
  'sealed-containment-casket': 1,
  'encrypted-grid-drive': 1,
  'sanguine-ampoule': 2,
};

export function mergeTestResourcesIntoLedger(
  ledger: RunResourceLedger,
  resources: ResourceQuantity = POST_RUN_ROUTING_TEST_LEDGER,
): RunResourceLedger {
  const nextExtracted = { ...ledger.extracted };
  const nextCollected = { ...ledger.collected };
  (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      nextExtracted[resourceId] = (nextExtracted[resourceId] ?? 0) + quantity;
      nextCollected[resourceId] = (nextCollected[resourceId] ?? 0) + quantity;
    },
  );
  return { ...ledger, extracted: nextExtracted, collected: nextCollected };
}
