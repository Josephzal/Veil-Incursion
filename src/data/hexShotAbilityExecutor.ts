import type { HexShotAbilityId } from '../types/operativeClass';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import type { ResolvedWeaponState } from '../types/weapon';
import { getHexShotAbilityDefinition } from './hexShotAbilities';
import { graftForcesSingleTarget } from './hexShotIntrinsics';
import { resolveHexShotResourceCosts } from './hexShotResourceEngine';
import { resolveHexBasicShot } from './weaponBasicEngine';
import { addCombatTag } from './combatFractureEngine';
import {
  aliveUnits,
  getUnitById,
  isUnitAlive,
} from './combatSquadEngine';
import type { ResolvedWeaponCombatStats } from './inventory';
import type { ClassGraftCastPlan } from '../types/classGraft';
import { playCombatPresentationCue } from '../utils/combatPresentationAudio';
import {
  ASH_JACKET_SALVO_PACKETS,
  canCastBlacksiteTriage,
  resolveCinderlineSlotForUnit,
  seedCinderlineHazard,
} from './hexShotPhaseH3bEngine';
import {
  applyUniversalDamagePacketUpgrade,
  getUniversalGraftDefinition,
  readUniversalUpgradeValue,
} from './universalGraftRegistry';

export interface HexShotAbilityHurtOptions {
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  fractureGain?: number;
  targetId?: string;
  abilityId?: HexShotAbilityId;
  rollCrit?: boolean;
  forceCrit?: boolean;
  /** DoT / trap / triggered damage — no weapon attack SFX. */
  indirectDamage?: boolean;
  /** Floor for Kinetic Armor strip layers (Nullbreach innate pressure). */
  innateArmorPressureLayers?: number;
  /**
   * H.2a — family ballisticDamagePct already applied in resolveHexBasicShot.
   * Hub must not re-apply the family ballistic layer.
   */
  weaponFamilyBallisticAlreadyScaled?: boolean;
  /** Stable action id shared across all packets of one fixed-basic commitment. */
  playerActionId?: string;
}

export interface HexShotExecutionContext {
  abilityId: HexShotAbilityId;
  squad: EnemyCombatProfile[];
  targetId: string | null;
  strikeStats: ResolvedWeaponCombatStats;
  currentAmmo: number;
  maxAmmo: number;
  maxSoulAnchor: number;
  classState: ClassCombatEncounterState;
  log: (msg: string) => void;
  apCostOverride?: number;
  ammoCostOverride?: number;
  spendAmmo: (amount: number) => boolean;
  spendStamina: (cost: number) => boolean;
  spendStaminaPct: (pct: number) => boolean;
  hurtEnemy: (
    raw: number,
    tag: string,
    options?: HexShotAbilityHurtOptions,
    targetId?: string,
  ) => boolean;
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void;
  syncSquad: (squad: EnemyCombatProfile[]) => void;
  healOperative: (amount: number) => void;
  setShadowStepEvadeActive?: (active: boolean) => void;
  reduceEnemyAp: (unitId: string, amount: number) => void;
  emptyMagazine: () => void;
  ultimatePerformance?: number;
  /** Effective authored tags for this cast. */
  effectiveTags?: readonly string[];
  /** Equipped weapon — drives unique basic delivery (Phase 3D). */
  resolvedWeapon?: ResolvedWeaponState | null;
  /** Called when magazine hits 0 after a basic (shotgun / breach loop). */
  onMagazineEmptied?: () => void;
  /** Operative HP for Blacksite Triage validation (H.3b). */
  operativeCurrentHp?: number;
  operativeMaxHp?: number;
  graftPlan?: ClassGraftCastPlan | null;
}

export type HexShotExecutionResult =
  | { ok: true }
  | { ok: false; refundAp: number; refundAmmo?: number };

function targetUnit(ctx: HexShotExecutionContext): EnemyCombatProfile | null {
  if (!ctx.targetId) return null;
  return getUnitById(ctx.squad, ctx.targetId) ?? null;
}

function resolveHexShotAreaHits(
  ctx: HexShotExecutionContext,
  focalUnit: EnemyCombatProfile,
): EnemyCombatProfile[] {
  if (graftForcesSingleTarget(ctx.effectiveTags)) {
    return focalUnit.unitId && isUnitAlive(focalUnit) ? [focalUnit] : [];
  }
  return aliveUnits(ctx.squad);
}

