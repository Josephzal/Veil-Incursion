import type { ClassBoonEncounterState, EnvoyBoonCombatModifiers } from '../types/classBoon';
import type { EnvoyBoonId } from '../types/classBoon';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import type { EnvoyAbilityId } from '../types/operativeClass';
import { boonMatchesEnvoyAction, hasEnvoyBoon } from './classBoonEngine';
import { getEnvoyAbilityTags, getEnvoyAbilityDefinition } from './envoyAbilities';
import { adjacentAliveUnits, aliveUnits, getUnitById, isUnitAlive } from './combatSquadEngine';
import { addCombatTag, hasCombatTag } from './combatFractureEngine';

export function isEnemyCursed(
  unit: EnemyCombatProfile,
  classState: ClassCombatEncounterState,
  encounter: ClassBoonEncounterState,
): boolean {
  if (!unit.unitId) return false;
  const id = unit.unitId;
  if (encounter.cursedUnitIds[id]) return true;
  if (classState.fleshWarpUnits[id]) return true;
  if (classState.soulTetherUnitId === id) return true;
  if ((classState.entropyHexTurns[id] ?? 0) > 0) return true;
  if ((unit.combatTags ?? []).some((t) => t.includes('CURSE') || t === 'DOOMED')) return true;
  return false;
}

export function markEnemyCursed(
  unitId: string,
  encounter: ClassBoonEncounterState,
  curseTurns = 2,
): void {
  encounter.cursedUnitIds[unitId] = true;
  encounter.hexBreakerCurseTurns[unitId] = Math.max(
    encounter.hexBreakerCurseTurns[unitId] ?? 0,
    curseTurns,
  );
}

export interface EnvoyDamageAdjustInput {
  boons: readonly EnvoyBoonId[];
  mods: EnvoyBoonCombatModifiers;
  abilityId: EnvoyAbilityId | null;
  target: EnemyCombatProfile;
  damage: number;
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  encounter: ClassBoonEncounterState;
  log: (msg: string) => void;
}

export interface EnvoyDamageAdjustResult {
  damage: number;
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  executeKill?: boolean;
  kineticConversionSplash?: number;
}

export function adjustEnvoyOutgoingDamage(input: EnvoyDamageAdjustInput): EnvoyDamageAdjustResult {
  const { boons, mods, abilityId, target, encounter, log } = input;
  let damage = input.damage;
  let channel = input.channel;
  let executeKill = false;
  let kineticConversionSplash: number | undefined;

  if (!abilityId || damage <= 0 || !target.unitId) {
    return { damage, channel, executeKill, kineticConversionSplash };
  }

  const tags = getEnvoyAbilityTags(abilityId);

  if (
    encounter.voidsBargainFirstStrike
    && hasEnvoyBoon(boons, 'VOIDS_BARGAIN')
  ) {
    damage = Math.floor(damage * 2);
    encounter.voidsBargainFirstStrike = false;
    log("[VOID'S BARGAIN] >> First strike this turn — double damage.");
  }

  if (
    tags.includes('RANGED')
    && target.gridSlot?.startsWith('BL')
    && boonMatchesEnvoyAction(boons, 'ASTRAL_PIERCER', abilityId)
  ) {
    damage = Math.floor(damage * 1.3);
    log('[ASTRAL PIERCER] >> Backline ranged strike amplified.');
  }

  if (
    tags.includes('FLUX_DUMP')
    && encounter.lastActionWasFluxGen
    && boonMatchesEnvoyAction(boons, 'PENDULUM_SHIFT', abilityId)
  ) {
    damage = Math.floor(damage * (1 + mods.pendulumDumpBonusPct / 100));
    log('[PENDULUM SHIFT] >> Flux dump after generation — +50% damage.');
  }

  if (
    tags.includes('SPELL')
    && target.maxHp > 0
    && !target.isBoss
    && boonMatchesEnvoyAction(boons, 'EXECUTIONERS_SPELL', abilityId)
    && target.currentHp / target.maxHp <= 0.2
  ) {
    damage = target.currentHp;
    executeKill = true;
    log("[EXECUTIONER'S SPELL] >> Sub-threshold target — instant execution.");
  }

  if (
    channel === 'OCCULT'
    && (hasCombatTag(target, 'CONCUSSED') || (target.combatTags ?? []).includes('CONCUSSED'))
    && boonMatchesEnvoyAction(boons, 'MIND_PLAGUE', abilityId)
  ) {
    damage = Math.floor(damage * 2);
    log('[MIND-PLAGUE] >> Concussed target — occult damage doubled.');
  }

  if (
    tags.includes('SPELL')
    && channel === 'OCCULT'
    && boonMatchesEnvoyAction(boons, 'KINETIC_CONVERSION', abilityId)
  ) {
    kineticConversionSplash = Math.max(1, Math.floor(damage * 0.2));
    log('[KINETIC CONVERSION] >> Occult charge partially converted to kinetic.');
  }

  return { damage, channel, executeKill, kineticConversionSplash };
}

