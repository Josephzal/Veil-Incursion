import type { CombatGridSlotId } from '../types/combatGrid';
import { FRONTLINE_SLOTS } from '../types/combatGrid';
import type { FactionType } from '../types/game';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth } from './districtPacing';
import {
  ENEMY_ROSTER,
  GRUNT_ROSTER_BY_FACTION,
  factionForDistrict,
  type EnemyRosterEntry,
} from './enemyRoster';

export type ThreatTier = 1 | 2 | 3;

export interface EncounterBudgetParams {
  depth: number;
  isElite?: boolean;
  isAmbush?: boolean;
}

export interface EncounterBudgetResult {
  spawnBudget: number;
  maxEnemies: number;
  phaseBudget: number;
}

export interface DraftedEncounter {
  entries: EnemyRosterEntry[];
  slots: CombatGridSlotId[];
  spawnBudget: number;
  spent: number;
}

function depthInDistrict(depth: number, district: DistrictId): number {
  if (district === 1) return depth;
  if (district === 2) return depth - 10;
  return depth - 20;
}

export function encounterBudgetForDepth(params: EncounterBudgetParams): EncounterBudgetResult {
  const { depth, isElite = false, isAmbush = false } = params;
  const district = getDistrictFromDepth(depth);
  const local = depthInDistrict(depth, district);

  let spawnBudget: number;
  let maxEnemies: number;

  if (district === 1) {
    if (local <= 3) {
      spawnBudget = 2;
      maxEnemies = 2;
    } else if (local <= 6) {
      spawnBudget = 3;
      maxEnemies = 3;
    } else {
      spawnBudget = 4;
      maxEnemies = 3;
    }
  } else if (district === 2) {
    if (local <= 4) {
      spawnBudget = 5;
      maxEnemies = 3;
    } else {
      spawnBudget = 6;
      maxEnemies = 4;
    }
  } else if (local <= 4) {
    spawnBudget = 7;
    maxEnemies = 4;
  } else {
    spawnBudget = 8;
    maxEnemies = 4;
  }

  if (isElite) {
    spawnBudget = Math.min(10, spawnBudget + 1);
    maxEnemies = Math.min(4, maxEnemies + 1);
  }
  if (isAmbush) {
    spawnBudget = Math.min(10, spawnBudget + 2);
    maxEnemies = 4;
  }

  const phaseBudget = Math.min(4, Math.max(2, Math.ceil(spawnBudget / 2)));

  return { spawnBudget, maxEnemies, phaseBudget };
}

function factionPool(faction: FactionType): EnemyRosterEntry[] {
  return GRUNT_ROSTER_BY_FACTION[faction].map((id) => ENEMY_ROSTER[id]);
}

function canAddEntry(
  picks: EnemyRosterEntry[],
  entry: EnemyRosterEntry,
  remaining: number,
  disruptorCount: number,
  tier3Count: number,
): boolean {
  if (entry.threatTier > remaining) return false;
  if (picks.some((p) => p.id === entry.id)) return false;
  if (entry.isDisruptor && disruptorCount >= 1) return false;
  if (entry.threatTier === 3 && tier3Count >= 2) return false;
  return true;
}

function assignSlots(entries: EnemyRosterEntry[]): CombatGridSlotId[] {
  const front = entries.filter((e) => e.role === 'FRONTLINE');
  const back = entries.filter((e) => e.role === 'BACKLINE');
  const slots: CombatGridSlotId[] = [];
  const frontSlots: CombatGridSlotId[] = ['FL_0', 'FL_1'];
  const backSlots: CombatGridSlotId[] = ['BL_0', 'BL_1'];

  front.forEach((_, i) => {
    if (frontSlots[i]) slots.push(frontSlots[i]);
  });
  back.forEach((_, i) => {
    if (backSlots[i]) slots.push(backSlots[i]);
  });

  if (slots.length === 0 && entries.length > 0) {
    return ['FL_0'];
  }
  return slots;
}

