import type { ClassType } from './game';
import type { AegisAbilityId, AegisTechniqueLoadout } from './aegisCombat';

/** Hex Shot deck ability ids. */
export type HexShotAbilityId =
  | 'SILVER_CORE_SIDEARM'
  | 'ZERO_PROTOCOL'
  | 'PHASE_SHIFT_RELOAD'
  | 'ASH_JACKET_SALVO'
  | 'SINGULARITY_SLUG'
  | 'PANOPTICON_PROTOCOL'
  | 'REVENANTS_ECHO'
  | 'RIFT_SNARE'
  | 'PHOSPHORUS_HEX'
  | 'NULL_SPACE_CLOAK'
  | 'GHOST_GRID_CAMO'
  | 'ASTRAL_TARGET_LOCK'
  | 'CINDERLINE_SATURATION'
  | 'BLACKSITE_TRIAGE'
  | 'BLEEDING_PAYLOAD'
  | 'WRAITH_PIERCER_ROUND'
  | 'BLOOD_TRACER_ROUND'
  | 'STASIS_LOCK_SLUG';

/**
 * W.2 — persisted Hex flex selections (exactly three).
 * Weapon actions are derived from the equipped family and never stored here.
 * Legacy 4-tuples `[SILVER_CORE_SIDEARM, f0, f1, f2]` are migrated by sanitizeHexFlexLoadout.
 */
export type HexFlexLoadout = readonly [
  HexShotAbilityId,
  HexShotAbilityId,
  HexShotAbilityId,
];

/** @deprecated Alias — HexShotLoadout is now the three-flex shape. */
export type HexShotLoadout = HexFlexLoadout;

/** Envoy deck ability ids. */
export type EnvoyAbilityId =
  | 'VEIL_SPLINTER'
  | 'CATACLYSM_SIGIL'
  | 'ASTRAL_LANCE'
  | 'NECROTIC_BLOOM'
  | 'FLUX_PURGE'
  | 'DIMENSIONAL_SHEAR'
  | 'RIFT_WARD'
  | 'PHASE_STEP'
  | 'AETHERIC_TRANSFUSION'
  | 'SOUL_TETHER'
  | 'ENTROPY_HEX'
  | 'FLESH_WARP'
  | 'PARALYTIC_MIASMA'
  | 'MIND_SUNDER';

/** Flex-eligible Envoy ability IDs (eleven). Weapon actions / anchor / intrinsics excluded. */
export type EnvoyFlexAbilityId =
  | 'ASTRAL_LANCE'
  | 'ENTROPY_HEX'
  | 'NECROTIC_BLOOM'
  | 'FLUX_PURGE'
  | 'DIMENSIONAL_SHEAR'
  | 'PHASE_STEP'
  | 'AETHERIC_TRANSFUSION'
  | 'SOUL_TETHER'
  | 'FLESH_WARP'
  | 'PARALYTIC_MIASMA'
  | 'MIND_SUNDER';

/**
 * E.3 — canonical persisted Envoy flex selections (exactly three).
 * Weapon actions are derived from the equipped family and never stored here.
 * Legacy 4-tuples `[VEIL_SPLINTER, f0, f1, f2]` are migrated by sanitizeEnvoyFlexLoadout.
 */
export type EnvoyFlexLoadout = readonly [
  EnvoyFlexAbilityId,
  EnvoyFlexAbilityId,
  EnvoyFlexAbilityId,
];

/**
 * E.5 — EnvoyLoadout is the persisted three-flex shape (alias of EnvoyFlexLoadout).
 * Legacy 4-tuples `[VEIL_SPLINTER|Action1, f1, f2, f3]` migrate via sanitizeEnvoyFlexLoadout.
 */
export type EnvoyLoadout = EnvoyFlexLoadout;

export const ALL_OPERATIVE_CLASSES: readonly ClassType[] = ['AEGIS', 'HEX_SHOT', 'ENVOY'];

export const DEFAULT_HEX_FLEX_LOADOUT: HexFlexLoadout = [
  'ASH_JACKET_SALVO',
  'RIFT_SNARE',
  'SINGULARITY_SLUG',
];

/** @deprecated Prefer DEFAULT_HEX_FLEX_LOADOUT */
export const DEFAULT_HEX_SHOT_LOADOUT: HexShotLoadout = DEFAULT_HEX_FLEX_LOADOUT;

export const DEFAULT_ENVOY_FLEX_LOADOUT: EnvoyFlexLoadout = [
  'ASTRAL_LANCE',
  'ENTROPY_HEX',
  'NECROTIC_BLOOM',
];

/** Canonical persisted Envoy loadout — three flex abilities. */
export const DEFAULT_ENVOY_LOADOUT: EnvoyLoadout = DEFAULT_ENVOY_FLEX_LOADOUT;

export const DEFAULT_HEX_SHOT_UNLOCKED: readonly HexShotAbilityId[] = [...DEFAULT_HEX_SHOT_LOADOUT];

export const DEFAULT_ENVOY_UNLOCKED: readonly EnvoyAbilityId[] = [...DEFAULT_ENVOY_LOADOUT];

export type ClassLoadoutSnapshot =
  | { classId: 'AEGIS'; loadout: AegisTechniqueLoadout; unlocked: readonly AegisAbilityId[] }
  | { classId: 'HEX_SHOT'; loadout: HexShotLoadout; unlocked: readonly HexShotAbilityId[] }
  | { classId: 'ENVOY'; loadout: EnvoyLoadout; unlocked: readonly EnvoyAbilityId[] };