export function getEnvoyVolatileMagicCritBonus(
  boons: readonly EnvoyBoonId[],
  abilityId: EnvoyAbilityId | null,
  critical: boolean,
): number {
  if (!critical || !abilityId) return 0;
  if (!boonMatchesEnvoyAction(boons, 'VOLATILE_MAGIC', abilityId)) return 0;
  if (!getEnvoyAbilityTags(abilityId).includes('AOE')) return 0;
  return 0.25;
}

export interface EnvoyOnHitContext {
  boons: readonly EnvoyBoonId[];
  abilityId: EnvoyAbilityId | null;
  target: EnemyCombatProfile;
  damageDealt: number;
  log: (msg: string) => void;
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void;
  healOperative: (amount: number) => void;
  encounter: ClassBoonEncounterState;
}

export function runEnvoyOnHitBoons(ctx: EnvoyOnHitContext): void {
  const { boons, abilityId, target, damageDealt, encounter } = ctx;
  if (!abilityId || damageDealt <= 0 || !target.unitId) return;

  const tags = getEnvoyAbilityTags(abilityId);

  if (boonMatchesEnvoyAction(boons, 'SHATTER_CAST', abilityId) && tags.includes('SPELL')) {
    const patch: Partial<EnemyCombatProfile> = {};
    if ((target.veilBarrierCharges ?? 0) > 0) {
      const next = (target.veilBarrierCharges ?? 0) - 1;
      patch.veilBarrierCharges = next > 0 ? next : undefined;
    } else if ((target.occultWards ?? 0) > 0) {
      patch.occultWards = Math.max(0, (target.occultWards ?? 0) - 1);
    } else if ((target.kineticArmor ?? 0) > 0) {
      patch.kineticArmor = Math.max(0, (target.kineticArmor ?? 0) - 1);
    }
    if (Object.keys(patch).length > 0) {
      ctx.patchUnit(target.unitId, patch);
      ctx.log('[SHATTER-CAST] >> Spell impact — 1 shield layer shattered.');
    }
  }

  if (encounter.vampiricLifestealPending) {
    encounter.vampiricLifestealPending = false;
    const heal = Math.max(1, Math.floor(damageDealt * 0.5));
    ctx.healOperative(heal);
    ctx.log(`[VAMPIRIC STEP] >> Rift slip lifesteal — +${heal} HP.`);
  }
}

export interface EnvoyAbilityResolveContext {
  boons: readonly EnvoyBoonId[];
  abilityId: EnvoyAbilityId;
  ok: boolean;
  squad: EnemyCombatProfile[];
  targetId: string | null;
  classState: ClassCombatEncounterState;
  encounter: ClassBoonEncounterState;
  fluxDelta: number;
  log: (msg: string) => void;
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void;
  applyOccultShield: (amount: number) => void;
  healOperative: (amount: number) => void;
  echoSpellDamage?: (amount: number, targetId: string) => void;
  stripAllKineticArmor?: () => void;
}

