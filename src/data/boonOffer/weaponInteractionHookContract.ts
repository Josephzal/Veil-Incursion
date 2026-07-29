/**
 * Phase 3I — frozen interaction-hook contract.
 * Only hooks with a proven runtime producer are eligible for hard matching / soft weighting.
 * Descriptive recommendation-only hooks are REJECTED from this contract.
 */
import type { WeaponAbilityInteractionHook } from '../../types/weaponLoadoutRecommendation';

export type InteractionHookCardinality =
  | 'PER_ACTION'
  | 'PER_HIT'
  | 'PER_TARGET'
  | 'PER_TURN'
  | 'PER_ENCOUNTER'
  | 'ARMED_CONSUME';

export type InteractionHookSource =
  | 'WEAPON_BASIC'
  | 'CLASS_MECHANIC'
  | 'EQUIPPED_ABILITY'
  | 'ALWAYS_AVAILABLE_CLASS';

export interface InteractionHookContractEntry {
  id: WeaponAbilityInteractionHook;
  /** File / symbol of the live producer. */
  runtimeProducer: string;
  eligibleConsumers: string;
  triggerTiming: string;
  cardinality: InteractionHookCardinality;
  sources: readonly InteractionHookSource[];
  resetBehavior: string;
  multiTargetBehavior: string;
  canFireMoreThanOncePerResolution: boolean;
  status: 'FROZEN' | 'REJECTED';
  rejectReason?: string;
}

export const WEAPON_INTERACTION_HOOK_CONTRACT: Record<
  WeaponAbilityInteractionHook,
  InteractionHookContractEntry
