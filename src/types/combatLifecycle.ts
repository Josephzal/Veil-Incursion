import type { DamageChannel } from './aegisCombat';
import type { EnemyCombatProfile } from './run';
import type { CombatSessionExtras } from './combatHooks';

export type AdaptedElement = 'Kinetic' | 'Occult' | null;

export interface PlayerCombatState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  abyssalReserve: number;
  actionPoints: number;
  activeBuffs?: readonly string[];
}

export interface AttackData {
  raw: number;
  channel: DamageChannel;
  source?: string;
  /** HP remaining if this hit lands unmodified. */
  projectedHpAfter: number;
}

export interface KillingBlowData {
  channel: DamageChannel;
  damage: number;
  source?: string;
}

export interface CombatLifecycleContext {
  squad: EnemyCombatProfile[];
  player: PlayerCombatState;
  extras: CombatSessionExtras;
}

export interface TurnStartLifecycleResult {
  squad: EnemyCombatProfile[];
  logLines: string[];
  extras?: Partial<CombatSessionExtras>;
  /** Optional floating status label (e.g. goliath regenerate). */
  statusFloatLabel?: string;
  statusFloatUnitId?: string;
  playerHpDelta?: number;
  playerStaminaDelta?: number;
  /** Units that reached true death during turn-start (must dissolve / check victory). */
  forceDissolveUnitIds?: string[];
}

export interface HitTakenLifecycleResult {
  squad: EnemyCombatProfile[];
  logLines: string[];
  negateDamage?: boolean;
  damageOverride?: number;
  showImmunePopup?: boolean;
  immunePopupUnitId?: string;
  extras?: Partial<CombatSessionExtras>;
  playerHpDelta?: number;
  /** Scuttler counter-attack after dodge. */
  scuttlerCounter?: boolean;
  playerStaminaDelta?: number;
}

export interface DeathLifecycleResult {
  squad: EnemyCombatProfile[];
  logLines: string[];
  delayDissolve?: boolean;
  triggerRetributionParry?: {
    unitId: string;
    occultDamage: number;
  };
  extras?: Partial<CombatSessionExtras>;
  /** Leave ash token at dead unit's grid slot for scavengers. */
  ashTokenSlot?: import('./combatGrid').CombatGridSlotId;
  playerHpDelta?: number;
  /** Thrall slump — keep unit on grid instead of dissolving. */
  enterSlump?: boolean;
}

export type TurnStartHandler = (
  enemy: EnemyCombatProfile,
  ctx: CombatLifecycleContext,
) => TurnStartLifecycleResult;

export type HitTakenHandler = (
  enemy: EnemyCombatProfile,
  attack: AttackData,
  ctx: CombatLifecycleContext,
) => HitTakenLifecycleResult;

export type DeathHandler = (
  enemy: EnemyCombatProfile,
  killingBlow: KillingBlowData,
  ctx: CombatLifecycleContext,
) => DeathLifecycleResult;
