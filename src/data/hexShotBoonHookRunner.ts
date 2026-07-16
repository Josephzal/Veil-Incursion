import type { ClassBoonEncounterState, HexShotBoonCombatModifiers } from '../types/classBoon';
import type { HexShotBoonId } from '../types/classBoon';
import type { ActiveReloadResult } from '../types/classCombatResources';
import type { EnemyCombatProfile } from '../types/run';
import type { HexShotAbilityId } from '../types/operativeClass';
import { boonMatchesHexAction, hasHexShotBoon, resolveHexEffectiveTags } from './classBoonEngine';
import { getHexShotAbilityTags } from './hexShotAbilities';
import type { HexAmmoType } from '../types/hexAmmo';
import { adjacentAliveUnits, aliveUnits, getUnitById, isUnitAlive } from './combatSquadEngine';
import { addCombatTag, hasCombatTag } from './combatFractureEngine';

export const VOID_BLEED_DOT = 5;

export interface HexShotDamageAdjustInput {
  boons: readonly HexShotBoonId[];
  mods: HexShotBoonCombatModifiers;
  abilityId: HexShotAbilityId | null;
  target: EnemyCombatProfile;
  damage: number;
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  encounter: ClassBoonEncounterState;
  log: (msg: string) => void;
  /** Loaded ammo type — Wraithglass counts as VOID_AMMO (v1 refactor). */
  ammoType?: HexAmmoType;
}

export interface HexShotDamageAdjustResult {
  damage: number;
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  forceCrit?: boolean;
  ignoreDefenses?: boolean;
}

export function getHexShotCritOverrides(
  boons: readonly HexShotBoonId[],
  abilityId: HexShotAbilityId,
  target: EnemyCombatProfile,
  encounter: ClassBoonEncounterState,
  ammoType?: HexAmmoType,
): { forceCrit: boolean; ignoreDefenses: boolean } {
  const tags = resolveHexEffectiveTags(abilityId, ammoType);
  if (
    tags.includes('VOID_AMMO')
    && hasCombatTag(target, 'EXPOSED')
    && boonMatchesHexAction(boons, 'OCCULT_ASSASSIN', abilityId, ammoType)
  ) {
    return { forceCrit: true, ignoreDefenses: true };
  }
  if (
    tags.includes('VOID_AMMO')
    && target.unitId
    && encounter.voidMarkedUnits[target.unitId]
    && boonMatchesHexAction(boons, 'CURSED_BALLISTICS', abilityId, ammoType)
  ) {
    return { forceCrit: false, ignoreDefenses: true };
  }
  return { forceCrit: false, ignoreDefenses: false };
}

export function adjustHexShotOutgoingDamage(input: HexShotDamageAdjustInput): HexShotDamageAdjustResult {
  const { boons, mods, abilityId, target, encounter, log, ammoType } = input;
  let damage = input.damage;
  let channel = input.channel;
  let forceCrit = false;
  let ignoreDefenses = false;

  if (!abilityId || damage <= 0 || !target.unitId) {
    return { damage, channel, forceCrit, ignoreDefenses };
  }

  const unitId = target.unitId;
  const tags = resolveHexEffectiveTags(abilityId, ammoType);
  const bm = (id: HexShotBoonId) => boonMatchesHexAction(boons, id, abilityId, ammoType);

  if (encounter.phantomTracerUnits[unitId] != null) {
    damage = Math.floor(damage * 1.1);
  }

  if (
    tags.includes('VOID_AMMO')
    && target.gridSlot?.startsWith('BL')
    && bm('LEYLINE_PENETRATOR')
  ) {
    damage = Math.floor(damage * (1 + mods.voidBacklineDamagePct / 100));
    log('[LEY-LINE PENETRATOR] >> Backline void strike amplified.');
  }

  if (
    tags.includes('BALLISTIC')
    && encounter.breachAndClearPending
    && bm('BREACH_AND_CLEAR')
  ) {
    damage = Math.floor(damage * 1.4);
    encounter.breachAndClearPending = false;
    log('[BREACH AND CLEAR] >> Post-burst ballistic — +40% damage.');
  }

  if (
    tags.includes('VOID_AMMO')
    && tags.includes('KINETIC')
    && bm('ABYSSAL_PRIMERS')
    && channel === 'KINETIC'
  ) {
    channel = 'OCCULT';
    log('[ABYSSAL PRIMERS] >> Kinetic charge converted to occult.');
  }

  if (
    tags.includes('VOID_AMMO')
    && hasCombatTag(target, 'EXPOSED')
    && bm('OCCULT_ASSASSIN')
  ) {
    forceCrit = true;
    log('[OCCULT ASSASSIN] >> Exposed void mark — guaranteed critical.');
  }

  if (
    tags.includes('VOID_AMMO')
    && encounter.voidMarkedUnits[unitId]
    && bm('CURSED_BALLISTICS')
  ) {
    ignoreDefenses = true;
    log('[CURSED BALLISTICS] >> Void-marked target — defenses bypassed.');
  }

  return { damage, channel, forceCrit, ignoreDefenses };
}

