import type {
  ResourceDepthRules,
  ResourceItemId,
} from '../types/resourceItem';
import type { SectorId } from '../types/worldState';

/**
 * Phase 2B — source identity per resource.
 * Sector farming identity (2D) + depth rules (2E) consume this;
 * registry validation requires every resource to be listed here.
 */
export interface ResourceSourceIdentity {
  primarySectors: readonly SectorId[];
  secondarySources: readonly string[];
  depthRules: ResourceDepthRules;
}

const D1_3: ResourceDepthRules = { minDepth: 1, maxDepth: 3, preferredDepths: [] };
const D1_2: ResourceDepthRules = { minDepth: 1, maxDepth: 2, preferredDepths: [1] };
const D2_3: ResourceDepthRules = { minDepth: 2, maxDepth: 3, preferredDepths: [2, 3] };
const D3: ResourceDepthRules = { minDepth: 3, maxDepth: 3, preferredDepths: [3] };
const D2: ResourceDepthRules = { minDepth: 2, maxDepth: 3, preferredDepths: [2] };

export const RESOURCE_SOURCE_IDENTITY: Record<ResourceItemId, ResourceSourceIdentity> = {
  'ley-slag': {
    primarySectors: ['THE_SLAG_WORKS', 'THE_NULL_ZONE'],
    secondarySources: ['Blackline industrial caches', 'Common resource nodes'],
    depthRules: D1_3,
  },
  'sanguine-ampoule': {
    primarySectors: ['THE_ABYSSAL_SINK'],
    secondarySources: ['Ashen organic caches', 'Slag Works occult salvage'],
    depthRules: D1_3,
  },
  'encrypted-grid-drive': {
    primarySectors: ['THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS'],
    secondarySources: ['Blacksite tech vaults', 'Scanner industrial salvage'],
    // Phase 2E — rare Threshold peek (Null Zone D1 example); preferred Breach+.
    depthRules: { minDepth: 1, maxDepth: 3, preferredDepths: [2, 3] },
  },
  'legion-blood-iron': {
    primarySectors: ['THE_SLAG_WORKS'],
    secondarySources: ['Blackline Legion caches', 'Ashen industrial residue'],
    depthRules: D2_3,
  },
  'anomalous-core': {
    primarySectors: ['THE_BLACKLINE_TERMINUS'],
    secondarySources: ['Boss / apex blacksite contexts', 'Deep high-risk anomalies'],
    depthRules: D3,
  },
  'echo-glass-shard': {
    primarySectors: ['THE_NULL_ZONE', 'THE_ABYSSAL_SINK', 'THE_ASHEN_WASTES'],
    secondarySources: ['Echo residue fights', 'Slag Works resonant caches'],
    depthRules: D1_3,
  },
  'veil-ash-canister': {
    primarySectors: ['THE_ASHEN_WASTES'],
    secondarySources: ['Volatile Depth 2+ salvage', 'Scorched blacksite vents'],
    depthRules: D2,
  },
  'smugglers-ledger': {
    primarySectors: ['THE_NULL_ZONE', 'THE_SLAG_WORKS'],
    secondarySources: ['Fallen-runner residue', 'Black-market intel drops'],
    depthRules: D1_3,
  },
  'ossified-ley-knot': {
    primarySectors: ['THE_ABYSSAL_SINK', 'THE_ASHEN_WASTES'],
    secondarySources: ['Occult Depth caches', 'Blackline mutation salvage'],
    depthRules: D2_3,
  },
  'sealed-containment-casket': {
    primarySectors: ['THE_BLACKLINE_TERMINUS', 'THE_NULL_ZONE'],
    secondarySources: ['Gatekeeper salvage', 'High-risk blacksite recovery'],
    // Phase 2E — appraisable contraband leans Deep Veil (D2 high-risk only via policy).
    depthRules: { minDepth: 2, maxDepth: 3, preferredDepths: [3] },
  },
  'tarnished-dog-tags': {
    primarySectors: ['THE_NULL_ZONE', 'THE_ABYSSAL_SINK'],
    secondarySources: ['Echo / fallen-runner residue', 'Slag Works recovery caches'],
    depthRules: D1_2,
  },
  'combustion-cylinder': {
    primarySectors: ['THE_SLAG_WORKS', 'THE_ASHEN_WASTES'],
    secondarySources: ['Blackline industrial fuel stores', 'Scorched salvage'],
    depthRules: D1_3,
  },
  'nullcrete-shard': {
    primarySectors: ['THE_NULL_ZONE'],
    secondarySources: ['Urban defense rubble', 'Ward / concrete caches'],
    depthRules: D1_3,
  },
  'mycelial-ichor': {
    primarySectors: ['THE_ABYSSAL_SINK'],
    secondarySources: ['Biological attrition nodes', 'Organic survival caches'],
    depthRules: D1_3,
  },
  'cinder-wire': {
    primarySectors: ['THE_ASHEN_WASTES'],
    secondarySources: ['Road salvage', 'Signal / flare fabrication scrap'],
    depthRules: D1_3,
  },
  'rail-capacitor': {
    primarySectors: ['THE_SLAG_WORKS'],
    secondarySources: ['Industrial power cores', 'Weapon-tech machinery'],
    depthRules: D2_3,
  },
  'containment-seal': {
    primarySectors: ['THE_BLACKLINE_TERMINUS', 'THE_NULL_ZONE'],
    secondarySources: ['Blacksite vault seals', 'Appraisal / sealed-casket events'],
    depthRules: D2_3,
  },
  'resonant-filament': {
    primarySectors: ['THE_NULL_ZONE', 'THE_ABYSSAL_SINK'],
    secondarySources: [
      'Ashen / Slag / Blackline echo contamination',
      'Choir Spire / Mirror pressure clears',
    ],
    depthRules: D1_3,
  },
  'anchor-marrow': {
    primarySectors: ['THE_SLAG_WORKS'],
    secondarySources: ['Anchor / engine events', 'Deep industrial rites'],
    depthRules: D2_3,
  },
  'breach-thread': {
    primarySectors: ['THE_ASHEN_WASTES', 'THE_BLACKLINE_TERMINUS'],
    secondarySources: ['False extraction / depth distortion', 'Breach fracture salvage'],
    depthRules: D2_3,
  },
  'blacksite-specimen-jar': {
    primarySectors: ['THE_BLACKLINE_TERMINUS', 'THE_ABYSSAL_SINK'],
    secondarySources: ['Blacksite labs', 'Veil Proper Cache / sealed labs'],
    // Phase 2E — Deep Veil appraisable; D2 only on marked high-risk.
    depthRules: { minDepth: 2, maxDepth: 3, preferredDepths: [3] },
  },
  'overgrowth-coordinate': {
    primarySectors: ['THE_NULL_ZONE'],
    secondarySources: ['Depth 1+ elite / boss salvage while Sink mandate is active'],
    depthRules: D1_2,
  },
  'false-road-signal': {
    primarySectors: ['THE_NULL_ZONE', 'THE_ABYSSAL_SINK'],
    secondarySources: ['Depth 2+ events while Ashen Wastes mandate is active'],
    depthRules: D2,
  },
  'transit-cipher': {
    primarySectors: ['THE_ASHEN_WASTES', 'THE_NULL_ZONE'],
    secondarySources: ['Depth 2 elite caches while Slag Works mandate is active'],
    depthRules: D2_3,
  },
  'blackline-credentials': {
    primarySectors: ['THE_SLAG_WORKS', 'THE_ASHEN_WASTES'],
    secondarySources: ['Depth 3 blacksite clearance while Terminus mandate is active'],
    depthRules: D3,
  },
};

export function getResourceSourceIdentity(id: ResourceItemId): ResourceSourceIdentity {
  return RESOURCE_SOURCE_IDENTITY[id];
}
