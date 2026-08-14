import type { StrainId } from '../../types/nineStrain';

export const NINE_STRAIN_IDS: readonly StrainId[] = [
  'COUNTERFATE',
  'RITUAL_CADENCE',
  'AFTERIMAGE',
  'STILLPOINT',
  'WOUNDWEAVE',
  'FAULTLINE',
  'SOULWAKE',
  'GRAVEMARK',
  'SHARDSKIN',
] as const;

export const STRAIN_DISPLAY_NAMES: Readonly<Record<StrainId, string>> = {
  COUNTERFATE: 'Counterfate',
  RITUAL_CADENCE: 'Ritual Cadence',
  AFTERIMAGE: 'Afterimage',
  STILLPOINT: 'Stillpoint',
  WOUNDWEAVE: 'Woundweave',
  FAULTLINE: 'Faultline',
  SOULWAKE: 'Soulwake',
  GRAVEMARK: 'Gravemark',
  SHARDSKIN: 'Shardskin',
};

export const CORE_IMPRINTS = ['ARMAMENT', 'DISCIPLINE', 'INSTINCT', 'CURRENT'] as const;

export const MAX_NATURAL_CONTACTED_STRAINS = 3;

export const NINE_STRAIN_SCHEMA_VERSION = 4;

export const PROC_DEPTH_CEILING = 8;

/** Retired vocabulary → live domain. Import/save only. */
export const LEGACY_ROLE_ALIASES: Readonly<Record<string, string>> = {
  AUTHORITY: 'STRAIN',
  REVELATION: 'MANIFESTATION',
};

export function isStrainId(value: unknown): value is StrainId {
  return typeof value === 'string' && (NINE_STRAIN_IDS as readonly string[]).includes(value);
}
