import type { ClassType } from './game';
import type {
  UniversalCastPlanOverlay,
  UniversalGraftDefinition,
} from './universalGraft';
import { emptyUniversalCastPlanOverlay } from './universalGraft';

export type HexShotGraftId = string;

export type EnvoyGraftId = string;

export type OperativeClassGraftId = HexShotGraftId | EnvoyGraftId;

export type ClassGraftDamageScale = 'MISSING_AMMO' | 'MISSING_FLUX' | 'CURRENT_FLUX';

export interface ClassGraftDefinition extends UniversalGraftDefinition {
  damageMultiplier?: number;
  baseDamageMultiplier?: number;
  staminaPenalty?: number;
  setApCost?: number;
  addApCost?: number;
  addHpCost?: number;
  duplicateCast?: number;
  hitCount?: number;
  convertToTrueDamage?: boolean;
  applySelfDebuffOnSurvive?: string;
  applySelfDebuff?: string;
  applyDebuffToTarget?: string;
  addTag?: string;
  removeTags?: readonly string[];
  modifyTagFrom?: string;
  modifyTagTo?: string;
  setAmmoCost?: number;
  ammoCostMultiplier?: number;
  addAmmoCost?: number;
  refundAmmoOnKill?: boolean;
  refundApOnKill?: boolean;
  refundApOnCrit?: boolean;
  setFluxCost?: number;
  /** Additional Veil-Flux % consumed on cast (burn-rate economy). */
  addFluxCost?: number;
  /** Overrides or sets Veil-Flux % restored on cast. */
  setFluxRegen?: number;
  /** @deprecated Use addFluxCost */
  setFluxGen?: number;
  /** @deprecated Use addFluxCost */
  addFluxGeneration?: number;
  reduceDamage?: number;
  healPercentageOfDamage?: number;
  reduceMaxHp?: number;
  addBuff?: string;
  randomTarget?: boolean;
  consumeAllAmmo?: boolean;
  damageScale?: ClassGraftDamageScale;
  convertToAoE?: boolean;
  dealSelfDamage?: number;
  executeThreshold?: number;
  /** Legacy cast-plan multiplier; universal upgrades leave it neutral. */
  bossDamageMultiplier?: number;
  setCritChance?: number;
  disableUltimate?: boolean;
  selfDebuffOnFail?: string;
  dropLootOnKill?: string;
  /** Manual Phase-Shift Reload ejects remaining rounds as kinetic AoE. */
  deadMansSwitchOnReload?: boolean;
}

/** Run-scoped grafts keyed by canonical weapon-action or selected Flex id. */
export type HexShotAbilityGraftMap = Partial<Record<string, HexShotGraftId>>;

/** Run-scoped grafts keyed by canonical weapon-action or selected Flex id. */
export type EnvoyAbilityGraftMap = Partial<Record<string, EnvoyGraftId>>;

export interface ClassGraftCastPlan extends UniversalCastPlanOverlay {
  apCost: number;
  hpCostPct: number;
  extraStaminaCost: number;
  ammoCost: number;
  ammoCostMultiplier: number;
  fluxRegen: number;
  fluxCost: number;
  damageMultiplier: number;
  baseDamageMultiplier: number;
  hitCount: number;
  duplicateCastRatio: number;
  forceTrueDamage: boolean;
  effectiveTags: readonly string[];
  healOnDamagePct: number;
  grantShieldHits: number;
  refundApOnKill: boolean;
  refundApOnCrit: boolean;
  refundAmmoOnKill: boolean;
  failDebuff: string | null;
  executeThreshold: number | null;
  bossDamageMultiplier: number;
  guaranteedCrit: boolean;
  randomTarget: boolean;
  consumeAllAmmo: boolean;
  damageScale: ClassGraftDamageScale | null;
  convertToAoE: boolean;
  dealSelfDamage: number;
  targetDebuff: string | null;
  selfDebuff: string | null;
  selfDebuffOnSurvive: string | null;
  evadeBuffPct: number;
  untargetableBuff: boolean;
  disableUltimate: boolean;
  dropLootOnKill: string | null;
  graftName: string;
}

export function defaultClassGraftCastPlan(
  apCost: number,
  ammoCost: number,
  fluxRegen: number,
  fluxCost: number,
  tags: readonly string[],
): ClassGraftCastPlan {
  return {
    ...emptyUniversalCastPlanOverlay(),
    apCost,
    hpCostPct: 0,
    extraStaminaCost: 0,
    ammoCost,
    ammoCostMultiplier: 1,
    fluxRegen,
    fluxCost,
    damageMultiplier: 1,
    baseDamageMultiplier: 1,
    hitCount: 1,
    duplicateCastRatio: 0,
    forceTrueDamage: false,
    effectiveTags: tags,
    healOnDamagePct: 0,
    grantShieldHits: 0,
    refundApOnKill: false,
    refundApOnCrit: false,
    refundAmmoOnKill: false,
    failDebuff: null,
    executeThreshold: null,
    bossDamageMultiplier: 1,
    guaranteedCrit: false,
    randomTarget: false,
    consumeAllAmmo: false,
    damageScale: null,
    convertToAoE: false,
    dealSelfDamage: 0,
    targetDebuff: null,
    selfDebuff: null,
    selfDebuffOnSurvive: null,
    evadeBuffPct: 0,
    untargetableBuff: false,
    disableUltimate: false,
    dropLootOnKill: null,
    graftName: '',
  };
}

export function getActiveClassGraftOffers(
  classId: ClassType,
  offers: readonly OperativeClassGraftId[] | null,
): readonly OperativeClassGraftId[] {
  return offers ?? [];
}