function ensureFrontlineRule(
  entries: EnemyRosterEntry[],
  faction: FactionType,
  budget: number,
): EnemyRosterEntry[] {
  const hasBack = entries.some((e) => e.role === 'BACKLINE');
  const hasFront = entries.some((e) => e.role === 'FRONTLINE');
  if (!hasBack || hasFront) return entries;

  const frontCandidates = factionPool(faction)
    .filter((e) => e.role === 'FRONTLINE')
    .sort((a, b) => a.threatTier - b.threatTier);
  const spent = entries.reduce((sum, e) => sum + e.threatTier, 0);
  const cheapest = frontCandidates.find(
    (e) => !entries.some((p) => p.id === e.id) && spent + e.threatTier <= budget,
  );
  if (!cheapest) {
    const grunt = frontCandidates.find((e) => e.threatTier === 1 && spent + 1 <= budget);
    if (grunt) return [...entries, grunt];
    return entries;
  }
  return [...entries, cheapest];
}

function pickWeighted(pool: EnemyRosterEntry[], preferHighTier: boolean): EnemyRosterEntry {
  const sorted = [...pool].sort((a, b) =>
    preferHighTier ? b.threatTier - a.threatTier : a.threatTier - b.threatTier,
  );
  const weights = sorted.map((e) => (preferHighTier ? e.threatTier : 4 - e.threatTier));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < sorted.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return sorted[i];
  }
  return sorted[sorted.length - 1];
}

export function draftEncounterSquad(
  faction: FactionType,
  budget: number,
  maxEnemies: number,
): DraftedEncounter {
  const pool = factionPool(faction);
  const picks: EnemyRosterEntry[] = [];
  let remaining = budget;
  let disruptorCount = 0;
  let tier3Count = 0;
  const preferHighTier = budget >= 5;

  while (picks.length < maxEnemies && remaining > 0) {
    const affordable = pool.filter((e) =>
      canAddEntry(picks, e, remaining, disruptorCount, tier3Count),
    );
    if (affordable.length === 0) break;

    const needsFront = !picks.some((e) => e.role === 'FRONTLINE');
    const hasBack = picks.some((e) => e.role === 'BACKLINE');
    let candidates = affordable;
    if (needsFront && picks.length > 0) {
      const frontOnly = affordable.filter((e) => e.role === 'FRONTLINE');
      if (frontOnly.length > 0) candidates = frontOnly;
    } else if (!hasBack && picks.length < maxEnemies - 1 && Math.random() < 0.4 && budget >= 3) {
      const backOnly = affordable.filter((e) => e.role === 'BACKLINE');
      if (backOnly.length > 0) candidates = backOnly;
    }

    const entry = pickWeighted(candidates, preferHighTier);
    picks.push(entry);
    remaining -= entry.threatTier;
    if (entry.isDisruptor) disruptorCount += 1;
    if (entry.threatTier === 3) tier3Count += 1;
  }

  let finalEntries = ensureFrontlineRule(picks, faction, budget);
  if (finalEntries.length > maxEnemies) {
    finalEntries = finalEntries.slice(0, maxEnemies);
  }

  const spent = finalEntries.reduce((sum, e) => sum + e.threatTier, 0);
  const slots = assignSlots(finalEntries).slice(0, finalEntries.length);

  return { entries: finalEntries, slots, spawnBudget: budget, spent };
}

export function draftEncounterForDepth(
  depth: number,
  options?: { isElite?: boolean; isAmbush?: boolean; district?: DistrictId },
): DraftedEncounter {
  const district = options?.district ?? getDistrictFromDepth(depth);
  const faction = factionForDistrict(district);
  const { spawnBudget, maxEnemies } = encounterBudgetForDepth({
    depth,
    isElite: options?.isElite,
    isAmbush: options?.isAmbush,
  });
  return draftEncounterSquad(faction, spawnBudget, maxEnemies);
}

export function allGridSlots(): CombatGridSlotId[] {
  return [...FRONTLINE_SLOTS, 'BL_0', 'BL_1'];
}
