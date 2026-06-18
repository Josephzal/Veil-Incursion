import { addCombatTag, hasCombatTag, isEnemyFractured } from './combatFractureEngine';
import { aliveUnits } from './combatSquadEngine';
import { laneForSlot } from '../types/combatGrid';
import type {
  CombatHookContext,
  CombatHookResult,
  CombatSessionExtras,
  EnemyStatusId,
  PlayerDebuffId,
} from '../types/combatHooks';
import type { BlueprintId } from '../types/equipmentBlueprint';
import type { EnemyCombatProfile } from '../types/run';

function applyEnemyStatus(
  extras: CombatSessionExtras,
  unitId: string,
  status: EnemyStatusId,
  turns: number,
): void {
  extras.enemyStatusTurns[unitId] = {
    ...extras.enemyStatusTurns[unitId],
    [status]: turns,
  };
}

export function getEnemyDamageTakenMultiplier(
  unit: EnemyCombatProfile,
  extras: CombatSessionExtras,
): number {
  let mult = 1;
  const vulnerableTurns = extras.enemyStatusTurns[unit.unitId ?? '']?.VULNERABLE ?? 0;
  if (vulnerableTurns > 0 || hasCombatTag(unit, 'VULNERABLE')) {
    mult *= 1.15;
  }
  return mult;
}

export function getEnemyAccuracyPenalty(
  unit: EnemyCombatProfile,
  extras: CombatSessionExtras,
): number {
  const blindedTurns = extras.enemyStatusTurns[unit.unitId ?? '']?.BLINDED ?? 0;
  if (blindedTurns > 0 || hasCombatTag(unit, 'BLINDED')) {
    return 0.3;
  }
  return 0;
}

export function tickCombatSessionExtras(extras: CombatSessionExtras): void {
  if (extras.playerShieldTurnsRemaining > 0 && !extras.narrativeVeilWardActive) {
    extras.playerShieldTurnsRemaining -= 1;
    if (extras.playerShieldTurnsRemaining <= 0) {
      extras.playerShield = 0;
    }
  }
  extras.structuredDebuffs = extras.structuredDebuffs
    .map((d) => ({ ...d, turnsRemaining: d.turnsRemaining - 1 }))
    .filter((d) => d.turnsRemaining > 0);
  extras.playerDebuffs = extras.structuredDebuffs.map((d) => d.type);

  Object.keys(extras.ashTokens).forEach((slot) => {
    const key = slot as keyof typeof extras.ashTokens;
    const token = extras.ashTokens[key];
    if (!token) return;
    token.turnsRemaining -= 1;
    if (token.turnsRemaining <= 0) {
      delete extras.ashTokens[key];
    }
  });

  extras.playerDefendedThisTurn = false;
  Object.keys(extras.enemyStatusTurns).forEach((unitId) => {
    const entry = extras.enemyStatusTurns[unitId];
    (['VULNERABLE', 'BLINDED'] as EnemyStatusId[]).forEach((status) => {
      if (entry[status] != null && entry[status]! > 0) {
        entry[status] = entry[status]! - 1;
        if (entry[status]! <= 0) {
          delete entry[status];
        }
      }
    });
    if (Object.keys(entry).length === 0) {
      delete extras.enemyStatusTurns[unitId];
    }
  });
}

export function runOnCombatStartHooks(
  blueprintId: BlueprintId | null,
  ctx: CombatHookContext,
  extras: CombatSessionExtras,
): CombatHookResult {
  const logLines: string[] = [];
  if (blueprintId !== 'envoy_hex') {
    return { logLines };
  }
  const hostiles = aliveUnits(ctx.squad);
  if (hostiles.length === 0) return { logLines };
  const pick = hostiles[Math.floor(Math.random() * hostiles.length)];
  if (!pick.unitId) return { logLines };
  applyEnemyStatus(extras, pick.unitId, 'VULNERABLE', 99);
  logLines.push(`[ENVOY HEX] >> ${pick.designation} marked Vulnerable (+15% damage).`);
  return {
    enemyStatusApplied: [{ unitId: pick.unitId, status: 'VULNERABLE', turns: 99 }],
    logLines,
  };
}

export function runOnFireHooks(
  blueprintId: BlueprintId | null,
  ctx: CombatHookContext,
): CombatHookResult {
  const logLines: string[] = [];
  if (blueprintId !== 'riftshot_pulse_rifle') {
    return { logLines, damageMultiplier: 1 };
  }
  const hpCost = Math.floor(ctx.player.maxHp * 0.05);
  logLines.push(`[PULSE RIFLE] >> Overcharge bleed — ${hpCost} Soul Anchor.`);
  let damageMultiplier = 1;
  if (ctx.target?.affinity === 'SPECTRAL') {
    damageMultiplier = 2;
    logLines.push('[PULSE RIFLE] >> Spectral resonance — 2× damage.');
  }
  return {
    playerHpDelta: -hpCost,
    damageMultiplier,
    logLines,
  };
}

export function runOnHitHooks(
  blueprintId: BlueprintId | null,
  ctx: CombatHookContext,
  extras: CombatSessionExtras,
): CombatHookResult {
  const logLines: string[] = [];
  if (blueprintId !== 'aegis_claymore' || !ctx.target) {
    return { logLines };
  }
  if (!isEnemyFractured(ctx.target) && !hasCombatTag(ctx.target, 'FRACTURED')) {
    return { logLines };
  }
  extras.playerShield = 10;
  extras.playerShieldTurnsRemaining = 1;
  logLines.push('[CLAYMORE] >> Fracture resonance — +10 shield (1 turn).');
  return {
    playerShieldDelta: 10,
    playerShieldTurns: 1,
    logLines,
  };
}

export function applyFrontlineBlinded(
  squad: EnemyCombatProfile[],
  extras: CombatSessionExtras,
  turns: number,
): CombatHookResult {
  const logLines: string[] = [];
  const applied: CombatHookResult['enemyStatusApplied'] = [];
  squad.forEach((unit) => {
    if (!unit.unitId || !unit.gridSlot) return;
    if (laneForSlot(unit.gridSlot) !== 'FRONTLINE') return;
    applyEnemyStatus(extras, unit.unitId, 'BLINDED', turns);
    applied?.push({ unitId: unit.unitId, status: 'BLINDED', turns });
  });
  if (applied && applied.length > 0) {
    logLines.push(`[VEIL-ASH GRENADE] >> ${applied.length} frontline hostiles blinded (−30% accuracy, ${turns} turns).`);
  }
  return { enemyStatusApplied: applied, logLines };
}

export function patchEnemyTagsFromExtras(
  unit: EnemyCombatProfile,
  extras: CombatSessionExtras,
): EnemyCombatProfile {
  if (!unit.unitId) return unit;
  let next = unit;
  const statuses = extras.enemyStatusTurns[unit.unitId];
  if (statuses?.VULNERABLE && statuses.VULNERABLE > 0) {
    next = addCombatTag(next, 'VULNERABLE');
  }
  if (statuses?.BLINDED && statuses.BLINDED > 0) {
    next = addCombatTag(next, 'BLINDED');
  }
  return next;
}
