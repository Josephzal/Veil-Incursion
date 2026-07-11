import type { ResourceItemId } from './resourceItem';
import type { CargoItemId } from './cargoGrid';

/**
 * Expedition Relic (Trinkets v2) — pre-run expedition modifiers, not combat boons.
 * Each relic defines a run intention (hunt echoes, contraband run, debt economy, etc.).
 * Type/field names retain the `Keepsake` prefix for migration continuity with the
 * v1.5 wiring; the player-facing surface calls these "Expedition Relics".
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

/** In-run relic branch choices surfaced mid-incursion. */
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
  /** One-line description of the run intention this relic enables. */
  runStyle: string;
  /** One-line description of the tradeoff/risk this relic adds. */
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

export interface KeepsakeRuntimeStats {
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
  cargoBankedByTrinket: number;
  operationProgressAdded: number;
  sponsorRepBonus: number;
  echoSignalsGenerated: number;
  echoThreadGenerated: number;
  echoIntelRevealed: number;
  echoGlassBonus: number;
  anchorSignalsGenerated: number;
  anchorTrailCleared: number;
  contaminationAdded: number;
  contaminationPurged: number;
  matchesLit: number;
  safeExtractionsSkipped: number;
  contrabandWrapped: number;
  markedShelfPurchases: number;
  debtWarningsTriggered: number;
  rivalQuarriesCleared: number;
  falseBeaconsPlanted: number;
  keysUsed: number;
  outsideCargoNodesCarried: number;
  safehouseServiceUsed: string | null;
  triggerCount: number;
}

export interface KeepsakeRuntime {
  keepsakeId: KeepsakeId;
  /** Pre-run deployment configuration copied from the account loadout. */
  deployment: KeepsakeDeployment;
  triggersUsed: Record<string, boolean>;
  perDepthTriggersUsed: Record<number, Record<string, boolean>>;
  messages: string[];
  /** Player-facing decisions recorded for the debrief. */
  decisions: KeepsakeDecision[];
  /** Lightweight boolean state flags (pendingDeadDrop, deathClueAvailable, mirroredNodePlanted, ...). */
  flags: Record<string, boolean>;
  /** Lightweight numeric counters (contamination, matches, echoThread, scent, noise, keys, ...). */
  counters: Record<string, number>;
  stats: KeepsakeRuntimeStats;
  /** Instance-level cargo tags applied by relic hooks this run. */
  taggedCargo: KeepsakeTaggedCargoEntry[];
  /** Fast lookup for routing value bonuses at debrief. */
  cargoTagByResource: Partial<Record<ResourceItemId, KeepsakeCargoTagKind>>;
  /** Ley-Siphon Needle — next harvest may overdraw the vein. */
  leySiphonOverdrawPending: boolean;
  /** Black Market Mark — discounted marked shelf listing id. */
  markedShelfItemId: CargoItemId | null;
  /** Node id corrupted after buying the marked shelf item. */
  markedShelfCorruptedNodeId: string | null;
  /** Null Ledger — credits owed on successful extraction (+25% surcharge). */
  nullLedgerDebtCredits: number;
  /** Null Ledger — item purchased on credit this run. */
  nullLedgerCreditItemId: CargoItemId | null;
  /** Extraction Token — first revealed safe extraction node id. */
  stampedExtractionNodeId: string | null;
  /** Extraction confirmed through stamped node — stable cargo bonus pending payout. */
  stampedExtractionConfirmed: boolean;
  /** Last Light Matchbook — greed bonus armed for next qualifying clear. */
  overextendedActive: boolean;
  /** Overextended bonus already consumed this run. */
  overextendedBonusConsumed: boolean;
  /** Overextended — next dirty extraction gains +1 threat. */
  overextendedDirtyThreatPending: boolean;
  /** In-run branch choice awaiting player resolution. */
  pendingChoice: KeepsakePendingChoice | null;
  /** Cargo Seal — dirty extraction cracked the seal dampening. */
  cargoSealCracked: boolean;
  /** Smuggler's Wrap — hunter mark active after double wrap. */
  smugglersHunterMarkActive: boolean;
  /** Extraction Token — burn count this run (escalates route risk). */
  extractionTokenBurns: number;
}

export interface KeepsakeDebriefSummary {
  keepsakeId: KeepsakeId;
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
