import type { ClassType } from './game';

export type HexShotGraftId =
  | 'WIDOW_CHOKE_GRAFT'
  | 'HELL_FIRE_COMPENSATOR'
  | 'SILENT_VOID_SUPPRESSOR'
  | 'SPLITTER_BARREL_GRAFT'
  | 'BLOOD_MAG_GRAFT'
  | 'ECHO_RECEIVER_GRAFT'
  | 'BOTTOMLESS_DRUM_GRAFT'
  | 'SCAVENGER_BOLT_GRAFT'
  | 'OMNI_LENS_GRAFT'
  | 'ASTRAL_SIGHT_GRAFT'
  | 'GHOST_BEAM_GRAFT'
  | 'PRECOGNITIVE_SCOPE_GRAFT'
  | 'RICOCHET_DEFLECTOR_GRAFT'
  | 'NEUTRON_SEAR_GRAFT'
  | 'PARASITE_GRIP_GRAFT'
  | 'APEX_TRIGGER_GRAFT';

export type EnvoyGraftId =
  | 'VOID_CONDUCTOR_GRAFT'
  | 'SPLINTER_RUNE_GRAFT'
  | 'ECLIPSE_SIGIL_GRAFT'
  | 'BLOOD_INK_GRAFT'
  | 'AETHER_VALVE_GRAFT'
  | 'SANGUINE_CHANNEL_GRAFT'
  | 'ECHO_WEAVE_GRAFT'
  | 'NULL_STATE_GRAFT'
  | 'PARASITIC_SEAL_GRAFT'
  | 'WITHER_MARK_GRAFT'
  | 'GHOST_THREAD_GRAFT'
  | 'CHRONO_LOCK_GRAFT'
  | 'ANOMALY_SPARK_GRAFT'
  | 'OVERLOAD_CATALYST_GRAFT'
  | 'MARTYR_RUNE_GRAFT'
  | 'APEX_CHANNEL_GRAFT';

export type OperativeClassGraftId = HexShotGraftId | EnvoyGraftId;

export type ClassGraftDamageScale = 'MISSING_AMMO' | 'CURRENT_FLUX';

export interface ClassGraftDefinition {
  id: OperativeClassGraftId;
  classId: 'HEX_SHOT' | 'ENVOY';
  name: string;
  cost: number;
  description: string;
  accentColor: string;
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
  setFluxGen?: number;
  setFluxCost?: number;
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
  setCritChance?: number;
  disableUltimate?: boolean;
  selfDebuffOnFail?: string;
  dropLootOnKill?: string;
}

export type HexShotAbilityGraftMap = Partial<
  Record<import('./operativeClass').HexShotAbilityId, HexShotGraftId>
>;

export type EnvoyAbilityGraftMap = Partial<
  Record<import('./operativeClass').EnvoyAbilityId, EnvoyGraftId>
>;

export interface ClassGraftCastPlan {
  apCost: number;
  hpCostPct: number;
  extraStaminaCost: number;
  ammoCost: number;
  ammoCostMultiplier: number;
  fluxGen: number;
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
  graftName: string;
}

export function defaultClassGraftCastPlan(
  apCost: number,
  ammoCost: number,
  fluxGen: number,
  fluxCost: number,
  tags: readonly string[],
): ClassGraftCastPlan {
  return {
    apCost,
    hpCostPct: 0,
    extraStaminaCost: 0,
    ammoCost,
    ammoCostMultiplier: 1,
    fluxGen,
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
    graftName: '',
  };
}

export function getActiveClassGraftOffers(
  classId: ClassType,
  offers: readonly OperativeClassGraftId[] | null,
): readonly OperativeClassGraftId[] {
  return offers ?? [];
}
