/**
 * Hex Shot W.2–W.4 — Revolver + Carbine + Black Door weapon-action execution.
 * Hub owns AP spend, Elusive, Last Word refund, Firing Solution turn clock,
 * Suppressed consume, Threshold reaction fire, Deadbolt reload arming.
 */
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { HexAmmoType } from '../types/hexAmmo';
import type { EnemyCombatProfile } from '../types/run';
import type { ResolvedWeaponState } from '../types/weapon';
import type { HexWeaponActionId } from '../types/hexWeaponAction';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { resolveHexBasicShot } from './weaponBasicEngine';
import { applyWeaponBallisticDamageMultiplier } from './weaponCombatEngine';
import { getUnitById, isUnitAlive } from './combatSquadEngine';
import { getHexWeaponActionDefinition } from './hexWeaponActionCatalog';
import { grantHexElusiveCharge } from './hexElusiveEngine';
import { graftForcesSingleTarget } from './hexShotIntrinsics';
import {
  clearHexFiringSolutionIfUnit,
  establishHexFiringSolution,
  firingSolutionAccuracyBonusPct,
  hasFiringSolutionOn,
} from './hexFiringSolutionEngine';
import {
  applyHexCarbineSuppressed,
  shouldApplySuppressedFromAuthoredHits,
} from './hexCarbineSuppressedEngine';
import { applyBlackDoorBacklineFalloff } from './hexBlackDoorPositionEngine';
import {
  FATAL_FUNNEL_AMMO_COST,
  FATAL_FUNNEL_STAMINA_COST,
  resolveFatalFunnelLane,
} from './hexFatalFunnelEngine';
import {
  THRESHOLD_AMMO_COST,
  THRESHOLD_STAMINA_COST,
  armHexThreshold,
} from './hexThresholdEngine';
import {
  DEADBOLT_AMMO_COST,
  DEADBOLT_STAMINA_COST,
  consumeHexDeadboltReloadOpportunity,
  deadboltAuthoredBase,
} from './hexDeadboltEngine';

export const LAST_WORD_HP_RATIO = 0.3;
export const SIX_BELLS_PACKET_DAMAGE = 5;
export const SLIPSHOT_BASE_DAMAGE = 8;
export const LAST_WORD_BASE_DAMAGE = 14;
export const SIX_BELLS_MIN_ROUNDS = 2;

export const CENTER_MASS_BASE_DAMAGE = 9;
export const CONTROLLED_BURST_PACKET_DAMAGE = 6;
export const CONTROLLED_BURST_ROUNDS = 3;
export const SUPPRESSIVE_BARRAGE_PACKET_DAMAGE = 4;
export const SUPPRESSIVE_BARRAGE_ROUNDS = 2;
export const CONTACT_FRONT_PACKET_DAMAGE = 5;
export const CONTACT_FRONT_ROUNDS = 4;

export const DOOR_KNOCKER_AUTHORED_BASE = 16;
export const FATAL_FUNNEL_PRIMARY_AUTHORED = 16;
export const FATAL_FUNNEL_REAR_AUTHORED = 11;
export const THRESHOLD_AUTHORED = 14;
export const DEADBOLT_BASE_AUTHORED = 22;
export const DEADBOLT_PRIMED_AUTHORED = 28;

export interface HexWeaponActionHurtOptions {
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  fractureGain?: number;
  targetId?: string;
  abilityId?: string;
  rollCrit?: boolean;
  forceCrit?: boolean;
  indirectDamage?: boolean;
  innateArmorPressureLayers?: number;
  weaponFamilyBallisticAlreadyScaled?: boolean;
  playerActionId?: string;
  /** Firing Solution / other action-local accuracy (percentage points). */
  accuracyBonusPct?: number;
}

export interface HexWeaponActionExecutionContext {
  actionId: HexWeaponActionId;
  squad: EnemyCombatProfile[];
  targetId: string | null;
  /** Contact Front second target for 2+2; null/undefined = 4+0. */
  secondaryTargetId?: string | null;
  currentAmmo: number;
  maxAmmo: number;
  classState: ClassCombatEncounterState;
  resolvedWeapon: ResolvedWeaponState | null;
  effectiveTags?: readonly string[];
  /** Current player-turn number for Firing Solution lifetime. */
  currentPlayerTurn?: number;
  /**
   * Loaded ammo type + reload-grade next-shot flags for Threshold snapshot.
   * Hub supplies live Hex magazine state at arm time.
   */
  thresholdArmSnapshot?: {
    ammoType: HexAmmoType;
    nextShotOvercharged: boolean;
    overchargeMultiplier: number;
    firstShotPenaltyPending: boolean;
  };
  /** Called after Threshold successfully arms so hub can clear global next-shot flags. */
  onThresholdArmed?: () => void;
  log: (msg: string) => void;
  spendAmmo: (amount: number) => boolean;
  spendStamina?: (amount: number) => boolean;
  hurtEnemy: (
    raw: number,
    tag: string,
    options?: HexWeaponActionHurtOptions,
    targetId?: string,
  ) => boolean;
  onMagazineEmptied?: () => void;
  /** Called after valid Slipshot attempt (hit or miss). */
  onSlipshotResolved?: () => void;
  /**
   * Called when Last Word's synchronous resolution killed the initial target.
   * Hub applies once-per-turn refund + AP clamp.
   */
  onLastWordSynchronousKill?: (targetId: string) => void;
}

