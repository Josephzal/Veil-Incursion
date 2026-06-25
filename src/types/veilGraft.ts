import type { AegisAbilityId, AbilityTag } from './aegisCombat';

export type VeilGraftId =
  | 'DENSITY_GRAFT'
  | 'SANGUINE_GRAFT'
  | 'ECHO_GRAFT'
  | 'VOID_GLASS_GRAFT'
  | 'NEUTRON_GRAFT'
  | 'IRON_LUNG_GRAFT'
  | 'GRID_HACKER_GRAFT'
  | 'SCAVENGER_GRAFT'
  | 'SHRAPNEL_GRAFT'
  | 'SPLINTER_GRAFT'
  | 'FLAYER_GRAFT'
  | 'CONDUIT_GRAFT'
  | 'MARROW_GRAFT'
  | 'MARTYR_GRAFT'
  | 'NULL_SPACE_GRAFT'
  | 'APEX_GRAFT';

/** Run-scoped graft applied to one loadout slot ability. */
export type AbilityGraftMap = Partial<Record<AegisAbilityId, VeilGraftId>>;

export type GraftDamageScale = 'RESERVE_CONSUMED';

export interface VeilGraftDefinition {
  id: VeilGraftId;
  name: string;
  cost: number;
  description: string;
  accentColor: string;
  damageMultiplier?: number;
  /** Flat Abyssal Reserve % tax applied on cast. */
  reservePenalty?: number;
  setApCost?: number;
  addHpCost?: number;
  addApCost?: number;
  duplicateCast?: number;
  removeTags?: readonly AbilityTag[];
  convertToTrueDamage?: boolean;
  applySelfDebuffOnSurvive?: string;
  consumeAllReserve?: boolean;
  damageScale?: GraftDamageScale;
  addReserveGeneration?: number;
  addCooldown?: number;
  refundApOnKill?: boolean;
  selfDebuffOnFail?: string;
  dropLootOnKill?: string;
  addTag?: AbilityTag;
  hitCount?: number;
  applyDebuffToTarget?: string;
  applySelfDebuff?: string;
  addOccultDamage?: number;
  /** Runic Brands consumed on cast. */
  brandTax?: number;
  healPercentageOfDamage?: number;
  grantShieldHits?: number;
  reduceMaxHp?: number;
  addBuff?: string;
  reduceReserveGeneration?: number;
  executeThreshold?: number;
  disableUltimate?: boolean;
  bossDamageMultiplier?: number;
}

export interface GraftCastPlan {
  apCost: number;
  hpCostPct: number;
  reservePenalty: number;
  consumeAllReserve: boolean;
  brandTax: number;
  damageMultiplier: number;
  bossDamageMultiplier: number;
  hitCount: number;
  duplicateCastRatio: number;
  forceTrueDamage: boolean;
  effectiveTags: readonly AbilityTag[];
  reserveGenerationBonus: number;
  cooldownTurns: number;
  healOnDamagePct: number;
  grantShieldHits: number;
  reserveGenerationMultiplier: number;
  refundApOnKill: boolean;
  failDebuff: string | null;
  executeThreshold: number | null;
  occultFlatBonus: number;
  targetDebuff: string | null;
  selfDebuff: string | null;
  evadeBuffPct: number;
  dropLootOnKill: string | null;
  graftName: string;
}
