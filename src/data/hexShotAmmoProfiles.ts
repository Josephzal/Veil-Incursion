/**
 * Combat Refactor Phase 3 — Hex Shot ammo / shot identity profiles.
 * Formalizes existing abilities as tactical "rounds" (no new magazine sim).
 */

import type { HexShotAbilityId } from '../types/operativeClass';
import type { IntentCounterTag } from '../types/enemyIntentMeta';

export type HexAmmoProfileId =
  | 'KINETIC'
  | 'BREACHER'
  | 'NULL'
  | 'FLASH'
  | 'HOLLOW'
  | 'TACTICAL';

export interface HexAmmoProfile {
  id: HexAmmoProfileId;
  displayName: string;
  description: string;
  abilityIds: readonly HexShotAbilityId[];
  counterTags: readonly IntentCounterTag[];
  bonusAgainst: {
    armor?: boolean;
    wards?: boolean;
    fractured?: boolean;
    lockOn?: boolean;
    channeling?: boolean;
  };
  tooltipHint: string;
}

export const HEX_AMMO_PROFILES: readonly HexAmmoProfile[] = [
  {
    id: 'KINETIC',
    displayName: 'Kinetic Round',
    description: 'Baseline ballistic pressure.',
    abilityIds: ['SILVER_CORE_SIDEARM', 'REVENANTS_ECHO', 'ZERO_PROTOCOL'],
    counterTags: ['KILL_SOURCE', 'BURST_DAMAGE'],
    bonusAgainst: {},
    tooltipHint: 'Reliable kinetic shot.',
  },
  {
    id: 'BREACHER',
    displayName: 'Breacher Round',
    description: 'Armor answer — strips Kinetic Armor / Guard.',
    abilityIds: ['SILVER_CORE_SIDEARM', 'SINGULARITY_SLUG', 'ASH_JACKET_SALVO'],
    counterTags: ['ARMOR_BREAK', 'GUARD_BREAK', 'FRACTURE'],
    bonusAgainst: { armor: true },
    tooltipHint: 'Breaks Armor // Counters Guard.',
  },
  {
    id: 'NULL',
    displayName: 'Null Round',
    description: 'Ward / channel answer.',
    abilityIds: ['WRAITH_PIERCER_ROUND'],
    counterTags: ['WARD_BREAK', 'INTERRUPT', 'SILENCE'],
    bonusAgainst: { wards: true, channeling: true },
    tooltipHint: 'Breaks Wards // Counters Channel.',
  },
  {
    id: 'FLASH',
    displayName: 'Flash Round',
    description: 'Lock-On / accuracy disrupt.',
    abilityIds: ['STASIS_LOCK_SLUG', 'PHOSPHORUS_HEX', 'PANOPTICON_PROTOCOL'],
    counterTags: ['BLIND', 'INTERRUPT'],
    bonusAgainst: { lockOn: true },
    tooltipHint: 'Counters Lock-On.',
  },
  {
    id: 'HOLLOW',
    displayName: 'Hollow Round',
    description: 'Fracture / execution cash-out.',
    abilityIds: ['ASH_JACKET_SALVO', 'REVENANTS_ECHO'],
    counterTags: ['FRACTURE', 'BURST_DAMAGE', 'KILL_SOURCE'],
    bonusAgainst: { fractured: true },
    tooltipHint: 'Bonus vs Fractured.',
  },
  {
    id: 'TACTICAL',
    displayName: 'Tactical Utility',
    description: 'Reload, traps, and defensive tools.',
    abilityIds: ['PHASE_SHIFT_RELOAD', 'RIFT_SNARE', 'NULL_SPACE_CLOAK', 'GHOST_GRID_CAMO'],
    counterTags: ['BLOCK', 'DECOY'],
    bonusAgainst: {},
    tooltipHint: 'Tempo / survival tool.',
  },
] as const;

const BY_ABILITY: Partial<Record<HexShotAbilityId, HexAmmoProfile>> = {};
for (const profile of HEX_AMMO_PROFILES) {
  for (const id of profile.abilityIds) {
    // Prefer the most specific profile: first write wins for primary, later overwrites for multi-role.
    // Breacher/Null/Flash should win over Kinetic for tagged shots.
    if (!BY_ABILITY[id] || profile.id !== 'KINETIC') {
      BY_ABILITY[id] = profile;
    }
  }
}

export function getHexAmmoProfileForAbility(abilityId: HexShotAbilityId): HexAmmoProfile | null {
  return BY_ABILITY[abilityId] ?? null;
}

export function formatHexAmmoCounterHint(abilityId: HexShotAbilityId): string | null {
  return getHexAmmoProfileForAbility(abilityId)?.tooltipHint ?? null;
}
