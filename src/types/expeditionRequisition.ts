import type { CargoItemId } from './cargoGrid';
import type { ResourceItemId } from './resourceItem';

export const ENABLED_REQUISITION_IDS = [
  'signal_compass',
  'ashen_cartograph',
  'dead_drop_receiver',
  'cargo_seal',
  'smugglers_wrap',
  'black_market_mark',
  'null_ledger',
  'extraction_token',
  'contract_seal',
  'hazard_pay',
  'adrenaline_primer',
  'reinforced_trench_coat',
  'hollow_point_requisition',
  'kinetic_battery',
  'chalk_line_ward',
] as const;

export type RequisitionId = (typeof ENABLED_REQUISITION_IDS)[number];

export const DEFERRED_REQUISITION_IDS = [
  'standard_issue_coagulant',
  'apex_bait',
  'martyrs_bargain',
  'ley_siphon_needle',
  'last_light_matchbook',
  'anchor_charm',
  'mourners_bell',
  'hollow_keyring',
  'bloodhound_tag',
  'false_evac_beacon',
  'gutter_crown',
  'bent_nail',
] as const;

export type DeferredRequisitionId = (typeof DEFERRED_REQUISITION_IDS)[number];
export type RecognizedRequisitionId = RequisitionId | DeferredRequisitionId;

export const COMBAT_PREPARATION_REQUISITION_IDS = [
  'adrenaline_primer',
  'reinforced_trench_coat',
  'hollow_point_requisition',
  'kinetic_battery',
  'chalk_line_ward',
] as const;

export type CombatPreparationRequisitionId =
  (typeof COMBAT_PREPARATION_REQUISITION_IDS)[number];

export type RequisitionFamily =
  | 'Logistics'
  | 'Reconnaissance'
  | 'Extraction'
  | 'Preparation'
  | 'Bargain';

export type RequisitionSubtype = 'Expedition' | 'Combat Preparation';

export type RequisitionAttunement =
  | 'HIGH_VALUE_RESOURCE'
  | 'ECHO_RESIDUE'
  | 'ANCHOR_SIGNAL'
  | 'EXTRACTION'
  | 'OPERATION_TARGET';

export type RequisitionRouteDoctrine = 'SAFE' | 'GREED' | 'HUNT';

export interface RequisitionDeployment {
  attunement: RequisitionAttunement | null;
  routeDoctrine: RequisitionRouteDoctrine | null;
}

export type RequisitionDeploymentChoiceKind = 'attunement' | 'route_doctrine';

export interface RequisitionDeploymentOption {
  value: string;
  label: string;
  detail: string;
}

export interface RequisitionDeploymentChoiceSpec {
  kind: RequisitionDeploymentChoiceKind;
  prompt: string;
  options: readonly RequisitionDeploymentOption[];
}

export type RequisitionRuntimeGuard = 'run' | 'depth' | 'encounter' | 'none';

export type RequisitionHook =
  | 'onRunStart'
  | 'onScannerGenerate'
  | 'onNodeReveal'
  | 'onNodeSelected'
  | 'onNodeCompleted'
  | 'onCargoAdded'
  | 'onCargoBanked'
  | 'onMarketOpen'
  | 'onMarketPurchase'
  | 'onExtractionNodeReveal'
  | 'onExtractionStart'
  | 'onDirtyExtractionStart'
  | 'onContractAccepted'
  | 'onContractResolve'
  | 'onDebriefBuild'
  | 'onCombatEncounterStart'
  | 'onFirstPlayerTurn'
  | 'onDirectHostileDamage'
  | 'onPlayerCritChance'
  | 'onPlayerDamagingAction'
  | 'onHostileEffectApply'
  | 'onCombatEncounterEnd';

export type RequisitionCombatEffectSignature =
  | {
      kind: 'FIRST_TURN_AP';
      amount: 1;
      eligibleEncounterLimit: 3;
      totalTriggerLimit: 3;
    }
  | {
      kind: 'FIRST_ELITE_DIRECT_DAMAGE_REDUCTION';
      reductionPct: 50;
      eligibleEncounterLimit: 1;
    }
  | {
      kind: 'DEPTH_ONE_CRIT_CHANCE_POINTS';
      percentagePoints: 10;
      maximumDepth: 1;
    }
  | {
      kind: 'FIRST_PROTECTED_TARGET_ACTION_PIERCE';
      armorPierceLayers: 1;
      wardPierceLayers: 1;
      eligibleEncounterLimit: 3;
      empoweredActionLimit: 3;
    }
  | {
      kind: 'FIRST_HOSTILE_CONTROL_PREVENTION';
      eligibleEncounterLimit: 3;
      preventionPerEncounter: 1;
      totalPreventionLimit: 3;
    };

export interface RequisitionDefinition {
  id: RequisitionId;
  name: string;
  shortName: string;
  family: RequisitionFamily;
  subtype: RequisitionSubtype;
  enabled: true;
  description: string;
  flavorText: string;
  effectSummary: string;
  runStyle: string;
  riskSummary: string;
  tags: readonly string[];
  displayPriority: number;
  hooks: readonly RequisitionHook[];
  triggerMessage: string;
  deploymentChoice?: RequisitionDeploymentChoiceSpec;
  deploymentWarning?: string;
  primaryTriggerKey: string;
  primaryRuntimeGuard: RequisitionRuntimeGuard;
  combatEffect?: RequisitionCombatEffectSignature;
}

export interface RequisitionDecision {
  key: string;
  label: string;
  value: string;
  depth?: number;
}

