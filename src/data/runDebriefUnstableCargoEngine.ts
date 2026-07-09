import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';
import type { UnstableCargoEffectId } from '../types/unstableCargoEffects';
import { getResourceCategory, getResourceDisplayName } from './resourceRegistry';
import { UNSTABLE_CARRIED_EFFECTS } from './unstableCargoEffectsEngine';

export interface UnstableCargoDebriefLine {
  resourceId: ResourceItemId;
  quantity: number;
  label: string;
}

export interface UnstableCargoDebriefResolution {
  extracted: UnstableCargoDebriefLine[];
  banked: UnstableCargoDebriefLine[];
  lost: UnstableCargoDebriefLine[];
}

export interface UnstableCargoDebriefSummary {
  resolution: UnstableCargoDebriefResolution;
  carriedEffectsSeen: string[];
  hadCarriedPressure: boolean;
}

function filterUnstableResources(resources: ResourceQuantity): ResourceQuantity {
  const filtered: ResourceQuantity = {};
  (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if ((quantity ?? 0) <= 0) return;
      if (getResourceCategory(resourceId) !== 'UNSTABLE') return;
      filtered[resourceId] = quantity ?? 0;
    },
  );
  return filtered;
}

function linesFromUnstableQuantity(resources: ResourceQuantity): UnstableCargoDebriefLine[] {
  return (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([resourceId, quantity]) => ({
      resourceId,
      quantity: quantity ?? 0,
      label: getResourceDisplayName(resourceId, true),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildUnstableCargoDebriefSummary(
  ledger: RunResourceLedger,
  effectsSeen: readonly UnstableCargoEffectId[],
): UnstableCargoDebriefSummary | null {
  const extracted = linesFromUnstableQuantity(filterUnstableResources(ledger.extracted));
  const banked = linesFromUnstableQuantity(filterUnstableResources(ledger.bankedAtSafehouse));
  const lost = linesFromUnstableQuantity(filterUnstableResources(ledger.lostOnDeath));
  const carriedEffectsSeen = effectsSeen.map((id) => UNSTABLE_CARRIED_EFFECTS[id].itemName);
  const hadCarriedPressure = carriedEffectsSeen.length > 0;
  const hasResolution = extracted.length + banked.length + lost.length > 0;

  if (!hadCarriedPressure && !hasResolution) return null;

  return {
    resolution: { extracted, banked, lost },
    carriedEffectsSeen,
    hadCarriedPressure,
  };
}

export function formatUnstableCargoDebriefLine(line: UnstableCargoDebriefLine): string {
  return `${line.quantity}× ${line.label.toUpperCase()}`;
}