export type HexWeaponActionExecutionResult =
  | { ok: true; committedAmmo?: number }
  | { ok: false; reason: string; refundAp: number };

function targetUnit(ctx: HexWeaponActionExecutionContext): EnemyCombatProfile | null {
  if (!ctx.targetId) return null;
  return getUnitById(ctx.squad, ctx.targetId) ?? null;
}

export function isLastWordLegalTarget(unit: EnemyCombatProfile): boolean {
  if (!isUnitAlive(unit) || unit.maxHp <= 0) return false;
  return unit.currentHp / unit.maxHp <= LAST_WORD_HP_RATIO;
}

export function scaleSidearmAuthoredDamage(
  authored: number,
  weapon: ResolvedWeaponState | null,
): number {
  return scaleHexWeaponAuthoredDamage(authored, weapon);
}

/** Family ballistic scaling once per authored packet (Sidearm / Carbine). */
export function scaleHexWeaponAuthoredDamage(
  authored: number,
  weapon: ResolvedWeaponState | null,
): number {
  if (!weapon) return authored;
  return applyWeaponBallisticDamageMultiplier(
    authored,
    weapon.statModifiers,
    false,
    weapon.passiveBonusPct ?? 0,
  );
}

export type ContactFrontAllocation =
  | { kind: '4+0'; primaryId: string }
  | { kind: '2+2'; primaryId: string; secondaryId: string };

export function resolveContactFrontAllocation(
  primaryId: string | null | undefined,
  secondaryId: string | null | undefined,
): ContactFrontAllocation | null {
  if (!primaryId) return null;
  if (!secondaryId || secondaryId === primaryId) {
    return { kind: '4+0', primaryId };
  }
  return { kind: '2+2', primaryId, secondaryId };
}

export function previewSixBellsRounds(currentAmmo: number, maxAmmo: number): number {
  if (currentAmmo < SIX_BELLS_MIN_ROUNDS) return 0;
  return Math.min(currentAmmo, Math.max(0, maxAmmo));
}

export function isHexWeaponActionEnabled(
  actionId: HexWeaponActionId,
  currentAmmo: number,
  maxAmmo: number,
  playerAp: number,
  opts?: {
    stamina?: number;
    thresholdArmed?: boolean;
    /** Door Knocker uses live Nullbreach stamina; optional override. */
    doorKnockerStaminaCost?: number;
  },
): boolean {
  const def = getHexWeaponActionDefinition(actionId);
  if (!def) return false;
  if (playerAp < def.apCost) return false;
  if (actionId === 'THRESHOLD' && opts?.thresholdArmed) return false;
  if (actionId === 'SIX_BELLS') {
    return previewSixBellsRounds(currentAmmo, maxAmmo) >= SIX_BELLS_MIN_ROUNDS;
  }
  if (def.ammoCost > 0 && currentAmmo < def.ammoCost) return false;
  const stamNeed = actionId === 'DOOR_KNOCKER'
    ? (opts?.doorKnockerStaminaCost ?? def.staminaCost)
    : def.staminaCost;
  if (stamNeed > 0 && opts?.stamina != null && opts.stamina < stamNeed) return false;
  return true;
}

export function executeHexWeaponAction(
  ctx: HexWeaponActionExecutionContext,
): HexWeaponActionExecutionResult {
  const def = getHexWeaponActionDefinition(ctx.actionId);
  if (!def) {
    return { ok: false, reason: 'UNIMPLEMENTED_WEAPON_ACTION', refundAp: 0 };
  }

  switch (ctx.actionId) {
    case 'QUICKDRAW':
      return executeQuickdraw(ctx, def.apCost);
    case 'SLIPSHOT':
      return executeSlipshot(ctx, def.apCost);
    case 'SIX_BELLS':
      return executeSixBells(ctx, def.apCost);
    case 'LAST_WORD':
      return executeLastWord(ctx, def.apCost);
    case 'CENTER_MASS':
      return executeCenterMass(ctx, def.apCost);
    case 'CONTROLLED_BURST':
      return executeControlledBurst(ctx, def.apCost);
    case 'SUPPRESSIVE_BARRAGE':
      return executeSuppressiveBarrage(ctx, def.apCost);
    case 'CONTACT_FRONT':
      return executeContactFront(ctx, def.apCost);
    case 'DOOR_KNOCKER':
      return executeDoorKnocker(ctx, def.apCost);
    case 'FATAL_FUNNEL':
      return executeFatalFunnel(ctx, def.apCost);
    case 'THRESHOLD':
      return executeThresholdArm(ctx, def.apCost);
    case 'DEADBOLT':
      return executeDeadbolt(ctx, def.apCost);
    default:
      return { ok: false, reason: 'UNIMPLEMENTED_WEAPON_ACTION', refundAp: def.apCost };
  }
}

