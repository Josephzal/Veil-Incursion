import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { CombatGridSlotId } from '../types/combatGrid';
import { ADJACENT_SLOTS } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import { aliveUnits, getUnitById, isUnitAlive, unitAtSlot } from './combatSquadEngine';

export const VEIL_ROT_STACK_CAP = 4;
export const VEIL_ROT_TICK_DAMAGE = 8;

export const CATALYTIC_CONSOLE_AP_COST = 1;
export const CATALYTIC_SLOPPY_FLUX_PENALTY = 30;
export const CATALYTIC_PERFECT_OVERLAP_EPSILON = 0.096;

/** Total Veil Rot stacks across the board required to prime Cataclysm Sigil. */
export const CATACLYSM_ROT_GATE = 6;

export function getVeilRotStacks(
  classState: ClassCombatEncounterState,
  unitId: string,
): number {
  return classState.veilRotStacks[unitId] ?? 0;
}

export function totalVeilRotStacks(classState: ClassCombatEncounterState): number {
  return Object.values(classState.veilRotStacks).reduce((sum, stacks) => sum + stacks, 0);
}

export function isCataclysmSigilReady(
  classState: ClassCombatEncounterState,
  squad: readonly EnemyCombatProfile[],
): boolean {
  if (aliveUnits([...squad]).length === 0) return false;
  return totalVeilRotStacks(classState) >= CATACLYSM_ROT_GATE;
}

/** Grid-wide TRUE rupture — exponential in harvested rot × trace accuracy (0–1). */
export function computeCataclysmSigilDamage(
  rotTotal: number,
  traceAccuracy: number,
): number {
  if (rotTotal <= 0) return 0;
  const trace = Math.max(0, Math.min(1, traceAccuracy));
  const harvestedTicks = rotTotal * VEIL_ROT_TICK_DAMAGE;
  const exponentialScale = Math.pow(1.35, rotTotal);
  return Math.max(1, Math.floor(harvestedTicks * exponentialScale * trace));
}

export function addVeilRotStacks(
  classState: ClassCombatEncounterState,
  unitId: string,
  amount: number,
): number {
  const next = Math.min(VEIL_ROT_STACK_CAP, getVeilRotStacks(classState, unitId) + amount);
  classState.veilRotStacks[unitId] = next;
  return next;
}

export function infectVeilRot(
  classState: ClassCombatEncounterState,
  unit: { unitId?: string; designation: string },
  stacks: number,
  log: (msg: string) => void,
): number {
  if (!unit.unitId || stacks <= 0) return 0;
  const total = addVeilRotStacks(classState, unit.unitId, stacks);
  log(`>> [VEIL ROT] — ${unit.designation} infected (${total}/${VEIL_ROT_STACK_CAP} stacks).`);
  return total;
}

export function consumeVeilRotStacks(
  classState: ClassCombatEncounterState,
  unitId: string,
  amount = 1,
): number {
  const current = getVeilRotStacks(classState, unitId);
  const next = Math.max(0, current - amount);
  if (next <= 0) {
    delete classState.veilRotStacks[unitId];
    delete classState.paralyticMiasmaDoubleRotNextTurn[unitId];
  } else {
    classState.veilRotStacks[unitId] = next;
  }
  return next;
}

export function purgeAllVeilRotStacks(classState: ClassCombatEncounterState): void {
  classState.veilRotStacks = {};
  classState.paralyticMiasmaDoubleRotNextTurn = {};
}

/** Immediate payload per stack for Catalytic Console / detonation hooks. */
export function veilRotImmediatePayloadPerStack(stacks: number): number {
  return stacks * VEIL_ROT_TICK_DAMAGE;
}

export function veilRotImmediatePayload(
  classState: ClassCombatEncounterState,
  unitId: string,
): number {
  return veilRotImmediatePayloadPerStack(getVeilRotStacks(classState, unitId));
}

export function spreadVeilRotMitosis(
  classState: ClassCombatEncounterState,
  squad: EnemyCombatProfile[],
  sourceUnitId: string,
): string[] {
  const source = getUnitById(squad, sourceUnitId);
  if (!source?.gridSlot || getVeilRotStacks(classState, sourceUnitId) <= 0) return [];
  const slot = source.gridSlot as CombatGridSlotId;
  const infected: string[] = [];
  for (const adjacentSlot of ADJACENT_SLOTS[slot]) {
    const neighbor = unitAtSlot(squad, adjacentSlot);
    if (!neighbor?.unitId || !isUnitAlive(neighbor)) continue;
    addVeilRotStacks(classState, neighbor.unitId, 1);
    infected.push(neighbor.designation);
  }
  return infected;
}

