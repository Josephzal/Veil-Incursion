import type { ResourceItemId } from './resourceItem';

/** Semantic tags for boon targeting and graft validation. */
export type AbilityTag =
  | 'KINETIC'
  | 'OCCULT'
  | 'MELEE'
  | 'RANGED'
  | 'AOE'
  | 'DEFENSIVE'
  | 'MOBILITY'
  | 'CONTROL'
  | 'DEBUFF'
  | 'FRACTURE'
  | 'ARMOR_PIERCE'
  | 'RESTORE'
  | 'BUFF'
  | 'SACRIFICE'
  | 'ULTIMATE'
  | 'TRUE_DAMAGE';

/** Hub stash resources required to permanently unlock an ability. Empty = no cost. */
export type AbilityUnlockCost = Partial<Record<ResourceItemId, number>>;

/** Aegis ability ids — Phase A wires STRIKE, VEIL_PIERCER, WRAITH_PARRY, ASHEN_MANTLE. */
export type AegisAbilityId =
  | 'STRIKE'
  | 'RUIN'
  | 'WRAITH_PARRY'
  | 'GRAVE_BIND'
  | 'SHADOW_STEP'
  | 'VEIL_PIERCER'
  | 'ASHEN_MANTLE'
  | 'NAIL_TO_GRID'
  | 'BLOOD_TITHE'
  | 'DEMONS_LUNG'
  | 'CRIMSON_PACT'
  | 'EVISCERATE'
  | 'DEVASTATE'
  | 'ABYSSAL_FAULT'
  | 'BLOOD_BOUND_CARAPACE'
  | 'REAVE';

export type AegisLoadout = readonly [
  AegisAbilityId,
  AegisAbilityId,
  AegisAbilityId,
  AegisAbilityId,
];

export type CombatUnitTag =
  | 'CONCUSSED'
  | 'DOOMED'
  | 'EXPOSED'
  | 'FRACTURED'
  | 'VULNERABLE'
  | 'BLINDED';

export type DamageChannel = 'KINETIC' | 'OCCULT' | 'TRUE';

export const PLAYER_ACTION_POINTS_PER_TURN = 3;
export const VOID_WARD_AP_COST = 1;
export const VOID_WARD_PERFECT_RESERVE_GAIN = 25;
export const RUNIC_BRAND_CAP = 3;

export const DEFAULT_AEGIS_LOADOUT: AegisLoadout = [
  'STRIKE',
  'WRAITH_PARRY',
  'VEIL_PIERCER',
  'RUIN',
];

export const ALL_AEGIS_ABILITIES: readonly AegisAbilityId[] = [
  'STRIKE',
  'RUIN',
  'WRAITH_PARRY',
  'GRAVE_BIND',
  'SHADOW_STEP',
  'VEIL_PIERCER',
  'ASHEN_MANTLE',
  'NAIL_TO_GRID',
  'BLOOD_TITHE',
  'DEMONS_LUNG',
  'CRIMSON_PACT',
  'EVISCERATE',
  'DEVASTATE',
  'ABYSSAL_FAULT',
  'BLOOD_BOUND_CARAPACE',
  'REAVE',
];