function ballisticDamage(ctx: HexShotExecutionContext, abilityId: HexShotAbilityId): number {
  const def = getHexShotAbilityDefinition(abilityId);
  if (def.baseDamage > 0) return def.baseDamage;
  return ctx.strikeStats.strikeDamage;
}

function stackBleed(unit: EnemyCombatProfile): EnemyCombatProfile {
  const tags = unit.combatTags ?? [];
  if (tags.includes('DOOMED')) return unit;
  return { ...unit, combatTags: [...tags, 'DOOMED'] };
}

export function executeHexShotAbility(ctx: HexShotExecutionContext): HexShotExecutionResult {
  const def = getHexShotAbilityDefinition(ctx.abilityId);
  const costs = resolveHexShotResourceCosts(def, {
    apCost: ctx.apCostOverride,
    ammoCost: ctx.ammoCostOverride,
  });
  const { apCost, ammoCost, staminaCostPct } = costs;
  const staminaCost = readUniversalUpgradeValue(ctx.graftPlan, 'STAMINA_COST', costs.staminaCost);

  if (ammoCost > 0 && !ctx.spendAmmo(ammoCost)) {
    ctx.log('[REJECTED] >> Magazine dry — insufficient rounds.');
    return { ok: false, refundAp: apCost, refundAmmo: 0 };
  }

  if (staminaCostPct > 0) {
    if (!ctx.spendStaminaPct(staminaCostPct)) {
      ctx.log('[REJECTED] >> Insufficient stamina.');
      return { ok: false, refundAp: apCost, refundAmmo: ammoCost };
    }
  } else if (staminaCost > 0 && !ctx.spendStamina(staminaCost)) {
    ctx.log('[REJECTED] >> Insufficient stamina.');
    return { ok: false, refundAp: apCost, refundAmmo: ammoCost };
  }

  switch (ctx.abilityId) {
    case 'PHASE_SHIFT_RELOAD':
      ctx.log('[REJECTED] >> Use [ COMBAT RELOAD ] — intrinsic class feature.');
      return { ok: false, refundAp: def.apCost };

    case 'SILVER_CORE_SIDEARM': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Sidearm requires a target.');
        return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
      }
      const weapon = ctx.resolvedWeapon;
      if (weapon) {
        const plan = resolveHexBasicShot({
          weapon,
          squad: ctx.squad,
          primaryTargetId: unit.unitId,
          catalogBaseDamage: def.baseDamage || ballisticDamage(ctx, ctx.abilityId),
          forceSingleTarget: graftForcesSingleTarget(ctx.effectiveTags),
        });
        plan.logLines.forEach((line) => ctx.log(line));
        if (plan.hits.length === 0) {
          return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
        }
        if (plan.staminaCost > 0 && !ctx.spendStamina(plan.staminaCost)) {
          ctx.log('[REJECTED] >> Insufficient stamina for breach round.');
          return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
        }
        // Ammo already spent above via ammoCost; shotgun still spends 1.
        // Spread hits share one cast-level ammo payload in the hub (tracker caps).
        // Nullbreach innate KA pressure is applied once in hurtEnemy via
        // resolveWeaponArmorPressureLayers (floor = innateArmorPressureLayers).
        // H.2a — one playerActionId for the whole fixed-basic commitment.
        const playerActionId = `pa-hex-basic-${Date.now()}`;
        for (const hit of plan.hits) {
          ctx.hurtEnemy(hit.damage, hit.isPrimary ? '[WEAPON BASIC]' : '[SPREAD]', {
            channel: 'KINETIC',
            fractureGain: hit.fractureGain,
            abilityId: ctx.abilityId,
            targetId: hit.targetId,
            innateArmorPressureLayers: plan.innateArmorPressureLayers,
            // Family ballisticDamagePct already applied in resolveHexBasicShot.
            weaponFamilyBallisticAlreadyScaled: true,
            playerActionId,
          }, hit.targetId);
        }
        if (ctx.currentAmmo - (ammoCost || plan.ammoCost) <= 0) {
          ctx.onMagazineEmptied?.();
        }
        return { ok: true };
      }
      ctx.hurtEnemy(ballisticDamage(ctx, ctx.abilityId), '[SILVER-CORE]', {
        channel: 'KINETIC',
        fractureGain: 15,
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true };
    }

    case 'ASH_JACKET_SALVO': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Salvo requires a target.');
        return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
      }
      // H.3b — three authored packets (7+7+8); ammo spent once above via ammoCost=3.
      const playerActionId = `pa-hex-salvo-${Date.now()}`;
      let resolvedHits = 0;
      ASH_JACKET_SALVO_PACKETS.forEach((packetDmg, index) => {
        const landed = ctx.hurtEnemy(
          packetDmg,
          `[ASH-JACKET SALVO — ${index + 1}]`,
          {
            channel: 'KINETIC',
            fractureGain: index === 0 ? 30 : 0,
            abilityId: ctx.abilityId,
            targetId: unit.unitId,
            playerActionId,
          },
          unit.unitId,
        );
        if (landed) resolvedHits += 1;
      });
      if (resolvedHits > 0) {
        const working = getUnitById(ctx.squad, unit.unitId) ?? unit;
        ctx.patchUnit(unit.unitId, addCombatTag(working, 'CONCUSSED'));
        ctx.log('[ASH-JACKET SALVO] >> Three-round burst (7+7+8) — stagger applied.');
      }
      return { ok: true };
    }

    case 'SINGULARITY_SLUG': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Singularity Slug requires a target.');
        return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
      }
      const reducedMax = Math.max(1, Math.floor(unit.maxHp * 0.9));
      ctx.patchUnit(unit.unitId, {
        maxHp: reducedMax,
        currentHp: Math.min(unit.currentHp, reducedMax),
        kineticArmor: 0,
      });
      ctx.hurtEnemy(ballisticDamage(ctx, ctx.abilityId), '[SINGULARITY SLUG]', {
        channel: 'KINETIC',
        abilityId: ctx.abilityId,
        rollCrit: false,
        targetId: unit.unitId,
      }, unit.unitId);
      ctx.log('[SINGULARITY SLUG] >> Max HP compressed −10%, armor ignored.');
      return { ok: true };
    }

    case 'REVENANTS_ECHO': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Revenant\'s Echo requires a target.');
        return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
      }
      const base = ballisticDamage(ctx, ctx.abilityId);
      ctx.hurtEnemy(base, "[REVENANT'S ECHO — 1]", {
        channel: 'KINETIC',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      const working = getUnitById(ctx.squad, unit.unitId) ?? unit;
      const executionWindow = working.maxHp > 0 && working.currentHp / working.maxHp < 0.3;
      const second = executionWindow ? Math.floor(base * 3) : base;
      ctx.hurtEnemy(second, "[REVENANT'S ECHO — 2]", {
        channel: 'KINETIC',
        abilityId: ctx.abilityId,
        rollCrit: executionWindow,
        forceCrit: executionWindow,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true };
    }

    case 'RIFT_SNARE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Rift-Snare requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.classState.riftSnareUnits[unit.unitId] = applyUniversalDamagePacketUpgrade(
        { damage: def.baseDamage },
        getUniversalGraftDefinition(ctx.graftPlan?.graftId),
      ).damage;
      playCombatPresentationCue('sfx.hex.snare');
      ctx.log(`[RIFT-SNARE] >> Mine seeded under ${unit.designation}.`);
      return { ok: true };
    }

    case 'PHOSPHORUS_HEX': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Phosphorus Hex requires a focal target.');
        return { ok: false, refundAp: def.apCost };
      }
      const singleTarget = graftForcesSingleTarget(ctx.effectiveTags);
      for (const hit of resolveHexShotAreaHits(ctx, unit)) {
        if (!hit.unitId) continue;
        ctx.patchUnit(hit.unitId, {
          ...addCombatTag(hit, 'BLINDED'),
          blindedAccuracyPenaltyPct: readUniversalUpgradeValue(
            ctx.graftPlan,
            'ACCURACY_PENALTY',
            50,
          ),
          evadeChance: 0,
          evadeActive: false,
        });
      }
      ctx.log(singleTarget
        ? '[PHOSPHORUS HEX] >> Focal blind — evade stripped.'
        : '[PHOSPHORUS HEX] >> Grid blinded — evade stripped.');
      return { ok: true };
    }

    case 'NULL_SPACE_CLOAK': {
      ctx.setShadowStepEvadeActive?.(true);
      ctx.log('[NULL-SPACE CLOAK] >> Phase cloak — next incoming attack will whiff.');
      return { ok: true };
    }

    case 'GHOST_GRID_CAMO': {
      ctx.classState.ghostCamoTurnsRemaining = readUniversalUpgradeValue(
        ctx.graftPlan,
        'DURATION_TURNS',
        1,
      );
      ctx.log('[GHOST-GRID CAMO] >> Operative phased — untargetable until next turn.');
      return { ok: true };
    }

    case 'ASTRAL_TARGET_LOCK': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Target-Lock requires a hostile.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.classState.astralLockUnitId = unit.unitId;
      ctx.patchUnit(unit.unitId, addCombatTag(unit, 'EXPOSED'));
      ctx.log('[ASTRAL TARGET-LOCK] >> Ballistic crit primed on marked hostile.');
      return { ok: true };
    }

    case 'BLEEDING_PAYLOAD': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Bleeding Payload requires a focal target.');
        return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
      }
      const singleTarget = graftForcesSingleTarget(ctx.effectiveTags);
      for (const hit of resolveHexShotAreaHits(ctx, unit)) {
        if (!hit.unitId) continue;
        ctx.hurtEnemy(def.baseDamage, '[BLEEDING PAYLOAD]', {
          channel: 'OCCULT',
          abilityId: ctx.abilityId,
          targetId: hit.unitId,
        }, hit.unitId);
        ctx.classState.bleedingPayloadTurns[hit.unitId] = 2;
        ctx.patchUnit(hit.unitId, stackBleed(hit));
      }
      ctx.log(singleTarget
        ? '[BLEEDING PAYLOAD] >> Focal slug — burn hazard seeded.'
        : '[BLEEDING PAYLOAD] >> Void burst — burn hazard seeded.');
      return { ok: true };
    }

    case 'WRAITH_PIERCER_ROUND': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Wraith-Piercer requires a target.');
        return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
      }
      ctx.hurtEnemy(def.baseDamage, '[WRAITH-PIERCER]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true };
    }

    case 'BLOOD_TRACER_ROUND': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Blood-Tracer requires a target.');
        return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
      }
      const before = unit.currentHp;
      ctx.hurtEnemy(def.baseDamage, '[BLOOD-TRACER]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      const after = getUnitById(ctx.squad, unit.unitId)?.currentHp ?? 0;
      const dealt = Math.max(0, before - after);
      const heal = Math.floor(dealt * 0.5);
      if (heal > 0) ctx.healOperative(heal);
      return { ok: true };
    }

    case 'STASIS_LOCK_SLUG': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Stasis-Lock requires a target.');
        return { ok: false, refundAp: def.apCost, refundAmmo: def.ammoCost };
      }
      ctx.reduceEnemyAp(unit.unitId, 2);
      ctx.hurtEnemy(def.baseDamage, '[STASIS-LOCK]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true };
    }

    case 'PANOPTICON_PROTOCOL': {
      ctx.classState.panopticonActive = true;
      ctx.classState.panopticonDamagePercent = readUniversalUpgradeValue(
        ctx.graftPlan,
        'DIRECT_DAMAGE',
        100,
      );
      ctx.log('[PANOPTICON WATCH] >> Overwatch online — next hostile action will be interrupted.');
      return { ok: true };
    }

    case 'CINDERLINE_SATURATION': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Cinderline Saturation requires a positional target.');
        return { ok: false, refundAp: def.apCost };
      }
      const slot = resolveCinderlineSlotForUnit(unit);
      if (!slot) {
        ctx.log('[REJECTED] >> Target has no stable grid position for Cinderline.');
        return { ok: false, refundAp: def.apCost };
      }
      const tickDamage = readUniversalUpgradeValue(
        ctx.graftPlan,
        'HAZARD_TICK_DAMAGE',
        5,
      );
      seedCinderlineHazard(ctx.classState, slot, tickDamage);
      ctx.log(`[CINDERLINE SATURATION] >> Hazard seeded on ${slot} — ${tickDamage} Occult / enemy turn · 2 rounds.`);
      return { ok: true };
    }

    case 'BLACKSITE_TRIAGE': {
      const currentHp = ctx.operativeCurrentHp ?? 0;
      const maxHp = ctx.operativeMaxHp ?? 0;
      const gate = canCastBlacksiteTriage(
        ctx.classState,
        currentHp,
        maxHp,
        readUniversalUpgradeValue(ctx.graftPlan, 'HEAL_PERCENT', 20),
      );
      if (!gate.ok) {
        ctx.log(gate.reason === 'USED'
          ? '[REJECTED] >> Blacksite Triage already expended this encounter.'
          : '[REJECTED] >> Blacksite Triage — operative at full HP.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.classState.blacksiteTriageUsed = true;
      ctx.healOperative(gate.heal);
      ctx.log(`[BLACKSITE TRIAGE] >> Field recovery — +${gate.heal} HP.`);
      return { ok: true };
    }

    case 'ZERO_PROTOCOL': {
      if (ctx.currentAmmo < ctx.maxAmmo) {
        ctx.log('[REJECTED] >> Zero Protocol requires a full magazine.');
        return { ok: false, refundAp: def.apCost };
      }
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Zero Protocol requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      const performance = ctx.ultimatePerformance ?? 1;
      const burst = Math.floor((def.baseDamage + ctx.currentAmmo * 4) * (0.55 + performance * 0.45));
      ctx.hurtEnemy(burst, '[ZERO PROTOCOL]', {
        channel: 'TRUE',
        abilityId: ctx.abilityId,
        rollCrit: false,
        targetId: unit.unitId,
      }, unit.unitId);
      ctx.emptyMagazine();
      ctx.log('[ZERO PROTOCOL] >> Magazine dumped — execution channel resolved.');
      return { ok: true };
    }

    default:
      ctx.log('[REJECTED] >> Ability channel not wired.');
      return { ok: false, refundAp: def.apCost };
  }
}

