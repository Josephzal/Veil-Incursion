/**
 * Phase 3L — resting first-slot card presentation from live weapon / runtime state.
 * Numbers come from weaponBasicEngine plans — not hardcoded preview duplicates.
 */
import type { ClassType } from '../types/game';
import type { ResolvedWeaponState, WeaponFamilyId, WeaponRuntimeState } from '../types/weapon';
import type { EnemyCombatProfile } from '../types/run';
import type { EnvoyCatalystType } from './envoyCatalystEngine';
import {
  getWeaponAnchorAttack,
  resolveWeaponAnchorForAbility,
  type WeaponAnchorAttackRecord,
} from './weaponAnchorAttackRegistry';
import {
  resolveAegisStrikeBasic,
  resolveEnvoySplinterBasic,
  resolveHexBasicShot,
  PRISM_BRINK_FLUX_THRESHOLD,
} from './weaponBasicEngine';
import { AEGIS_RIPOSTE_BONUS_KINETIC } from './aegisRiposteEngine';
import { resolveWeaponCombatCallouts } from './weaponPlayerFacing/weaponPlayerFacingEngine';

export interface WeaponAnchorCardPresentation {
  anchor: WeaponAnchorAttackRecord;
  label: string;
  apCost: number;
  primaryOutcome: string;
  secondaryCost: string | null;
  targetPattern: string;
  definingEffects: readonly string[];
  conditionalState: string | null;
  effectLine: string;
  expandedDescription: string;
}

export interface WeaponAnchorCardContext {
  classId: ClassType;
  abilityId: string;
  weapon: ResolvedWeaponState;
  runtime: WeaponRuntimeState;
  stamina?: number;
  currentAmmo?: number;
  veilFlux?: number;
  operativeHp?: number;
  maxOperativeHp?: number;
  previousCatalyst?: EnvoyCatalystType | null;
  pulseSpreadSecondaryCount?: number;
  claymoreStaminaCommitted?: boolean;
  hexPerfectReload?: boolean;
  lanternDetonationReady?: boolean;
  prismCanPayFullSacrifice?: boolean;
  catalogBaseDamage?: number;
  catalogFluxCost?: number;
  /** Aegis Riposte ready — Strike preview shows base + Riposte bonus separately. */
  riposteReady?: boolean;
  targetFractured?: boolean;
}

function mockSquad(secondaryCount: number): EnemyCombatProfile[] {
  const squad: EnemyCombatProfile[] = [{
    unitId: 'primary',
    designation: 'PRIMARY',
    currentHp: 40,
    maxHp: 40,
    intent: 'STRIKE',
    class: 'GREMLIN',
    gridSlot: 'FL_0',
    baseDamage: 5,
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex: 0,
    scale: 1,
  } as EnemyCombatProfile];
  for (let i = 0; i < Math.max(0, secondaryCount); i += 1) {
    squad.push({
      unitId: `sec-${i}`,
      designation: `SEC ${i}`,
      currentHp: 30,
      maxHp: 30,
      intent: 'STRIKE',
      class: 'GREMLIN',
      gridSlot: i === 0 ? 'FL_1' : 'BL_0',
      baseDamage: 5,
      chargeTurns: 0,
      evadeActive: false,
      nodeIndex: i + 1,
      scale: 1,
    } as EnemyCombatProfile);
  }
  return squad;
}

