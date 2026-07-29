/**
 * Phase 3K — weapon↔enemy / weapon↔sector matchup types (read-only inspection).
 * Does not modify damage, AI, spawn weights, boons, or grafts.
 */
import type { WeaponFamilyId } from './weapon';
import type { SectorId } from './worldState';
import type { EncounterEnemyKey } from '../data/enemyCombatConfig';
import type { VeilBiome } from './encounterSpawn';

export type MatchupClassification =
  | 'FAVORABLE'
  | 'EVEN'
  | 'STRAINED'
  | 'NONVIABLE_DEFECT';

export type MatchupQualifier =
  | 'TARGET_DEPENDENT'
  | 'LOADOUT_DEPENDENT'
  | 'AMMO_DEPENDENT'
  | 'GRAFT_COMPENSATED'
  | 'BOON_COMPENSATED'
  | 'EXECUTION_DEPENDENT'
  | 'RESOURCE_PRESSURE'
  | 'DEFENSE_LAYER_PRESSURE';

export type MatchupValidationStatus = 'VALIDATED' | 'NEEDS_REVIEW' | 'ROSTER_GAP';

export type EnemyAuditDefect =
  | 'VALID'
  | 'DESCRIPTION_MISMATCH'
  | 'PARTIALLY_WIRED'
  | 'DEAD_OR_UNREACHABLE'
  | 'RETIRED_DEPENDENCY'
  | 'MATCHUP_DESIGN_GAP'
  | 'NUMERICAL_TUNING_CANDIDATE';

export type MatchupBuildState =
  | 'NATURAL_UNGRAFTED_UNBOONED'
  | 'PHASE_3H_LOADOUT'
  | 'RANK3_SANCTUARY_GRAFT'
  | 'MATURE_SANCTUARY_GRAFT'
  | 'PHASE_3I_BOON_STATE';

export interface WeaponEnemyMatchupRecord {
  key: string;
  weaponFamilyId: WeaponFamilyId;
  enemyId: EncounterEnemyKey;
  classification: MatchupClassification;
  qualifiers: readonly MatchupQualifier[];
  mechanicalReason: string;
  relevantTags: readonly string[];
  relevantEvents: readonly string[];
  damageDefenseInteraction: string;
  targetingInteraction: string;
  resourcePressure: string;
  classMeterInteraction: string;
  enemyIntentEffect: string;
  naturalAdvantage: string;
  structuralDrawbackPressured: string;
  accessibleCompensation: string;
  compensationSource: 'ABILITY' | 'AMMO' | 'SANCTUARY_GRAFT' | 'BOON' | 'NONE' | 'MIXED';
  compensationMinClassRank: number | null;
  compensationInPhase3HLoadout: boolean;
  preservesPhase3GDrawback: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  validationStatus: MatchupValidationStatus;
}

export interface WeaponSectorMatchupRecord {
  key: string;
  weaponFamilyId: WeaponFamilyId;
  sectorId: SectorId;
  veilBiome: VeilBiome;
  depth: 1 | 2 | 3;
  classification: MatchupClassification;
  qualifiers: readonly MatchupQualifier[];
  mechanicalReason: string;
  poolSummary: string;
  defenseLayerDistribution: string;
  formationPressure: string;
  accessibleCompensation: string;
  preservesPhase3GDrawback: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  validationStatus: MatchupValidationStatus;
}

export interface MatchupInspectInput {
  weaponFamilyId: WeaponFamilyId;
  loadoutKind?: 'IDENTITY_FORWARD' | 'ALTERNATE_COVERAGE';
  abilityGrafts?: Readonly<Record<string, string>>;
  ownedBoonIds?: readonly string[];
  sectorId?: SectorId;
  depth?: 1 | 2 | 3;
  enemyId?: EncounterEnemyKey;
  encounterComposition?: readonly EncounterEnemyKey[];
  buildState?: MatchupBuildState;
  classRank?: number;
}

export interface MatchupInspectResult {
  weaponFamilyId: WeaponFamilyId;
  baseProperties: string[];
  finalTransformedProperties: string[];
  finalTags: readonly string[];
  finalReachableEvents: readonly string[];
  damageDefenseRouting: string;
  resourceCadence: string;
  classMeterRoute: string;
  targetingBehavior: string;
  matchupClassification: MatchupClassification | null;
  classificationReasons: string[];
  accessibleCompensationRoutes: string[];
  phase3GDrawbackGuard: string;
  enemySectorDepthLegality: string | null;
  encounterDeckSource: string | null;
  unresolvedDependencies: string[];
}
