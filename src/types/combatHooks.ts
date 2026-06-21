import type { CombatGridSlotId } from './combatGrid';
import type { EnemyCombatProfile } from './run';
import type { BlueprintId } from './equipmentBlueprint';

export type PlayerDebuffId =
  | 'BLEEDING'
  | 'FRACTURED'
  | 'ECHO_DEBUFF'
  | 'SENSORY_JAMMED'
  | 'TARGET_LOCKED'
  | 'ASHEN_ROT'
  | 'JAMMED_AUGMENT'
  | 'ROOTED'
  | 'SEARING'
  | 'LASER_SIGHT';

export interface StructuredPlayerDebuff {
  type: PlayerDebuffId;
  amount?: number;
  turnsRemaining: number;
}

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

export interface AshBoardToken {
  turnsRemaining: number;
}

export interface CombatSessionExtras {
  playerShield: number;
  playerShieldTurnsRemaining: number;
  playerDebuffs: PlayerDebuffId[];
  structuredDebuffs: StructuredPlayerDebuff[];
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
  /** Narrative Overcharged boon — first damaging player strike ignores mitigation. */
  overchargedActive: boolean;
  /** Narrative Veil Ward boon — shield persists for full encounter. */
  narrativeVeilWardActive: boolean;
  /** Ash tokens left on grid slots after enemy death (1 turn). */
  ashTokens: Partial<Record<CombatGridSlotId, AshBoardToken>>;
  /** Player guarded or dodged this turn — clears echo debuff. */
  playerDefendedThisTurn: boolean;
  /** Hook Weaver — stamina drain when damaging tethered ally. */
  hookWeaverTetheredUnitId: string | null;
  /** Memory Leech — disabled augment slot index (0–2). */
  jammedAugmentSlot: number | null;
  /** Envoy Flesh-Warp — unit ids with healing negated. */
  fleshWarpUnitIds: Record<string, boolean>;
}

export function createDefaultCombatSessionExtras(): CombatSessionExtras {
  return {
    playerShield: 0,
    playerShieldTurnsRemaining: 0,
    playerDebuffs: [],
    structuredDebuffs: [],
    enemyStatusTurns: {},
    leySirenTetheredUnitIds: [],
    leySirenSourceUnitId: null,
    playerApPenaltyNextTurn: 0,
    playerApCapNextTurn: null,
    immunePopupSeq: {},
    overchargedActive: false,
    narrativeVeilWardActive: false,
    ashTokens: {},
    playerDefendedThisTurn: false,
    hookWeaverTetheredUnitId: null,
    jammedAugmentSlot: null,
    fleshWarpUnitIds: {},
  };
}

export function syncFlatDebuffsFromStructured(extras: CombatSessionExtras): void {
  extras.playerDebuffs = extras.structuredDebuffs.map((d) => d.type);
}

export function addStructuredDebuff(
  extras: CombatSessionExtras,
  debuff: StructuredPlayerDebuff,
): void {
  const existing = extras.structuredDebuffs.findIndex((d) => d.type === debuff.type);
  if (existing >= 0) {
    extras.structuredDebuffs[existing] = debuff;
  } else {
    extras.structuredDebuffs.push(debuff);
  }
  syncFlatDebuffsFromStructured(extras);
}

export function removeStructuredDebuff(
  extras: CombatSessionExtras,
  type: PlayerDebuffId,
): void {
  extras.structuredDebuffs = extras.structuredDebuffs.filter((d) => d.type !== type);
  syncFlatDebuffsFromStructured(extras);
}

export function hasStructuredDebuff(
  extras: CombatSessionExtras,
  type: PlayerDebuffId,
): boolean {
  return extras.structuredDebuffs.some((d) => d.type === type);
}