export function resolveWeaponAnchorCardPresentation(
  ctx: WeaponAnchorCardContext,
): WeaponAnchorCardPresentation | null {
  const anchor = resolveWeaponAnchorForAbility(
    ctx.abilityId,
    ctx.weapon.familyId,
    ctx.classId,
  );
  if (!anchor) return null;

  const familyId = ctx.weapon.familyId;
  let primaryOutcome = '';
  let secondaryCost: string | null = null;
  let conditionalState: string | null = null;
  const effects = [...anchor.definingEffects];

  if (ctx.classId === 'AEGIS') {
    const plan = resolveAegisStrikeBasic({
      weapon: ctx.weapon,
      runtime: ctx.runtime,
      targetFractured: !!ctx.targetFractured,
    });
    const riposteBonus = ctx.riposteReady ? AEGIS_RIPOSTE_BONUS_KINETIC : 0;
    if (riposteBonus > 0) {
      const total = plan.kineticDamage + riposteBonus + (plan.occultRiderDamage > 0 ? plan.occultRiderDamage : 0);
      primaryOutcome = plan.occultRiderDamage > 0
        ? `${plan.kineticDamage}+${plan.occultRiderDamage} // +${riposteBonus} RIPOSTE // TOTAL ${total}`
        : `${plan.kineticDamage} + ${riposteBonus} RIPOSTE`;
      conditionalState = 'RIPOSTE READY';
    } else {
      primaryOutcome = plan.occultRiderDamage > 0
        ? `${plan.kineticDamage}+${plan.occultRiderDamage} DMG`
        : `${plan.kineticDamage} KINETIC`;
    }
    if (plan.staminaCost > 0) secondaryCost = `${plan.staminaCost} STAM`;
    if (familyId === 'aegis-rift-edge') {
      conditionalState = ctx.runtime.riftEdgeTempoArmed ? 'TEMPO ARMED' : conditionalState;
    }
    if (familyId === 'aegis-claymore-blade' && ctx.claymoreStaminaCommitted) {
      conditionalState = 'BREAK READY';
    }
    if (plan.fractureGain > 0) effects[0] = `+${plan.fractureGain} FRACTURE`;
  } else if (ctx.classId === 'HEX_SHOT') {
    const plan = resolveHexBasicShot({
      weapon: ctx.weapon,
      primaryTargetId: 'primary',
      squad: mockSquad(ctx.pulseSpreadSecondaryCount ?? 0),
      catalogBaseDamage: ctx.catalogBaseDamage ?? 12,
    });
    const primaryHit = plan.hits.find((h) => h.isPrimary) ?? plan.hits[0];
    primaryOutcome = primaryHit ? `${primaryHit.damage} BALLISTIC` : 'BALLISTIC';
    secondaryCost = `${plan.ammoCost} AMMO`;
    if (familyId === 'hex-pulse-rifle') {
      const spread = Math.max(0, plan.hits.length - 1);
      conditionalState = spread > 0 ? `${spread} SPREAD TARGETS` : 'PRIMARY ONLY';
    }
    if (familyId === 'hex-silver-core-sidearm' && ctx.hexPerfectReload) {
      conditionalState = 'PERFECT RELOAD';
    }
  } else {
    const plan = resolveEnvoySplinterBasic({
      weapon: ctx.weapon,
      catalogDamage: ctx.catalogBaseDamage ?? 10,
      catalogFluxCost: ctx.catalogFluxCost ?? 5,
      veilFlux: ctx.veilFlux ?? 50,
      operativeHp: ctx.operativeHp ?? 100,
      maxHp: ctx.maxOperativeHp ?? 100,
      previousCatalyst: ctx.previousCatalyst ?? null,
    });
    primaryOutcome = `${plan.occultDamage} OCCULT`;
    secondaryCost = `${plan.fluxCost} FLUX`;
    if (plan.hpSacrifice > 0) {
      secondaryCost = `${plan.fluxCost} FLUX // ${plan.hpSacrifice} HP`;
    }
    if (familyId === 'envoy-null-conduit') {
      conditionalState = plan.cleanCatalystCycle ? 'CLEAN CYCLE' : null;
    }
    if (familyId === 'envoy-echo-lantern' && ctx.lanternDetonationReady) {
      conditionalState = 'DETONATION READY';
    }
    if (familyId === 'envoy-sanguine-prism') {
      const brink = (ctx.veilFlux ?? 50) <= PRISM_BRINK_FLUX_THRESHOLD;
      if (ctx.prismCanPayFullSacrifice === false) {
        conditionalState = 'PARTIAL PAY';
      } else if (ctx.prismCanPayFullSacrifice === true) {
        conditionalState = brink ? 'BRINK // FULL PAY' : 'FULL PAY';
      } else if (brink) {
        conditionalState = 'BRINK';
      }
    }
  }

  const callouts = resolveWeaponCombatCallouts({
    weaponFamilyId: familyId,
    operativeClass: ctx.classId,
    stamina: ctx.stamina,
    currentAmmo: ctx.currentAmmo,
    veilFlux: ctx.veilFlux,
    riftEdgeTempoArmed: ctx.runtime.riftEdgeTempoArmed,
    claymoreStaminaCommitted: ctx.claymoreStaminaCommitted,
    perfectReloadWindow: ctx.hexPerfectReload,
    pulseSpreadSecondaryCount: ctx.pulseSpreadSecondaryCount,
    cleanCatalystCycleReady: conditionalState === 'CLEAN CYCLE',
    lanternDetonationReady: ctx.lanternDetonationReady,
    prismCanPayFullSacrifice: ctx.prismCanPayFullSacrifice,
    prismSacrificePreview: secondaryCost?.includes('HP') ? 1 : 0,
  });
  if (!conditionalState && callouts[0]) {
    conditionalState = callouts[0].label;
  }

  const parts = [
    primaryOutcome,
    secondaryCost,
    anchor.targetPattern,
    ...effects.slice(0, 2),
    conditionalState,
  ].filter(Boolean) as string[];

  return {
    anchor,
    label: `[ ${anchor.displayName} ]`,
    apCost: 1,
    primaryOutcome,
    secondaryCost,
    targetPattern: anchor.targetPattern,
    definingEffects: effects.slice(0, 2),
    conditionalState,
    effectLine: parts.join(' // '),
    expandedDescription: [
      `${anchor.displayName} — ${anchor.weaponDisplayName} basic.`,
      primaryOutcome,
      secondaryCost ? `Cost: ${secondaryCost}` : null,
      `Target: ${anchor.targetPattern}`,
      conditionalState ? `State: ${conditionalState}` : null,
    ].filter(Boolean).join(' '),
  };
}

export function resolveWeaponAnchorCardOrNull(
  classId: ClassType,
  abilityId: string,
  familyId: WeaponFamilyId | null | undefined,
): WeaponAnchorAttackRecord | null {
  if (!familyId) return null;
  return resolveWeaponAnchorForAbility(abilityId, familyId, classId)
    ?? getWeaponAnchorAttack(familyId);
}
