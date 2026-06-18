import type { DistrictId } from './districtPacing';
import type { SafeAnchorIndex } from '../types/sectorPacing';

/** Local level before each district boss — always hosts a sanctuary vector. */
export const SANCTUARY_PENULT_LOCAL_LEVEL = 14;

/** Sanctuaries cannot roll on local levels below this. */
export const SANCTUARY_MIN_LOCAL_LEVEL = 4;

/** District 1 clean extraction conduits (local levels within chapter 1). */
export const DISTRICT1_EXTRACTION_LOCAL_LEVELS: readonly number[] = [5, 9, 14];

const DISTRICT1_EXTRACTION_ANCHOR: Record<number, SafeAnchorIndex> = {
  5: 1,
  9: 2,
  14: 3,
};

export type SanctuarySchedule = Record<DistrictId, readonly number[]>;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function pickRandomLevels(
  pool: number[],
  count: number,
  rand: () => number,
): number[] {
  const available = [...pool];
  const picks: number[] = [];
  for (let i = 0; i < count && available.length > 0; i += 1) {
    const idx = Math.floor(rand() * available.length);
    picks.push(available[idx]);
    available.splice(idx, 1);
  }
  return picks;
}

/**
 * Per-incursion sanctuary layout per district chapter.
 * Always includes local 14; rolls 1–2 additional levels from local 4–13.
 */
export function rollSanctuarySchedule(seed: string): SanctuarySchedule {
  const rand = seededRandom(seed);
  const schedule: SanctuarySchedule = { 1: [], 2: [], 3: [] };

  (([1, 2, 3] as const)).forEach((district) => {
    const pool = Array.from(
      { length: SANCTUARY_PENULT_LOCAL_LEVEL - SANCTUARY_MIN_LOCAL_LEVEL },
      (_, i) => i + SANCTUARY_MIN_LOCAL_LEVEL,
    );
    const extraCount = rand() < 0.5 ? 1 : 2;
    const extras = pickRandomLevels(pool, extraCount, rand);
    const levels = new Set<number>([...extras, SANCTUARY_PENULT_LOCAL_LEVEL]);
    schedule[district] = [...levels].sort((a, b) => a - b);
  });

  return schedule;
}

export function isSanctuaryScheduledLevel(
  schedule: SanctuarySchedule,
  district: DistrictId,
  localLevel: number,
): boolean {
  return schedule[district]?.includes(localLevel) ?? false;
}

export function district1ExtractionAnchorForLocalLevel(localLevel: number): SafeAnchorIndex | null {
  return DISTRICT1_EXTRACTION_ANCHOR[localLevel] ?? null;
}

export function isDistrict1ExtractionLevel(district: DistrictId, localLevel: number): boolean {
  return district === 1 && DISTRICT1_EXTRACTION_LOCAL_LEVELS.includes(localLevel);
}
