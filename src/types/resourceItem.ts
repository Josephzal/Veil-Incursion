import type { SectorId } from './worldState';

export type ResourceItemId =
  | 'ley-slag'
  | 'sanguine-ampoule'
  | 'encrypted-grid-drive'
  | 'legion-blood-iron'
  | 'anomalous-core'
  | 'echo-glass-shard'
  | 'veil-ash-canister'
  | 'smugglers-ledger'
  | 'ossified-ley-knot'
  | 'sealed-containment-casket'
  | 'tarnished-dog-tags'
  | 'combustion-cylinder'
  /** Resource Expansion Phase A */
  | 'nullcrete-shard'
  | 'mycelial-ichor'
  | 'cinder-wire'
  | 'rail-capacitor'
  | 'containment-seal'
  | 'resonant-filament'
  | 'anchor-marrow'
  | 'breach-thread'
  | 'blacksite-specimen-jar';

export type ResourceItemType = 'RESOURCE';

/** Broad resource class for contracts, debrief grouping, and cargo rules. */
export type ResourceCategory = 'STABLE' | 'UNSTABLE' | 'INTEL' | 'CONTRABAND';

/** Player-facing loot rarity band for UI / drop guidance. */
export type ResourceRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'APEX';

/** Primary gameplay role — category alone does not decide behavior. */
export type ResourcePrimaryRole =
  | 'CRAFTING_MATERIAL'
  | 'SCANNER_INTEL'
  | 'ECONOMY_INTEL'
  | 'FENCE_VALUE'
  | 'APEX_CARGO'
  | 'VOLATILE_CARGO'
  | 'OCCULT_CARGO'
  | 'EXPLOSIVE_MATERIAL'
  | 'UNIDENTIFIED_CONTAINER';

/** Fine-grained usage tags for contract generation and system eligibility. */
export type ResourceUsageTag =
  | 'STABLE'
  | 'UNSTABLE'
  | 'INTEL'
  | 'CONTRABAND'
  | 'CRAFTING_MATERIAL'
  | 'CONTRACT_TARGET'
  | 'FENCE_VALUE'
  | 'ECONOMY_INTEL'
  | 'SCANNER_INTEL'
  | 'WEAPON_BLUEPRINT_MATERIAL'
  | 'STARTING_REQUISITION_MATERIAL'
  | 'APEX_CARGO'
  | 'UNIDENTIFIED_CONTAINER'
  | 'OPERATION_TARGET'
  | 'SPONSOR_TURN_IN'
  | 'COMMON_MATERIAL'
  | 'OCCULT_MATERIAL'
  | 'CONSUMABLE_MATERIAL'
  | 'EXPLOSIVE_MATERIAL'
  | 'SCANNER_MATERIAL'
  | 'ECHO_MATERIAL'
  | 'LEGION_MATERIAL'
  | 'MASTERWORK_MATERIAL'
  | 'MUTATION_MATERIAL'
  | 'VOLATILE_CARGO'
  | 'OCCULT_CARGO'
  | 'APPRAISABLE'
  /** Resource Expansion Phase A — sector / role identity tags */
  | 'SECTOR_MATERIAL'
  | 'DEFENSIVE_MATERIAL'
  | 'ARMOR_MATERIAL'
  | 'SURVIVAL_MATERIAL'
  | 'BIOLOGICAL_MATERIAL'
  | 'EXTRACTION_MATERIAL'
  | 'SIGNAL_MATERIAL'
  | 'TECH_MATERIAL'
  | 'INDUSTRIAL_MATERIAL'
  | 'WEAPON_MATERIAL'
  | 'CONTAINMENT_MATERIAL'
  | 'APPRAISAL_MATERIAL'
  | 'RESONANCE_MATERIAL'
  | 'CHOIR_RESOURCE'
  | 'ANCHOR_MATERIAL'
  | 'HIGH_VALUE_RESOURCE'
  | 'DEPTH_MATERIAL'
  | 'BREACH_MATERIAL'
  | 'NULL_ZONE_RESOURCE'
  | 'ABYSSAL_SINK_RESOURCE'
  | 'ASHEN_WASTE_RESOURCE'
  | 'SLAG_WORKS_RESOURCE'
  | 'BLACKLINE_TERMINUS_RESOURCE'
  | 'SEALED_CARGO'
  | 'BLACKSITE_CARGO';

export interface ResourceItemDefinition {
  id: ResourceItemId;
  /** Full display name for detail views. */
  name: string;
  /** Compact label for chips, cards, and cramped UI. */
  shortName: string;
  /** Player-facing description for tooltips and contract copy. */
  description?: string;
  category: ResourceCategory;
  primaryRole: ResourcePrimaryRole;
  usageTags: readonly ResourceUsageTag[];
  /** Drop / UI rarity band. */
  rarity: ResourceRarity;
  /** Short player-facing source guidance (crafting missing hints, UI). */
  sourceHint: string;
  /** At least two intended systems / recipe / economy uses (validation). */
  intendedUses: readonly string[];
  gridWidth: number;
  gridHeight: number;
  maxStack: number;
  /** In-run cargo extraction / market friction value. */
  baseCapitalValue: number;
  /** Hub fence sell price in Cabal Credits. 0 when not fence-eligible. */
  sellValue: number;
  /** Legacy influence yield metadata (deprecated donation system). */
  ipValue: number;
  itemType: ResourceItemType;
  canBeCraftingIngredient: boolean;
  canBeSoldToFence: boolean;
  canBeContractTarget: boolean;
  canBeOperationTarget: boolean;
  canBeBankedAtSafehouse: boolean;
  requiresExtractionForValue: boolean;
  lostOnDeathIfUnbanked: boolean;
  canStack: boolean;
  /** Future hook — unboxing/appraisal at hub. */
  canOpenAtHub: boolean;
  canOpenInRun: boolean;
  /** Sectors where this resource can appear — used for contract validation. */
  validSectorIds: readonly SectorId[];
}

export type ResourceQuantity = Partial<Record<ResourceItemId, number>>;

export interface ResourceBundle {
  items: ReadonlyArray<{ id: ResourceItemId; quantity: number }>;
}

export type ResourceCacheId = 'smuggling_drop_stealth';

/** Fence-eligible resources — derived at runtime via getFenceableResourceIds(). */
export type FenceableResourceId = ResourceItemId;