function spendStaminaOrReject(
  ctx: HexWeaponActionExecutionContext,
  amount: number,
  apCost: number,
  label: string,
): HexWeaponActionExecutionResult | null {
  if (amount <= 0) return null;
  if (!ctx.spendStamina) {
    ctx.log(`[REJECTED] >> ${label} — stamina spend unavailable.`);
    return { ok: false, reason: 'NO_STAMINA', refundAp: apCost };
  }
  if (!ctx.spendStamina(amount)) {
    ctx.log(`[REJECTED] >> ${label} — insufficient stamina.`);
    return { ok: false, reason: 'NO_STAMINA', refundAp: apCost };
  }
  return null;
}

function executeQuickdraw(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Quickdraw requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (!ctx.spendAmmo(1)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const weapon = ctx.resolvedWeapon;
  const catalogBase = HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage;
  if (weapon) {
    const plan = resolveHexBasicShot({
      weapon,
      squad: ctx.squad,
      primaryTargetId: unit.unitId,
      catalogBaseDamage: catalogBase,
      forceSingleTarget: graftForcesSingleTarget(ctx.effectiveTags),
    });
    plan.logLines.forEach((line) => ctx.log(line.replace('[SIDEARM]', '[QUICKDRAW]')));
    if (plan.hits.length === 0) {
      return { ok: false, reason: 'NO_HITS', refundAp: apCost };
    }
    const playerActionId = `pa-hex-quickdraw-${Date.now()}`;
    for (const hit of plan.hits) {
      ctx.hurtEnemy(hit.damage, hit.isPrimary ? '[QUICKDRAW]' : '[QUICKDRAW SPREAD]', {
        channel: 'KINETIC',
        fractureGain: hit.fractureGain,
        abilityId: 'QUICKDRAW',
        targetId: hit.targetId,
        innateArmorPressureLayers: plan.innateArmorPressureLayers,
        weaponFamilyBallisticAlreadyScaled: true,
        playerActionId,
      }, hit.targetId);
    }
    if (ctx.currentAmmo - 1 <= 0) ctx.onMagazineEmptied?.();
    return { ok: true, committedAmmo: 1 };
  }
  ctx.hurtEnemy(catalogBase, '[QUICKDRAW]', {
    channel: 'KINETIC',
    fractureGain: 15,
    abilityId: 'QUICKDRAW',
    targetId: unit.unitId,
    weaponFamilyBallisticAlreadyScaled: true,
  }, unit.unitId);
  return { ok: true, committedAmmo: 1 };
}

function executeSlipshot(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Slipshot requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (!ctx.spendAmmo(1)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const dmg = scaleSidearmAuthoredDamage(SLIPSHOT_BASE_DAMAGE, ctx.resolvedWeapon);
  const playerActionId = `pa-hex-slipshot-${Date.now()}`;
  ctx.hurtEnemy(dmg, '[SLIPSHOT]', {
    channel: 'KINETIC',
    fractureGain: 10,
    abilityId: 'SLIPSHOT',
    targetId: unit.unitId,
    weaponFamilyBallisticAlreadyScaled: true,
    playerActionId,
  }, unit.unitId);
  // Elusive after valid attempt — even on miss (hurtEnemy may return false).
  ctx.classState.hexElusiveCharges = grantHexElusiveCharge({
    charges: ctx.classState.hexElusiveCharges,
  }).charges;
  ctx.onSlipshotResolved?.();
  ctx.log('[SLIPSHOT] >> Elusive primed — next eligible direct attack will whiff.');
  if (ctx.currentAmmo - 1 <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: 1 };
}

function executeSixBells(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Six Bells requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  const rounds = previewSixBellsRounds(ctx.currentAmmo, ctx.maxAmmo);
  if (rounds < SIX_BELLS_MIN_ROUNDS) {
    ctx.log('[REJECTED] >> Six Bells needs at least two loaded rounds.');
    return { ok: false, reason: 'INSUFFICIENT_AMMO', refundAp: apCost };
  }
  if (!ctx.spendAmmo(rounds)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const packetBase = scaleSidearmAuthoredDamage(SIX_BELLS_PACKET_DAMAGE, ctx.resolvedWeapon);
  const playerActionId = `pa-hex-six-bells-${Date.now()}`;
  const targetId = unit.unitId;
  ctx.log(`[SIX BELLS] >> Cylinder dump — ${rounds}×${SIX_BELLS_PACKET_DAMAGE} authored.`);
  for (let i = 0; i < rounds; i += 1) {
    const live = getUnitById(ctx.squad, targetId);
    if (!live || !isUnitAlive(live)) {
      ctx.log('[SIX BELLS] >> Target down — remaining rounds lost.');
      break;
    }
    ctx.hurtEnemy(packetBase, `[SIX BELLS — ${i + 1}]`, {
      channel: 'KINETIC',
      fractureGain: i === 0 ? 12 : 0,
      abilityId: 'SIX_BELLS',
      targetId,
      weaponFamilyBallisticAlreadyScaled: true,
      playerActionId,
    }, targetId);
  }
  if (ctx.currentAmmo - rounds <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: rounds };
}

function executeLastWord(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Last Word requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (!isLastWordLegalTarget(unit)) {
    ctx.log('[REJECTED] >> Last Word — target above 30% HP.');
    return { ok: false, reason: 'HP_THRESHOLD', refundAp: apCost };
  }
  if (!ctx.spendAmmo(1)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const dmg = scaleSidearmAuthoredDamage(LAST_WORD_BASE_DAMAGE, ctx.resolvedWeapon);
  const playerActionId = `pa-hex-last-word-${Date.now()}`;
  const targetId = unit.unitId;
  ctx.hurtEnemy(dmg, '[LAST WORD]', {
    channel: 'KINETIC',
    fractureGain: 20,
    abilityId: 'LAST_WORD',
    targetId,
    weaponFamilyBallisticAlreadyScaled: true,
    playerActionId,
  }, targetId);
  const after = getUnitById(ctx.squad, targetId);
  if (!after || !isUnitAlive(after)) {
    ctx.onLastWordSynchronousKill?.(targetId);
  }
  if (ctx.currentAmmo - 1 <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: 1 };
}

function fsBonusForTarget(
  ctx: HexWeaponActionExecutionContext,
  targetId: string,
  snapshotHasFs: boolean,
): number {
  return firingSolutionAccuracyBonusPct(
    {
      firingSolutionUnitId: ctx.classState.firingSolutionUnitId,
      firingSolutionExpiresAfterPlayerTurn: ctx.classState.firingSolutionExpiresAfterPlayerTurn,
    },
    targetId,
    snapshotHasFs,
  );
}

function executeCenterMass(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Center Mass requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (!ctx.spendAmmo(1)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const targetId = unit.unitId;
  const hadFs = hasFiringSolutionOn({
    firingSolutionUnitId: ctx.classState.firingSolutionUnitId,
    firingSolutionExpiresAfterPlayerTurn: ctx.classState.firingSolutionExpiresAfterPlayerTurn,
  }, targetId);
  const dmg = scaleHexWeaponAuthoredDamage(CENTER_MASS_BASE_DAMAGE, ctx.resolvedWeapon);
  const playerActionId = `pa-hex-center-mass-${Date.now()}`;
  const hit = ctx.hurtEnemy(dmg, '[CENTER MASS]', {
    channel: 'KINETIC',
    fractureGain: 14,
    abilityId: 'CENTER_MASS',
    targetId,
    weaponFamilyBallisticAlreadyScaled: true,
    playerActionId,
    accuracyBonusPct: fsBonusForTarget(ctx, targetId, hadFs) || undefined,
  }, targetId);
  if (hit) {
    const turn = Math.max(1, ctx.currentPlayerTurn ?? 1);
    const next = establishHexFiringSolution({
      firingSolutionUnitId: ctx.classState.firingSolutionUnitId,
      firingSolutionExpiresAfterPlayerTurn: ctx.classState.firingSolutionExpiresAfterPlayerTurn,
    }, targetId, turn);
    ctx.classState.firingSolutionUnitId = next.firingSolutionUnitId;
    ctx.classState.firingSolutionExpiresAfterPlayerTurn = next.firingSolutionExpiresAfterPlayerTurn;
    const after = getUnitById(ctx.squad, targetId);
    if (!after || !isUnitAlive(after)) {
      const cleared = clearHexFiringSolutionIfUnit({
        firingSolutionUnitId: ctx.classState.firingSolutionUnitId,
        firingSolutionExpiresAfterPlayerTurn: ctx.classState.firingSolutionExpiresAfterPlayerTurn,
      }, targetId);
      ctx.classState.firingSolutionUnitId = cleared.firingSolutionUnitId;
      ctx.classState.firingSolutionExpiresAfterPlayerTurn = cleared.firingSolutionExpiresAfterPlayerTurn;
      ctx.log('[FIRING SOLUTION] >> Mark lost — target down.');
    } else {
      ctx.log('[FIRING SOLUTION] >> Center Mass lock — +15 accuracy while marked.');
    }
  }
  if (ctx.currentAmmo - 1 <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: 1 };
}

function executeControlledBurst(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Controlled Burst requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (ctx.currentAmmo < CONTROLLED_BURST_ROUNDS) {
    ctx.log('[REJECTED] >> Controlled Burst needs three loaded rounds.');
    return { ok: false, reason: 'INSUFFICIENT_AMMO', refundAp: apCost };
  }
  if (!ctx.spendAmmo(CONTROLLED_BURST_ROUNDS)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const targetId = unit.unitId;
  const hadFs = hasFiringSolutionOn({
    firingSolutionUnitId: ctx.classState.firingSolutionUnitId,
    firingSolutionExpiresAfterPlayerTurn: ctx.classState.firingSolutionExpiresAfterPlayerTurn,
  }, targetId);
  const packetBase = scaleHexWeaponAuthoredDamage(CONTROLLED_BURST_PACKET_DAMAGE, ctx.resolvedWeapon);
  const playerActionId = `pa-hex-controlled-burst-${Date.now()}`;
  const acc = fsBonusForTarget(ctx, targetId, hadFs) || undefined;
  ctx.log(`[CONTROLLED BURST] >> ${CONTROLLED_BURST_ROUNDS}×${CONTROLLED_BURST_PACKET_DAMAGE} authored.`);
  for (let i = 0; i < CONTROLLED_BURST_ROUNDS; i += 1) {
    const live = getUnitById(ctx.squad, targetId);
    if (!live || !isUnitAlive(live)) {
      ctx.log('[CONTROLLED BURST] >> Target down — remaining rounds lost.');
      break;
    }
    ctx.hurtEnemy(packetBase, `[CONTROLLED BURST — ${i + 1}]`, {
      channel: 'KINETIC',
      fractureGain: i === 0 ? 10 : 0,
      abilityId: 'CONTROLLED_BURST',
      targetId,
      weaponFamilyBallisticAlreadyScaled: true,
      playerActionId,
      accuracyBonusPct: acc,
    }, targetId);
  }
  if (ctx.currentAmmo - CONTROLLED_BURST_ROUNDS <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: CONTROLLED_BURST_ROUNDS };
}

function executeSuppressiveBarrage(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Suppressive Fire requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (ctx.currentAmmo < SUPPRESSIVE_BARRAGE_ROUNDS) {
    ctx.log('[REJECTED] >> Suppressive Fire needs two loaded rounds.');
    return { ok: false, reason: 'INSUFFICIENT_AMMO', refundAp: apCost };
  }
  if (!ctx.spendAmmo(SUPPRESSIVE_BARRAGE_ROUNDS)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const targetId = unit.unitId;
  const hadFs = hasFiringSolutionOn({
    firingSolutionUnitId: ctx.classState.firingSolutionUnitId,
    firingSolutionExpiresAfterPlayerTurn: ctx.classState.firingSolutionExpiresAfterPlayerTurn,
  }, targetId);
  const packetBase = scaleHexWeaponAuthoredDamage(SUPPRESSIVE_BARRAGE_PACKET_DAMAGE, ctx.resolvedWeapon);
  const playerActionId = `pa-hex-suppressive-barrage-${Date.now()}`;
  const acc = fsBonusForTarget(ctx, targetId, hadFs) || undefined;
  let authoredHits = 0;
  ctx.log(`[SUPPRESSIVE FIRE] >> ${SUPPRESSIVE_BARRAGE_ROUNDS}×${SUPPRESSIVE_BARRAGE_PACKET_DAMAGE} authored.`);
  for (let i = 0; i < SUPPRESSIVE_BARRAGE_ROUNDS; i += 1) {
    const live = getUnitById(ctx.squad, targetId);
    if (!live || !isUnitAlive(live)) break;
    const hit = ctx.hurtEnemy(packetBase, `[SUPPRESSIVE FIRE — ${i + 1}]`, {
      channel: 'KINETIC',
      fractureGain: i === 0 ? 8 : 0,
      abilityId: 'SUPPRESSIVE_BARRAGE',
      targetId,
      weaponFamilyBallisticAlreadyScaled: true,
      playerActionId,
      accuracyBonusPct: acc,
    }, targetId);
    if (hit) authoredHits += 1;
  }
  const after = getUnitById(ctx.squad, targetId);
  const living = !!after && isUnitAlive(after);
  if (
    living
    && shouldApplySuppressedFromAuthoredHits({
      authoredHitCount: authoredHits,
      authoredPacketCount: SUPPRESSIVE_BARRAGE_ROUNDS,
      hadFiringSolutionAtStart: hadFs,
    })
  ) {
    const next = applyHexCarbineSuppressed({
      carbineSuppressedUnitId: ctx.classState.carbineSuppressedUnitId,
      carbineSuppressedAppliedThisAction: ctx.classState.carbineSuppressedAppliedThisAction,
    }, targetId);
    ctx.classState.carbineSuppressedUnitId = next.carbineSuppressedUnitId;
    ctx.classState.carbineSuppressedAppliedThisAction = next.carbineSuppressedAppliedThisAction;
    ctx.log('[SUPPRESSED] >> Next eligible direct attack ×0.70.');
  }
  if (ctx.currentAmmo - SUPPRESSIVE_BARRAGE_ROUNDS <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: SUPPRESSIVE_BARRAGE_ROUNDS };
}

function executeContactFront(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const allocation = resolveContactFrontAllocation(ctx.targetId, ctx.secondaryTargetId);
  if (!allocation) {
    ctx.log('[REJECTED] >> Contact Front requires a valid allocation.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  const primary = getUnitById(ctx.squad, allocation.primaryId);
  if (!primary || !isUnitAlive(primary)) {
    ctx.log('[REJECTED] >> Contact Front — primary target invalid.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (allocation.kind === '2+2') {
    const secondary = getUnitById(ctx.squad, allocation.secondaryId);
    if (!secondary || !isUnitAlive(secondary)) {
      ctx.log('[REJECTED] >> Contact Front — secondary target invalid.');
      return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
    }
  }
  if (ctx.currentAmmo < CONTACT_FRONT_ROUNDS) {
    ctx.log('[REJECTED] >> Contact Front needs four loaded rounds.');
    return { ok: false, reason: 'INSUFFICIENT_AMMO', refundAp: apCost };
  }
  if (!ctx.spendAmmo(CONTACT_FRONT_ROUNDS)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }

  const fsPrimary = hasFiringSolutionOn({
    firingSolutionUnitId: ctx.classState.firingSolutionUnitId,
    firingSolutionExpiresAfterPlayerTurn: ctx.classState.firingSolutionExpiresAfterPlayerTurn,
  }, allocation.primaryId);
  const fsSecondary = allocation.kind === '2+2'
    ? hasFiringSolutionOn({
      firingSolutionUnitId: ctx.classState.firingSolutionUnitId,
      firingSolutionExpiresAfterPlayerTurn: ctx.classState.firingSolutionExpiresAfterPlayerTurn,
    }, allocation.secondaryId)
    : false;

  const packetBase = scaleHexWeaponAuthoredDamage(CONTACT_FRONT_PACKET_DAMAGE, ctx.resolvedWeapon);
  const playerActionId = `pa-hex-contact-front-${Date.now()}`;
  const plan: Array<{ targetId: string; hasFs: boolean; index: number }> = allocation.kind === '4+0'
    ? [0, 1, 2, 3].map((i) => ({ targetId: allocation.primaryId, hasFs: fsPrimary, index: i }))
    : [
      { targetId: allocation.primaryId, hasFs: fsPrimary, index: 0 },
      { targetId: allocation.primaryId, hasFs: fsPrimary, index: 1 },
      { targetId: allocation.secondaryId, hasFs: fsSecondary, index: 2 },
      { targetId: allocation.secondaryId, hasFs: fsSecondary, index: 3 },
    ];

  ctx.log(
    allocation.kind === '4+0'
      ? `[CONTACT FRONT] >> Concentrated 5×4 on primary.`
      : `[CONTACT FRONT] >> Divided 5×2 / 5×2.`,
  );

  const stoppedTargets = new Set<string>();
  for (const shot of plan) {
    if (stoppedTargets.has(shot.targetId)) continue;
    const live = getUnitById(ctx.squad, shot.targetId);
    if (!live || !isUnitAlive(live)) {
      stoppedTargets.add(shot.targetId);
      ctx.log('[CONTACT FRONT] >> Assigned target down — remaining shots for that target lost.');
      continue;
    }
    ctx.hurtEnemy(packetBase, `[CONTACT FRONT — ${shot.index + 1}]`, {
      channel: 'KINETIC',
      fractureGain: shot.index === 0 ? 10 : 0,
      abilityId: 'CONTACT_FRONT',
      targetId: shot.targetId,
      weaponFamilyBallisticAlreadyScaled: true,
      playerActionId,
      accuracyBonusPct: fsBonusForTarget(ctx, shot.targetId, shot.hasFs) || undefined,
    }, shot.targetId);
    const after = getUnitById(ctx.squad, shot.targetId);
    if (!after || !isUnitAlive(after)) {
      stoppedTargets.add(shot.targetId);
    }
  }

  if (ctx.currentAmmo - CONTACT_FRONT_ROUNDS <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: CONTACT_FRONT_ROUNDS };
}

function executeDoorKnocker(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Door Knocker requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (!ctx.resolvedWeapon || ctx.resolvedWeapon.familyId !== 'hex-void-cannon') {
    ctx.log('[REJECTED] >> Door Knocker requires Nullbreach.');
    return { ok: false, reason: 'WRONG_FAMILY', refundAp: apCost };
  }
  const plan = resolveHexBasicShot({
    weapon: ctx.resolvedWeapon,
    squad: ctx.squad,
    primaryTargetId: unit.unitId,
    catalogBaseDamage: DOOR_KNOCKER_AUTHORED_BASE,
    forceSingleTarget: true,
  });
  if (plan.hits.length === 0) {
    plan.logLines.forEach((line) => ctx.log(line.replace('[NULLBREACH]', '[DOOR KNOCKER]')));
    return { ok: false, reason: 'NO_HITS', refundAp: apCost };
  }
  if (ctx.currentAmmo < 1) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const stamFail = spendStaminaOrReject(ctx, plan.staminaCost, apCost, 'Door Knocker');
  if (stamFail) return stamFail;
  if (!ctx.spendAmmo(1)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  plan.logLines.forEach((line) => ctx.log(line.replace('[NULLBREACH]', '[DOOR KNOCKER]')));
  const playerActionId = `pa-hex-door-knocker-${Date.now()}`;
  for (const hit of plan.hits) {
    ctx.hurtEnemy(hit.damage, hit.isPrimary ? '[DOOR KNOCKER]' : '[DOOR KNOCKER]', {
      channel: 'KINETIC',
      fractureGain: hit.fractureGain,
      abilityId: 'DOOR_KNOCKER',
      targetId: hit.targetId,
      innateArmorPressureLayers: plan.innateArmorPressureLayers,
      weaponFamilyBallisticAlreadyScaled: true,
      playerActionId,
    }, hit.targetId);
  }
  if (ctx.currentAmmo - 1 <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: 1 };
}

function executeFatalFunnel(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const lane = resolveFatalFunnelLane(ctx.squad, ctx.targetId);
  if (!lane) {
    ctx.log('[REJECTED] >> Fatal Funnel requires a valid column.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (ctx.currentAmmo < FATAL_FUNNEL_AMMO_COST) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const stamFail = spendStaminaOrReject(ctx, FATAL_FUNNEL_STAMINA_COST, apCost, 'Fatal Funnel');
  if (stamFail) return stamFail;
  if (!ctx.spendAmmo(FATAL_FUNNEL_AMMO_COST)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }

  const playerActionId = `pa-hex-fatal-funnel-${Date.now()}`;
  ctx.log(`[FATAL FUNNEL] >> Column ${lane.columnSlots.join('/')}.`);
  for (const hit of lane.hits) {
    const live = getUnitById(ctx.squad, hit.unitId);
    if (!live || !isUnitAlive(live)) {
      if (!hit.isPrimary) ctx.log('[FATAL FUNNEL] >> Rear occupant invalid — skipped.');
      continue;
    }
    let dmg = scaleHexWeaponAuthoredDamage(hit.authoredDamage, ctx.resolvedWeapon);
    dmg = applyBlackDoorBacklineFalloff(dmg, hit.isBackline);
    ctx.hurtEnemy(dmg, hit.isPrimary ? '[FATAL FUNNEL]' : '[FATAL FUNNEL — REAR]', {
      channel: 'KINETIC',
      fractureGain: hit.isPrimary ? 12 : 8,
      abilityId: 'FATAL_FUNNEL',
      targetId: hit.unitId,
      weaponFamilyBallisticAlreadyScaled: true,
      playerActionId,
    }, hit.unitId);
  }
  if (ctx.currentAmmo - FATAL_FUNNEL_AMMO_COST <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: FATAL_FUNNEL_AMMO_COST };
}

function executeThresholdArm(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  if (ctx.classState.thresholdArmed) {
    ctx.log('[REJECTED] >> Threshold already armed.');
    return { ok: false, reason: 'ALREADY_ARMED', refundAp: apCost };
  }
  if (!ctx.resolvedWeapon || ctx.resolvedWeapon.familyId !== 'hex-void-cannon') {
    ctx.log('[REJECTED] >> Threshold requires Nullbreach.');
    return { ok: false, reason: 'WRONG_FAMILY', refundAp: apCost };
  }
  if (!ctx.thresholdArmSnapshot) {
    ctx.log('[REJECTED] >> Threshold snapshot unavailable.');
    return { ok: false, reason: 'NO_SNAPSHOT', refundAp: apCost };
  }
  if (ctx.currentAmmo < THRESHOLD_AMMO_COST) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  // Snapshot captured before spending the shell (hub supplies live flags).
  const snap = ctx.thresholdArmSnapshot;
  const stamFail = spendStaminaOrReject(ctx, THRESHOLD_STAMINA_COST, apCost, 'Threshold');
  if (stamFail) return stamFail;
  if (!ctx.spendAmmo(THRESHOLD_AMMO_COST)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  const armed = armHexThreshold({
    thresholdArmed: ctx.classState.thresholdArmed,
    thresholdSnapshot: ctx.classState.thresholdAmmoType
      ? {
        ammoType: ctx.classState.thresholdAmmoType,
        nextShotOvercharged: ctx.classState.thresholdNextShotOvercharged,
        overchargeMultiplier: ctx.classState.thresholdOverchargeMultiplier,
        firstShotPenaltyPending: ctx.classState.thresholdFirstShotPenaltyPending,
      }
      : null,
  }, snap);
  if (!armed) {
    ctx.log('[REJECTED] >> Threshold already armed.');
    return { ok: false, reason: 'ALREADY_ARMED', refundAp: apCost };
  }
  ctx.classState.thresholdArmed = true;
  ctx.classState.thresholdAmmoType = snap.ammoType;
  ctx.classState.thresholdNextShotOvercharged = snap.nextShotOvercharged;
  ctx.classState.thresholdOverchargeMultiplier = snap.overchargeMultiplier;
  ctx.classState.thresholdFirstShotPenaltyPending = snap.firstShotPenaltyPending;
  ctx.onThresholdArmed?.();
  ctx.log('[THRESHOLD] >> Armed — shell reserved. Fires before next direct attack on you.');
  if (ctx.currentAmmo - THRESHOLD_AMMO_COST <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: THRESHOLD_AMMO_COST };
}

function executeDeadbolt(
  ctx: HexWeaponActionExecutionContext,
  apCost: number,
): HexWeaponActionExecutionResult {
  const unit = targetUnit(ctx);
  if (!unit?.unitId) {
    ctx.log('[REJECTED] >> Deadbolt requires a target.');
    return { ok: false, reason: 'NO_TARGET', refundAp: apCost };
  }
  if (!ctx.resolvedWeapon || ctx.resolvedWeapon.familyId !== 'hex-void-cannon') {
    ctx.log('[REJECTED] >> Deadbolt requires Nullbreach.');
    return { ok: false, reason: 'WRONG_FAMILY', refundAp: apCost };
  }
  if (ctx.currentAmmo < DEADBOLT_AMMO_COST) {
    ctx.log('[REJECTED] >> Deadbolt needs one loaded round.');
    return { ok: false, reason: 'INSUFFICIENT_AMMO', refundAp: apCost };
  }
  const stamFail = spendStaminaOrReject(ctx, DEADBOLT_STAMINA_COST, apCost, 'Deadbolt');
  if (stamFail) return stamFail;
  // Snapshot opportunity before costs commit, then consume with the shot.
  const primed = ctx.classState.deadboltReloadOpportunity === true;
  const authored = deadboltAuthoredBase(primed);
  if (!ctx.spendAmmo(DEADBOLT_AMMO_COST)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, reason: 'NO_AMMO', refundAp: apCost };
  }
  if (primed) {
    const next = consumeHexDeadboltReloadOpportunity({
      deadboltReloadOpportunity: ctx.classState.deadboltReloadOpportunity,
    });
    ctx.classState.deadboltReloadOpportunity = next.deadboltReloadOpportunity;
    ctx.log('[DEADBOLT] >> Reload opportunity consumed — primed 28 Kinetic base.');
  }
  let dmg = scaleHexWeaponAuthoredDamage(authored, ctx.resolvedWeapon);
  dmg = applyBlackDoorBacklineFalloff(
    dmg,
    !!unit.gridSlot?.startsWith('BL'),
  );
  const playerActionId = `pa-hex-deadbolt-${Date.now()}`;
  ctx.hurtEnemy(dmg, primed ? '[DEADBOLT — PRIMED]' : '[DEADBOLT]', {
    channel: 'KINETIC',
    fractureGain: 14,
    abilityId: 'DEADBOLT',
    targetId: unit.unitId,
    weaponFamilyBallisticAlreadyScaled: true,
    playerActionId,
  }, unit.unitId);
  if (ctx.currentAmmo - DEADBOLT_AMMO_COST <= 0) ctx.onMagazineEmptied?.();
  return { ok: true, committedAmmo: DEADBOLT_AMMO_COST };
}
