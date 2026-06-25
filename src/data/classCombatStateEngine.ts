import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { HexShotAbilityId } from '../types/operativeClass';
import type { EnemyCombatProfile } from '../types/run';
import { getUnitById, isUnitAlive } from './combatSquadEngine';

export const BLEEDING_PAYLOAD_DOT = 6;

export function isEnemyHealBlocked(
  classState: ClassCombatEncounterState,
  unitId: string,
  hasFleshRot = false,
): boolean {
  if (classState.fleshWarpUnits[unitId] === true) return true;
  if (hasFleshRot && (classState.entropyHexTurns[unitId] ?? 0) > 0) return true;
  return false;
}

export function isGhostCamoBlockingAttacks(classState: ClassCombatEncounterState): boolean {
  return classState.ghostCamoTurnsRemaining > 0;
}

export function resolveAstralLockCrit(
  targetId: string | undefined,
  abilityId: HexShotAbilityId | undefined,
  hasBallisticTag: boolean,
  classState: ClassCombatEncounterState,
): { forceCrit: boolean; consumeLock: boolean } {
  if (
    targetId
    && abilityId
    && hasBallisticTag
    && classState.astralLockUnitId === targetId
  ) {
    return { forceCrit: true, consumeLock: true };
  }
  return { forceCrit: false, consumeLock: false };
}

export function applyBleedingPayloadDot(
  squad: EnemyCombatProfile[],
  turns: Record<string, number>,
  hurtEnemy: (
    raw: number,
    tag: string,
    options: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      abilityId?: HexShotAbilityId;
      targetId?: string;
      rollCrit?: boolean;
      indirectDamage?: boolean;
    },
    targetId?: string,
  ) => void,
  log: (msg: string) => void,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [unitId, remaining] of Object.entries(turns)) {
    const unit = getUnitById(squad, unitId);
    if (!unit?.unitId || !isUnitAlive(unit)) continue;
    hurtEnemy(BLEEDING_PAYLOAD_DOT, '[BLEEDING PAYLOAD]', {
      channel: 'OCCULT',
      abilityId: 'BLEEDING_PAYLOAD',
      targetId: unitId,
      rollCrit: false,
      indirectDamage: true,
    }, unitId);
    log(`[BLEEDING PAYLOAD] >> ${unit.designation} — ${BLEEDING_PAYLOAD_DOT} occult burn.`);
    if (remaining > 1) next[unitId] = remaining - 1;
  }
  return next;
}

export function applyEnemyApDrainAtTurnStart(
  unitId: string,
  designation: string,
  classState: ClassCombatEncounterState,
  reduceEnemyAp: (unitId: string, amount: number) => void,
  log: (msg: string) => void,
): void {
  const drain = classState.enemyApDrainNextTurn[unitId];
  if (!drain || drain <= 0) return;
  delete classState.enemyApDrainNextTurn[unitId];
  reduceEnemyAp(unitId, drain);
  log(`[AP SIPHON] >> ${designation} — ${drain} AP siphoned.`);
}
