import { CARGO_ITEM_CATALOG, type CargoItemId } from '../types/cargoGrid';
import { getCargoStackCap, isCargoStackable } from '../data/cargoStackEngine';
import { getResourceDefinition, isResourceItemId } from '../data/resourceRegistry';

export interface CargoItemInspectInfo {
  itemId: CargoItemId;
  name: string;
  shortName: string;
  description: string;
  rarityLabel: string | null;
  categoryLabel: string | null;
  sourceHint: string | null;
  unitValue: number;
  quantity: number;
  stackCap: number;
  stackable: boolean;
  tags: readonly string[];
}

/** Build extraction-style inspect copy for a cargo / containment item. */
export function resolveCargoItemInspectInfo(
  itemId: CargoItemId,
  quantity = 1,
  unitValue?: number,
): CargoItemInspectInfo {
  const catalog = CARGO_ITEM_CATALOG[itemId];
  const qty = Math.max(1, quantity);
  const stackCap = getCargoStackCap(itemId);
  const stackable = isCargoStackable(itemId);

  if (isResourceItemId(itemId)) {
    const resource = getResourceDefinition(itemId);
    return {
      itemId,
      name: resource.name,
      shortName: resource.shortName,
      description: resource.description,
      rarityLabel: resource.rarity.replace(/_/g, ' '),
      categoryLabel: resource.category.replace(/_/g, ' '),
      sourceHint: resource.sourceHint || null,
      unitValue: Math.max(1, unitValue ?? resource.baseCapitalValue),
      quantity: qty,
      stackCap,
      stackable,
      tags: catalog?.tags ?? [],
    };
  }

  return {
    itemId,
    name: catalog.name,
    shortName: catalog.name,
    description: catalog.tags.length > 0
      ? `${catalog.tags.join(' · ')}.`
      : 'Salvage item.',
    rarityLabel: null,
    categoryLabel: catalog.tags[0] ?? null,
    sourceHint: null,
    unitValue: Math.max(1, unitValue ?? catalog.baseValue),
    quantity: qty,
    stackCap,
    stackable,
    tags: catalog.tags,
  };
}
