import type { ClassType } from './game';
import type { AegisAbilityId, AegisLoadout } from './aegisCombat';

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
  | 'BRIMSTONE_PAYLOAD'
  | 'WRAITH_PIERCER_ROUND'
  | 'BLOOD_TRACER_ROUND'
  | 'STASIS_LOCK_SLUG';

export type HexShotLoadout = readonly [
  HexShotAbilityId,
  HexShotAbilityId,
  HexShotAbilityId,
  HexShotAbilityId,
];

/** Envoy deck ability ids. */
export type EnvoyAbilityId =
  | 'VEIL_SPLINTER'
  | 'CATACLYSM_SIGIL'
  | 'ASTRAL_LANCE'
  | 'SPATIAL_COLLAPSE'
  | 'FLUX_PURGE'
  | 'DIMENSIONAL_SHEAR'
  | 'RIFT_WARD'
  | 'PHASE_STEP'
  | 'AETHERIC_TRANSFUSION'
  | 'SOUL_TETHER'
  | 'ENTROPY_HEX'
  | 'FLESH_WARP'
  | 'GRAVITY_WELL'
  | 'MIND_SUNDER';

export type EnvoyLoadout = readonly [
  EnvoyAbilityId,
  EnvoyAbilityId,
  EnvoyAbilityId,
  EnvoyAbilityId,
];

export const ALL_OPERATIVE_CLASSES: readonly ClassType[] = ['AEGIS', 'HEX_SHOT', 'ENVOY'];

export const DEFAULT_HEX_SHOT_LOADOUT: HexShotLoadout = [
  'SILVER_CORE_SIDEARM',
  'ZERO_PROTOCOL',
  'RIFT_SNARE',
  'BRIMSTONE_PAYLOAD',
];

export const DEFAULT_ENVOY_LOADOUT: EnvoyLoadout = [
  'VEIL_SPLINTER',
  'CATACLYSM_SIGIL',
  'ASTRAL_LANCE',
  'ENTROPY_HEX',
];

export const DEFAULT_HEX_SHOT_UNLOCKED: readonly HexShotAbilityId[] = [...DEFAULT_HEX_SHOT_LOADOUT];

export const DEFAULT_ENVOY_UNLOCKED: readonly EnvoyAbilityId[] = [...DEFAULT_ENVOY_LOADOUT];

export type ClassLoadoutSnapshot =
  | { classId: 'AEGIS'; loadout: AegisLoadout; unlocked: readonly AegisAbilityId[] }
  | { classId: 'HEX_SHOT'; loadout: HexShotLoadout; unlocked: readonly HexShotAbilityId[] }
  | { classId: 'ENVOY'; loadout: EnvoyLoadout; unlocked: readonly EnvoyAbilityId[] };
