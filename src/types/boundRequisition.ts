import type { FactionType } from './game';

export type BoundRequisitionTier = 1 | 2 | 3 | 4 | 5;

export type BoundRequisitionKind = 'STANDARD' | 'CABAL_MANDATE';

export type BoundRequisitionId =
  | 'HAZARD_PAY'
  | 'STANDARD_ISSUE_COAGULANT'
  | 'ADRENALINE_PRIMER'
  | 'REINFORCED_TRENCH_COAT'
  | 'SMUGGLERS_POCKETS'
  | 'CHALK_LINE_WARD'
  | 'BLOOD_PRICE'
  | 'SCAVENGERS_MARK'
  | 'WIRETAP_OVERRIDE'
  | 'BRIBE_THE_FERRYMAN'
  | 'DEAD_DROP_TRACKER'
  | 'KINETIC_BATTERY'
  | 'HOLLOW_POINT_REQUISITION'
  | 'VOID_TOUCHED_ARTIFACT'
  | 'APEX_BAIT'
  | 'MARTYRS_BARGAIN'
  | 'IRONCLAD_LOGISTICS'
  | 'SUNKEN_RITE'
  | 'ENDLESS_MARCH';

export interface BoundRequisitionDefinition {
  id: BoundRequisitionId;
  name: string;
  tier: BoundRequisitionTier;
  kind: BoundRequisitionKind;
  cabal?: FactionType;
  tagline: string;
  effectSummary: string;
  tradeoffSummary?: string;
}

/** Active run modifiers from the chosen bound requisition. */
export interface BoundRequisitionRuntime {
  id: BoundRequisitionId;
  adrenalinePrimerCombatsRemaining: number;
  chalkLineWardDepthsRemaining: number;
  wiretapDepthsRemaining: number;
  smugglersPocketsActive: boolean;
  scavengerMarkBlackMarketPending: boolean;
  bribeFerrymanActive: boolean;
  deadDropTrackerActive: boolean;
  kineticBatteryActive: boolean;
  hollowPointActive: boolean;
  voidTouchedArtifactActive: boolean;
  apexBaitActive: boolean;
  martyrsBargainActive: boolean;
  ironcladLogisticsActive: boolean;
  leyScarsBlocked: boolean;
  sunkenRiteActive: boolean;
  resonanceImmuneDepthsRemaining: number;
  endlessMarchActive: boolean;
  evacBlocked: boolean;
  endlessMarchDamageBonusPct: number;
  extraCargoSlots: number;
  lockedCargoSlots: number;
  guaranteedEvacDepth: number | null;
  blackMarketDiscountPct: number;
  eliteIncomingDamageBonusPct: number;
  eliteLootMultiplier: number;
}

export function createDefaultBoundRequisitionRuntime(id: BoundRequisitionId): BoundRequisitionRuntime {
  return {
    id,
    adrenalinePrimerCombatsRemaining: 0,
    chalkLineWardDepthsRemaining: 0,
    wiretapDepthsRemaining: 0,
    smugglersPocketsActive: false,
    scavengerMarkBlackMarketPending: false,
    bribeFerrymanActive: false,
    deadDropTrackerActive: false,
    kineticBatteryActive: false,
    hollowPointActive: false,
    voidTouchedArtifactActive: false,
    apexBaitActive: false,
    martyrsBargainActive: false,
    ironcladLogisticsActive: false,
    leyScarsBlocked: false,
    sunkenRiteActive: false,
    resonanceImmuneDepthsRemaining: 0,
    endlessMarchActive: false,
    evacBlocked: false,
    endlessMarchDamageBonusPct: 0,
    extraCargoSlots: 0,
    lockedCargoSlots: 0,
    guaranteedEvacDepth: null,
    blackMarketDiscountPct: 0,
    eliteIncomingDamageBonusPct: 0,
    eliteLootMultiplier: 1,
  };
}