export function runEnvoyOnAbilityResolveBoons(ctx: EnvoyAbilityResolveContext): number {
  if (!ctx.ok) return ctx.fluxDelta;

  const tags = getEnvoyAbilityTags(ctx.abilityId);
  let fluxDelta = ctx.fluxDelta;

  if (tags.includes('FLUX_GEN')) {
    ctx.encounter.lastActionWasFluxGen = true;
    ctx.encounter.lastActionWasFluxDump = false;
  }
  if (tags.includes('FLUX_DUMP')) {
    ctx.encounter.lastActionWasFluxDump = true;
    ctx.encounter.lastActionWasFluxGen = false;
  }

  if (
    tags.includes('FLUX_GEN')
    && boonMatchesEnvoyAction(ctx.boons, 'RESIDUAL_ENERGY', ctx.abilityId)
    && fluxDelta > 0
  ) {
    const stacks = Math.min(2, ctx.encounter.fluxShieldStacks + 1);
    ctx.encounter.fluxShieldStacks = stacks;
    ctx.applyOccultShield(10);
    ctx.log(`[RESIDUAL ENERGY] >> Flux surge — occult shield grafted (${stacks}/2 stacks).`);
  }

  if (
    tags.includes('FLUX_DUMP')
    && boonMatchesEnvoyAction(ctx.boons, 'SAFETY_VALVE', ctx.abilityId)
    && fluxDelta < 0
  ) {
    const spent = Math.abs(fluxDelta);
    const heal = Math.max(1, Math.floor(spent / 10));
    if (heal > 0) {
      ctx.healOperative(heal);
      ctx.log(`[SAFETY VALVE] >> Flux vent siphon — +${heal} HP.`);
    }
  }

  if (tags.includes('DEFENSIVE') && hasEnvoyBoon(ctx.boons, 'WARD_WEAVER')) {
    ctx.encounter.wardWeaverCurseFree = true;
    ctx.log('[WARD-WEAVER] >> Defensive weave — next CURSE costs 0 AP.');
  }

  if (tags.includes('MOBILITY') && hasEnvoyBoon(ctx.boons, 'VAMPIRIC_STEP')) {
    ctx.encounter.vampiricLifestealPending = true;
    ctx.log('[VAMPIRIC STEP] >> Mobility proc — next strike will lifesteal.');
  }

  if (
    boonMatchesEnvoyAction(ctx.boons, 'ECHOING_AETHER', ctx.abilityId)
    && tags.includes('SPELL')
    && Math.random() < 0.15
    && ctx.targetId
  ) {
    const def = getEnvoyAbilityTags(ctx.abilityId);
    void def;
    const unit = getUnitById(ctx.squad, ctx.targetId);
    if (unit?.unitId) {
      const echoDmg = Math.max(4, getEnvoyAbilityDefinition(ctx.abilityId).baseDamage);
      ctx.echoSpellDamage?.(echoDmg, unit.unitId);
      ctx.log('[ECHOING AETHER] >> Aether echo — duplicate spell for 0 cost.');
    }
  }

  if (tags.includes('CURSE')) {
    applyEnvoyCurseResolveEffects(ctx);
  }

  if (
    tags.includes('DEBUFF')
    && hasEnvoyBoon(ctx.boons, 'DOOMED_FLESH')
  ) {
    for (const unit of aliveUnits(ctx.squad)) {
      if (!unit.unitId) continue;
      if (ctx.classState.entropyHexTurns[unit.unitId]) {
        ctx.classState.entropyHexTurns[unit.unitId] += 1;
      }
    }
    ctx.log('[DOOMED FLESH] >> Debuff payload — hazard duration extended.');
  }

  if (
    (tags.includes('AOE') || tags.includes('FLUX_DUMP'))
    && boonMatchesEnvoyAction(ctx.boons, 'SINGULARITY_COLLAPSE', ctx.abilityId)
  ) {
    ctx.stripAllKineticArmor?.();
    ctx.log('[SINGULARITY COLLAPSE] >> Flux singularity — all kinetic armor stripped.');
  }

  if (
    tags.includes('SPELL')
    && ctx.targetId
    && hasEnvoyBoon(ctx.boons, 'CURSED_AETHER')
    && fluxDelta > 0
  ) {
    const curseTarget = getUnitById(ctx.squad, ctx.targetId);
    if (curseTarget && isEnemyCursed(curseTarget, ctx.classState, ctx.encounter)) {
      fluxDelta = Math.floor(fluxDelta * 0.5);
      ctx.log('[CURSED AETHER] >> Cursed target dampens flux generation (−50%).');
    }
  }

  return fluxDelta;
}