export interface HexShotOnHitContext {
  boons: readonly HexShotBoonId[];
  abilityId: HexShotAbilityId | null;
  target: EnemyCombatProfile;
  damageDealt: number;
  critical: boolean;
  squad: EnemyCombatProfile[];
  encounter: ClassBoonEncounterState;
  log: (msg: string) => void;
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void;
  splashDamage: (raw: number, targetId: string, tag: string) => void;
  healOperative: (amount: number) => void;
  maxHp: number;
  /** Loaded ammo type — Wraithglass counts as VOID_AMMO (v1 refactor). */
  ammoType?: HexAmmoType;
}

export function runHexShotOnHitBoons(ctx: HexShotOnHitContext): void {
  const { boons, abilityId, target, damageDealt, critical, encounter, ammoType } = ctx;
  if (!abilityId || damageDealt <= 0 || !target.unitId) return;

  const unitId = target.unitId;
  const tags = resolveHexEffectiveTags(abilityId, ammoType);
  const bm = (id: HexShotBoonId) => boonMatchesHexAction(boons, id, abilityId, ammoType);

  if (tags.includes('VOID_AMMO')) {
    encounter.voidMarkedUnits[unitId] = true;
    if (bm('PHANTOM_TRACER')) {
      encounter.phantomTracerUnits[unitId] = 1;
      ctx.log('[PHANTOM TRACER] >> Target marked — +10% damage taken.');
    }
  }

  if (bm('CORRUPTED_CASINGS') && tags.includes('VOID_AMMO')) {
    encounter.voidBleedTurns[unitId] = Math.max(encounter.voidBleedTurns[unitId] ?? 0, 2);
    ctx.log('[CORRUPTED CASINGS] >> Void-bleed seeded.');
  }

  if (
    bm('CURSED_SHRAPNEL')
    && tags.includes('BALLISTIC')
    && tags.includes('AOE')
  ) {
    for (const hit of aliveUnits(ctx.squad)) {
      if (!hit.unitId) continue;
      encounter.voidBleedTurns[hit.unitId] = Math.max(encounter.voidBleedTurns[hit.unitId] ?? 0, 2);
    }
    ctx.log('[CURSED SHRAPNEL] >> Shrapnel cloud — void-bleed on all hit.');
  }

  if (bm('SUPPRESSIVE_FIRE') && tags.includes('BALLISTIC')) {
    encounter.suppressiveFireUnits[unitId] = true;
    const reduced = Math.max(1, Math.floor(target.baseDamage * 0.85));
    ctx.patchUnit(unitId, { baseDamage: reduced });
    ctx.log('[SUPPRESSIVE FIRE] >> Target suppressed — next strike −15% power.');
  }

  if (bm('EVENT_HORIZON_ROUNDS') && tags.includes('VOID_AMMO')) {
    ctx.patchUnit(unitId, { evadeChance: 0, evadeActive: false });
    ctx.log('[EVENT HORIZON ROUNDS] >> Target evade stripped to zero.');
  }

  if (bm('GRID_SCRAMBLER') && tags.includes('TRAP') && Math.random() < 0.5) {
    const concussed = addCombatTag(target, 'CONCUSSED');
    ctx.patchUnit(unitId, { combatTags: concussed.combatTags });
    ctx.log('[GRID SCRAMBLER] >> Trap detonation — target concussed.');
  }

  if (
    critical
    && bm('SHRAPNEL_BLOOM')
    && tags.includes('BALLISTIC')
  ) {
    const splash = Math.max(1, Math.floor(damageDealt * 0.25));
    for (const adj of adjacentAliveUnits(ctx.squad, unitId)) {
      if (!adj.unitId) continue;
      ctx.splashDamage(splash, adj.unitId, '[SHRAPNEL BLOOM]');
    }
    ctx.log('[SHRAPNEL BLOOM] >> Critical shrapnel splashes adjacent hostiles.');
  }

  if (
    critical
    && bm('SIPHON_CHOKE')
    && tags.includes('VOID_AMMO')
  ) {
    const heal = Math.max(1, Math.floor(ctx.maxHp * 0.05));
    ctx.healOperative(heal);
    ctx.log(`[SIPHON CHOKE] >> Void crit siphon — +${heal} HP.`);
  }

  if (bm('ECHOING_GUNFIRE') && tags.includes('VOID_AMMO') && Math.random() < 0.2) {
    const pool = aliveUnits(ctx.squad).filter((u) => u.unitId !== unitId);
    const echo = pool[Math.floor(Math.random() * pool.length)];
    if (echo?.unitId) {
      ctx.splashDamage(damageDealt, echo.unitId, '[ECHOING GUNFIRE]');
      ctx.log('[ECHOING GUNFIRE] >> Void echo ricochets to secondary target.');
    }
  }
}

