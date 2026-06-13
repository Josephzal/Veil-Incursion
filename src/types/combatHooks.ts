import type { EnemyCombatProfile } from './run';
import type { BlueprintId } from './equipmentBlueprint';

export type PlayerDebuffId = 'BLEEDING' | 'FRACTURED';

export type EnemyStatusId = 'VULNERABLE' | 'BLINDED';

export interface PlayerCombatSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  shieldTurnsRemaining: number;
  debuffs: PlayerDebuffId[];
}

export interface CombatHookContext {
  blueprintId: BlueprintId | null;
  player: PlayerCombatSnapshot;
  target?: EnemyCombatProfile;
  squad: EnemyCombatProfile[];
  damage?: {
    raw: number;
    channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
    multiplier: number;
  };
  source?: string;
}

export interface CombatHookResult {
  playerShieldDelta?: number;
  playerShieldTurns?: number;
  playerHpDelta?: number;
  playerDebuffsRemoved?: PlayerDebuffId[];
  playerDebuffsAdded?: PlayerDebuffId[];
  damageMultiplier?: number;
  enemyStatusApplied?: Array<{
    unitId: string;
    status: EnemyStatusId;
    turns: number;
  }>;
  logLines: string[];
}

export interface CombatSessionExtras {
  playerShield: number;
  playerShieldTurnsRemaining: number;
  playerDebuffs: PlayerDebuffId[];
  enemyStatusTurns: Record<string, Partial<Record<EnemyStatusId, number>>>;
  /** Unit ids granted fracture immunity by a living Ley-Siren. */
  leySirenTetheredUnitIds: string[];
  leySirenSourceUnitId: string | null;
  /** AP stripped from operative next player turn (Miasma Tick / Lag Field). */
  playerApPenaltyNextTurn: number;
  /** Hard AP cap for operative next player turn (Veil Static — e.g. 2/3). */
  playerApCapNextTurn: number | null;
  /** Increments to drive IMMUNE floaters above hostiles. */
  immunePopupSeq: Record<string, number>;
}

export function createDefaultCombatSessionExtras(): CombatSessionExtras {
  return {
    playerShield: 0,
    playerShieldTurnsRemaining: 0,
    playerDebuffs: [],
    enemyStatusTurns: {},
    leySirenTetheredUnitIds: [],
    leySirenSourceUnitId: null,
    playerApPenaltyNextTurn: 0,
    playerApCapNextTurn: null,
    immunePopupSeq: {},
  };
}
