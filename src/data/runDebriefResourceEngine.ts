import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';
import {
  canResourceBeSoldToFence,
  getResourceDisplayName,
  getResourcePrimaryRole,
  getResourceCategory,
} from './resourceRegistry';

export type DebriefResourceGroup =
  | 'STABLE_MATERIALS'
  | 'UNSTABLE_CARGO'
  | 'INTEL_RECOVERED'
  | 'CONTRABAND'
  | 'FENCE_VALUE'
  | 'LOST_IN_THE_VEIL'
  | 'BANKED_AT_SAFEHOUSE';

export interface DebriefResourceLine {
  resourceId: ResourceItemId;
  quantity: number;
  label: string;
}

export interface DebriefResourceSection {
  group: DebriefResourceGroup;
  title: string;
  lines: DebriefResourceLine[];
  totalItems: number;
}

const GROUP_TITLES: Record<DebriefResourceGroup, string> = {
  STABLE_MATERIALS: 'Stable Materials',
  UNSTABLE_CARGO: 'Unstable Cargo',
  INTEL_RECOVERED: 'Intel Recovered',
  CONTRABAND: 'Contraband',
  FENCE_VALUE: 'Fence-Value Items',
  LOST_IN_THE_VEIL: 'Lost in the Veil',
  BANKED_AT_SAFEHOUSE: 'Banked at Safehouse',
};

function resolveDebriefGroup(resourceId: ResourceItemId): DebriefResourceGroup {
  const role = getResourcePrimaryRole(resourceId);
  if (role === 'FENCE_VALUE' || role === 'ECONOMY_INTEL') {
    return 'FENCE_VALUE';
  }
  if (canResourceBeSoldToFence(resourceId) && role !== 'SCANNER_INTEL') {
    return 'FENCE_VALUE';
  }

  switch (getResourceCategory(resourceId)) {
    case 'STABLE':
      return 'STABLE_MATERIALS';
    case 'UNSTABLE':
      return 'UNSTABLE_CARGO';
    case 'INTEL':
      return 'INTEL_RECOVERED';
    case 'CONTRABAND':
      return 'CONTRABAND';
    default:
      return 'STABLE_MATERIALS';
  }
}

function linesFromQuantity(resources: ResourceQuantity): DebriefResourceLine[] {
  return (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([resourceId, quantity]) => ({
      resourceId,
      quantity: quantity ?? 0,
      label: getResourceDisplayName(resourceId, true),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildSections(
  resourcesByGroup: Partial<Record<DebriefResourceGroup, ResourceQuantity>>,
): DebriefResourceSection[] {
  const order: DebriefResourceGroup[] = [
    'STABLE_MATERIALS',
    'UNSTABLE_CARGO',
    'INTEL_RECOVERED',
    'CONTRABAND',
    'FENCE_VALUE',
    'BANKED_AT_SAFEHOUSE',
    'LOST_IN_THE_VEIL',
  ];

  return order
    .map((group) => {
      const resources = resourcesByGroup[group];
      if (!resources || Object.keys(resources).length === 0) return null;
      const lines = linesFromQuantity(resources);
      if (lines.length === 0) return null;
      const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
      return {
        group,
        title: GROUP_TITLES[group],
        lines,
        totalItems,
      };
    })
    .filter((section): section is DebriefResourceSection => section != null);
}

function bucketResources(resources: ResourceQuantity): Partial<Record<DebriefResourceGroup, ResourceQuantity>> {
  const buckets: Partial<Record<DebriefResourceGroup, ResourceQuantity>> = {};
  linesFromQuantity(resources).forEach(({ resourceId, quantity }) => {
    const group = resolveDebriefGroup(resourceId);
    buckets[group] = { ...(buckets[group] ?? {}), [resourceId]: quantity };
  });
  return buckets;
}

export function buildExtractedResourceSections(ledger: RunResourceLedger): DebriefResourceSection[] {
  return buildSections(bucketResources(ledger.extracted));
}

export function buildDeathResourceSections(ledger: RunResourceLedger): DebriefResourceSection[] {
  const buckets: Partial<Record<DebriefResourceGroup, ResourceQuantity>> = {};
  if (Object.keys(ledger.bankedAtSafehouse).length > 0) {
    buckets.BANKED_AT_SAFEHOUSE = { ...ledger.bankedAtSafehouse };
  }
  if (Object.keys(ledger.lostOnDeath).length > 0) {
    buckets.LOST_IN_THE_VEIL = { ...ledger.lostOnDeath };
  }
  return buildSections(buckets);
}

export function formatDebriefResourceLine(line: DebriefResourceLine): string {
  return `${line.quantity}× ${line.label.toUpperCase()}`;
}
