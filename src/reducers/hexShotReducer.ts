import {
  evaluateZeroProtocolReady,
  HEX_RELOAD_AP_COST,
  type HexShotCombatState,
} from '../types/hexShotState';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import {
  HEX_MAGAZINE_CONFIG,
  pushCalibratedAmmo,
  type HexAmmoType,
  type ReloadQuality,
} from '../types/hexAmmo';
import { getHexShotAbilityTags, HEX_SHOT_ABILITY_CATALOG } from '../data/hexShotAbilities';
import { getHexWeaponActionDefinition } from '../data/hexWeaponActionCatalog';
import { migrateHexShotAbilityId } from '../data/hexShotMigration';
import type { HexShotAbilityId } from '../types/operativeClass';

export type HexShotReducerAction =
  | { type: 'HEX_SYNC_RESOURCES'; patch: Partial<Pick<HexShotCombatState, 'hp' | 'maxHp' | 'stamina' | 'maxStamina' | 'ap' | 'ammo' | 'maxAmmo'>> }
  | { type: 'HEX_TURN_START'; ap: number; encounter: ClassCombatEncounterState; squad: readonly EnemyCombatProfile[] }
  | { type: 'HEX_BEGIN_RELOAD'; manual: boolean; deadMansSwitch?: boolean }
  | { type: 'HEX_RESOLVE_RELOAD'; quality: ReloadQuality; ammoType: HexAmmoType; encounter: ClassCombatEncounterState; squad: readonly EnemyCombatProfile[]; deadMansSwitchBlocksOvercharge?: boolean }
  /**
   * Phase H.1a — Sixth Seal (and similar) ultimate-owned magazine refill.
   * Refills ammo without Protocol / Overcharge / fail penalty / calibrated push.
   * Must not be used for ordinary Active Reload resolution.
   */
  | { type: 'HEX_ULTIMATE_OWNED_MAGAZINE_REFILL' }
  | { type: 'HEX_CONSUME_BALLISTIC_OVERCHARGE' }
  | { type: 'HEX_AFTER_BALLISTIC_SPEND' }
  | { type: 'HEX_PHANTOM_FEED' }
  | { type: 'HEX_REEVALUATE_ULTIMATE'; encounter: ClassCombatEncounterState; squad: readonly EnemyCombatProfile[] }
  | { type: 'HEX_EXECUTE_ZERO_PROTOCOL'; encounter: ClassCombatEncounterState; squad: readonly EnemyCombatProfile[] }
  | { type: 'HEX_DISMISS_RELOAD_PROMPT' };

/**
 * Zero Protocol availability is gated purely by Protocol Charges (v1 refactor) —
 * no full-mag / debuff requirement. `encounter`/`squad` retained for signature
 * stability with existing call sites.
 */
function withUltimate(
  state: HexShotCombatState,
  _encounter: ClassCombatEncounterState,
  _squad: readonly EnemyCombatProfile[],
): HexShotCombatState {
  return {
    ...state,
    isUltimateAvailable: evaluateZeroProtocolReady(state),
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
      // Refill magazine + set ammo type regardless of quality (reload is a pivot, not a punishment).
      const base: HexShotCombatState = {
        ...state,
        ammo: state.maxAmmo,
        currentAmmoType: action.ammoType,
        lastAmmoType: action.ammoType,
        lastReloadQuality: action.quality,
        isAutoLoadMinigameActive: false,
        isManualReloadMinigameActive: false,
        autoReloadPending: false,
        pendingEjectDamage: 0,
      };
      const perfect = action.quality === 'PERFECT' && !action.deadMansSwitchBlocksOvercharge;
      if (perfect) {
        return withUltimate(
          {
            ...base,
            protocolCharges: Math.min(state.maxProtocolCharges, state.protocolCharges + 1),
            calibratedAmmoTypes: pushCalibratedAmmo(state.calibratedAmmoTypes, action.ammoType),
            nextShotOvercharged: true,
            overchargeMultiplier: HEX_MAGAZINE_CONFIG.overchargedDamagePct / 100,
            firstShotPenaltyPending: false,
          },
          action.encounter,
          action.squad,
        );
      }
      // CLEAN (or Perfect blocked by Dead-Man's Switch): refill only, no Protocol / Overcharge.
      // FAILED: refill + a light −10% first-shot penalty (no Protocol, no stamina rip).
      return withUltimate(
        {
          ...base,
          nextShotOvercharged: false,
          overchargeMultiplier: 0,
          firstShotPenaltyPending: action.quality === 'FAILED',
        },
        action.encounter,
        action.squad,
      );
    }

    case 'HEX_ULTIMATE_OWNED_MAGAZINE_REFILL':
      // Presentation refill only — no Protocol, Overcharge, fail penalty, or calibrated push.
      return {
        ...state,
        ammo: state.maxAmmo,
        isAutoLoadMinigameActive: false,
        isManualReloadMinigameActive: false,
        autoReloadPending: false,
        pendingEjectDamage: 0,
      };

    case 'HEX_CONSUME_BALLISTIC_OVERCHARGE':
      return {
        ...state,
        overchargeMultiplier: 0,
        nextShotOvercharged: false,
        firstShotPenaltyPending: false,
      };

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
      // Consume all Protocol + clear calibrated sequence. Does NOT dump the magazine.
      return withUltimate(
        {
          ...state,
          protocolCharges: 0,
          calibratedAmmoTypes: [],
          isUltimateAvailable: false,
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
  const wa = getHexWeaponActionDefinition(abilityId as import('../types/hexWeaponAction').HexWeaponActionId);
  if (wa) return wa.tags.includes('BALLISTIC');
  const resolved = migrateHexShotAbilityId(abilityId);
  if (!(resolved in HEX_SHOT_ABILITY_CATALOG)) return false;
  return getHexShotAbilityTags(resolved as HexShotAbilityId).includes('BALLISTIC');
}

export function abilityUsesTacticalTags(abilityId: string): boolean {
  const wa = getHexWeaponActionDefinition(abilityId as import('../types/hexWeaponAction').HexWeaponActionId);
  if (wa) return wa.tags.includes('TACTICAL');
  const resolved = migrateHexShotAbilityId(abilityId);
  if (!(resolved in HEX_SHOT_ABILITY_CATALOG)) return false;
  return getHexShotAbilityTags(resolved as HexShotAbilityId).includes('TACTICAL');
}
