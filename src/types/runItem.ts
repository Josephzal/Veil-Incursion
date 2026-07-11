import type { CargoItemId } from './cargoGrid';
import type { ResourceItemId } from './resourceItem';

/** One-use combat consumables and field tools — separate from Bound Requisitions and cargo grid loot. */
export type RunItemId =
  | 'standard-coagulant'
  | 'trauma-patch'
  | 'grave-dust-ampoule'
  | 'spall-weave-vest'
  | 'grid-cracker-mag'
  | 'eclipse-flare'
  | 'veil-ash-grenade'
  | 'rigged-combustion-cylinder'
  | 'mirror-salt-vial'
  | 'bloodwire-tourniquet'
  | 'null-space-injector'
  | 'black-iron-wedge'
  | 'razorwire-spool'
  | 'voidglass-decoy'
  | 'broker-flashcard'
  | 'relay-spike'
  | 'sonar-ping'
  | 'null-lens-filter'
  | 'dead-drop-token'
  | 'ash-seal-canister'
  | 'containment-foam'
  | 'ley-slag-splitter'
  | 'echo-tuning-fork'
  | 'anchor-needle';

export type RunItemFamily = 'COMBAT_CONSUMABLE' | 'FIELD_TOOL';

export type RunItemSlotType = 'COMBAT' | 'FIELD';

export type RunItemUsableContext =
  | 'COMBAT'
  | 'SCANNER'
  | 'CARGO'
  | 'BLACK_MARKET'
  | 'RESOURCE_NODE'
  | 'ECHO_NODE'
  | 'ANCHOR_NODE';

export type RunItemTag =
  | 'HEALING'
  | 'SURVIVAL'
  | 'CLEANSE'
  | 'STAMINA'
  | 'AP'
  | 'TEMPO'
  | 'SHIELD'
  | 'AOE'
  | 'ARMOR_BREAK'
  | 'KINETIC'
  | 'RISK'
  | 'WARD_BREAK'
  | 'OCCULT'
  | 'CONTROL'
  | 'GRID_CONTROL'
  | 'INTERRUPT'
  | 'SCANNER'
  | 'RECON'
  | 'CARGO'
  | 'EXTRACTION'
  | 'UNSTABLE_CARGO'
  | 'RESOURCE'
  | 'ECHO'
  | 'ANCHOR'
  | 'OPERATION'
  | 'MARKET'
  | 'ECONOMY'
  | 'ROUTE';

/** Engine behavior key — resolved in Phase C/D combat and field engines. */
export type RunItemUseBehavior =
  | 'heal_percent'
  | 'trauma_cleanse'
  | 'grave_dust_surge'
  | 'spall_weave_shield'
  | 'grid_cracker_armor_break'
  | 'eclipse_flare_ward_break'
  | 'veil_ash_grenade'
  | 'rigged_combustion_delayed'
  | 'mirror_salt_echo'
  | 'bloodwire_tourniquet'
  | 'null_space_injector'
  | 'black_iron_wedge'
  | 'razorwire_spool'
  | 'voidglass_decoy'
  | 'broker_flashcard'
  | 'relay_spike'
  | 'sonar_ping'
  | 'null_lens_filter'
  | 'dead_drop_token'
  | 'ash_seal_canister'
  | 'containment_foam'
  | 'ley_slag_splitter'
  | 'echo_tuning_fork'
  | 'anchor_needle';

export interface RunItemRecipeRequirement {
  resourceId: ResourceItemId;
  quantity: number;
}

export interface RunItemDefinition {
  id: RunItemId;
  /** Optional snake_case or legacy catalog aliases for migration. */
  legacyIds?: readonly string[];
  name: string;
  shortName: string;
  family: RunItemFamily;
  category: string;
  description: string;
  flavorText?: string;
  effectSummary: string;
  recipe: readonly RunItemRecipeRequirement[];
  marketPrice: number;
  canCraft: boolean;
  canBuy: boolean;
  canFind: boolean;
  stackLimit: number;
  slotType: RunItemSlotType;
  usableContexts: readonly RunItemUsableContext[];
  tags: readonly RunItemTag[];
  useBehavior: RunItemUseBehavior;
  triggerText: string;
  riskText?: string;
  /** Optional validation rule ids checked by runItemValidation. */
  validation?: readonly string[];
  debriefTextBuilder?: (stats: RunItemRuntimeStats) => string | null;
}

