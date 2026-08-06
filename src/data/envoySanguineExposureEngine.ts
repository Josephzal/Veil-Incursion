/**
 * E.4 — Heart’s Due sanguineExposure encounter-local family state.
 * Never serialized to account/run loadouts.
 */
import type { ClassCombatEncounterState } from '../types/classCombatAbility';

export function hasSanguineExposure(
  classState: ClassCombatEncounterState,
  unitId: string,
): boolean {
  return classState.sanguineExposure[unitId] === true;
}

export function armSanguineExposure(
  classState: ClassCombatEncounterState,
  unitId: string,
): void {
  classState.sanguineExposure[unitId] = true;
}

/** Consume mark if present; returns whether it was armed. */
export function consumeSanguineExposure(
  classState: ClassCombatEncounterState,
  unitId: string,
): boolean {
  if (!hasSanguineExposure(classState, unitId)) return false;
  delete classState.sanguineExposure[unitId];
  return true;
}

export function clearSanguineExposureForUnit(
  classState: ClassCombatEncounterState,
  unitId: string,
): void {
  delete classState.sanguineExposure[unitId];
}

/** End of enemy turn — expire unconsumed marks. */
export function expireSanguineExposureEndOfEnemyTurn(
  classState: ClassCombatEncounterState,
): void {
  classState.sanguineExposure = {};
}

export function clearAllSanguineExposure(classState: ClassCombatEncounterState): void {
  classState.sanguineExposure = {};
}

export function armSmokeArcAccuracyDown(
  classState: ClassCombatEncounterState,
  unitId: string,
): void {
  classState.smokeArcAccuracyDown[unitId] = true;
}

export function clearSmokeArcAccuracyDownEndOfEnemyTurn(
  classState: ClassCombatEncounterState,
): void {
  classState.smokeArcAccuracyDown = {};
}

export function clearSmokeArcAccuracyDownForUnit(
  classState: ClassCombatEncounterState,
  unitId: string,
): void {
  delete classState.smokeArcAccuracyDown[unitId];
}
