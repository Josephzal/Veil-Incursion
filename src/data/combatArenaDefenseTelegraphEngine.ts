/**
 * Combat Telegraph Language — Phase 2.
 * Persistent defense silhouettes (KA / OW / Fractured) for the arena.
 * Separate from intent glyphs — defenses are materials, not next actions.
 */

import type { IntentCounterTag } from '../types/enemyIntentMeta';
import { COMBAT_DEFENSE_BALANCE } from './balance/combatDefenseBalanceConfig';

export type DefenseTelegraphId = 'KINETIC_ARMOR' | 'OCCULT_WARD' | 'FRACTURED';

export type DefenseSilhouette = 'ANGULAR_STEEL' | 'GLYPH_RING' | 'CRACK';
export type DefensePipStyle = 'PLATE' | 'DIAMOND_GLYPH' | 'FRACTURE_NOTCH';

export interface DefenseTelegraphProfile {
  id: DefenseTelegraphId;
  silhouette: DefenseSilhouette;
  pipStyle: DefensePipStyle;
  /** Short arena caption. */
  label: string;
  /** Float / toast when fully broken. */
  breakLabel: string;
  colors: {
    primary: string;
    secondary: string;
    hit: string;
    break: string;
  };
  /** Reuse Intent 2.0 counter tags — no parallel hint soup. */
  counterHints: readonly IntentCounterTag[];
  /** Tier-2 persistent volume. */
  priority: 2;
}

export const DEFENSE_TELEGRAPH_PROFILES: Record<DefenseTelegraphId, DefenseTelegraphProfile> = {
  KINETIC_ARMOR: {
    id: 'KINETIC_ARMOR',
    silhouette: 'ANGULAR_STEEL',
    pipStyle: 'PLATE',
    label: 'KA',
    breakLabel: 'ARMOR BROKEN',
    colors: {
      primary: '#c8d0dc',
      secondary: '#64748b',
      hit: '#e2e8f0',
      break: '#94a3b8',
    },
    counterHints: ['ARMOR_BREAK', 'FRACTURE', 'BURST_DAMAGE'],
    priority: 2,
  },
  OCCULT_WARD: {
    id: 'OCCULT_WARD',
    silhouette: 'GLYPH_RING',
    pipStyle: 'DIAMOND_GLYPH',
    label: 'OW',
    breakLabel: 'WARD SHATTERED',
    colors: {
      primary: '#a78bfa',
      secondary: '#5b21b6',
      hit: '#ddd6fe',
      break: '#c4b5fd',
    },
    counterHints: ['WARD_BREAK', 'FRACTURE', 'BURST_DAMAGE'],
    priority: 2,
  },
  FRACTURED: {
    id: 'FRACTURED',
    silhouette: 'CRACK',
    pipStyle: 'FRACTURE_NOTCH',
    label: 'FRX',
    breakLabel: 'FRACTURED',
    colors: {
      primary: '#f87171',
      secondary: '#7f1d1d',
      hit: '#fecaca',
      break: '#ef4444',
    },
    counterHints: ['BURST_DAMAGE', 'FRACTURE'],
    priority: 2,
  },
};

export interface ArenaDefenseState {
  kineticArmor: number;
  occultWards: number;
  isFractured: boolean;
  armorProfile: DefenseTelegraphProfile | null;
  wardProfile: DefenseTelegraphProfile | null;
  fracturedProfile: DefenseTelegraphProfile | null;
  /** Cap for pip rendering (matches absolute stack hard cap). */
  maxPips: number;
}

export function resolveArenaDefenseState(args: {
  kineticArmor?: number;
  occultWards?: number;
  isFractured?: boolean;
}): ArenaDefenseState {
  const kineticArmor = Math.max(0, args.kineticArmor ?? 0);
  const occultWards = Math.max(0, args.occultWards ?? 0);
  const isFractured = args.isFractured === true;
  const maxPips = COMBAT_DEFENSE_BALANCE.absoluteMaxDefenseStacks;

  return {
    kineticArmor,
    occultWards,
    isFractured,
    armorProfile: kineticArmor > 0 ? DEFENSE_TELEGRAPH_PROFILES.KINETIC_ARMOR : null,
    wardProfile: occultWards > 0 ? DEFENSE_TELEGRAPH_PROFILES.OCCULT_WARD : null,
    fracturedProfile: isFractured ? DEFENSE_TELEGRAPH_PROFILES.FRACTURED : null,
    maxPips,
  };
}

/** % mitigation chip copy — replaces legacy flat-absorb teaching language. */
export function formatKineticArmorChipDescription(stacks: number): string {
  const pct = Math.round(COMBAT_DEFENSE_BALANCE.defaultKineticArmorReductionPercent * 100);
  return `Kinetic Armor ×${stacks}. While stacks remain, ~${pct}% less kinetic damage. Counter: Armor Break / Pierce / Fracture.`;
}

export function formatOccultWardChipDescription(stacks: number): string {
  const pct = Math.round(COMBAT_DEFENSE_BALANCE.defaultOccultWardReductionPercent * 100);
  return `Occult Wards ×${stacks}. While stacks remain, ~${pct}% less occult damage. Counter: Ward Break / Pierce / Fracture.`;
}