function applyEnvoyCurseResolveEffects(ctx: EnvoyAbilityResolveContext): void {
  const curseTargets = ctx.targetId
    ? [getUnitById(ctx.squad, ctx.targetId)].filter(Boolean) as EnemyCombatProfile[]
    : aliveUnits(ctx.squad);

  for (const unit of curseTargets) {
    if (!unit.unitId) continue;
    const curseTurns = ctx.classState.entropyHexTurns[unit.unitId]
      ? (ctx.classState.entropyHexTurns[unit.unitId] ?? 2)
      : 2;
    markEnemyCursed(unit.unitId, ctx.encounter, curseTurns);

    if (boonMatchesEnvoyAction(ctx.boons, 'WITHERED_VIGOR', ctx.abilityId)) {
      const reduced = Math.max(1, Math.floor(unit.baseDamage * 0.9));
      ctx.patchUnit(unit.unitId, { baseDamage: reduced });
      ctx.log(`[WITHERED VIGOR] >> ${unit.designation} — curse withers offensive output.`);
    }

    if (boonMatchesEnvoyAction(ctx.boons, 'VOID_MARKED', ctx.abilityId)) {
      ctx.patchUnit(unit.unitId, {
        kineticArmor: 0,
        occultWards: 0,
        veilBarrierCharges: undefined,
        evadeActive: false,
      });
      ctx.log(`[VOID-MARKED] >> ${unit.designation} — defensive buffs purged.`);
    }
  }

  if (
    boonMatchesEnvoyAction(ctx.boons, 'HEAVY_GRAVITY', ctx.abilityId)
    && getEnvoyAbilityTags(ctx.abilityId).includes('CONTROL')
  ) {
    for (const unit of aliveUnits(ctx.squad)) {
      if (!unit.unitId) continue;
      ctx.encounter.heavyGravityApDrain[unit.unitId] = 1;
    }
    ctx.log('[HEAVY GRAVITY] >> Displaced hostiles — −1 AP next turn.');
  }
}

export interface EnvoyKillBoonContext {
  boons: readonly EnvoyBoonId[];
  abilityId: EnvoyAbilityId | null;
  killedUnitId: string | null;
  squad: EnemyCombatProfile[];
  classState: ClassCombatEncounterState;
  encounter: ClassBoonEncounterState;
  log: (msg: string) => void;
  healOperative: (amount: number) => void;
  maxHp: number;
  currentHp: number;
  applyCurseToUnit: (unitId: string) => void;
}

export function runEnvoyKillBoonsExtended(ctx: EnvoyKillBoonContext): void {
  const { boons, abilityId, killedUnitId, squad, encounter } = ctx;
  if (!abilityId || !killedUnitId) return;

  if (
    boonMatchesEnvoyAction(boons, 'CURSE_EATER', abilityId)
    && encounter.cursedUnitIds[killedUnitId]
  ) {
    const missing = Math.max(0, ctx.maxHp - ctx.currentHp);
    const heal = Math.floor(missing * 0.2);
    if (heal > 0) {
      ctx.healOperative(heal);
      ctx.log(`[CURSE-EATER] >> Cursed kill — ${heal} HP restored.`);
    }
  }

  if (
    boonMatchesEnvoyAction(boons, 'CONTAGIOUS_HEX', abilityId)
    && encounter.cursedUnitIds[killedUnitId]
  ) {
    const adj = adjacentAliveUnits(squad, killedUnitId);
    const spread = adj[0];
    if (spread?.unitId) {
      ctx.applyCurseToUnit(spread.unitId);
      ctx.classState.entropyHexTurns[spread.unitId] = 2;
      markEnemyCursed(spread.unitId, encounter, 2);
      ctx.log(`[CONTAGIOUS HEX] >> Curse jumps to ${spread.designation}.`);
    }
  }

  if (boonMatchesEnvoyAction(boons, 'CATACLYSMIC_ECHO', abilityId)) {
    encounter.cataclysmicEchoUltBonus += 2;
    ctx.log('[CATACLYSMIC ECHO] >> Ultimate kill — base ultimate damage +2.');
  }

  delete encounter.cursedUnitIds[killedUnitId];
  delete encounter.hexBreakerCurseTurns[killedUnitId];
}

export function applyEnvoyWardWeaverApDiscount(
  boons: readonly EnvoyBoonId[],
  abilityId: EnvoyAbilityId,
  apCost: number,
  encounter: ClassBoonEncounterState,
  log: (msg: string) => void,
): number {
  if (
    encounter.wardWeaverCurseFree
    && hasEnvoyBoon(boons, 'WARD_WEAVER')
    && getEnvoyAbilityTags(abilityId).includes('CURSE')
  ) {
    encounter.wardWeaverCurseFree = false;
    log('[WARD-WEAVER] >> Woven ward — CURSE cast costs 0 AP.');
    return 0;
  }
  return apCost;
}

