/**
 * Phase B.1 — authoritative Doomfall interruption + Poise/Committed ordering.
 * Hub and tests share these pure helpers; do not cancel Doomfall only in the simulator.
 */
import type { AegisWeaponCombatState } from './aegisWeaponCombatState';
import {
  cancelDoomfallCharge,
  clearPoise,
} from './aegisWeaponCombatState';
import {
  applyPercentDamageReduction,
  isEligibleDirectEnemyAttack,
} from './aegisWeaponActionRuntime';
import { POISE_DAMAGE_REDUCTION_PCT } from './aegisWeaponActionResolveEngine';
import { clampBrandGain } from './aegisWeaponActionResolveEngine';
import { RUNIC_BRAND_CAP } from '../types/aegisCombat';

/** Control / interrupt reasons that cancel an active Doomfall Charge or pending Release. */
export type AegisControlInterruptReason =
  | 'STUN'
  | 'KNOCKDOWN'
  | 'INTERRUPT_CHARGE'
  | 'DEATH';

export function isAegisDoomfallInterruptReason(
  reason: string,
): reason is AegisControlInterruptReason {
  return reason === 'STUN'
    || reason === 'KNOCKDOWN'
    || reason === 'INTERRUPT_CHARGE'
    || reason === 'DEATH';
}

export function doomfallIsCancellable(state: AegisWeaponCombatState): boolean {
  return state.committed || state.doomfallReleaseAvailable
    || state.doomfallOriginActionId != null;
}

/**
 * Cancel Doomfall Charge / pending Release.
 * No AP refund. Clears COMMITTED, Release availability, and originActionId.
 */
export function cancelDoomfallForControl(
  state: AegisWeaponCombatState,
  reason: AegisControlInterruptReason,
): { state: AegisWeaponCombatState; cancelled: boolean; logLine: string | null } {
  if (!doomfallIsCancellable(state)) {
    return { state, cancelled: false, logLine: null };
  }
  return {
    state: cancelDoomfallCharge(state),
    cancelled: true,
    logLine: `[DOOMFALL] >> Charge cancelled — ${reason}.`,
  };
}

/**
 * Deduped control interrupt for one authored enemy action.
 * Multi-hit actions share authoredActionId → one cancellation event.
 */
export function applyAegisControlInterrupt(args: {
  weaponState: AegisWeaponCombatState;
  reason: AegisControlInterruptReason;
  /** Shared id for every hit/control pulse of one authored enemy action. */
  authoredActionId?: string | null;
  /** Last authored action that already cancelled Doomfall this encounter window. */
  alreadyCancelledForActionId?: string | null;
}): {
  weaponState: AegisWeaponCombatState;
  cancelled: boolean;
  /** Update hub dedupe ref to this when cancelled. */
  cancelDedupeActionId: string | null;
  logLine: string | null;
} {
  const actionKey = args.authoredActionId ?? `control-${args.reason}`;
  if (
    args.alreadyCancelledForActionId != null
    && args.alreadyCancelledForActionId === actionKey
  ) {
    return {
      weaponState: args.weaponState,
      cancelled: false,
      cancelDedupeActionId: args.alreadyCancelledForActionId,
      logLine: null,
    };
  }
  const result = cancelDoomfallForControl(args.weaponState, args.reason);
  return {
    weaponState: result.state,
    cancelled: result.cancelled,
    cancelDedupeActionId: result.cancelled ? actionKey : (args.alreadyCancelledForActionId ?? null),
    logLine: result.logLine,
  };
}

export interface AegisInboundHitResolveArgs {
  weaponState: AegisWeaponCombatState;
  damage: number;
  eligible: boolean;
  /** Control attached to this authored action (may be empty). */
  controlEffects?: readonly AegisControlInterruptReason[];
  authoredActionId?: string | null;
  alreadyCancelledForActionId?: string | null;
  currentBrands?: number;
}

