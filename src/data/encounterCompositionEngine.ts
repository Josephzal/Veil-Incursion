import type { CombatGridSlotId } from '../types/combatGrid';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, localLevelFromDepth } from './districtPacing';
import type { EnemyRosterId } from './enemyRoster';
import { ENEMY_ROSTER, type EnemyRosterEntry } from './enemyRoster';

export interface CompositionSlot {
  rosterId: EnemyRosterId;
  slot: CombatGridSlotId;
  isApex?: boolean;
}

export interface EncounterComposition {
  slots: CompositionSlot[];
  isApex?: boolean;
  label?: string;
}

function hashPick<T>(seed: string, options: readonly T[]): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return options[Math.abs(hash) % options.length];
}

/** Depth macro caps: D1 → 2, D2 → 3, D3 → 4 enemies max. */
export function maxEnemiesForDistrict(district: DistrictId): number {
  if (district === 1) return 2;
  if (district === 2) return 3;
  return 4;
}

export function spawnBudgetForDistrict(district: DistrictId, localLevel: number, isElite: boolean): number {
  const act = localLevel <= 5 ? 1 : localLevel <= 10 ? 2 : 3;
  if (district === 1) {
    if (act === 1) return isElite ? 3 : 2;
    if (act === 2) return isElite ? 3 : 3;
    return isElite ? 4 : 3;
  }
  if (district === 2) {
    if (act === 1) return isElite ? 4 : 3;
    if (act === 2) return isElite ? 5 : 4;
    return isElite ? 6 : 5;
  }
  if (act === 1) return isElite ? 5 : 4;
  if (act === 2) return isElite ? 7 : 6;
  return isElite ? 8 : 7;
}

function trimComposition(
  composition: EncounterComposition,
  maxEnemies: number,
): EncounterComposition {
  if (composition.slots.length <= maxEnemies) return composition;
  return {
    ...composition,
    slots: composition.slots.slice(0, maxEnemies),
    isApex: composition.isApex && maxEnemies === 1 ? composition.isApex : false,
  };
}

function pickRandom<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

/** Act I — levels 1–5, no elite compositions. Randomized each engagement. */
function actIStandard(): EncounterComposition {
  const singles: EncounterComposition[] = [
    { slots: [{ rosterId: 'gutter-goliath', slot: 'FL_0' }] },
    { slots: [{ rosterId: 'concrete-gargoyle', slot: 'FL_0' }] },
  ];
  const doubles: EncounterComposition[] = [
    {
      slots: [
        { rosterId: 'fracture-hound', slot: 'FL_0' },
        { rosterId: 'fracture-hound', slot: 'FL_1' },
      ],
      label: 'Twin Hounds',
    },
    {
      slots: [
        { rosterId: 'null-shade', slot: 'BL_0' },
        { rosterId: 'gutter-goliath', slot: 'FL_0' },
      ],
      label: 'Shade + Goliath',
    },
  ];
  return Math.random() < 0.5 ? pickRandom(singles) : pickRandom(doubles);
}

/** Act II — levels 6–10. */
function actIIStandard(seed: string): EncounterComposition {
  return hashPick(seed, [
    {
      slots: [
        { rosterId: 'echoing-brute', slot: 'FL_0' },
        { rosterId: 'ash-weeper', slot: 'BL_0' },
      ],
      label: 'Brute + Weeper',
    },
    {
      slots: [
        { rosterId: 'spatial-glitch', slot: 'BL_0' },
        { rosterId: 'miasma-tick-swarm', slot: 'FL_0' },
      ],
      label: 'Glitch + Swarm',
    },
  ] as EncounterComposition[]);
}

function actIIElite(seed: string, maxEnemies: number): EncounterComposition {
  if (maxEnemies < 2) {
    return {
      slots: [{ rosterId: 'concrete-gargoyle', slot: 'FL_0', isApex: true }],
      isApex: true,
      label: 'Apex Gargoyle',
    };
  }
  return {
    slots: [
      { rosterId: 'concrete-gargoyle', slot: 'FL_0' },
      { rosterId: 'ley-siren', slot: 'BL_0' },
    ],
    label: 'Tethered Wall',
  };
}

