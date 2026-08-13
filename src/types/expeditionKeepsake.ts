import type { ResourceItemId } from './resourceItem';
import type { CargoItemId } from './cargoGrid';

/**
 * @deprecated Stage III-B donor schema retained only for deterministic migration
 * and adaptation of the nine surviving expedition definitions. Live APIs and all
 * player-facing surfaces use Expedition Requisitions.
 */
export type KeepsakeId =
  | 'signal_compass'
  | 'ashen_cartograph'
  | 'dead_drop_receiver'
  | 'ley_siphon_needle'
  | 'cargo_seal'
  | 'smugglers_wrap'
  | 'black_market_mark'
  | 'null_ledger'
  | 'extraction_token'
  | 'last_light_matchbook'
  | 'contract_seal'
  | 'anchor_charm'
  | 'mourners_bell'
  | 'grave_polaroid'
  | 'hollow_keyring'
  | 'bloodhound_tag'
  | 'false_evac_beacon'
  | 'gutter_crown'
  | 'mirror_writ'
  | 'bent_nail';

export type KeepsakeTag =
  | 'SCANNER'
  | 'RECON'
  | 'ROUTE'
  | 'CARGO'
  | 'INTEL'
  | 'CONTRABAND'
  | 'EXTRACTION'
  | 'DIRTY_EXTRACTION'
  | 'SAFEHOUSE'
  | 'MARKET'
  | 'CONTRACT'
  | 'SPONSOR'
  | 'OPERATION'
  | 'ANCHOR'
  | 'ECHO'
  | 'UNSTABLE_CARGO'
  | 'RESOURCE'
  | 'ECONOMY'
  | 'SURVIVAL'
  | 'RISK'
  | 'NARRATIVE'
  | 'STAMINA'
  | 'RIVAL'
  | 'DEBT'
  | 'GREED';

export type KeepsakeHook =
  | 'onRunStart'
  | 'onScannerGenerate'
  | 'onNodeReveal'
  | 'onNodeSelected'
  | 'onNodeCompleted'
  | 'onCargoAdded'
  | 'onCargoBanked'
  | 'onCargoSold'
  | 'onExtractionNodeReveal'
  | 'onExtractionStart'
  | 'onDirtyExtractionStart'
  | 'onSafehouseEnter'
  | 'onMarketOpen'
  | 'onMarketPurchase'
  | 'onContractAccepted'
  | 'onContractResolve'
  | 'onOperationContribution'
  | 'onEchoSignalResolved'
  | 'onAnchorSignalResolved'
  | 'onNarrativeResolverBuild'
  | 'onNarrativeResolverSelected'
  | 'onCombatStart'
  | 'onDebriefBuild';

export type KeepsakeUnlockState = 'UNLOCKED' | 'LOCKED';

export type KeepsakeRuntimeGuard = 'run' | 'depth' | 'none';

export type KeepsakeCargoTagKind = 'sealed' | 'wrapped';

/** Pre-run deployment choice families that surface a configuration picker on the loadout screen. */
export type KeepsakeDeploymentChoiceKind = 'attunement' | 'route_doctrine' | 'mirror_category';

/** Signal Compass — attuned signal families. */
export type KeepsakeAttunement =
  | 'HIGH_VALUE_RESOURCE'
  | 'ECHO_RESIDUE'
  | 'ANCHOR_SIGNAL'
  | 'EXTRACTION'
  | 'OPERATION_TARGET';

/** Ashen Cartograph — route doctrines. */
export type KeepsakeRouteDoctrine = 'SAFE' | 'GREED' | 'HUNT';

/** Mirror Writ — mirrored reward categories. */
export type KeepsakeMirrorCategory =
  | 'CREDITS'
  | 'SPONSOR_REP'
  | 'OPERATION_PROGRESS'
  | 'RESOURCE_PAYOUT';

/** Pre-run deployment selections, chosen on the loadout screen before descent. */
export interface KeepsakeDeployment {
  attunement: KeepsakeAttunement | null;
  routeDoctrine: KeepsakeRouteDoctrine | null;
  mirrorCategory: KeepsakeMirrorCategory | null;
}

export interface KeepsakeTaggedCargoEntry {
  instanceId: string;
  resourceId: ResourceItemId;
  tag: KeepsakeCargoTagKind;
}

/** A player-facing decision recorded for the debrief (deployment choices, branch picks, etc.). */
export interface KeepsakeDecision {
  key: string;
  label: string;
  value: string;
  depth?: number;
}

/** A single deployment option surfaced in the loadout picker. */
export interface KeepsakeDeploymentOption {
  value: string;
  label: string;
  detail: string;
}

export interface KeepsakeDeploymentChoiceSpec {
  kind: KeepsakeDeploymentChoiceKind;
  prompt: string;
  options: readonly KeepsakeDeploymentOption[];
}

/** Legacy donor choice schema retained for the runtime adapter. */
export type KeepsakePendingChoiceKind =
  | 'dead_drop_action'
  | 'contract_seal_clause'
  | 'extraction_token_action'
  | 'cartograph_lock'
  | 'polaroid_develop'
  | 'ley_siphon_overdraw'
  | 'smugglers_double_wrap'
  | 'mourners_bell_answer'
  | 'hollow_key_unlock'
  | 'false_evac_beacon_plant'
  | 'gutter_service';

export interface KeepsakePendingChoice {
  kind: KeepsakePendingChoiceKind;
  prompt: string;
  nodeId?: string;
  options: readonly KeepsakeDeploymentOption[];
}

export interface ExpeditionKeepsakeDefinition {
  id: KeepsakeId;
  name: string;
  shortName: string;
  description: string;
  flavorText: string;
  effectSummary: string;
  /** One-line description of the run intention this donor enables. */
  runStyle: string;
  /** One-line description of the donor tradeoff/risk. */
  riskSummary: string;
  tags: readonly KeepsakeTag[];
  unlockState: KeepsakeUnlockState;
  unlockRequirement?: string;
  displayPriority: number;
  hooks: readonly KeepsakeHook[];
  triggerMessage: string;
  /** Optional deployment configuration surfaced pre-run. */
  deploymentChoice?: KeepsakeDeploymentChoiceSpec;
  /** Deployment warning shown when key systems (sponsor/anchor/echo/contraband) may be inactive. */
  deploymentWarning?: string;
  /** Primary once-per-run or once-per-depth guard key for validation. */
  primaryTriggerKey: string;
  primaryRuntimeGuard: KeepsakeRuntimeGuard;
}