export function isHexShotAbilityEnabled(
  abilityId: HexShotAbilityId,
  currentAmmo: number,
  maxAmmo: number,
  stamina: number,
  classState: ClassCombatEncounterState,
  ammoCostOverride?: number,
  operativeHp?: { current: number; max: number },
  staminaCostOverride?: number,
): boolean {
  const def = getHexShotAbilityDefinition(abilityId);
  const costs = resolveHexShotResourceCosts(def, { ammoCost: ammoCostOverride });
  const ammoCost = costs.ammoCost;
  if (abilityId === 'PHASE_SHIFT_RELOAD') return false;
  if (ammoCost > 0 && currentAmmo < ammoCost) return false;
  if (def.requiresFullMag && currentAmmo < maxAmmo) return false;
  if (costs.staminaCostPct > 0) {
    const cost = Math.floor(stamina * (costs.staminaCostPct / 100));
    if (cost <= 0 || stamina < cost) return false;
  } else if ((staminaCostOverride ?? costs.staminaCost) > 0
    && stamina < (staminaCostOverride ?? costs.staminaCost)) {
    return false;
  }
  if (abilityId === 'PANOPTICON_PROTOCOL' && classState.panopticonActive) return false;
  if (abilityId === 'BLACKSITE_TRIAGE' && operativeHp) {
    return canCastBlacksiteTriage(classState, operativeHp.current, operativeHp.max).ok;
  }
  if (abilityId === 'BLACKSITE_TRIAGE' && classState.blacksiteTriageUsed) return false;
  return true;
}