/** Act III — levels 11–14. */
function actIIIStandard(seed: string, maxEnemies: number): EncounterComposition {
  const twinBrutes: EncounterComposition = {
    slots: [
      { rosterId: 'echoing-brute', slot: 'FL_0' },
      { rosterId: 'echoing-brute', slot: 'FL_1' },
    ],
    label: 'Twin Brutes',
  };
  const collapse: EncounterComposition = {
    slots: [
      { rosterId: 'spatial-glitch', slot: 'BL_0' },
      { rosterId: 'ley-siren', slot: 'BL_1' },
      { rosterId: 'fracture-hound', slot: 'FL_0' },
    ],
    label: 'Evasion Board',
  };
  if (maxEnemies < 3) {
    return twinBrutes;
  }
  return hashPick(seed, [twinBrutes, collapse] as EncounterComposition[]);
}

function actIIIElite(seed: string, maxEnemies: number): EncounterComposition {
  if (maxEnemies < 3) {
    return {
      slots: [{ rosterId: 'null-shade', slot: 'BL_0', isApex: true }],
      isApex: true,
      label: 'Apex Null-Shade',
    };
  }
  if (maxEnemies < 4) {
    return {
      slots: [
        { rosterId: 'concrete-gargoyle', slot: 'FL_0' },
        { rosterId: 'ley-siren', slot: 'BL_0' },
        { rosterId: 'fracture-hound', slot: 'FL_1' },
      ],
      label: 'Elite Collapse (3)',
    };
  }
  return {
    slots: [
      { rosterId: 'concrete-gargoyle', slot: 'FL_0' },
      { rosterId: 'miasma-tick-swarm', slot: 'FL_1' },
      { rosterId: 'ley-siren', slot: 'BL_0' },
      { rosterId: 'fracture-hound', slot: 'BL_1' },
    ],
    label: 'Total Collapse',
  };
}

/** 100% resonance override — apex ambush regardless of node type. */
export function apexResonanceAmbushComposition(): EncounterComposition {
  return {
    slots: [{ rosterId: 'echoing-brute', slot: 'FL_0', isApex: true }],
    isApex: true,
    label: 'Apex Echoing Brute Ambush',
  };
}

export function pickEncounterComposition(
  depth: number,
  options: { isElite?: boolean; isAmbush?: boolean; seed?: string },
): EncounterComposition {
  const district = getDistrictFromDepth(depth);
  const local = localLevelFromDepth(depth);
  const maxEnemies = maxEnemiesForDistrict(district);
  const isElite = options.isElite === true || options.isAmbush === true;
  const seed = options.seed ?? `comp:${depth}:${isElite ? 'elite' : 'std'}`;

  if (options.isAmbush) {
    return apexResonanceAmbushComposition();
  }

  let composition: EncounterComposition;
  if (local <= 5) {
    composition = actIStandard();
  } else if (local <= 10) {
    composition = isElite
      ? actIIElite(seed, maxEnemies)
      : actIIStandard(seed);
  } else if (local <= 14) {
    composition = isElite
      ? actIIIElite(seed, maxEnemies)
      : actIIIStandard(seed, maxEnemies);
  } else {
    composition = actIIIElite(seed, maxEnemies);
  }

  return trimComposition(composition, maxEnemies);
}

export function entriesFromComposition(composition: EncounterComposition): {
  entries: EnemyRosterEntry[];
  slots: CombatGridSlotId[];
  isApex: boolean;
} {
  const entries = composition.slots.map((s) => ENEMY_ROSTER[s.rosterId]);
  const slots = composition.slots.map((s) => s.slot);
  const isApex = composition.isApex === true
    || composition.slots.some((s) => s.isApex === true && composition.slots.length === 1);
  return { entries, slots, isApex };
}