export interface HexShotKillBoonContext {
  boons: readonly HexShotBoonId[];
  abilityId: HexShotAbilityId | null;
  killedUnitId: string | null;
  lastDamage: number;
  squad: EnemyCombatProfile[];
  log: (msg: string) => void;
  splashDamage: (raw: number, targetId: string, tag: string) => void;
  refundAmmo?: (amount: number) => void;
  fillMagazine?: () => void;
  restoreStamina?: () => void;
}

export function runHexShotKillBurstBoons(ctx: HexShotKillBoonContext): void {
  const { boons, abilityId, killedUnitId, lastDamage, squad } = ctx;
  if (!abilityId || !killedUnitId) return;

  if (boonMatchesHexAction(boons, 'HOLLOW_POINT_DEBRIS', abilityId)) {
    const burst = Math.max(4, Math.floor(lastDamage * 0.35));
    for (const adj of adjacentAliveUnits(squad, killedUnitId)) {
      if (!adj.unitId) continue;
      ctx.splashDamage(burst, adj.unitId, '[HOLLOW-POINT DEBRIS]');
    }
    ctx.log('[HOLLOW-POINT DEBRIS] >> Kill burst — shrapnel detonation.');
  }
}

export interface HexShotAbilityResolveContext {
  boons: readonly HexShotBoonId[];
  abilityId: HexShotAbilityId;
  ok: boolean;
  squad: EnemyCombatProfile[];
  encounter: ClassBoonEncounterState;
  maxStamina: number;
  currentAmmo: number;
  log: (msg: string) => void;
  restoreStamina: (amount: number) => void;
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void;
  grantGuerillaEvade?: () => void;
  dealHotSwapOccult?: (amount: number) => void;
}