/** Dedicated run-item slot inventory — never stored in the cargo grid. */
export interface RunItemsSlotState {
  combatSlots: [RunItemId | null, RunItemId | null];
  fieldSlots: [RunItemId | null, RunItemId | null];
}

export type EchoTuningForkMode = 'SOOTHE' | 'LISTEN' | 'PROVOKE';
export type AnchorNeedleMode = 'PIN' | 'PIERCE' | 'EXTRACT';
export type RelaySpikeAction = 'BOOST_SIGNAL' | 'CACHE_ROUTE' | 'EMERGENCY_PING';

export type RunItemFieldChoiceKind =
  | 'relay_spike_action'
  | 'echo_tuning_fork'
  | 'anchor_needle';

export interface RunItemFieldChoiceOption {
  value: string;
  label: string;
  detail: string;
}

export interface RunItemFieldChoice {
  kind: RunItemFieldChoiceKind;
  prompt: string;
  nodeId?: string;
  options: readonly RunItemFieldChoiceOption[];
}

export interface RunItemAshSealState {
  targetEffectId: import('./unstableCargoEffects').UnstableCargoEffectId;
  armedAtDepth: number;
  cracked: boolean;
}

export interface RunItemPendingEffect {
  kind: string;
  itemId?: RunItemId;
  expiresAt?: 'end_of_player_turn' | 'start_of_next_player_turn' | 'next_enemy_action' | 'combat_end' | 'next_harvest';
  payload?: Record<string, unknown>;
}

export interface RunItemRuntimeStats {
  hpRestoredByItems: number;
  damagePreventedByItems: number;
  debuffsClearedByItems: number;
  armorStrippedByItems: number;
  wardsStrippedByItems: number;
  staminaRestoredByItems: number;
  apGrantedByItems: number;
  enemyActionsInterrupted: number;
  scannerRevealsByItems: number;
  riskAddedByItems: number;
  cargoBankedByItems: number;
  cargoPreservedByItems: number;
  unstablePenaltiesReducedByItems: number;
  resourceBonusRollsByItems: number;
  creditsSavedByItems: number;
  triggerCount: number;
}

export type RunItemOfferSource = 'HUB_LOADOUT' | 'FIND' | 'BUY' | 'CRAFT' | 'DEBUG';

export type RunItemOfferResolution =
  | 'replace'
  | 'discard'
  | 'use_now'
  | 'cancel_purchase';

export interface RunItemPendingOffer {
  itemId: RunItemId;
  source: RunItemOfferSource;
  slotType: RunItemSlotType;
  /** Run credits already charged — refunded on cancel_purchase. */
  purchaseCost?: number;
}

export interface RunItemRuntime {
  combatItemsUsedThisTurn: number;
  bloodwireUsedThisCombat: boolean;
  mirrorSaltUsedThisTurn: boolean;
  scannerNoise: number;
  messages: string[];
  pendingEffects: RunItemPendingEffect[];
  stats: RunItemRuntimeStats;
  /** Relay Spike — applied on next scanner generation when node mutation is deferred. */
  pendingRelayModifier: {
    plantedNodeId: string;
    relayAction: 'BOOST_SIGNAL' | 'CACHE_ROUTE' | 'EMERGENCY_PING' | null;
  } | null;
  /** Broker Flashcard — marked shelf item id after reroll. */
  brokerMarkedItemId: CargoItemId | null;
  /** Slot-full flow — player must replace, discard, use-now, or cancel purchase. */
  pendingOffer: RunItemPendingOffer | null;
  /** Containment Foam — first cargo-loss event breaks foam instead of removing item. */
  foamedCargoInstanceId: string | null;
  /** Ash-Seal — dampens one unstable cargo downside until depth transition. */
  ashSeal: RunItemAshSealState | null;
  /** Ley-Slag Splitter armed for the current resource harvest. */
  leySlagSplitterArmed: boolean;
  /** Dead-Drop Token — route risk fires on next combat engage. */
  deadDropRiskPending: boolean;
  /** Echo Tuning Fork mode selected for the next echo resolution. */
  echoTuningMode: EchoTuningForkMode | null;
  /** Anchor Needle mode selected for the next anchor signal clear. */
  anchorNeedleMode: AnchorNeedleMode | null;
  /** Field-tool mode modal (relay payoff / echo / anchor). */
  pendingFieldChoice: RunItemFieldChoice | null;
}

