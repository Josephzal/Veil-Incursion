import type { ResourceCategory, ResourceDepthIndex, ResourceItemId } from '../types/resourceItem';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';

/**
 * Phase 2E — depth modifies the resource economy.
 * District depth 1/2/3 = Threshold / Breach / Deep Veil.
 * Reward packets (2F) consume these gates; this file is the policy source of truth.
 */

export type DepthEconomyBand = 'THRESHOLD' | 'BREACH' | 'DEEP_VEIL';

export type DepthCategoryAllow =
  | true
  | false
  | 'HIGH_RISK_ONLY';

export interface DepthEconomyPolicy {
  depth: ResourceDepthIndex;
  band: DepthEconomyBand;
  label: string;
  purpose: string;
  allowStable: boolean;
  allowIntel: DepthCategoryAllow;
  allowUnstable: DepthCategoryAllow;
  allowContraband: DepthCategoryAllow;
  allowApex: DepthCategoryAllow;
  /** Design notes for DevTest / docs. */
  dropSummary: readonly string[];
}

export const DEPTH_ECONOMY_POLICIES: Record<ResourceDepthIndex, DepthEconomyPolicy> = {
  1: {
    depth: 1,
    band: 'THRESHOLD',
    label: 'Threshold',
    purpose: 'Teach the sector. Give stable materials. Keep rewards readable.',
    allowStable: true,
    allowIntel: true,
    allowUnstable: false,
    allowContraband: false,
    allowApex: false,
    dropSummary: [
      'Common + sector stable resources',
      'Low chance of intel',
      'Very low / no unstable (depthRules gate)',
      'No apex / contraband except scripted exceptions',
    ],
  },
  2: {
    depth: 2,
    band: 'BREACH',
    label: 'Breach',
    purpose: 'Introduce dangerous value. Make pushing deeper economically meaningful.',
    allowStable: true,
    allowIntel: true,
    allowUnstable: true,
    allowContraband: 'HIGH_RISK_ONLY',
    allowApex: false,
    dropSummary: [
      'More sector material',
      'Uncommon / rare resources',
      'Intel + unstable',
      'Breach Thread rare; Anchor Marrow on Anchor contexts',
      'Contraband only on marked high-risk',
    ],
  },
  3: {
    depth: 3,
    band: 'DEEP_VEIL',
    label: 'Deep Veil',
    purpose: 'High-value cargo, unstable rewards, appraisable contraband, apex chances.',
    allowStable: true,
    allowIntel: true,
    allowUnstable: true,
    allowContraband: true,
    allowApex: 'HIGH_RISK_ONLY',
    dropSummary: [
      'Rare resources more common',
      'Unstable cargo meaningful',
      'Contraband / appraisable cargo possible',
      'Breach Thread more common; Anchor Marrow from major Anchor contexts',
      'Anomalous Core only in marked high-risk / apex contexts',
    ],
  },
};

export interface DepthEligibilityOptions {
  /** Elite / high-value peek for rare intel at Threshold. */
  isElite?: boolean;
  highRisk?: boolean;
  /** Scripted / tutorial apex or contraband bypass. */
  allowScriptedException?: boolean;
  /** Ignore registry depthRules (debug only). */
  ignoreDepthRules?: boolean;
}

function categoryAllowed(
  allow: DepthCategoryAllow,
  opts: DepthEligibilityOptions | undefined,
): boolean {
  if (allow === true) return true;
  if (allow === false) return Boolean(opts?.allowScriptedException);
  // HIGH_RISK_ONLY
  return Boolean(
    opts?.highRisk
    || opts?.isElite
    || opts?.allowScriptedException,
  );
}

export function getDepthEconomyPolicy(depth: ResourceDepthIndex): DepthEconomyPolicy {
  return DEPTH_ECONOMY_POLICIES[depth];
}

/** True apex salvage (Anomalous Core) — not appraisable contraband with APEX rarity. */
export function isApexEconomyResource(resourceId: ResourceItemId): boolean {
  const def = RESOURCE_REGISTRY[resourceId];
  return resourceId === 'anomalous-core' || def.primaryRole === 'APEX_CARGO';
}