export function runHexShotOnAbilityResolveBoons(ctx: HexShotAbilityResolveContext): void {
  if (!ctx.ok) return;

  const tags = getHexShotAbilityTags(ctx.abilityId);
  const prevBallistic = ctx.encounter.lastActionWasBallistic;

  if (
    boonMatchesHexAction(ctx.boons, 'GUN_FU', ctx.abilityId)
    && tags.includes('TACTICAL')
    && prevBallistic
  ) {
    const restore = Math.floor(ctx.maxStamina * 0.15);
    if (restore > 0) {
      ctx.restoreStamina(restore);
      ctx.log(`[GUN-FU] >> Flow state — +${restore} stamina.`);
    }
  }

  if (tags.includes('AOE')) {
    ctx.encounter.breachAndClearPending = hasHexShotBoon(ctx.boons, 'BREACH_AND_CLEAR');
    if (ctx.encounter.breachAndClearPending) {
      ctx.log('[BREACH AND CLEAR] >> AoE primed — next ballistic empowered.');
    }
    ctx.encounter.lastActionWasAoe = true;
  } else {
    ctx.encounter.lastActionWasAoe = false;
  }

  if (tags.includes('BALLISTIC')) {
    ctx.encounter.lastActionWasBallistic = true;
  } else if (tags.includes('TACTICAL')) {
    ctx.encounter.lastActionWasBallistic = false;
  } else {
    ctx.encounter.lastActionWasBallistic = false;
  }

  if (
    boonMatchesHexAction(ctx.boons, 'ADRENALINE_INJECTOR', ctx.abilityId)
    && tags.includes('TACTICAL')
  ) {
    const restore = Math.floor(ctx.maxStamina * 0.2);
    if (restore > 0) {
      ctx.restoreStamina(restore);
      ctx.log(`[ADRENALINE INJECTOR] >> Tactical surge — +${restore} stamina.`);
    }
  }

  if (boonMatchesHexAction(ctx.boons, 'GUERILLA_WARFARE', ctx.abilityId) && tags.includes('TRAP')) {
    ctx.grantGuerillaEvade?.();
    ctx.log('[GUERILLA WARFARE] >> Trap sprung — +15% evade until next turn.');
  }

  seedChemicalWarfareFromAbility(ctx.squad, ctx.abilityId, ctx.boons, ctx.encounter);
  if (
    boonMatchesHexAction(ctx.boons, 'CHEMICAL_WARFARE', ctx.abilityId)
    && (tags.includes('TRAP') || tags.includes('AOE'))
  ) {
    ctx.log('[CHEMICAL WARFARE] >> Residue cloud — armor erosion seeded.');
  }

  if (
    boonMatchesHexAction(ctx.boons, 'FLASH_BLIND_OPTICS', ctx.abilityId)
    && tags.includes('DEBUFF')
  ) {
    for (const unit of aliveUnits(ctx.squad)) {
      if (!unit.unitId || !hasCombatTag(unit, 'EXPOSED')) continue;
      const reduced = Math.max(1, Math.floor(unit.baseDamage * 0.8));
      ctx.patchUnit(unit.unitId, { baseDamage: reduced });
      ctx.encounter.flashBlindDamageDebuff[unit.unitId] = true;
      ctx.log(`[FLASH-BLIND OPTICS] >> ${unit.designation} — EXPOSED target damage reduced.`);
    }
  }

  if (
    ctx.encounter.hotSwapPending
    && tags.includes('TACTICAL')
    && hasHexShotBoon(ctx.boons, 'HOT_SWAP')
  ) {
    ctx.encounter.hotSwapPending = false;
    ctx.dealHotSwapOccult?.(20);
    ctx.log('[HOT-SWAP] >> Empty-mag contingency — 20 occult snap-shot.');
  }

  if (ctx.currentAmmo <= 0 && hasHexShotBoon(ctx.boons, 'HOT_SWAP')) {
    ctx.encounter.hotSwapPending = true;
  }

}

export function applyHexShotTacticalReloadDiscount(
  boons: readonly HexShotBoonId[],
  abilityId: HexShotAbilityId,
  apCost: number,
  encounter: ClassBoonEncounterState,
  log: (msg: string) => void,
): number {
  if (
    encounter.tacticalReloadPending
    && hasHexShotBoon(boons, 'TACTICAL_RELOAD')
    && getHexShotAbilityTags(abilityId).includes('TACTICAL')
  ) {
    encounter.tacticalReloadPending = false;
    log('[TACTICAL RELOAD] >> Follow-up tactical — 0 AP.');
    return 0;
  }
  return apCost;
}

export function markHexShotTacticalReloadPending(
  boons: readonly HexShotBoonId[],
  encounter: ClassBoonEncounterState,
  log: (msg: string) => void,
): void {
  if (!hasHexShotBoon(boons, 'TACTICAL_RELOAD')) return;
  encounter.tacticalReloadPending = true;
  log('[TACTICAL RELOAD] >> Magazine cycled — next TACTICAL costs 0 AP.');
}

