import type { ClassType } from './game';
import type { BoonHook } from './boonHooks';

export type ClassBoonTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';

export type HexShotBoonId =
  | 'HAIR_TRIGGER'
  | 'EXTENDED_MAGS'
  | 'DEPLETED_URANIUM_TIPS'
  | 'RECOIL_HARNESS'
  | 'SHRAPNEL_BLOOM'
  | 'SHATTER_RIFLING'
  | 'SUPPRESSIVE_FIRE'
  | 'DEAD_EYE'
  | 'EXECUTIONERS_CLIP'
  | 'HOLLOW_POINT_DEBRIS'
  | 'VOID_BANDOLEER'
  | 'CORRUPTED_CASINGS'
  | 'SIPHON_CHOKE'
  | 'ABYSSAL_PRIMERS'
  | 'ETHEREAL_MAGAZINES'
  | 'EVENT_HORIZON_ROUNDS'
  | 'CURSED_BALLISTICS'
  | 'PHANTOM_TRACER'
  | 'LEYLINE_PENETRATOR'
  | 'ECHOING_GUNFIRE'
  | 'FLAWLESS_DRILL'
  | 'CHEMICAL_WARFARE'
  | 'ADRENALINE_INJECTOR'
  | 'REACTIVE_CAMO'
  | 'GRID_SCRAMBLER'
  | 'AUTO_LOADER_DECK'
  | 'PANIC_BUTTON'
  | 'FLASH_BLIND_OPTICS'
  | 'KINETIC_DAMPENERS'
  | 'SURVIVALIST'
  | 'TACTICAL_RELOAD'
  | 'BREACH_AND_CLEAR'
  | 'OCCULT_ASSASSIN'
  | 'GUERILLA_WARFARE'
  | 'GUN_FU'
  | 'ZERO_POINT_EXTRACTION'
  | 'HOT_SWAP'
  | 'CURSED_SHRAPNEL'
  | 'OVERWATCH_MASTERY'
  | 'GUNSMITHS_CURSE'
  | 'SILVER_DISCIPLINE'
  | 'WRAITHGLASS_ETCHING'
  | 'COLD_CHAMBER';

export type EnvoyBoonId =
  | 'VOID_TOUCHED'
  | 'SHATTER_CAST'
  | 'ECHOING_AETHER'
  | 'LEYLINE_SURGE'
  | 'ASTRAL_PIERCER'
  | 'VOLATILE_MAGIC'
  | 'FLUX_CAPACITOR'
  | 'KINETIC_CONVERSION'
  | 'EXECUTIONERS_SPELL'
  | 'RESIDUAL_ENERGY'
  | 'CONTAGIOUS_HEX'
  | 'WITHERED_VIGOR'
  | 'PARASITIC_LINK'
  | 'HEAVY_GRAVITY'
  | 'DOOMED_FLESH'
  | 'MIND_PLAGUE'
  | 'CURSE_EATER'
  | 'FLESH_ROT'
  | 'VOID_MARKED'
  | 'AGONIZING_HEX'
  | 'PERFECTED_WARD'
  | 'MASOCHISTIC_CHANNEL'
  | 'SAFETY_VALVE'
  | 'ADRENALINE_CHANNEL'
  | 'PHASE_SHIFT'
  | 'EMERGENCY_VENT'
  | 'DEEP_RESERVES'
  | 'GLASS_CANNON'
  | 'BLOOD_MAGIC'
  | 'AETHERIC_BULWARK'
  | 'PENDULUM_SHIFT'
  | 'CURSED_AETHER'
  | 'WARD_WEAVER'
  | 'CATACLYSMIC_ECHO'
  | 'SINGULARITY_COLLAPSE'
  | 'VAMPIRIC_STEP'
  | 'HEX_BREAKER'
  | 'OVERLOAD_MASTERY'
  | 'RIFT_WALKER'
  | 'VOIDS_BARGAIN';

export type OperativeClassBoonId = HexShotBoonId | EnvoyBoonId;

export interface ClassBoonDefinition {
  id: OperativeClassBoonId;
  classId: 'HEX_SHOT' | 'ENVOY';
  name: string;
  tier: ClassBoonTier;
  tierLabel: string;
  description: string;
  effect: string;
  hook: BoonHook;
  tagAll?: readonly string[];
  tagAny?: readonly string[];
}

/** Unified offer shape for post-combat selection UI. */
export interface PostCombatBoonOffer {
  id: string;
  classId: ClassType;
  name: string;
  tier: ClassBoonTier | string;
  tierLabel: string;
  description: string;
  effect: string;
}

