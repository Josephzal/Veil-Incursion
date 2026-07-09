import type { ResourceItemId } from './resourceItem';
import type { CargoItemId } from './cargoGrid';

/** Expedition Keepsake (Trinkets v1.5) — pre-run expedition modifiers, not combat boons. */
export type KeepsakeId =
  | 'signal_compass'
  | 'ashen_cartograph'
  | 'dead_drop_receiver'
  | 'ley_siphon_needle'
  | 'cargo_seal'
  | 'lead_lined_map_tube'
  | 'smugglers_wrap'
  | 'black_market_mark'
  | 'null_ledger'
  | 'extraction_token'
  | 'last_light_matchbook'
  | 'rusted_flare'
  | 'safehouse_coin'
  | 'field_rations'
  | 'contract_seal'
  | 'counterfeit_mandate'
  | 'anchor_charm'
  | 'choir_tuning_fork'
  | 'echo_lure'
  | 'grave_polaroid';

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
  | 'STAMINA';

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

export type KeepsakeCargoTagKind = 'sealed' | 'lead_lined' | 'wrapped';

export interface KeepsakeTaggedCargoEntry {
  instanceId: string;
  resourceId: ResourceItemId;
  tag: KeepsakeCargoTagKind;
}

export interface ExpeditionKeepsakeDefinition {
  id: KeepsakeId;
  name: string;
  shortName: string;
  description: string;
  flavorText: string;
  effectSummary: string;
  tags: readonly KeepsakeTag[];
  unlockState: KeepsakeUnlockState;
  unlockRequirement?: string;
  displayPriority: number;
  hooks: readonly KeepsakeHook[];
  triggerMessage: string;
  /** Primary once-per-run or once-per-depth guard key for validation. */
  primaryTriggerKey: string;
  primaryRuntimeGuard: KeepsakeRuntimeGuard;
}

export interface KeepsakeRuntimeStats {
  nodeDetailsRevealed: number;
  futureNodesPreviewed: number;
  bonusResourcesGenerated: number;
  unstablePenaltiesReduced: number;
  creditsSaved: number;
  creditsDeferred: number;
  extractionDebtPaid: number;
  cargoValueBonus: number;
  cargoPreserved: number;
  operationProgressAdded: number;
  sponsorRepBonus: number;
  echoSignalsGenerated: number;
  echoGlassBonus: number;
  staminaPreserved: number;
  safehouseServiceUsed: string | null;
  harmonicNodesGenerated: number;
  narrativeResolversSpoofed: number;
  triggerCount: number;
}

export interface KeepsakeRuntime {
  keepsakeId: KeepsakeId;
  triggersUsed: Record<string, boolean>;
  perDepthTriggersUsed: Record<number, Record<string, boolean>>;
  messages: string[];
  stats: KeepsakeRuntimeStats;
  /** Instance-level cargo tags applied by keepsake hooks this run. */
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
  /** Rusted Flare — first dirty extraction shield armed for next combat. */
  rustedFlareShieldPending: boolean;
  /** Rusted Flare — cargo loss protection available on dirty extract survival. */
  rustedFlareCargoProtectionAvailable: boolean;
  /** Safehouse Coin — show favor picker on first safehouse visit. */
  safehouseCoinServicePending: boolean;
  /** Safehouse Coin — chosen favor (null until committed). */
  safehouseCoinServiceUsed: 'route_cargo' | 'buy_information' | 'stabilize_payload' | null;
  /** Safehouse Coin — +15% value on safehouse-banked cargo at debrief. */
  safehouseCoinRouteCargoBonus: boolean;
  /** Safehouse Coin — broad type preview for next scanner depth. */
  safehouseCoinNextDepthPreviewType: import('./proceduralRunTree').ProceduralNodeType | null;
  /** Safehouse Coin — one unstable penalty dampened by 25%. */
  safehouseCoinStabilizePayloadActive: boolean;
  /** Field Rations — combats remaining with Well-Fed (+20 stamina). */
  wellFedCombatsRemaining: number;
}

export interface KeepsakeDebriefSummary {
  keepsakeId: KeepsakeId;
  name: string;
  shortName: string;
  effectSummary: string;
  triggered: boolean;
  triggerCount: number;
  messages: string[];
  statLines: string[];
  note: string | null;
}