export interface AegisInboundHitResolveResult {
  damage: number;
  weaponState: AegisWeaponCombatState;
  /** Poise/Committed mastery — award before COMMITTED is cleared. */
  brandGain: number;
  doomfallCancelled: boolean;
  cancelDedupeActionId: string | null;
  poiseConsumed: boolean;
  logs: string[];
}

/**
 * Authoritative inbound ordering while POISE and/or COMMITTED are active:
 * 1. Snapshot Poise-triggered-while-Committed
 * 2. Apply Poise −35% to this damage instance
 * 3. (Caller allows Stun/Knockdown to resolve)
 * 4. Award exactly one Brand from Poise/Committed mastery
 * 5. Cancel Doomfall for attached control (after Brand)
 * 6. Consume Poise at action level when it triggered
 *
 * Clearing COMMITTED never erases an already-computed brandGain.
 */
export function resolveAegisInboundHitDefense(
  args: AegisInboundHitResolveArgs,
): AegisInboundHitResolveResult {
  let ws = args.weaponState;
  let damage = args.damage;
  const logs: string[] = [];
  let brandGain = 0;
  let poiseConsumed = false;
  let doomfallCancelled = false;
  let cancelDedupe = args.alreadyCancelledForActionId ?? null;

  const controls = (args.controlEffects ?? []).filter(isAegisDoomfallInterruptReason);
  const hasControl = controls.length > 0;
  const poiseTriggers = args.eligible && ws.poiseActive && (damage > 0 || hasControl);

  const poiseWhileCommitted = poiseTriggers && ws.committed;

  if (poiseTriggers && damage > 0) {
    damage = applyPercentDamageReduction(damage, POISE_DAMAGE_REDUCTION_PCT);
    logs.push(`[POISE] >> Incoming damage reduced ${POISE_DAMAGE_REDUCTION_PCT}%.`);
  }

  if (poiseWhileCommitted) {
    brandGain = clampBrandGain(args.currentBrands ?? 0, 1);
    if (brandGain > 0) {
      logs.push('[POISE] >> Committed payoff — 1 Brand.');
    } else if ((args.currentBrands ?? 0) >= RUNIC_BRAND_CAP) {
      logs.push('[POISE] >> Committed payoff — Brand cap reached.');
    }
  }

  if (poiseTriggers) {
    ws = clearPoise(ws);
    poiseConsumed = true;
  }

  // Control cancels Doomfall after Brand is decided (COMMITTED clear must not erase reward).
  if (hasControl) {
    const reason = controls[0]!;
    const interrupt = applyAegisControlInterrupt({
      weaponState: ws,
      reason,
      authoredActionId: args.authoredActionId,
      alreadyCancelledForActionId: cancelDedupe,
    });
    ws = interrupt.weaponState;
    if (interrupt.cancelled) {
      doomfallCancelled = true;
      cancelDedupe = interrupt.cancelDedupeActionId;
      if (interrupt.logLine) logs.push(interrupt.logLine);
    }
  }

  return {
    damage,
    weaponState: ws,
    brandGain,
    doomfallCancelled,
    cancelDedupeActionId: cancelDedupe,
    poiseConsumed,
    logs,
  };
}

/** Convenience: build eligibility for inbound direct attacks. */
export function inboundAttackEligible(args: {
  unblockable?: boolean;
  environmental?: boolean;
  damageOverTime?: boolean;
  damage: number;
  hasControl?: boolean;
}): boolean {
  return isEligibleDirectEnemyAttack({
    unblockable: args.unblockable,
    environmental: args.environmental,
    damageOverTime: args.damageOverTime,
    targetsAegis: true,
    isDamaging: args.damage > 0 || args.hasControl === true,
  });
}

/** After cancel: Release must not appear; origin cleared. */
export function assertDoomfallFullyCleared(state: AegisWeaponCombatState): boolean {
  return !state.committed
    && !state.doomfallReleaseAvailable
    && state.doomfallOriginActionId == null;
}