> = {
  WEAPON_BASIC: {
    id: 'WEAPON_BASIC',
    runtimeProducer: 'weaponBasicEngine.resolveAegisStrikeBasic|resolveHexBasicShot|resolveEnvoySplinterBasic',
    eligibleConsumers: 'Boons/abilities keyed to unique basic resolution',
    triggerTiming: 'On unique basic cast resolve',
    cardinality: 'PER_ACTION',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'None — fires each basic cast',
    multiTargetBehavior: 'Pulse spread resolves multiple hit payloads from one action',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  FRACTURE_SETUP: {
    id: 'FRACTURE_SETUP',
    runtimeProducer: 'weaponBasicEngine fractureGain + combatFractureEngine.applyFractureDamage',
    eligibleConsumers: 'Fracture-setup boons / loadout abilities',
    triggerTiming: 'When fracture gauge is applied on hit',
    cardinality: 'PER_HIT',
    sources: ['WEAPON_BASIC', 'EQUIPPED_ABILITY'],
    resetBehavior: 'Gauge persists until break/expire',
    multiTargetBehavior: 'Per target hit',
    canFireMoreThanOncePerResolution: true,
    status: 'FROZEN',
  },
  FRACTURE_BREAK: {
    id: 'FRACTURE_BREAK',
    runtimeProducer: 'TacticalCombatHub executeFractureBreak / resolveClaymoreFractureBreakReserve',
    eligibleConsumers: 'Break-cashout boons and Claymore Reserve',
    triggerTiming: 'When fracture gauge fills and break window resolves',
    cardinality: 'PER_TARGET',
    sources: ['CLASS_MECHANIC', 'WEAPON_BASIC'],
    resetBehavior: 'Break window expires after FRACTURE_BREAK_PROMPT_MS',
    multiTargetBehavior: 'Per fractured target',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  RESERVE_FLOW: {
    id: 'RESERVE_FLOW',
    runtimeProducer: 'TacticalCombatHub.chargeAr / aegis resource gains',
    eligibleConsumers: 'Reserve generation / spend boons',
    triggerTiming: 'On Reserve gain events',
    cardinality: 'PER_ACTION',
    sources: ['CLASS_MECHANIC', 'WEAPON_BASIC', 'EQUIPPED_ABILITY'],
    resetBehavior: 'Meter persists across actions',
    multiTargetBehavior: 'N/A (player meter)',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  RUNIC_BRAND: {
    id: 'RUNIC_BRAND',
    runtimeProducer: 'imprintRunicBrand / imprintRunicBrands (aegisResourceEngine)',
    eligibleConsumers: 'Brand spend abilities and related boons',
    triggerTiming: 'On qualifying imprint',
    cardinality: 'PER_ACTION',
    sources: ['CLASS_MECHANIC', 'EQUIPPED_ABILITY'],
    resetBehavior: `Capped imprint stacks`,
    multiTargetBehavior: 'Player brand count',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  RIFT_EDGE_TEMPO: {
    id: 'RIFT_EDGE_TEMPO',
    runtimeProducer: 'armRiftEdgeTempo / consumeRiftEdgeTempo → resolveAegisStrikeBasic',
    eligibleConsumers: 'Veil Edge Occult rider payoff',
    triggerTiming: 'Armed by evade/perfect parry; consumed on next basic',
    cardinality: 'ARMED_CONSUME',
    sources: ['WEAPON_BASIC', 'CLASS_MECHANIC'],
    resetBehavior: 'Cleared on consume or unequip',
    multiTargetBehavior: 'Single basic resolution',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  PARRY_EVADE_TEMPO: {
    id: 'PARRY_EVADE_TEMPO',
    runtimeProducer: 'Hub evade success + Void Ward perfect → armRiftEdgeTempo',
    eligibleConsumers: 'Veil Edge tempo arming',
    triggerTiming: 'On successful evade or perfect parry (Veil Edge equipped)',
    cardinality: 'PER_ACTION',
    sources: ['CLASS_MECHANIC', 'ALWAYS_AVAILABLE_CLASS'],
    resetBehavior: 'Arms tempo flag',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  STAMINA_PRESSURE: {
    id: 'STAMINA_PRESSURE',
    runtimeProducer: 'resolveAegisStrikeBasic / resolveHexBasicShot staminaCost',
    eligibleConsumers: 'Stamina-tax identity and related compensation',
    triggerTiming: 'On heavy basic resolve',
    cardinality: 'PER_ACTION',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'Stamina regenerates via class rules',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  RELOAD_PROTOCOL: {
    id: 'RELOAD_PROTOCOL',
    runtimeProducer: 'hexShotReducer HEX_RESOLVE_RELOAD / ActiveReloadOverlay',
    eligibleConsumers: 'Reload / Perfect Reload boons',
    triggerTiming: 'On reload resolve',
    cardinality: 'PER_ACTION',
    sources: ['CLASS_MECHANIC', 'ALWAYS_AVAILABLE_CLASS'],
    resetBehavior: 'Magazine refill; Perfect vs Normal result',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  PROTOCOL_CHARGE: {
    id: 'PROTOCOL_CHARGE',
    runtimeProducer: 'HEX_RESOLVE_RELOAD PERFECT → protocolCharges; evaluateZeroProtocolReady',
    eligibleConsumers: 'Protocol Charge / weapon ultimate routes (Carbine Zero Protocol + Hex siblings)',
    triggerTiming: 'On Perfect Reload only',
    cardinality: 'PER_ACTION',
    sources: ['CLASS_MECHANIC'],
    resetBehavior: 'Charges accumulate to ZP threshold; ZP spends charges',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  ARMOR_PRESSURE: {
    id: 'ARMOR_PRESSURE',
    runtimeProducer: 'resolveHexBasicShot innateArmorPressureLayers → stripKineticArmor',
    eligibleConsumers: 'Armor-break boons / Nullbreach identity',
    triggerTiming: 'On Nullbreach basic hit',
    cardinality: 'PER_HIT',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'Armor layers persist until stripped',
    multiTargetBehavior: 'Primary target',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  SPREAD_CLUSTER: {
    id: 'SPREAD_CLUSTER',
    runtimeProducer: "resolveHexBasicShot delivery:'SPREAD' (Pulse)",
    eligibleConsumers: 'AoE/spread boons',
    triggerTiming: 'On Pulse basic cast',
    cardinality: 'PER_HIT',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'None',
    multiTargetBehavior: '1 primary + up to 2 adjacent; no missing-hit redirect',
    canFireMoreThanOncePerResolution: true,
    status: 'FROZEN',
  },
  ASH_SALVO_BURST: {
    id: 'ASH_SALVO_BURST',
    runtimeProducer: 'hexShotAbilityExecutor ASH_JACKET_SALVO',
    eligibleConsumers: 'Salvo-specific / AoE burst support',
    triggerTiming: 'On Ash Jacket Salvo cast',
    cardinality: 'PER_ACTION',
    sources: ['EQUIPPED_ABILITY'],
    resetBehavior: 'None',
    multiTargetBehavior: 'Ability targeting rules',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  CLEAN_CATALYST_CYCLE: {
    id: 'CLEAN_CATALYST_CYCLE',
    runtimeProducer: 'resolveEnvoySplinterBasic cleanCatalystCycle (NULL/BLOOD → Splinter)',
    eligibleConsumers: 'Conduit Clean Cycle support',
    triggerTiming: 'When Conduit Splinter follows NULL/BLOOD catalyst',
    cardinality: 'PER_ACTION',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'Per sequenced cast',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  FLUX_CYCLE: {
    id: 'FLUX_CYCLE',
    runtimeProducer: 'envoyAbilityExecutor fluxDelta / envoyCatalystEngine',
    eligibleConsumers: 'Flux spend/restore boons',
    triggerTiming: 'On Envoy casts that change Flux',
    cardinality: 'PER_ACTION',
    sources: ['CLASS_MECHANIC', 'WEAPON_BASIC', 'EQUIPPED_ABILITY'],
    resetBehavior: 'Flux meter persists',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  ROT_SETUP: {
    id: 'ROT_SETUP',
    runtimeProducer: 'resolveEnvoySplinterBasic rotStacks → infectVeilRot',
    eligibleConsumers: 'Lantern Rot setup',
    triggerTiming: 'On Lantern basic',
    cardinality: 'PER_TARGET',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'Rot stacks persist until detonation/death',
    multiTargetBehavior: 'Primary target',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  ROT_DETONATION: {
    id: 'ROT_DETONATION',
    runtimeProducer: 'resolveLanternFluxPurgePayoff (weaponLanternRotPayoff)',
    eligibleConsumers: 'Delayed Rot cashout',
    triggerTiming: 'Separate FLUX_PURGE after Rot setup',
    cardinality: 'PER_TARGET',
    sources: ['EQUIPPED_ABILITY', 'WEAPON_BASIC'],
    resetBehavior: 'Consumes Rot stacks on detonation',
    multiTargetBehavior: 'Purge targeting',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  FLUX_PURGE_ROUTE: {
    id: 'FLUX_PURGE_ROUTE',
    runtimeProducer: 'envoyAbilityExecutor FLUX_PURGE',
    eligibleConsumers: 'Purge route + Lantern detonation',
    triggerTiming: 'On FLUX_PURGE cast',
    cardinality: 'PER_ACTION',
    sources: ['EQUIPPED_ABILITY'],
    resetBehavior: 'None',
    multiTargetBehavior: 'Ability targeting',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  BRINK_FLUX: {
    id: 'BRINK_FLUX',
    runtimeProducer: 'resolveEnvoySplinterBasic Prism brink branch (veilFlux ≤ threshold)',
    eligibleConsumers: 'Prism brink amplification',
    triggerTiming: 'On Prism basic while under brink threshold',
    cardinality: 'PER_ACTION',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'Conditional on current Flux',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  HP_SACRIFICE: {
    id: 'HP_SACRIFICE',
    runtimeProducer: 'resolveEnvoySplinterBasic hpSacrifice → applyHpSacrifice',
    eligibleConsumers: 'Prism sacrifice risk management',
    triggerTiming: 'On Prism basic',
    cardinality: 'PER_ACTION',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'HP persists; payoff only if sacrifice paid fully',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  EXECUTE_WINDOW: {
    id: 'EXECUTE_WINDOW',
    runtimeProducer: 'resolveHexBasicShot Sidearm low-HP amp (hpRatio ≤ 0.3)',
    eligibleConsumers: 'Execution / finishers',
    triggerTiming: 'On Sidearm basic vs low-HP target',
    cardinality: 'PER_HIT',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'Conditional on target HP',
    multiTargetBehavior: 'Primary',
    canFireMoreThanOncePerResolution: false,
    status: 'FROZEN',
  },
  DEFENSIVE_TEMPO: {
    id: 'DEFENSIVE_TEMPO',
    runtimeProducer: '—',
    eligibleConsumers: 'Recommendation taxonomy only',
    triggerTiming: 'N/A',
    cardinality: 'PER_ACTION',
    sources: ['EQUIPPED_ABILITY'],
    resetBehavior: 'N/A',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'REJECTED',
    rejectReason: 'No discrete runtime event emitter; ad-hoc per defensive ability',
  },
  CROWD_CONTROL: {
    id: 'CROWD_CONTROL',
    runtimeProducer: '—',
    eligibleConsumers: 'Recommendation taxonomy only',
    triggerTiming: 'N/A',
    cardinality: 'PER_ACTION',
    sources: ['EQUIPPED_ABILITY'],
    resetBehavior: 'N/A',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'REJECTED',
    rejectReason: 'No unified producer; CC is ability-local',
  },
  PRIORITY_TARGET: {
    id: 'PRIORITY_TARGET',
    runtimeProducer: 'isTargetUsefulForWeaponBasic (dead helper — never called)',
    eligibleConsumers: 'Recommendation taxonomy only',
    triggerTiming: 'N/A',
    cardinality: 'PER_TARGET',
    sources: ['WEAPON_BASIC'],
    resetBehavior: 'N/A',
    multiTargetBehavior: 'N/A',
    canFireMoreThanOncePerResolution: false,
    status: 'REJECTED',
    rejectReason: 'Helper exists but is not wired to live combat',
  },
};

export function listFrozenInteractionHooks(): WeaponAbilityInteractionHook[] {
  return (Object.keys(WEAPON_INTERACTION_HOOK_CONTRACT) as WeaponAbilityInteractionHook[]).filter(
    (id) => WEAPON_INTERACTION_HOOK_CONTRACT[id].status === 'FROZEN',
  );
}

export function listRejectedInteractionHooks(): WeaponAbilityInteractionHook[] {
  return (Object.keys(WEAPON_INTERACTION_HOOK_CONTRACT) as WeaponAbilityInteractionHook[]).filter(
    (id) => WEAPON_INTERACTION_HOOK_CONTRACT[id].status === 'REJECTED',
  );
}

export function isFrozenInteractionHook(id: string): id is WeaponAbilityInteractionHook {
  const entry = WEAPON_INTERACTION_HOOK_CONTRACT[id as WeaponAbilityInteractionHook];
  return Boolean(entry && entry.status === 'FROZEN');
}
