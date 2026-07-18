import type { ResourceCategory, ResourceItemId } from '../types/resourceItem';

/**
 * Phase 2C — Final frozen resource roster for v1.
 *
 * Economy spine works this set. Do not add resources without an explicit
 * Phase 2+ roster expansion decision. Route intel is progression cargo,
 * counted separately from the 21 economy resources.
 */

export const ECONOMY_V1_ROSTER_FROZEN = true as const;

/** 10 stable crafting / sector materials. */
export const ECONOMY_V1_STABLE_IDS = [
  'ley-slag',
  'sanguine-ampoule',
  'legion-blood-iron',
  'echo-glass-shard',
  'combustion-cylinder',
  'nullcrete-shard',
  'mycelial-ichor',
  'cinder-wire',
  'rail-capacitor',
  'resonant-filament',
] as const satisfies readonly ResourceItemId[];

/** 5 unstable carried-pressure / rare materials. */
export const ECONOMY_V1_UNSTABLE_IDS = [
  'anomalous-core',
  'veil-ash-canister',
  'ossified-ley-knot',
  'anchor-marrow',
  'breach-thread',
] as const satisfies readonly ResourceItemId[];

/** 4 economy intel (not sector-access route intel). */
export const ECONOMY_V1_INTEL_IDS = [
  'encrypted-grid-drive',
  'smugglers-ledger',
  'tarnished-dog-tags',
  'containment-seal',
] as const satisfies readonly ResourceItemId[];

/** 2 contraband / appraisal containers. */
export const ECONOMY_V1_CONTRABAND_IDS = [
  'sealed-containment-casket',
  'blacksite-specimen-jar',
] as const satisfies readonly ResourceItemId[];

/** The 21-resource economy roster — Phase 2 drop/craft/fence/contract surface. */
export const ECONOMY_V1_RESOURCE_IDS = [
  ...ECONOMY_V1_STABLE_IDS,
  ...ECONOMY_V1_UNSTABLE_IDS,
  ...ECONOMY_V1_INTEL_IDS,
  ...ECONOMY_V1_CONTRABAND_IDS,
] as const satisfies readonly ResourceItemId[];

/** Progression Spine Phase 1C route intel — not economy materials. */
export const ROUTE_INTEL_V1_IDS = [
  'overgrowth-coordinate',
  'false-road-signal',
  'transit-cipher',
  'blackline-credentials',
] as const satisfies readonly ResourceItemId[];

/** Full Phase 2C freeze set: 21 economy + 4 route intel. */
export const PHASE_2C_FULL_ROSTER_IDS = [
  ...ECONOMY_V1_RESOURCE_IDS,
  ...ROUTE_INTEL_V1_IDS,
] as const satisfies readonly ResourceItemId[];

export const ECONOMY_V1_COUNTS = {
  STABLE: ECONOMY_V1_STABLE_IDS.length,
  UNSTABLE: ECONOMY_V1_UNSTABLE_IDS.length,
  INTEL: ECONOMY_V1_INTEL_IDS.length,
  CONTRABAND: ECONOMY_V1_CONTRABAND_IDS.length,
  ECONOMY_TOTAL: ECONOMY_V1_RESOURCE_IDS.length,
  ROUTE_INTEL: ROUTE_INTEL_V1_IDS.length,
  FULL_ROSTER: PHASE_2C_FULL_ROSTER_IDS.length,
} as const;

const ECONOMY_V1_SET = new Set<string>(ECONOMY_V1_RESOURCE_IDS);
const ROUTE_INTEL_V1_SET = new Set<string>(ROUTE_INTEL_V1_IDS);
const FULL_ROSTER_SET = new Set<string>(PHASE_2C_FULL_ROSTER_IDS);

export function isEconomyV1ResourceId(id: string): id is ResourceItemId {
  return ECONOMY_V1_SET.has(id);
}

export function isRouteIntelV1ResourceId(id: string): id is ResourceItemId {
  return ROUTE_INTEL_V1_SET.has(id);
}

export function isPhase2CRosterResourceId(id: string): id is ResourceItemId {
  return FULL_ROSTER_SET.has(id);
}

export function expectedEconomyCategoryIds(
  category: ResourceCategory,
): readonly ResourceItemId[] {
  switch (category) {
    case 'STABLE':
      return ECONOMY_V1_STABLE_IDS;
    case 'UNSTABLE':
      return ECONOMY_V1_UNSTABLE_IDS;
    case 'INTEL':
      // Registry INTEL category includes route intel; economy bucket does not.
      return ECONOMY_V1_INTEL_IDS;
    case 'CONTRABAND':
      return ECONOMY_V1_CONTRABAND_IDS;
    default:
      return [];
  }
}

export function formatEconomyRosterV1Summary(): string {
  return [
    `Economy v1: ${ECONOMY_V1_COUNTS.ECONOMY_TOTAL} `
    + `(S${ECONOMY_V1_COUNTS.STABLE}/U${ECONOMY_V1_COUNTS.UNSTABLE}`
    + `/I${ECONOMY_V1_COUNTS.INTEL}/C${ECONOMY_V1_COUNTS.CONTRABAND})`,
    `Route intel: ${ECONOMY_V1_COUNTS.ROUTE_INTEL}`,
    `Full freeze: ${ECONOMY_V1_COUNTS.FULL_ROSTER}`,
    `Frozen: ${ECONOMY_V1_ROSTER_FROZEN ? 'YES' : 'NO'}`,
  ].join(' // ');
}