/** Registry depthRules + Phase 2E category policy. */
export function isResourceEligibleAtDepth(
  resourceId: ResourceItemId,
  depth: ResourceDepthIndex,
  opts?: DepthEligibilityOptions,
): boolean {
  const def = RESOURCE_REGISTRY[resourceId];
  const policy = DEPTH_ECONOMY_POLICIES[depth];

  if (!opts?.ignoreDepthRules) {
    const { minDepth, maxDepth } = def.depthRules;
    if (depth < minDepth || depth > maxDepth) return false;
  }

  if (isApexEconomyResource(resourceId)) {
    return categoryAllowed(policy.allowApex, opts);
  }

  switch (def.category as ResourceCategory) {
    case 'STABLE':
      return policy.allowStable;
    case 'INTEL':
      return categoryAllowed(policy.allowIntel, opts);
    case 'UNSTABLE':
      return categoryAllowed(policy.allowUnstable, opts);
    case 'CONTRABAND':
      return categoryAllowed(policy.allowContraband, opts);
    default:
      return false;
  }
}

export function filterResourcesForDepth(
  resourceIds: readonly ResourceItemId[],
  depth: ResourceDepthIndex,
  opts?: DepthEligibilityOptions,
): ResourceItemId[] {
  return resourceIds.filter((id) => isResourceEligibleAtDepth(id, depth, opts));
}

/** Prefer preferredDepths; otherwise uniform within eligible set. */
export function depthPreferenceWeight(
  resourceId: ResourceItemId,
  depth: ResourceDepthIndex,
): number {
  const { preferredDepths } = RESOURCE_REGISTRY[resourceId].depthRules;
  if (preferredDepths.length === 0) return 1;
  return preferredDepths.includes(depth) ? 2.25 : 1;
}

export function pickWeightedForDepth(
  pool: readonly ResourceItemId[],
  depth: ResourceDepthIndex,
  rng: () => number,
): ResourceItemId | null {
  if (pool.length === 0) return null;
  let total = 0;
  const weights = pool.map((id) => {
    const w = depthPreferenceWeight(id, depth);
    total += w;
    return w;
  });
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

/** Economy ids eligible at this depth under default (non-high-risk) policy. */
export function economyPoolAtDepth(
  depth: ResourceDepthIndex,
  opts?: DepthEligibilityOptions,
): ResourceItemId[] {
  return filterResourcesForDepth(ECONOMY_V1_RESOURCE_IDS, depth, opts);
}

/** Category pressure hints for roll tables (2F packets consume these). */
export const DEPTH_ROLL_PRESSURE: Record<ResourceDepthIndex, {
  intelChance: number;
  rareChance: number;
  unstableChance: number;
  contrabandChance: number;
  apexChance: number;
  breachThreadChance: number;
}> = {
  1: {
    intelChance: 0.08,
    rareChance: 0.05,
    unstableChance: 0,
    contrabandChance: 0,
    apexChance: 0,
    breachThreadChance: 0,
  },
  2: {
    intelChance: 0.18,
    rareChance: 0.14,
    unstableChance: 0.12,
    contrabandChance: 0.04,
    apexChance: 0,
    breachThreadChance: 0.18,
  },
  3: {
    intelChance: 0.28,
    rareChance: 0.24,
    unstableChance: 0.22,
    contrabandChance: 0.12,
    apexChance: 0.08,
    breachThreadChance: 0.32,
  },
};

export function formatDepthEconomyPolicyBrief(depth: ResourceDepthIndex): string {
  const policy = DEPTH_ECONOMY_POLICIES[depth];
  const pool = economyPoolAtDepth(depth);
  const highRiskPool = economyPoolAtDepth(depth, { highRisk: true });
  const names = pool.map((id) => RESOURCE_REGISTRY[id].shortName).join(', ');
  const highRiskOnly = highRiskPool.filter((id) => !pool.includes(id))
    .map((id) => RESOURCE_REGISTRY[id].shortName);
  return [
    `D${depth} ${policy.label} (${policy.band}) — ${policy.purpose}`,
    ...policy.dropSummary.map((line) => `  · ${line}`),
    `  Default pool (${pool.length}): ${names || '(empty)'}`,
    highRiskOnly.length
      ? `  High-risk unlocks: ${highRiskOnly.join(', ')}`
      : '  High-risk unlocks: (none extra)',
  ].join('\n');
}

/** Null Zone Threshold example from Phase 2E brief — for smoke assertions. */
export const NULL_ZONE_THRESHOLD_EXAMPLE_IDS: readonly ResourceItemId[] = [
  'ley-slag',
  'echo-glass-shard',
  'nullcrete-shard',
  'encrypted-grid-drive',
];
