/**
 * Phase E.1b — Unmaker Tier III Fracture-break → Abyssal Reserve.
 * Once per authored weapon-action commitment; graft-added hits cannot grant.
 */
import type { AegisWeaponActionId } from '../types/aegisCombat';
import type {
  ResolvedWeaponState,
  WeaponOncePerCombatPassiveId,
} from '../types/weapon';
import { deriveAegisWeaponActions } from './aegisWeaponActionRegistry';

/** Canonical Tier III passive id (replaces dead FIRST_FRACTURE_STAMINA_REFUND). */
export const UNMAKER_T3_FRACTURE_BREAK_RESERVE_PASSIVE:
  WeaponOncePerCombatPassiveId = 'FRACTURE_BREAK_RESERVE';

/** @deprecated Migration alias — treat as FRACTURE_BREAK_RESERVE. */
export const UNMAKER_T3_LEGACY_STAMINA_PASSIVE:
  WeaponOncePerCombatPassiveId = 'FIRST_FRACTURE_STAMINA_REFUND';

export const UNMAKER_T3_FRACTURE_BREAK_RESERVE_AMOUNT = 1;

export const UNMAKER_T3_FRACTURE_BREAK_PLAYER_COPY =
  'Fracture Break: Gain 1 Abyssal Reserve when an Unmaker action breaks Fracture. Once per action.';

const UNMAKER_ACTIONS = new Set<string>(deriveAegisWeaponActions('aegis-claymore-blade'));

export function isUnmakerWeaponActionId(id: string | null | undefined): id is AegisWeaponActionId {
  return id != null && UNMAKER_ACTIONS.has(id);
}

export function weaponHasUnmakerTier3FractureBreakReserve(
  weapon: Pick<ResolvedWeaponState, 'familyId' | 'oncePerCombatPassive'> | null | undefined,
): boolean {
  if (!weapon || weapon.familyId !== 'aegis-claymore-blade') return false;
  const p = weapon.oncePerCombatPassive;
  return p === 'FRACTURE_BREAK_RESERVE' || p === 'FIRST_FRACTURE_STAMINA_REFUND';
}

export function resolveUnmakerTier3FractureBreakReserveAmount(
  weapon: Pick<ResolvedWeaponState, 'familyId' | 'oncePerCombatPassive' | 'passiveBonusPct'> | null | undefined,
): number {
  if (!weaponHasUnmakerTier3FractureBreakReserve(weapon)) return 0;
  const bonus = weapon?.passiveBonusPct;
  return bonus != null && bonus > 0 ? bonus : UNMAKER_T3_FRACTURE_BREAK_RESERVE_AMOUNT;
}

export interface UnmakerT3FractureBreakGrantInput {
  weapon: Pick<ResolvedWeaponState, 'familyId' | 'oncePerCombatPassive' | 'passiveBonusPct'> | null | undefined;
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
 * Call only when the live path has determined a break will occur from this hit.
 */
export function resolveUnmakerTier3FractureBreakReserveGrant(
  input: UnmakerT3FractureBreakGrantInput,
): UnmakerT3FractureBreakGrantResult {
  const noGrant = {
    reserveGain: 0,
    nextGrantedForPlayerActionId: input.grantedForPlayerActionId,
    logLine: null,
  };
  if (!input.causesFractureBreak) return noGrant;
  if (input.echoHit) return noGrant;
  if (!weaponHasUnmakerTier3FractureBreakReserve(input.weapon)) return noGrant;
  if (!isUnmakerWeaponActionId(input.abilityId ?? null)) return noGrant;
  // Doomfall Charge never delivers fracture hits; Release shares playerActionId.
  const actionKey = input.playerActionId ?? input.abilityId ?? null;
  if (actionKey != null && input.grantedForPlayerActionId === actionKey) {
    return noGrant;
  }
  const reserveGain = resolveUnmakerTier3FractureBreakReserveAmount(input.weapon);
  if (reserveGain <= 0) return noGrant;
  return {
    reserveGain,
    nextGrantedForPlayerActionId: actionKey,
    logLine: `[UNMAKER] >> Fracture break — +${reserveGain} Abyssal Reserve.`,
  };
}
