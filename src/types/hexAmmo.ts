/**
 * Hex Shot ammo-type combat state (v1 refactor).
 *
 * Ammo type is **combat state**, not a consumable inventory. The Hex Shot chooses
 * one of three ammo types on every Phase-Shift Reload; BALLISTIC abilities inherit
 * the current ammo type. Perfect reloads build Protocol Charges (spent by Zero
 * Protocol) and prime an Overcharged first shot.
 *
 * This module is pure/data-only — no run-state mutation, no React.
 */

export type HexAmmoType = 'SILVER_CORE' | 'WRAITHGLASS' | 'STASIS_LOCK';

export type ReloadQuality = 'FAILED' | 'CLEAN' | 'PERFECT';

export const HEX_AMMO_TYPES: readonly HexAmmoType[] = ['SILVER_CORE', 'WRAITHGLASS', 'STASIS_LOCK'];

export const DEFAULT_HEX_AMMO_TYPE: HexAmmoType = 'SILVER_CORE';

/** Fixed v1 tuning for the Hex Magazine / Protocol systems. */
export const HEX_MAGAZINE_CONFIG = {
  maxProtocolCharges: 3,
  /** How many Perfect-reload ammo types feed Zero Protocol's calibrated sequence. */
  calibratedSequenceLength: 3,
  /** Overcharged first-shot damage bonus. */
  overchargedDamagePct: 20,
  /** Failed-reload first-shot penalty (kept light per design). */
  failedFirstShotDamagePct: 10,
  /** Per-cast caps for ammo effects. */
  maxArmorStripPerCast: 1,
  maxWardStripPerCast: 1,
  maxApReductionPerTargetPerCast: 2,
  /** Silver-Core tuning. */
  silverFractureBonusPct: 25,
  /** Wraithglass tuning. */
  wraithglassOccultConversionPct: 40,
  wraithglassFlatOccult: 6,
  wraithglassBacklineDamagePct: 15,
  wraithglassVoidMarkTurns: 2,
  /** Stasis-Lock tuning. */
  stasisDamagePenaltyPct: 20,
  stasisLockedTurns: 1,
  stasisApReductionNormal: 1,
  stasisApReductionHeavy: 2,
} as const;

export interface HexAmmoTypeMeta {
  id: HexAmmoType;
  /** Short display label, e.g. "Silver-Core". */
  label: string;
  /** Uppercase chip label, e.g. "SILVER-CORE". */
  chip: string;
  /** Full UI description line. */
  description: string;
  /** Short effect blurb for the reload selection buttons. */
  shortEffect: string;
  /** Theme accent color (Tron-occult palette). */
  color: string;
  /** Sigil glyph used in pips / chips. */
  sigil: string;
}

export const HEX_AMMO_META: Record<HexAmmoType, HexAmmoTypeMeta> = {
  SILVER_CORE: {
    id: 'SILVER_CORE',
    label: 'Silver-Core',
    chip: 'SILVER-CORE',
    description: 'Silver-Core: Kinetic rounds that build Fracture and punish armored bodies.',
    shortEffect: 'Kinetic // +Fracture, cracks Kinetic Armor',
    color: '#cbd5e1',
    sigil: '✦',
  },
  WRAITHGLASS: {
    id: 'WRAITHGLASS',
    label: 'Wraithglass',
    chip: 'WRAITHGLASS',
    description: 'Wraithglass: Veil-cut rounds that pierce wards, tag targets, and punish the backline.',
    shortEffect: 'Occult // Void-Marks, pierces wards, backline',
    color: '#a855f7',
    sigil: '✷',
  },
  STASIS_LOCK: {
    id: 'STASIS_LOCK',
    label: 'Stasis-Lock',
    chip: 'STASIS-LOCK',
    description: 'Stasis-Lock: Control rounds that reduce enemy AP and interrupt dangerous intent.',
    shortEffect: 'Control // −AP, interrupts telegraphed intent',
    color: '#38bdf8',
    sigil: '❄',
  },
};

export function isHexAmmoType(value: unknown): value is HexAmmoType {
  return value === 'SILVER_CORE' || value === 'WRAITHGLASS' || value === 'STASIS_LOCK';
}

export function formatHexAmmoLabel(type: HexAmmoType): string {
  return HEX_AMMO_META[type].label;
}

/**
 * Push a Perfect-reload ammo type into the calibrated sequence, keeping only the
 * most recent `calibratedSequenceLength` entries (oldest dropped).
 */
export function pushCalibratedAmmo(
  sequence: readonly HexAmmoType[],
  type: HexAmmoType,
): HexAmmoType[] {
  const next = [...sequence, type];
  const max = HEX_MAGAZINE_CONFIG.calibratedSequenceLength;
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * Resolve the effective calibrated sequence for Zero Protocol. If fewer than the
 * required entries exist but Protocol is somehow full, pad with the current ammo.
 */
export function resolveCalibratedSequence(
  calibrated: readonly HexAmmoType[],
  currentAmmoType: HexAmmoType,
): HexAmmoType[] {
  const target = HEX_MAGAZINE_CONFIG.calibratedSequenceLength;
  const seq = [...calibrated];
  while (seq.length < target) seq.push(currentAmmoType);
  return seq.slice(seq.length - target);
}

/** True when a calibrated sequence is exactly one repeated ammo type. */
export function isFullySpecialized(sequence: readonly HexAmmoType[]): HexAmmoType | null {
  if (sequence.length === 0) return null;
  const first = sequence[0]!;
  return sequence.every((t) => t === first) ? first : null;
}

/** True when a calibrated sequence contains all distinct ammo types (Full Calibration). */
export function isFullCalibration(sequence: readonly HexAmmoType[]): boolean {
  if (sequence.length < HEX_MAGAZINE_CONFIG.calibratedSequenceLength) return false;
  return new Set(sequence).size === sequence.length;
}