export interface HexShotReloadResolveContext {
  boons: readonly HexShotBoonId[];
  result: ActiveReloadResult;
  encounter: ClassBoonEncounterState;
  mods: HexShotBoonCombatModifiers;
  log: (msg: string) => void;
  grantOccultShield?: (amount: number) => void;
  grantAp?: () => void;
}

/** Reload boons fire after any resolve that restores a full magazine (perfect or jam). */
export function runHexShotOnReloadResolveBoons(ctx: HexShotReloadResolveContext): void {
  markHexShotTacticalReloadPending(ctx.boons, ctx.encounter, ctx.log);

  if (hasHexShotBoon(ctx.boons, 'ETHEREAL_MAGAZINES')) {
    ctx.grantOccultShield?.(10);
    ctx.log('[ETHEREAL MAGAZINES] >> Occult shield grafted to operative.');
  }

  if (ctx.result === 'PERFECT' && ctx.mods.perfectReloadApBonus) {
    ctx.grantAp?.();
    ctx.log('[FLAWLESS DRILL] >> Perfect reload — +1 AP.');
  }
}

export function tryHexShotPanicButton(
  boons: readonly HexShotBoonId[],
  encounter: ClassBoonEncounterState,
  currentAmmo: number,
  currentAp: number,
  maxAmmo: number,
  log: (msg: string) => void,
): { ammo: number; ap: number } | null {
  if (!hasHexShotBoon(boons, 'PANIC_BUTTON')) return null;
  if (encounter.panicButtonUsed || currentAmmo > 0 || currentAp > 0) return null;
  encounter.panicButtonUsed = true;
  log('[PANIC BUTTON] >> Emergency feed — +2 Ammo, +1 AP.');
  return { ammo: Math.min(2, maxAmmo), ap: 1 };
}

export function applyVoidBleedDot(
  squad: EnemyCombatProfile[],
  turns: Record<string, number>,
  hurtEnemy: (raw: number, tag: string, targetId: string) => void,
  log: (msg: string) => void,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [unitId, remaining] of Object.entries(turns)) {
    const unit = getUnitById(squad, unitId);
    if (!unit?.unitId || !isUnitAlive(unit)) continue;
    hurtEnemy(VOID_BLEED_DOT, '[VOID BLEED]', unitId);
    log(`[VOID BLEED] >> ${unit.designation} — ${VOID_BLEED_DOT} occult burn.`);
    if (remaining > 1) next[unitId] = remaining - 1;
  }
  return next;
}

export function tickHexShotChemicalWarfare(
  squad: EnemyCombatProfile[],
  turns: Record<string, number>,
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void,
  log: (msg: string) => void,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [unitId, remaining] of Object.entries(turns)) {
    const unit = getUnitById(squad, unitId);
    if (!unit?.unitId || !isUnitAlive(unit)) continue;
    const armor = unit.kineticArmor ?? 0;
    if (armor > 0) {
      patchUnit(unitId, { kineticArmor: armor - 1 });
      log(`[CHEMICAL WARFARE] >> ${unit.designation} — armor layer corroded.`);
    }
    if (remaining > 1) next[unitId] = remaining - 1;
  }
  return next;
}

export function seedChemicalWarfareFromAbility(
  squad: EnemyCombatProfile[],
  abilityId: HexShotAbilityId,
  boons: readonly HexShotBoonId[],
  encounter: ClassBoonEncounterState,
): void {
  const tags = getHexShotAbilityTags(abilityId);
  if (!boonMatchesHexAction(boons, 'CHEMICAL_WARFARE', abilityId)) return;
  if (!tags.includes('TRAP') && !tags.includes('AOE')) return;
  for (const unit of aliveUnits(squad)) {
    if (!unit.unitId) continue;
    encounter.chemicalWarfareTurns[unit.unitId] = 2;
  }
}

export function isOverwatchMasteryActive(boons: readonly HexShotBoonId[]): boolean {
  return hasHexShotBoon(boons, 'OVERWATCH_MASTERY');
}