export function tickVeilRotEndOfEnemyTurn(
  squad: EnemyCombatProfile[],
  classState: ClassCombatEncounterState,
  hurtEnemy: (
    raw: number,
    tag: string,
    options: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      targetId?: string;
      rollCrit?: boolean;
      indirectDamage?: boolean;
    },
    targetId?: string,
  ) => void,
  log: (msg: string) => void,
): void {
  for (const unit of aliveUnits(squad)) {
    if (!unit.unitId) continue;
    const stacks = getVeilRotStacks(classState, unit.unitId);
    if (stacks <= 0) continue;
    const multiplier = classState.paralyticMiasmaDoubleRotNextTurn[unit.unitId] ? 2 : 1;
    const damage = VEIL_ROT_TICK_DAMAGE * stacks * multiplier;
    hurtEnemy(damage, '[VEIL ROT]', {
      channel: 'OCCULT',
      targetId: unit.unitId,
      rollCrit: false,
      indirectDamage: true,
    }, unit.unitId);
    if (classState.paralyticMiasmaDoubleRotNextTurn[unit.unitId]) {
      delete classState.paralyticMiasmaDoubleRotNextTurn[unit.unitId];
    }
    log(`>> [VEIL ROT] — ${unit.designation} suffers ${damage} occult decay (${stacks} stack${stacks === 1 ? '' : 's'}).`);
  }
}

export function totalCatalyticPayload(classState: ClassCombatEncounterState): number {
  return Object.values(classState.veilRotStacks).reduce(
    (sum, stacks) => sum + veilRotImmediatePayloadPerStack(stacks),
    0,
  );
}

export function isCatalyticReleasePerfect(overlapRatio: number): boolean {
  return Math.abs(overlapRatio - 1.0) <= CATALYTIC_PERFECT_OVERLAP_EPSILON;
}

export interface CatalyticReleaseResult {
  perfect: boolean;
  totalDamageDealt: number;
  unitsHit: number;
  mitosisSpreadCount: number;
}

export function executeCatalyticRelease(
  squad: EnemyCombatProfile[],
  classState: ClassCombatEncounterState,
  overlapRatio: number,
  hurtEnemy: (
    raw: number,
    tag: string,
    options: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      targetId?: string;
      rollCrit?: boolean;
      indirectDamage?: boolean;
    },
    targetId?: string,
  ) => void,
  log: (msg: string) => void,
): CatalyticReleaseResult {
  const perfect = isCatalyticReleasePerfect(overlapRatio);
  const multiplier = perfect ? 1 : 0.5;
  let totalDamageDealt = 0;
  let unitsHit = 0;
  let mitosisSpreadCount = 0;

  const infected = aliveUnits(squad).filter(
    (unit) => unit.unitId && getVeilRotStacks(classState, unit.unitId) > 0,
  );

  for (const unit of infected) {
    if (!unit.unitId) continue;
    const stacks = getVeilRotStacks(classState, unit.unitId);
    const damage = Math.floor(veilRotImmediatePayloadPerStack(stacks) * multiplier);
    if (damage <= 0) continue;
    hurtEnemy(damage, '[CATALYTIC RELEASE]', {
      channel: 'OCCULT',
      targetId: unit.unitId,
      rollCrit: false,
      indirectDamage: false,
    }, unit.unitId);
    totalDamageDealt += damage;
    unitsHit += 1;
    log(
      `>> [CATALYTIC RELEASE] — ${unit.designation} detonates ${damage} occult (${stacks} stack${stacks === 1 ? '' : 's'}).`,
    );
  }

  if (perfect) {
    for (const unit of infected) {
      if (!unit.unitId) continue;
      const spread = spreadVeilRotMitosis(classState, squad, unit.unitId);
      if (spread.length > 0) {
        mitosisSpreadCount += spread.length;
        log(`>> [SUNDER-SPREAD] — ${unit.designation} mitosis → ${spread.join(', ')}.`);
      }
    }
    log('>> [CATALYTIC RELEASE] >> Perfect release — stacks retained.');
  } else {
    log('>> [CATALYTIC RELEASE] >> Aetheric Rupture — sloppy detonation.');
  }

  return { perfect, totalDamageDealt, unitsHit, mitosisSpreadCount };
}
