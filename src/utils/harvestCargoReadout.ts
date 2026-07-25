import { CARGO_ITEM_CATALOG, type PlacedCargoItem } from '../types/cargoGrid';
import { cargoItemQuantity, getCargoStackCap, unitCargoValue } from '../data/cargoStackEngine';
import { getResourceDefinition, isResourceItemId } from '../data/resourceRegistry';
import { UNSTABLE_CARRIED_EFFECTS } from '../data/unstableCargoEffectsEngine';
import { isUnstableCargoEffectId } from '../types/unstableCargoEffects';

export interface HarvestCargoReadoutRow {
  label: string;
  value: string;
}

export interface HarvestCargoReadoutModel {
  title: string;
  rows: HarvestCargoReadoutRow[];
}

/** Build rail readout rows for a selected stored cargo item. */
export function resolveHarvestCargoReadout(item: PlacedCargoItem): HarvestCargoReadoutModel {
  const def = CARGO_ITEM_CATALOG[item.itemId];
  const qty = cargoItemQuantity(item);
  const stackCap = getCargoStackCap(item.itemId);
  const unit = unitCargoValue(item);
  const rows: HarvestCargoReadoutRow[] = [];

  let title = def.name.toUpperCase();
  let cargoClass = def.tags.find((tag) => tag !== 'RESOURCE' && tag !== 'LOOT') ?? def.tags[0] ?? 'SALVAGE';
  let carried: string | null = null;
  let contractRelevance: string | null = null;

  if (isResourceItemId(item.itemId)) {
    const resource = getResourceDefinition(item.itemId);
    title = resource.name.toUpperCase();
    cargoClass = resource.category.replace(/_/g, ' ');
    if (resource.hasCarriedEffect && resource.carriedEffectId && isUnstableCargoEffectId(resource.carriedEffectId)) {
      const effect = UNSTABLE_CARRIED_EFFECTS[resource.carriedEffectId];
      carried = effect.displayLines[0]?.text ?? effect.warningText;
    }
    if (resource.usageTags.includes('CONTRACT_TARGET')) {
      contractRelevance = 'Contract-relevant material';
    } else if (resource.usageTags.includes('OPERATION_TARGET')) {
      contractRelevance = 'Operation target cargo';
    } else if (resource.sourceHint?.trim()) {
      contractRelevance = resource.sourceHint.trim();
    }
  }

  rows.push({ label: 'CLASS', value: cargoClass });
  rows.push({ label: 'FOOTPRINT', value: `${def.width}×${def.height}` });
  rows.push({
    label: 'STACK',
    value: stackCap > 1 ? `${qty} / ${stackCap}` : qty > 1 ? `×${qty}` : '1',
  });
  rows.push({
    label: 'VALUE',
    value: qty > 1 ? `${unit * qty} CR (${unit} ea)` : `${unit} CR`,
  });
  if (carried) {
    rows.push({ label: 'CARRIED', value: carried });
  }
  if (contractRelevance) {
    rows.push({ label: 'CONTRACT', value: contractRelevance });
  }

  return { title, rows };
}
