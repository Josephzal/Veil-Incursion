import type { ResourceQuantity } from '../../types/resourceItem';

export function sumLedgerCategoryTotals(
  bucket: Partial<Record<string, number>> | null | undefined,
): number {
  if (!bucket) return 0;
  return Object.values(bucket).reduce<number>((sum, qty) => sum + (qty ?? 0), 0);
}

export function sumResourceStash(stash: ResourceQuantity): number {
  return Object.values(stash).reduce<number>((sum, qty) => sum + (qty ?? 0), 0);
}
