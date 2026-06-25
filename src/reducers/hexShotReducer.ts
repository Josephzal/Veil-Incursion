import {
  evaluateHexShotUltimateAvailable,
  HEX_RELOAD_AP_COST,
  HEX_RELOAD_JAM_STAMINA_PENALTY,
  overchargeFromAmmoAtReloadStart,
  type HexShotCombatState,
} from '../types/hexShotState';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import type { ActiveReloadResult } from '../types/classCombatResources';
import { getHexShotAbilityTags } from '../data/hexShotAbilities';

export type HexShotReducerAction =
  | { type: 'HEX_SYNC_RESOURCES'; patch: Partial<Pick<HexShotCombatState, 'hp' | 'maxHp' | 'stamina' | 'maxStamina' | 'ap' | 'ammo' | 'maxAmmo'>> }
  | { type: 'HEX_TURN_START'; ap: number; encounter: ClassCombatEncounterState; squad: readonly EnemyCombatProfile[] }
  | { type: 'HEX_BEGIN_RELOAD'; manual: boolean; deadMansSwitch?: boolean }
  | { type: 'HEX_RESOLVE_RELOAD'; result: ActiveReloadResult; encounter: ClassCombatEncounterState; squad: readonly EnemyCombatProfile[]; deadMansSwitchBlocksOvercharge?: boolean }
  | { type: 'HEX_CONSUME_BALLISTIC_OVERCHARGE' }
  | { type: 'HEX_AFTER_BALLISTIC_SPEND' }
  | { type: 'HEX_PHANTOM_FEED' }
  | { type: 'HEX_REEVALUATE_ULTIMATE'; encounter: ClassCombatEncounterState; squad: readonly EnemyCombatProfile[] }
  | { type: 'HEX_EXECUTE_ZERO_PROTOCOL'; encounter: ClassCombatEncounterState; squad: readonly EnemyCombatProfile[] }
  | { type: 'HEX_DISMISS_RELOAD_PROMPT' };

function withUltimate(
  state: HexShotCombatState,
  encounter: ClassCombatEncounterState,
  squad: readonly EnemyCombatProfile[],
): HexShotCombatState {
  return {
    ...state,
    isUltimateAvailable: evaluateHexShotUltimateAvailable(
      state.overchargeMultiplier,
      squad,
      encounter,
    ),
  };
}

export function hexShotReducer(
  state: HexShotCombatState,
  action: HexShotReducerAction,
): HexShotCombatState {
  switch (action.type) {
    case 'HEX_SYNC_RESOURCES':
      return { ...state, ...action.patch };

    case 'HEX_TURN_START': {
      const next = {
        ...state,
        ap: action.ap,
        autoReloadPending: false,
        isAutoLoadMinigameActive: false,
        isManualReloadMinigameActive: false,
      };
      return withUltimate(next, action.encounter, action.squad);
    }

    case 'HEX_BEGIN_RELOAD': {
      if (state.ap < HEX_RELOAD_AP_COST) return state;
      const ammoAtReloadStart = state.ammo;
      let pendingEjectDamage = state.pendingEjectDamage;
      let ammo = state.ammo;
      if (action.deadMansSwitch && ammo > 0) {
        pendingEjectDamage = ammo * 10;
        ammo = 0;
      }
      return {
        ...state,
        ap: state.ap - HEX_RELOAD_AP_COST,
        ammo,
        ammoAtReloadStart,
        pendingEjectDamage,
        autoReloadPending: false,
        isAutoLoadMinigameActive: !action.manual,
        isManualReloadMinigameActive: action.manual,
      };
    }

    case 'HEX_RESOLVE_RELOAD': {
      const base: HexShotCombatState = {
        ...state,
        ammo: state.maxAmmo,
        isAutoLoadMinigameActive: false,
        isManualReloadMinigameActive: false,
        autoReloadPending: false,
        pendingEjectDamage: 0,
      };
      if (action.result === 'PERFECT' && !action.deadMansSwitchBlocksOvercharge) {
        const overchargeMultiplier = overchargeFromAmmoAtReloadStart(
          state.ammoAtReloadStart,
          state.maxAmmo,
        );
        return withUltimate(
          { ...base, overchargeMultiplier },
          action.encounter,
          action.squad,
        );
      }
      const stamina = Math.max(0, state.stamina - HEX_RELOAD_JAM_STAMINA_PENALTY);
      return withUltimate({ ...base, stamina, overchargeMultiplier: 0 }, action.encounter, action.squad);
    }

    case 'HEX_CONSUME_BALLISTIC_OVERCHARGE':
      return { ...state, overchargeMultiplier: 0, isUltimateAvailable: false };

    case 'HEX_AFTER_BALLISTIC_SPEND':
      if (state.ammo !== 0) return state;
      return { ...state, autoReloadPending: true };

    case 'HEX_PHANTOM_FEED':
      return {
        ...state,
        ammo: Math.min(state.maxAmmo, state.ammo + 1),
      };

    case 'HEX_REEVALUATE_ULTIMATE':
      return withUltimate(state, action.encounter, action.squad);

    case 'HEX_EXECUTE_ZERO_PROTOCOL':
      return withUltimate(
        {
          ...state,
          ammo: 0,
          overchargeMultiplier: 0,
          isUltimateAvailable: false,
          autoReloadPending: true,
        },
        action.encounter,
        action.squad,
      );

    case 'HEX_DISMISS_RELOAD_PROMPT':
      return { ...state, autoReloadPending: false };

    default:
      return state;
  }
}

export function canBeginHexShotReload(state: HexShotCombatState): boolean {
  return state.ap >= HEX_RELOAD_AP_COST && !state.isAutoLoadMinigameActive && !state.isManualReloadMinigameActive;
}

export function abilityUsesBallisticTags(abilityId: string): boolean {
  return getHexShotAbilityTags(abilityId as import('../types/operativeClass').HexShotAbilityId).includes('BALLISTIC');
}

export function abilityUsesTacticalTags(abilityId: string): boolean {
  return getHexShotAbilityTags(abilityId as import('../types/operativeClass').HexShotAbilityId).includes('TACTICAL');
}
