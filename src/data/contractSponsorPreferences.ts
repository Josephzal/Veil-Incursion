import type { ContractObjectiveKind } from '../types/contract';
import type { ResourceItemId } from '../types/resourceItem';
import type { CabalEmployerId } from '../types/worldState';

export interface SponsorContractPreference {
  preferredResources: ResourceItemId[];
  objectiveKindWeights: Partial<Record<ContractObjectiveKind, number>>;
  tonePrefixes: string[];
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const SPONSOR_CONTRACT_PREFERENCES: Record<CabalEmployerId, SponsorContractPreference> = {
  TERRAN_GRID: {
    preferredResources: [
      'containment-seal',
      'encrypted-grid-drive',
      'rail-capacitor',
      'sealed-containment-casket',
      'blacksite-specimen-jar',
      'ley-slag',
      'echo-glass-shard',
    ],
    objectiveKindWeights: {
      RECOVER_INTEL: 4,
      RECOVER_ECONOMY_INTEL: 3,
      RECOVER_CONTRABAND: 2,
      CLEAR_OPERATION_TARGET: 3,
      EXTRACT_SPONSOR_RESOURCE: 2,
      EXTRACT_STABLE_RESOURCE: 2,
      REACH_DEPTH_AND_EXTRACT: 1,
    },
    tonePrefixes: ['Validate', 'Authorize', 'Contain', 'Audit', 'Secure'],
    riskTolerance: 'LOW',
  },
  LEGION: {
    preferredResources: [
      'legion-blood-iron',
      'rail-capacitor',
      'combustion-cylinder',
      'anchor-marrow',
      'nullcrete-shard',
      'cinder-wire',
      'ley-slag',
    ],
    objectiveKindWeights: {
      DEFEAT_ELITE: 4,
      DEFEAT_DEPTH_BOSS: 3,
      COMPLETE_EMERGENCY_RECALL: 3,
      EXTRACT_SPONSOR_RESOURCE: 2,
      EXTRACT_UNSTABLE_CARGO: 2,
      REACH_DEPTH_AND_EXTRACT: 2,
    },
    tonePrefixes: ['Execute', 'Suppress', 'Break', 'Cull', 'Neutralize'],
    riskTolerance: 'HIGH',
  },
  SOLARIS: {
    preferredResources: [
      'sanguine-ampoule',
      'mycelial-ichor',
      'ossified-ley-knot',
      'breach-thread',
      'veil-ash-canister',
      'resonant-filament',
      'anomalous-core',
    ],
    objectiveKindWeights: {
      EXTRACT_UNSTABLE_CARGO: 4,
      RECOVER_APEX_CARGO: 1,
      EXTRACT_SPONSOR_RESOURCE: 3,
      DEFEAT_ELITE: 2,
      CLEAR_OPERATION_TARGET: 2,
      RECOVER_CONTRABAND: 2,
    },
    tonePrefixes: ['Recover', 'Commune', 'Harvest', 'Reveal', 'Distill'],
    riskTolerance: 'MEDIUM',
  },
};

export const SPONSOR_RESOURCE_BY_CABAL: Record<CabalEmployerId, ResourceItemId[]> = {
  TERRAN_GRID: ['encrypted-grid-drive', 'containment-seal', 'rail-capacitor', 'ley-slag', 'echo-glass-shard'],
  LEGION: ['legion-blood-iron', 'rail-capacitor', 'combustion-cylinder', 'cinder-wire', 'ley-slag'],
  SOLARIS: ['sanguine-ampoule', 'mycelial-ichor', 'resonant-filament', 'veil-ash-canister', 'ossified-ley-knot'],
};

/** Phase 2D — contract sector bias mirrors farming PRIMARY (+ key rare) tables. */
export const SECTOR_RESOURCE_IDS: Partial<Record<string, ResourceItemId[]>> = {
  THE_NULL_ZONE: [
    'nullcrete-shard',
    'echo-glass-shard',
    'ley-slag',
    'encrypted-grid-drive',
    'containment-seal',
  ],
  THE_ABYSSAL_SINK: [
    'mycelial-ichor',
    'sanguine-ampoule',
    'echo-glass-shard',
    'ossified-ley-knot',
    'blacksite-specimen-jar',
  ],
  THE_ASHEN_WASTES: [
    'cinder-wire',
    'combustion-cylinder',
    'veil-ash-canister',
    'echo-glass-shard',
    'breach-thread',
  ],
  THE_SLAG_WORKS: [
    'rail-capacitor',
    'legion-blood-iron',
    'combustion-cylinder',
    'ley-slag',
    'anchor-marrow',
  ],
  THE_BLACKLINE_TERMINUS: [
    'containment-seal',
    'encrypted-grid-drive',
    'blacksite-specimen-jar',
    'sealed-containment-casket',
    'breach-thread',
    'anomalous-core',
  ],
};

export function sponsorDisplayLabel(sponsorId: CabalEmployerId): string {
  switch (sponsorId) {
    case 'TERRAN_GRID': return 'Terran Grid';
    case 'LEGION': return 'Legion';
    case 'SOLARIS': return 'Solaris';
    default: return sponsorId;
  }
}
