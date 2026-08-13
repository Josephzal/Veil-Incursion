/**
 * Phase E.1b — Unmaker / Claymore Tier III Fracture-break → Abyssal Reserve.
 * Stage II-C — T3 once-per-combat passives removed; grant path fails closed.
 */
import type { AegisWeaponActionId } from '../types/aegisCombat';
import type {
  ResolvedWeaponState,
  WeaponOncePerCombatPassiveId,
} from '../types/weapon';
import { deriveAegisWeaponActions } from './aegisWeaponActionRegistry';

/** @deprecated Stage II-C — T3 passives removed; retained for type/compat only. */
export const UNMAKER_T3_FRACTURE_BREAK_RESERVE_PASSIVE:
  WeaponOncePerCombatPassiveId = 'FRACTURE_BREAK_RESERVE';

/** @deprecated Migration alias — treat as FRACTURE_BREAK_RESERVE. */
export const UNMAKER_T3_LEGACY_STAMINA_PASSIVE:
  WeaponOncePerCombatPassiveId = 'FIRST_FRACTURE_STAMINA_REFUND';

export const UNMAKER_T3_FRACTURE_BREAK_RESERVE_AMOUNT = 1;

export const UNMAKER_T3_FRACTURE_BREAK_PLAYER_COPY =
  'Fracture Break: Gain 1 Abyssal Reserve when a Claymore action breaks Fracture. Once per action.';

const UNMAKER_ACTIONS = new Set<string>(deriveAegisWeaponActions('aegis-claymore'));

export function isUnmakerWeaponActionId(id: string | null | undefined): id is AegisWeaponActionId {
  return id != null && UNMAKER_ACTIONS.has(id);
}

/** Stage II-C — always inactive (oncePerCombatPassive retired). */
export function weaponHasUnmakerTier3FractureBreakReserve(
  _weapon: Pick<ResolvedWeaponState, 'familyId'> | null | undefined,
): boolean {
  return false;
}

/** Stage II-C — always 0. */
export function resolveUnmakerTier3FractureBreakReserveAmount(
  _weapon: Pick<ResolvedWeaponState, 'familyId'> | null | undefined,
): number {
  return 0;
}

export interface UnmakerT3FractureBreakGrantInput {
  weapon: Pick<ResolvedWeaponState, 'familyId'> | null | undefined;
  /** True only when hurtEnemy is about to cause a Fracture break (gauge threshold). */
  causesFractureBreak: boolean;
  abilityId?: string | null;
  playerActionId?: string | null;
  /** Graft-added Echo/Splinter delivery. */
  echoHit?: boolean;
  /** playerActionId already rewarded this commitment. */
  grantedForPlayerActionId: string | null;
}

export interface UnmakerT3FractureBreakGrantResult {
  reserveGain: number;
  nextGrantedForPlayerActionId: string | null;
  logLine: string | null;
}

/**
 * Pure grant decision at the Fracture-break event boundary.
 * Stage II-C — always inactive / never awards.
 */
export function resolveUnmakerTier3FractureBreakReserveGrant(
  input: UnmakerT3FractureBreakGrantInput,
): UnmakerT3FractureBreakGrantResult {
  return {
    reserveGain: 0,
    nextGrantedForPlayerActionId: input.grantedForPlayerActionId,
    logLine: null,
  };
}
