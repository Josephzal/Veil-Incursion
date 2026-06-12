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
}

export function createDefaultCombatSessionExtras(): CombatSessionExtras {
  return {
    playerShield: 0,
    playerShieldTurnsRemaining: 0,
    playerDebuffs: [],
    enemyStatusTurns: {},
  };
}
