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
  | 'ARMOR_BREAK'
  | 'WARD_BREAK'
  | 'WARD_PIERCE'
  | 'RESTORE'
  | 'BUFF'
  | 'SACRIFICE'
  | 'ULTIMATE'
  | 'TRUE_DAMAGE'
  /** Authoritative basic Strike — Riposte cash-out eligibility. */
  | 'STRIKE'
  /** Weapon-basic identity (Warden's / Paired / Unmaker strike). */
  | 'BASIC'
  /** Multi-contact authored action (Divergence / Severance). */
  | 'MULTI_HIT'
  /** Occupied-row sweep (Dread Horizon). */
  | 'AREA_ROW'
  /** Phase 2 — intent counterplay tags */
  | 'INTERRUPT'
  | 'PARRY'
  | 'GUARD_BREAK'
  | 'BLOCK'
  | 'BLIND'
  | 'SILENCE'
  /** Finisher / heavy strikes — bypass Thrall Slump on lethal. */
  | 'HEAVY'
  | 'EXECUTE'
  | 'FINISHER';

/** Hub stash resources required to permanently unlock an ability. Empty = no cost. */
export type AbilityUnlockCost = Partial<Record<ResourceItemId, number>>;

/** Shared Aegis techniques — exactly twelve. Loadout validation accepts only these. */
export type AegisTechniqueId =
  | 'RUIN'
  | 'VEIL_PIERCER'
  | 'DEVASTATE'
  | 'FINAL_MERCY'
  | 'GRAVE_BIND'
  | 'NAIL_TO_GRID'
  | 'SHADOW_STEP'
  | 'REAVE'
  | 'ASHEN_MANTLE'
  | 'RUNEBOUND_CARAPACE'
  | 'DEMONS_LUNG'
  | 'CRIMSON_PACT';

/** Weapon-owned actions — derived from family; never stored in technique loadout. */
export type AegisWeaponActionId =
  | 'WARDENS_STRIKE'
  | 'RUPTURE'
  | 'DREADBIND'
  | 'NO_RESPITE'
  | 'PAIRED_BLADES_STRIKE'
  | 'DIVERGENCE'
  | 'ECLIPSE'
  | 'SEVERANCE'
  | 'UNMAKER_STRIKE'
  | 'DREAD_HORIZON'
  | 'UNBOWED'
  | 'DOOMFALL';

/** Fixed class mechanic — not part of technique loadout. */
export type AegisIntrinsicId = 'WRAITH_PARRY';

/** Weapon ultimates — derived from equipped family. */
export type AegisWeaponUltimateId =
  | 'ABYSSAL_VERDICT'
  | 'REND_THE_VEIL'
  | 'GRAVEFALL';

/**
 * Legacy combat-catalog ability ids still referenced by migration / Ultimates /
 * intrinsic Parry. Not valid technique-loadout entries.
 * Retired technique IDs (BLOOD_TITHE, ABYSSAL_FAULT, BLOOD_BOUND_CARAPACE) are
 * migration strings only — not members of this union.
 */
export type AegisLegacyCombatAbilityId =
  | 'STRIKE'
  | 'WRAITH_PARRY'
  | 'EVISCERATE'
  | AegisTechniqueId;

/** @deprecated Prefer AegisTechniqueId / AegisWeaponActionId / AegisIntrinsicId. */
export type AegisAbilityId = AegisLegacyCombatAbilityId;

/** Persisted technique selection — exactly three unique techniques. */
export type AegisTechniqueLoadout = readonly [
  AegisTechniqueId,
  AegisTechniqueId,
  AegisTechniqueId,
];

/**
 * @deprecated Phase A temporary combat view only — do not persist.
 * Prefer deriving weapon actions + techniques separately (Phase B+).
 */
export type AegisLoadout = readonly [
  AegisAbilityId,
  AegisAbilityId,
  AegisAbilityId,
  AegisAbilityId,
];

export type AegisTechniqueCategory = 'BRAND' | 'AP_UTILITY';

export type CombatUnitTag =
  | 'CONCUSSED'
  | 'DOOMED'
  | 'EXPOSED'
  | 'FRACTURED'
  | 'ROOTED'
  | 'VULNERABLE'
  | 'BLINDED';

export type DamageChannel = 'KINETIC' | 'OCCULT' | 'TRUE';

export const PLAYER_ACTION_POINTS_PER_TURN = 3;
export const VOID_WARD_AP_COST = 1;
export const VOID_WARD_PERFECT_RESERVE_GAIN = 25;
export const RUNIC_BRAND_CAP = 3;

export const ALL_AEGIS_TECHNIQUES: readonly AegisTechniqueId[] = [
  'RUIN',
  'VEIL_PIERCER',
  'DEVASTATE',
  'FINAL_MERCY',
  'GRAVE_BIND',
  'NAIL_TO_GRID',
  'SHADOW_STEP',
  'REAVE',
  'ASHEN_MANTLE',
  'RUNEBOUND_CARAPACE',
  'DEMONS_LUNG',
  'CRIMSON_PACT',
] as const;

export const AEGIS_BRAND_TECHNIQUES: readonly AegisTechniqueId[] = [
  'RUIN',
  'VEIL_PIERCER',
  'DEVASTATE',
  'FINAL_MERCY',
  'DEMONS_LUNG',
  'CRIMSON_PACT',
] as const;

export const AEGIS_AP_UTILITY_TECHNIQUES: readonly AegisTechniqueId[] = [
  'GRAVE_BIND',
  'NAIL_TO_GRID',
  'SHADOW_STEP',
  'REAVE',
  'ASHEN_MANTLE',
  'RUNEBOUND_CARAPACE',
] as const;

export const DEFAULT_AEGIS_TECHNIQUE_LOADOUT: AegisTechniqueLoadout = [
  'RUIN',
  'GRAVE_BIND',
  'RUNEBOUND_CARAPACE',
];

/**
 * @deprecated Use DEFAULT_AEGIS_TECHNIQUE_LOADOUT.
 * Kept only for transitional call sites — not a combat deck.
 */
export const DEFAULT_AEGIS_LOADOUT: AegisLoadout = [
  'STRIKE',
  'RUIN',
  'GRAVE_BIND',
  'RUNEBOUND_CARAPACE',
];

/** Catalog keys for live combat definitions (no retired technique IDs). */
export const ALL_AEGIS_ABILITIES: readonly AegisAbilityId[] = [
  'STRIKE',
  'RUIN',
  'WRAITH_PARRY',
  'GRAVE_BIND',
  'SHADOW_STEP',
  'VEIL_PIERCER',
  'ASHEN_MANTLE',
  'NAIL_TO_GRID',
  'DEMONS_LUNG',
  'CRIMSON_PACT',
  'EVISCERATE',
  'DEVASTATE',
  'REAVE',
  'FINAL_MERCY',
  'RUNEBOUND_CARAPACE',
];
