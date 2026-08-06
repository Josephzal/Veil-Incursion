/**
 * Phase B.1 — authoritative player control/status application for Aegis.
 * STUN / KNOCKDOWN / INTERRUPT_CHARGE / DEATH cancel Doomfall through this pipeline.
 */
import type { CombatSessionExtras, PlayerDebuffId } from '../types/combatHooks';
import { addStructuredDebuff } from '../types/combatHooks';
import type { AegisWeaponCombatState } from './aegisWeaponCombatState';
import {
  applyAegisControlInterrupt,
  assertDoomfallFullyCleared,
  resolveAegisInboundHitDefense,
  type AegisControlInterruptReason,
} from './aegisDoomfallInterruptEngine';

export interface AegisControlPipelineSession {
  /** Dedupes multi-hit cancellation for one authored enemy action. */
  lastDoomfallCancelActionId: string | null;
}

export function createAegisControlPipelineSession(): AegisControlPipelineSession {
  return { lastDoomfallCancelActionId: null };
}

export interface ApplyPlayerControlArgs {
  weaponState: AegisWeaponCombatState;
  extras: CombatSessionExtras;
  session: AegisControlPipelineSession;
  reason: AegisControlInterruptReason;
  authoredActionId?: string | null;
  /** Persist STUN/KNOCKDOWN as structured debuffs (not for DEATH / INTERRUPT_CHARGE). */
  applyDebuff?: boolean;
  debuffTurns?: number;
  currentBrands?: number;
  /**
   * When true, Poise+Committed mastery may fire even with 0 damage
   * (non-damaging Stun/Knockdown on a Poise-protected action).
   */
  poiseEligible?: boolean;
}

export interface ApplyPlayerControlResult {
  weaponState: AegisWeaponCombatState;
  session: AegisControlPipelineSession;
  brandGain: number;
  doomfallCancelled: boolean;
  doomfallCleared: boolean;
  logs: string[];
}

/**
 * Apply STUN / KNOCKDOWN / INTERRUPT_CHARGE / DEATH.
 * Awards Poise/Committed Brand before clearing COMMITTED when Poise is active.
 */
export function applyAegisPlayerControl(
  args: ApplyPlayerControlArgs,
): ApplyPlayerControlResult {
  const logs: string[] = [];
  let ws = args.weaponState;
  let session = { ...args.session };
  let brandGain = 0;

  // Poise + Committed on control-only pulses (0 damage).
  if (
    args.poiseEligible !== false
    && (args.reason === 'STUN' || args.reason === 'KNOCKDOWN')
    && ws.poiseActive
  ) {
    const inbound = resolveAegisInboundHitDefense({
      weaponState: ws,
      damage: 0,
      eligible: true,
      controlEffects: [args.reason],
      authoredActionId: args.authoredActionId,
      alreadyCancelledForActionId: session.lastDoomfallCancelActionId,
      currentBrands: args.currentBrands,
    });
    ws = inbound.weaponState;
    brandGain = inbound.brandGain;
    session.lastDoomfallCancelActionId = inbound.cancelDedupeActionId;
    logs.push(...inbound.logs);
  } else {
    const interrupt = applyAegisControlInterrupt({
      weaponState: ws,
      reason: args.reason,
      authoredActionId: args.authoredActionId,
      alreadyCancelledForActionId: session.lastDoomfallCancelActionId,
    });
    ws = interrupt.weaponState;
    if (interrupt.cancelled) {
      session.lastDoomfallCancelActionId = interrupt.cancelDedupeActionId;
      if (interrupt.logLine) logs.push(interrupt.logLine);
    }
  }

  if (
    args.applyDebuff !== false
    && (args.reason === 'STUN' || args.reason === 'KNOCKDOWN')
  ) {
    const debuffId: PlayerDebuffId = args.reason;
    addStructuredDebuff(args.extras, {
      type: debuffId,
      turnsRemaining: args.debuffTurns ?? 1,
    });
    logs.push(`[CONTROL] >> ${args.reason} applied.`);
  }

  const wasCancellable = !assertDoomfallFullyCleared(args.weaponState);
  const cleared = assertDoomfallFullyCleared(ws);
  return {
    weaponState: ws,
    session,
    brandGain,
    doomfallCancelled: wasCancellable && cleared,
    doomfallCleared: cleared,
    logs,
  };
}

/** Map structured debuff ids onto interrupt reasons. */
export function controlReasonFromDebuff(
  type: PlayerDebuffId,
): AegisControlInterruptReason | null {
  if (type === 'STUN') return 'STUN';
  if (type === 'KNOCKDOWN') return 'KNOCKDOWN';
  return null;
}
