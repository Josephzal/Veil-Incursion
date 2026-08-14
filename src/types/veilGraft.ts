import type { AegisAbilityId, AbilityTag } from './aegisCombat';
import type { UniversalCastPlanOverlay, UniversalGraftDefinition } from './universalGraft';

export type VeilGraftId = string;

/**
 * Run-scoped Aegis graft map.
 * Phase D keys are encoded: `WA:<weaponActionId>` | `TECH:<techniqueId>`.
 * Legacy bare ability IDs may appear only as hydration input and are dropped/coerced at sanitize.
 */
export type AbilityGraftMap = Partial<Record<string, VeilGraftId>>;

export type GraftDamageScale = 'RESERVE_CONSUMED';

export interface VeilGraftDefinition extends UniversalGraftDefinition {
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

export interface GraftCastPlan extends UniversalCastPlanOverlay {
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