export interface HexShotBoonCombatModifiers {
  maxAmmoBonus: number;
  ballisticArmorPierce: number;
  /** Ballistic damage +% while overcharge multiplier is active (Recoil Harness). */
  ballisticOverchargeDamagePct: number;
  ballisticFracturedDamagePct: number;
  ballisticCritBonusFullMag: number;
  ballisticDamageMultiplier: number;
  voidAmmoHpCostPct: number;
  voidBacklineDamagePct: number;
  maxHpMultiplier: number;
  damageMultiplier: number;
  perfectReloadApBonus: boolean;
  autoLoaderOnStart: boolean;
  gunsmithsCurseActive: boolean;
  /** Sanctuary Bio-Stim heal bonus % (Survivalist). */
  sanctuaryHealBonusPct: number;
}

export interface EnvoyBoonCombatModifiers {
  spellDamageFluxBonusPct: number;
  fluxMaxCap: number;
  startingFluxPenalty: number;
  damageMultiplier: number;
  maxHpMultiplier: number;
  kineticArmorPer25Flux: number;
  fluxRegenShieldStacks: number;
  overloadMasteryCrit: boolean;
  pendulumDumpBonusPct: number;
  masochisticChannel: boolean;
}

export interface ClassBoonEncounterState {
  hairTriggerPending: boolean;
  executionersClipActive: boolean;
  reactiveCamoUsed: boolean;
  panicButtonUsed: boolean;
  breachAndClearPending: boolean;
  tacticalReloadPending: boolean;
  lastActionWasBallistic: boolean;
  lastActionConsumedFlux: boolean;
  lastActionRestoredFlux: boolean;
  lastActionWasSpell: boolean;
  pendulumShiftDamageBonus: boolean;
  deepReservesShieldActive: boolean;
  lastActionWasAoe: boolean;
  phantomTracerUnits: Record<string, number>;
  voidMarkedUnits: Record<string, boolean>;
  voidBleedTurns: Record<string, number>;
  suppressiveFireUnits: Record<string, boolean>;
  chemicalWarfareTurns: Record<string, number>;
  flashBlindDamageDebuff: Record<string, boolean>;
  guerillaEvadeTurnsRemaining: number;
  hotSwapPending: boolean;
  fluxShieldStacks: number;
  emergencyVentUsed: boolean;
  cursedUnitIds: Record<string, boolean>;
  wardWeaverCurseFree: boolean;
  vampiricLifestealPending: boolean;
  cataclysmicEchoUltBonus: number;
  voidsBargainFirstStrike: boolean;
  hexBreakerCurseTurns: Record<string, number>;
  heavyGravityApDrain: Record<string, number>;
}

export function createDefaultClassBoonEncounterState(): ClassBoonEncounterState {
  return {
    hairTriggerPending: false,
    executionersClipActive: false,
    reactiveCamoUsed: false,
    panicButtonUsed: false,
    breachAndClearPending: false,
    tacticalReloadPending: false,
    lastActionWasBallistic: false,
    lastActionConsumedFlux: false,
    lastActionRestoredFlux: false,
    lastActionWasSpell: false,
    pendulumShiftDamageBonus: false,
    deepReservesShieldActive: false,
    lastActionWasAoe: false,
    phantomTracerUnits: {},
    voidMarkedUnits: {},
    voidBleedTurns: {},
    suppressiveFireUnits: {},
    chemicalWarfareTurns: {},
    flashBlindDamageDebuff: {},
    guerillaEvadeTurnsRemaining: 0,
    hotSwapPending: false,
    fluxShieldStacks: 0,
    emergencyVentUsed: false,
    cursedUnitIds: {},
    wardWeaverCurseFree: false,
    vampiricLifestealPending: false,
    cataclysmicEchoUltBonus: 0,
    voidsBargainFirstStrike: true,
    hexBreakerCurseTurns: {},
    heavyGravityApDrain: {},
  };
}

export function defaultHexShotBoonModifiers(): HexShotBoonCombatModifiers {
  return {
    maxAmmoBonus: 0,
    ballisticArmorPierce: 0,
    ballisticOverchargeDamagePct: 0,
    ballisticFracturedDamagePct: 0,
    ballisticCritBonusFullMag: 0,
    ballisticDamageMultiplier: 1,
    voidAmmoHpCostPct: 0,
    voidBacklineDamagePct: 0,
    maxHpMultiplier: 1,
    damageMultiplier: 1,
    perfectReloadApBonus: false,
    autoLoaderOnStart: false,
    gunsmithsCurseActive: false,
    sanctuaryHealBonusPct: 0,
  };
}

export function defaultEnvoyBoonModifiers(): EnvoyBoonCombatModifiers {
  return {
    spellDamageFluxBonusPct: 0,
    fluxMaxCap: 100,
    startingFluxPenalty: 0,
    damageMultiplier: 1,
    maxHpMultiplier: 1,
    kineticArmorPer25Flux: 0,
    fluxRegenShieldStacks: 0,
    overloadMasteryCrit: false,
    pendulumDumpBonusPct: 0,
    masochisticChannel: false,
  };
}