export const RUN_ITEM_COMBAT_SLOT_COUNT = 2;
export const RUN_ITEM_FIELD_SLOT_COUNT = 2;

/** Bound Requisition / augment ids that must never appear in the Run Item registry. */
export const FORBIDDEN_RUN_ITEM_IDS = [
  'chalk-line-ward',
  'adrenaline-primer',
  'scanner-override',
  'smugglers-pockets',
] as const;

export const ALL_RUN_ITEM_IDS: readonly RunItemId[] = [
  'standard-coagulant',
  'trauma-patch',
  'grave-dust-ampoule',
  'spall-weave-vest',
  'grid-cracker-mag',
  'eclipse-flare',
  'veil-ash-grenade',
  'rigged-combustion-cylinder',
  'mirror-salt-vial',
  'bloodwire-tourniquet',
  'null-space-injector',
  'black-iron-wedge',
  'razorwire-spool',
  'voidglass-decoy',
  'broker-flashcard',
  'relay-spike',
  'sonar-ping',
  'null-lens-filter',
  'dead-drop-token',
  'ash-seal-canister',
  'containment-foam',
  'ley-slag-splitter',
  'echo-tuning-fork',
  'anchor-needle',
] as const;

export const RUN_ITEM_COMBAT_IDS: readonly RunItemId[] = ALL_RUN_ITEM_IDS.slice(0, 14);
export const RUN_ITEM_FIELD_IDS: readonly RunItemId[] = ALL_RUN_ITEM_IDS.slice(14);

export function createDefaultRunItemRuntimeStats(): RunItemRuntimeStats {
  return {
    hpRestoredByItems: 0,
    damagePreventedByItems: 0,
    debuffsClearedByItems: 0,
    armorStrippedByItems: 0,
    wardsStrippedByItems: 0,
    staminaRestoredByItems: 0,
    apGrantedByItems: 0,
    enemyActionsInterrupted: 0,
    scannerRevealsByItems: 0,
    riskAddedByItems: 0,
    cargoBankedByItems: 0,
    cargoPreservedByItems: 0,
    unstablePenaltiesReducedByItems: 0,
    resourceBonusRollsByItems: 0,
    creditsSavedByItems: 0,
    triggerCount: 0,
  };
}

export function createDefaultRunItemsSlotState(): RunItemsSlotState {
  return {
    combatSlots: [null, null],
    fieldSlots: [null, null],
  };
}

export interface RunItemDebriefSummary {
  itemsSlotted: RunItemId[];
  itemsBrought: RunItemId[];
  combatSlotted: RunItemId[];
  fieldSlotted: RunItemId[];
  combatBrought: RunItemId[];
  fieldBrought: RunItemId[];
  triggered: boolean;
  triggerCount: number;
  messages: string[];
  riskLines: string[];
  statLines: string[];
  note: string | null;
}

export function createDefaultRunItemRuntime(): RunItemRuntime {
  return {
    combatItemsUsedThisTurn: 0,
    bloodwireUsedThisCombat: false,
    mirrorSaltUsedThisTurn: false,
    scannerNoise: 0,
    messages: [],
    pendingEffects: [],
    stats: createDefaultRunItemRuntimeStats(),
    pendingRelayModifier: null,
    brokerMarkedItemId: null,
    pendingOffer: null,
    foamedCargoInstanceId: null,
    ashSeal: null,
    leySlagSplitterArmed: false,
    deadDropRiskPending: false,
    echoTuningMode: null,
    anchorNeedleMode: null,
    pendingFieldChoice: null,
  };
}