export function detonateRiftSnareOnUnit(
  unitId: string,
  designation: string,
  snares: Record<string, number>,
  hurtEnemy: HexShotExecutionContext['hurtEnemy'],
  log: (msg: string) => void,
): Record<string, number> {
  if (snares[unitId] == null) return snares;
  const dmg = snares[unitId];
  const remaining = { ...snares };
  delete remaining[unitId];
  hurtEnemy(dmg, '[RIFT-SNARE DETONATION]', {
    channel: 'KINETIC',
    abilityId: 'RIFT_SNARE',
    targetId: unitId,
    rollCrit: false,
    indirectDamage: true,
  }, unitId);
  log(`[RIFT-SNARE] >> Mine detonated under ${designation}.`);
  return remaining;
}

export function detonateRiftSnares(
  squad: EnemyCombatProfile[],
  snares: Record<string, number>,
  hurtEnemy: HexShotExecutionContext['hurtEnemy'],
  log: (msg: string) => void,
): Record<string, number> {
  let remaining: Record<string, number> = { ...snares };
  for (const unit of aliveUnits(squad)) {
    if (!unit.unitId || remaining[unit.unitId] == null) continue;
    remaining = detonateRiftSnareOnUnit(
      unit.unitId,
      unit.designation,
      remaining,
      hurtEnemy,
      log,
    );
  }
  return remaining;
}

export function tickHexShotClassState(classState: ClassCombatEncounterState): void {
  if (classState.ghostCamoTurnsRemaining > 0) {
    classState.ghostCamoTurnsRemaining -= 1;
  }
}