export type RequisitionPendingChoiceKind =
  | 'dead_drop_action'
  | 'contract_seal_clause'
  | 'extraction_token_action'
  | 'cartograph_lock'
  | 'smugglers_double_wrap';

export interface RequisitionPendingChoice {
  kind: RequisitionPendingChoiceKind;
  prompt: string;
  nodeId?: string;
  options: readonly RequisitionDeploymentOption[];
}

export type RequisitionCargoTagKind = 'sealed' | 'wrapped';

export interface RequisitionTaggedCargoEntry {
  instanceId: string;
  resourceId: ResourceItemId;
  tag: RequisitionCargoTagKind;
}

export type RequisitionEncounterKind =
  | 'STANDARD'
  | 'ELITE'
  | 'BOSS'
  | 'DIRTY_EXTRACTION'
  | 'TUTORIAL'
  | 'SCRIPTED'
  | 'SIMULATION'
  | 'DEVELOPER';

export interface RequisitionEncounterDescriptor {
  encounterId: string;
  kind: RequisitionEncounterKind;
}

export interface AdrenalinePrimerRuntime {
  kind: 'adrenaline_primer';
  consumedEncounterIds: string[];
  grantedEncounterIds: string[];
  apGranted: number;
}

export interface ReinforcedTrenchCoatRuntime {
  kind: 'reinforced_trench_coat';
  protectedEncounterId: string | null;
  protectionSpent: boolean;
  damagePrevented: number;
}

export interface HollowPointRuntime {
  kind: 'hollow_point_requisition';
  depthOneExpired: boolean;
  attributableCriticalHits: number;
}

export interface KineticBatteryRuntime {
  kind: 'kinetic_battery';
  consumedEncounterIds: string[];
  empoweredActionIds: string[];
  bypassedArmorLayers: number;
  bypassedWardLayers: number;
}

export interface ChalkLineWardRuntime {
  kind: 'chalk_line_ward';
  protectedEncounterIds: string[];
  currentEncounterId: string | null;
  currentWardAvailable: boolean;
  preventedEffectIds: string[];
}

export type RequisitionCombatPreparationRuntime =
  | AdrenalinePrimerRuntime
  | ReinforcedTrenchCoatRuntime
  | HollowPointRuntime
  | KineticBatteryRuntime
  | ChalkLineWardRuntime;

export interface RequisitionRuntimeStats {
  nodeDetailsRevealed: number;
  futureNodesPreviewed: number;
  routeNodesLocked: number;
  bonusResourcesGenerated: number;
  unstablePenaltiesReduced: number;
  creditsSaved: number;
  creditsDeferred: number;
  extractionDebtPaid: number;
  cargoValueBonus: number;
  cargoPreserved: number;
  cargoBankedByRequisition: number;
  sponsorRepBonus: number;
  contrabandWrapped: number;
  markedShelfPurchases: number;
  debtWarningsTriggered: number;
  startingCreditsGranted: number;
  eligibleCombatEncountersConsumed: number;
  temporaryApGranted: number;
  directHostileDamagePrevented: number;
  attributableCriticalHits: number;
  empoweredPiercingActions: number;
  armorLayersBypassed: number;
  wardLayersBypassed: number;
  hostileEffectsPrevented: number;
  triggerCount: number;
}

export interface RequisitionRuntime {
  requisitionId: RequisitionId;
  deployment: RequisitionDeployment;
  triggersUsed: Record<string, boolean>;
  perDepthTriggersUsed: Record<number, Record<string, boolean>>;
  perEncounterTriggersUsed: Record<string, Record<string, boolean>>;
  messages: string[];
  decisions: RequisitionDecision[];
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  stats: RequisitionRuntimeStats;
  taggedCargo: RequisitionTaggedCargoEntry[];
  cargoTagByResource: Partial<Record<ResourceItemId, RequisitionCargoTagKind>>;
  markedShelfItemId: CargoItemId | null;
  markedShelfCorruptedNodeId: string | null;
  nullLedgerDebtCredits: number;
  nullLedgerCreditItemId: CargoItemId | null;
  stampedExtractionNodeId: string | null;
  stampedExtractionConfirmed: boolean;
  pendingChoice: RequisitionPendingChoice | null;
  cargoSealCracked: boolean;
  smugglersHunterMarkActive: boolean;
  extractionTokenBurns: number;
  combatPreparation: RequisitionCombatPreparationRuntime | null;
}

export interface RequisitionDebriefSummary {
  requisitionId: RequisitionId;
  name: string;
  shortName: string;
  effectSummary: string;
  triggered: boolean;
  triggerCount: number;
  messages: string[];
  decisionLines: string[];
  riskLines: string[];
  statLines: string[];
  note: string | null;
}

export interface RequisitionAccountFields {
  equippedRequisitionId: RequisitionId | null;
  unlockedRequisitionIds: readonly RecognizedRequisitionId[];
  requisitionDeployment: RequisitionDeployment;
}

export interface StoredRequisitionAccountInput {
  equippedRequisitionId?: unknown;
  unlockedRequisitionIds?: readonly unknown[];
  requisitionDeployment?: Partial<RequisitionDeployment> | null;
  equippedKeepsakeId?: unknown;
  unlockedKeepsakeIds?: readonly unknown[];
  keepsakeDeployment?: {
    attunement?: unknown;
    routeDoctrine?: unknown;
    mirrorCategory?: unknown;
  } | null;
  craftedAugments?: readonly unknown[];
}
