/**
 * Phase B.1 — combat-hub runtime sequence for Aegis inbound defense / Doomfall.
 * TacticalCombatHub calls these helpers; integration tests exercise the same path.
 */
import type { AegisWeaponCombatState } from './aegisWeaponCombatState';
import { clearDreadbound, clearEclipse } from './aegisWeaponCombatState';
import {
  applyPercentDamageReduction,
  isEligibleDirectEnemyAttack,
} from './aegisWeaponActionRuntime';
import { DREADBOUND_DAMAGE_REDUCTION_PCT } from './aegisWeaponActionResolveEngine';
import {
  resolveAegisInboundHitDefense,
  type AegisControlInterruptReason,
} from './aegisDoomfallInterruptEngine';
import {
  applyAegisPlayerControl,
  createAegisControlPipelineSession,
  type AegisControlPipelineSession,
} from './aegisPlayerControlPipeline';
import type { CombatSessionExtras } from '../types/combatHooks';

export { createAegisControlPipelineSession };
export type { AegisControlPipelineSession };

export interface HubInboundHitArgs {
  weaponState: AegisWeaponCombatState;
  damage: number;
  unblockable?: boolean;
  environmental?: boolean;
  damageOverTime?: boolean;
  attackerUnitId?: string | null;
  controlEffects?: readonly AegisControlInterruptReason[];
  authoredActionId?: string | null;
  pipelineSession: AegisControlPipelineSession;
  currentBrands: number;
}

export interface HubInboundHitResult {
  damage: number;
  weaponState: AegisWeaponCombatState;
  pipelineSession: AegisControlPipelineSession;
  brandGain: number;
  logs: string[];
  /** True when staged Doomfall / targeting should be scrubbed. */
  clearStagedCombatCommand: boolean;
}

/**
 * Hub inbound sequence after evade/crit resolution, before HP commit:
 * Eclipse fail → Dreadbound reduce → Poise/Committed/control (Brand before cancel).
 */
export function hubResolveAegisInboundPlayerHit(
  args: HubInboundHitArgs,
): HubInboundHitResult {
  let ws = args.weaponState;
  let damage = args.damage;
  const logs: string[] = [];
  const controls = args.controlEffects ?? [];
  const eligible = isEligibleDirectEnemyAttack({
    unblockable: args.unblockable,
    environmental: args.environmental,
    damageOverTime: args.damageOverTime,
    targetsAegis: true,
    isDamaging: damage > 0 || controls.length > 0,
  });

  if (eligible && ws.eclipseActive && damage > 0) {
    ws = clearEclipse(ws);
    logs.push('[ECLIPSE] >> Posture consumed — no reward.');
  }

  if (eligible && args.attackerUnitId && ws.dreadboundByUnitId[args.attackerUnitId] && damage > 0) {
    damage = applyPercentDamageReduction(damage, DREADBOUND_DAMAGE_REDUCTION_PCT);
    logs.push(`[DREADBOUND] >> Incoming damage reduced ${DREADBOUND_DAMAGE_REDUCTION_PCT}%.`);
    ws = clearDreadbound(ws, args.attackerUnitId);
  }

  const inbound = resolveAegisInboundHitDefense({
    weaponState: ws,
    damage,
    eligible,
    controlEffects: controls,
    authoredActionId: args.authoredActionId,
    alreadyCancelledForActionId: args.pipelineSession.lastDoomfallCancelActionId,
    currentBrands: args.currentBrands,
  });
  ws = inbound.weaponState;
  damage = inbound.damage;
  logs.push(...inbound.logs);

  return {
    damage,
    weaponState: ws,
    pipelineSession: {
      ...args.pipelineSession,
      lastDoomfallCancelActionId: inbound.cancelDedupeActionId,
    },
    brandGain: inbound.brandGain,
    logs,
    clearStagedCombatCommand: inbound.doomfallCancelled,
  };
}

/**
 * Apply control when not going through a damaging hurtPlayer pulse
 * (non-damaging Stun/Knockdown, explicit INTERRUPT_CHARGE, death).
 */
export function hubApplyAegisPlayerControl(args: {
  weaponState: AegisWeaponCombatState;
  extras: CombatSessionExtras;
  pipelineSession: AegisControlPipelineSession;
  reason: AegisControlInterruptReason;
  authoredActionId?: string | null;
  currentBrands: number;
  applyDebuff?: boolean;
}): {
  weaponState: AegisWeaponCombatState;
  pipelineSession: AegisControlPipelineSession;
  brandGain: number;
  logs: string[];
  clearStagedCombatCommand: boolean;
} {
  const result = applyAegisPlayerControl({
    weaponState: args.weaponState,
    extras: args.extras,
    session: args.pipelineSession,
    reason: args.reason,
    authoredActionId: args.authoredActionId,
    currentBrands: args.currentBrands,
    applyDebuff: args.applyDebuff,
    poiseEligible: true,
  });
  return {
    weaponState: result.weaponState,
    pipelineSession: result.session,
    brandGain: result.brandGain,
    logs: result.logs,
    clearStagedCombatCommand: result.doomfallCancelled,
  };
}

/** Staged command scrub after Doomfall cancel / transform. */
export interface AegisStagedCombatCommand {
  selectedAbility: string | null;
  dualTargetIds: [string | null, string | null];
  dualPickStep: number;
  selectedTargetId: string | null;
}

export function scrubAegisStagedCombatCommand(
  staged: AegisStagedCombatCommand,
): AegisStagedCombatCommand {
  return {
    selectedAbility: null,
    dualTargetIds: [null, null],
    dualPickStep: 0,
    selectedTargetId: staged.selectedAbility === 'DOOMFALL' || staged.selectedAbility === 'DIVERGENCE'
      ? null
      : staged.selectedTargetId,
  };
}

/** Divergence cancel before final commit — no AP, no resolution. */
export function divergenceCancelBeforeCommit(staged: AegisStagedCombatCommand): {
  staged: AegisStagedCombatCommand;
  apSpent: number;
  actionCommitted: boolean;
} {
  return {
    staged: {
      selectedAbility: null,
      dualTargetIds: [null, null],
      dualPickStep: 0,
      selectedTargetId: null,
    },
    apSpent: 0,
    actionCommitted: false,
  };
}
