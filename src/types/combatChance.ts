import type { AegisAbilityId } from './aegisCombat';
import type { DamageChannel } from './aegisCombat';
import type { EnemyCombatProfile } from './run';

export const COMBAT_CHANCE = {
  PLAYER_BASE_CRIT: 0.10,
  PLAYER_BASE_EVADE: 0.08,
  ENEMY_BASE_CRIT: 0.02,
  ENEMY_BASE_EVADE: 0.00,
  CRIT_DAMAGE_MULTIPLIER: 1.5,
  SHADOW_STEP_EVADE_BONUS: 0.15,
  VEIL_PIERCER_CRIT_BONUS: 0.10,
  SHATTER_POINT_CRIT_BONUS: 0.20,
  GRID_GHOST_EVADE_PER_STACK: 0.05,
  GRID_GHOST_MAX_STACKS: 3,
  GRID_GHOST_STAMINA_REFUND_PCT: 0.20,
  PHANTOM_CRIT_SPLIT_PCT: 0.50,
} as const;

export interface CombatChanceEncounterState {
  shadowStepEvadeActive: boolean;
  gridGhostEvadeStacks: number;
  momentumShiftEvadeDisabled: boolean;
}

export function createDefaultCombatChanceState(): CombatChanceEncounterState {
  return {
    shadowStepEvadeActive: false,
    gridGhostEvadeStacks: 0,
    momentumShiftEvadeDisabled: false,
  };
}

export interface PlayerCritContext {
  abilityId?: AegisAbilityId;
  target: EnemyCombatProfile;
  factionCritBonus: number;
  hasShatterPoint: boolean;
  guaranteedCrits: number;
}

export interface PlayerEvadeContext {
  shadowStepEvadeActive: boolean;
  gridGhostEvadeStacks: number;
  momentumShiftEvadeDisabled: boolean;
}

export interface EnemyCritContext {
  attacker: EnemyCombatProfile;
}

export interface EnemyEvadeContext {
  defender: EnemyCombatProfile;
}

export interface CombatHitResolution {
  evaded: boolean;
  critical: boolean;
  ignoreDefenses: boolean;
  critMultiplier: number;
}

export type CombatFeedbackKind =
  | 'PLAYER_EVADE'
  | 'ENEMY_EVADE'
  | 'PLAYER_CRIT'
  | 'ENEMY_CRIT';

export interface CombatFeedbackEvent {
  kind: CombatFeedbackKind;
  channel?: DamageChannel;
}