export function tryEnvoyBloodMagicCast(
  boons: readonly EnvoyBoonId[],
  apCost: number,
  currentAp: number,
  maxHp: number,
  currentHp: number,
  log: (msg: string) => void,
): { apCost: number; hpCost: number } | null {
  if (!hasEnvoyBoon(boons, 'BLOOD_MAGIC')) return null;
  if (currentAp > 0 || apCost !== 1) return null;
  const hpCost = Math.max(1, Math.floor(maxHp * 0.15));
  if (currentHp <= hpCost) return null;
  log('[BLOOD MAGIC] >> Life tithe — 1 AP ability fueled by soul anchor.');
  return { apCost: 0, hpCost };
}

export function resolveEnvoyAethericBulwarkArmor(
  boons: readonly EnvoyBoonId[],
  mods: EnvoyBoonCombatModifiers,
  veilFlux: number,
): number {
  if (!hasEnvoyBoon(boons, 'AETHERIC_BULWARK')) return 0;
  return Math.floor(veilFlux / 25) * mods.kineticArmorPer25Flux;
}

export interface EnvoyOverloadEntryContext {
  boons: readonly EnvoyBoonId[];
  encounter: ClassBoonEncounterState;
  firstOverloadThisTurn: boolean;
  log: (msg: string) => void;
  resetCooldowns: () => void;
  dealOccultAoE: (amount: number) => void;
}

export function runEnvoyOverloadEntryBoons(ctx: EnvoyOverloadEntryContext): void {
  if (!ctx.firstOverloadThisTurn) return;

  if (hasEnvoyBoon(ctx.boons, 'LEYLINE_SURGE')) {
    ctx.resetCooldowns();
    ctx.log('[LEY-LINE SURGE] >> Overload cascade — all cooldowns reset.');
  }

  if (
    !ctx.encounter.emergencyVentUsed
    && hasEnvoyBoon(ctx.boons, 'EMERGENCY_VENT')
  ) {
    ctx.encounter.emergencyVentUsed = true;
    ctx.dealOccultAoE(20);
    ctx.log('[EMERGENCY VENT] >> First overload — 20 occult rupture vented.');
  }
}

export function tickEnvoyHexBreaker(
  squad: EnemyCombatProfile[],
  turns: Record<string, number>,
  hurtEnemy: (raw: number, targetId: string) => void,
  log: (msg: string) => void,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [unitId, remaining] of Object.entries(turns)) {
    const unit = getUnitById(squad, unitId);
    if (!unit?.unitId || !isUnitAlive(unit)) continue;
    if (remaining <= 1) {
      hurtEnemy(15, unitId);
      log(`[HEX-BREAKER] >> ${unit.designation} — curse collapse burst.`);
    } else {
      next[unitId] = remaining - 1;
    }
  }
  return next;
}

export function runAgonizingHexOnEnemyTurn(
  boons: readonly EnvoyBoonId[],
  unit: EnemyCombatProfile,
  classState: ClassCombatEncounterState,
  encounter: ClassBoonEncounterState,
  hurtEnemy: (raw: number, targetId: string) => void,
  log: (msg: string) => void,
): void {
  if (!hasEnvoyBoon(boons, 'AGONIZING_HEX')) return;
  if (!unit.unitId || !isEnemyCursed(unit, classState, encounter)) return;
  hurtEnemy(5, unit.unitId);
  log(`[AGONIZING HEX] >> ${unit.designation} — curse wracks on action (−5 TRUE).`);
}

export function applyEnvoyHeavyGravityApDrain(
  unitId: string,
  encounter: ClassBoonEncounterState,
  reduceEnemyAp: (unitId: string, amount: number) => void,
  designation: string,
  log: (msg: string) => void,
): void {
  const drain = encounter.heavyGravityApDrain[unitId];
  if (!drain || drain <= 0) return;
  delete encounter.heavyGravityApDrain[unitId];
  reduceEnemyAp(unitId, drain);
  log(`[HEAVY GRAVITY] >> ${designation} — displacement tax (−${drain} AP).`);
}

export function applyVoidsBargainStartBleed(
  boons: readonly EnvoyBoonId[],
  hurtPlayer: (amount: number) => void,
  log: (msg: string) => void,
): void {
  if (!hasEnvoyBoon(boons, 'VOIDS_BARGAIN')) return;
  hurtPlayer(1);
  log("[VOID'S BARGAIN] >> Encounter tithe — operative enters with 1 bleed.");
}

export function getCataclysmicEchoDamageBonus(encounter: ClassBoonEncounterState): number {
  return encounter.cataclysmicEchoUltBonus;
}
