/**
 * Phase B — apply a weapon-action plan through host-provided combat primitives.
 * Keeps authored action identity stable for Riposte / boon hooks.
 * Phase D — optional graft transform (Echo/Splinter/damage) with graft-added hit tagging.
 */
import type { AegisWeaponActionId } from '../types/aegisCombat';
import { RUNIC_BRAND_CAP } from '../types/aegisCombat';
import type { GraftCastPlan } from '../types/veilGraft';
import {
  aegisWeaponActionApCost,
  aegisWeaponActionTags,
  formatAegisWeaponActionLabel,
} from './aegisWeaponActionCatalog';
import {
  planAegisWeaponAction,
  type AegisWeaponActionPlan,
  type WeaponHitPlan,
} from './aegisWeaponActionResolveEngine';
import {
  applyGraftTransformToWeaponPlan,
  type GraftTaggedWeaponHit,
} from './aegisWeaponActionGraftEngine';
import {
  type AegisWeaponCombatState,
  applyDreadbound,
  consumeAegisTempo,
  consumeDoomfallRelease,
  enterDoomfallCharge,
  enterEclipse,
  enterPoise,
} from './aegisWeaponCombatState';
import {
  applyApRefund,
  applyReserveGain,
  resolveBothHitsBrandGain,
  resolveRuptureBrandGain,
  type AuthoredHitOutcome,
} from './aegisWeaponActionRuntime';

export interface WeaponActionHostEnemy {
  unitId: string;
  currentHp: number;
  kineticArmorStacks?: number;
  fractured?: boolean;
  fracture?: number;
  fractureThreshold?: number;
}

export interface WeaponActionExecuteHost {
  log: (line: string) => void;
  getEnemy: (unitId: string) => WeaponActionHostEnemy | null;
  /** Returns true when target eradicated / encounter ending. */
  hurtEnemy: (args: {
    damage: number;
    channel: 'KINETIC' | 'OCCULT';
    fractureGain: number;
    armorStrip: number;
    tag: string;
    abilityId: AegisWeaponActionId;
    playerActionId: string;
    targetId: string;
    nestedPresentation?: boolean;
    accuracyBonusPct?: number;
    consumeFractured?: boolean;
    /** Graft-added Echo/Splinter hit — skips mastery / Crimson / Riposte. */
    echoHit?: boolean;
  }) => boolean;
  spendActionPoints: (cost: number) => boolean;
  refundActionPoints: (amount: number) => void;
  chargeReserve: (amount: number) => void;
  imprintBrand: (count: number) => void;
  getBrands: () => number;
  getPlayerTurn: () => number;
  /** Snapshot armor/fracture flags after a hit for mastery. */
  readHitOutcome: (unitId: string, before: {
    kineticArmor: number;
    fractured: boolean;
  }) => AuthoredHitOutcome;
}

export interface WeaponActionExecuteArgs {
  actionId: AegisWeaponActionId;
  weaponState: AegisWeaponCombatState;
  targetId?: string | null;
  dualTargetIds?: readonly [string, string] | null;
  rowTargetIds?: readonly string[] | null;
  originActionId?: string;
  host: WeaponActionExecuteHost;
  /** Phase D graft plan — transforms hits; AP may be overridden. */
  graftPlan?: GraftCastPlan | null;
  /** Caller already committed AP (and graft taxes). */
  apAlreadyCommitted?: boolean;
  /** Override catalog AP when committing inside the executor. */
  apCostOverride?: number;
}

export interface WeaponActionExecuteResult {
  ok: boolean;
  rejectedReason?: string;
  weaponState: AegisWeaponCombatState;
  plan: AegisWeaponActionPlan | null;
  playerActionId: string | null;
  staminaTouched: boolean;
}

function hitDamage(hit: WeaponHitPlan): number {
  return hit.kineticDamage + hit.occultDamage;
}

export function executeAegisWeaponActionPlan(
  args: WeaponActionExecuteArgs,
): WeaponActionExecuteResult {
  const { actionId, host } = args;
  let weaponState = args.weaponState;
  const playerActionId = `pa-${actionId}-${Date.now()}`;
  const release = weaponState.doomfallReleaseAvailable;

  // Contract: Aegis weapon actions never check or spend Stamina.
  const staminaTouched = false;

  const catalogAp = aegisWeaponActionApCost(actionId, { doomfallReleaseAvailable: release });
  const apCost = args.apCostOverride ?? catalogAp;
  if (!args.apAlreadyCommitted) {
    if (!host.spendActionPoints(apCost)) {
      return {
        ok: false,
        rejectedReason: 'Insufficient action points.',
        weaponState,
        plan: null,
        playerActionId: null,
        staminaTouched,
      };
    }
  }

  const primaryId = args.targetId
    ?? args.dualTargetIds?.[0]
    ?? args.rowTargetIds?.[0]
    ?? null;
  const primary = primaryId ? host.getEnemy(primaryId) : null;

  let plan = planAegisWeaponAction(actionId, {
    tempoArmed: weaponState.tempoArmed,
    targetFracturedAtStart: primary?.fractured === true,
    noRespiteUsedThisTurn: weaponState.noRespiteUsedThisPlayerTurn,
    doomfallReleaseAvailable: release,
    doomfallOriginActionId: weaponState.doomfallOriginActionId
      ?? args.originActionId
      ?? playerActionId,
  });

  if (args.graftPlan?.graftName && plan.stage !== 'CHARGE') {
    plan = applyGraftTransformToWeaponPlan(plan, args.graftPlan);
  }

  const label = formatAegisWeaponActionLabel(actionId, {
    doomfallReleaseAvailable: release,
  });
  host.log(`>> ${label}`);
  if (args.graftPlan?.graftName) {
    host.log(`>> [${args.graftPlan.graftName.toUpperCase()}] — weapon-action graft online.`);
  }

  if (plan.stage === 'CHARGE') {
    weaponState = enterDoomfallCharge(weaponState, plan.originActionId!);
    host.log('[DOOMFALL] >> Charge — Committed. Release available next turn.');
    return { ok: true, weaponState, plan, playerActionId, staminaTouched };
  }

  const deliverHit = (
    hit: GraftTaggedWeaponHit | WeaponHitPlan,
    opts: {
      tag: string;
      targetId: string;
      accuracyBonusPct?: number;
      consumeFractured?: boolean;
      nestedPresentation?: boolean;
    },
  ) => {
    const graftAdded = 'graftAdded' in hit && hit.graftAdded === true;
    return host.hurtEnemy({
      damage: hitDamage(hit),
      channel: hit.channel,
      fractureGain: hit.fractureGain,
      armorStrip: graftAdded ? 0 : hit.armorStrip,
      tag: graftAdded ? `${opts.tag} [GRAFT]` : opts.tag,
      abilityId: actionId,
      playerActionId,
      targetId: opts.targetId,
      accuracyBonusPct: opts.accuracyBonusPct ?? hit.accuracyBonusPct,
      consumeFractured: graftAdded ? false : opts.consumeFractured,
      nestedPresentation: graftAdded ? true : opts.nestedPresentation,
      echoHit: graftAdded,
    });
  };

  if (actionId === 'DIVERGENCE' && args.dualTargetIds) {
    const outcomes: AuthoredHitOutcome[] = [];
    const authoredHits = plan.hits.filter((h) => !('graftAdded' in h && h.graftAdded));
    const graftHits = plan.hits.filter((h) => 'graftAdded' in h && h.graftAdded);
    for (let i = 0; i < Math.min(2, authoredHits.length); i++) {
      const tid = args.dualTargetIds[i]!;
      const beforeEnemy = host.getEnemy(tid);
      if (!beforeEnemy) break;
      if (i === 1 && outcomes[0]?.killed && args.dualTargetIds[0] === tid) {
        host.log('[DIVERGENCE] >> Blade Two cancelled — target already down.');
        break;
      }
      const before = {
        kineticArmor: beforeEnemy.kineticArmorStacks ?? 0,
        fractured: beforeEnemy.fractured === true,
      };
      const hit = authoredHits[i]!;
      const eradicated = deliverHit(hit, {
        tag: `[DIVERGENCE BLADE ${i + 1}]`,
        targetId: tid,
        accuracyBonusPct: hit.accuracyBonusPct,
      });
      const after = host.getEnemy(tid);
      const outcome = after
        ? host.readHitOutcome(tid, before)
        : { hit: true, killed: eradicated };
      if (hit.reserveGain > 0 && outcome.hit) {
        host.chargeReserve(hit.reserveGain);
      }
      outcomes.push(outcome);
    }
    // Graft-added echoes after both blades — once per action, no Brand / mastery.
    graftHits.forEach((hit, gi) => {
      const tid = args.dualTargetIds![Math.min(gi, 1)]!;
      if (!host.getEnemy(tid)) return;
      deliverHit(hit, { tag: '[DIVERGENCE ECHO]', targetId: tid });
    });
    const brand = resolveBothHitsBrandGain(host.getBrands(), outcomes, 'Divergence');
    if (brand.brandGain > 0) host.imprintBrand(brand.brandGain);
    if (brand.reason) host.log(`[DIVERGENCE] >> ${brand.reason}`);
    return { ok: true, weaponState, plan, playerActionId, staminaTouched };
  }

  if (actionId === 'DREAD_HORIZON') {
    const ids = args.rowTargetIds ?? (primaryId ? [primaryId] : []);
    const outcomes: AuthoredHitOutcome[] = [];
    const authored = plan.hits.filter((h) => !('graftAdded' in h && h.graftAdded));
    ids.slice(0, 2).forEach((tid, i) => {
      const beforeEnemy = host.getEnemy(tid);
      if (!beforeEnemy) return;
      const before = {
        kineticArmor: beforeEnemy.kineticArmorStacks ?? 0,
        fractured: beforeEnemy.fractured === true,
      };
      const hit = authored[i] ?? authored[0] ?? plan.hits[0]!;
      deliverHit(hit, { tag: '[DREAD HORIZON]', targetId: tid });
      const outcome = host.readHitOutcome(tid, before);
      if (hit.reserveGain > 0 && outcome.hit && !('graftAdded' in hit && hit.graftAdded)) {
        host.chargeReserve(hit.reserveGain);
      }
      outcomes.push(outcome);
    });
    plan.hits.filter((h) => 'graftAdded' in h && h.graftAdded).forEach((hit) => {
      const tid = ids[0];
      if (!tid || !host.getEnemy(tid)) return;
      deliverHit(hit, { tag: '[DREAD HORIZON ECHO]', targetId: tid });
    });
    const brand = resolveBothHitsBrandGain(host.getBrands(), outcomes, 'Dread Horizon');
    if (brand.brandGain > 0) host.imprintBrand(brand.brandGain);
    if (brand.reason) host.log(`[DREAD HORIZON] >> ${brand.reason}`);
    return { ok: true, weaponState, plan, playerActionId, staminaTouched };
  }

  if (!primary || !primaryId) {
    if (plan.hits.length === 0) {
      return { ok: true, weaponState, plan, playerActionId, staminaTouched };
    }
    host.refundActionPoints(apCost);
    return {
      ok: false,
      rejectedReason: 'Illegal target.',
      weaponState,
      plan,
      playerActionId: null,
      staminaTouched,
    };
  }

  if (actionId === 'SEVERANCE') {
    const outcomes: AuthoredHitOutcome[] = [];
    const authored = plan.hits.filter((h) => !('graftAdded' in h && h.graftAdded));
    for (let i = 0; i < authored.length; i++) {
      const live = host.getEnemy(primaryId);
      if (!live || live.currentHp <= 0) {
        if (i > 0) host.log('[SEVERANCE] >> Blade Two cancelled — Tempo preserved.');
        break;
      }
      const before = {
        kineticArmor: live.kineticArmorStacks ?? 0,
        fractured: live.fractured === true,
      };
      const hit = authored[i]!;
      deliverHit(hit, { tag: `[SEVERANCE BLADE ${i + 1}]`, targetId: primaryId });
      const outcome = host.readHitOutcome(primaryId, before);
      if (hit.reserveGain > 0 && outcome.hit) host.chargeReserve(hit.reserveGain);
      outcomes.push(outcome);
      if (i === 1 && plan.tempoWasArmed && outcome.hit) {
        weaponState = consumeAegisTempo(weaponState);
        host.log('[TEMPO] >> Consumed — Severance Blade Two connected.');
      }
    }
    plan.hits.filter((h) => 'graftAdded' in h && h.graftAdded).forEach((hit) => {
      if (!host.getEnemy(primaryId)) return;
      deliverHit(hit, { tag: '[SEVERANCE ECHO]', targetId: primaryId });
    });
    return { ok: true, weaponState, plan, playerActionId, staminaTouched };
  }

  // Eclipse / Unbowed establish posture even on miss — resolve primary hit first.
  const authoredHits = plan.hits.filter((h) => !('graftAdded' in h && h.graftAdded));
  const graftExtraHits = plan.hits.filter((h) => 'graftAdded' in h && h.graftAdded);
  const firstHit = authoredHits[0] ?? plan.hits[0];
  let primaryOutcome: AuthoredHitOutcome = { hit: false, killed: false };

  if (firstHit) {
    const before = {
      kineticArmor: primary.kineticArmorStacks ?? 0,
      fractured: primary.fractured === true,
    };
    const isRelease = plan.stage === 'RELEASE';
    deliverHit({
      ...firstHit,
      fractureGain: isRelease ? 0 : firstHit.fractureGain,
    }, {
      tag: label,
      targetId: primaryId,
      accuracyBonusPct: firstHit.accuracyBonusPct,
      consumeFractured: plan.doomfallConsumeFractured,
    });
    primaryOutcome = host.readHitOutcome(primaryId, before);

    if (primaryOutcome.hit) {
      if (firstHit.reserveGain > 0 && !('graftAdded' in firstHit && firstHit.graftAdded)) {
        host.chargeReserve(firstHit.reserveGain);
      }
      if (plan.noRespiteReserveBonus > 0 && actionId === 'DOOMFALL') {
        host.chargeReserve(plan.noRespiteReserveBonus);
      }
      if (plan.doomfallPostFracturePressure > 0) {
        deliverHit({
          kineticDamage: 0,
          occultDamage: 0,
          fractureGain: plan.doomfallPostFracturePressure,
          armorStrip: 0,
          reserveGain: 0,
          accuracyBonusPct: 0,
          channel: 'KINETIC',
        }, {
          tag: '[DOOMFALL FRACTURE]',
          targetId: primaryId,
          nestedPresentation: true,
        });
      }
    }

    // Paired Strike Tempo occult rider (authored — never graft-added)
    const tempoRider = authoredHits[1];
    if (
      actionId === 'PAIRED_BLADES_STRIKE'
      && primaryOutcome.hit
      && tempoRider
      && plan.tempoWasArmed
    ) {
      deliverHit(tempoRider, {
        tag: '[TEMPO RIDER]',
        targetId: primaryId,
        nestedPresentation: true,
      });
      weaponState = consumeAegisTempo(weaponState);
      host.log('[TEMPO] >> Consumed — Occult rider delivered.');
    }

    // Splinter extras / Echo grafts after authored primary resolution.
    for (let i = 1; i < authoredHits.length; i++) {
      if (actionId === 'PAIRED_BLADES_STRIKE' && plan.tempoWasArmed && i === 1) continue;
      const hit = authoredHits[i]!;
      if (!host.getEnemy(primaryId)) break;
      deliverHit(hit, { tag: label, targetId: primaryId });
    }
    graftExtraHits.forEach((hit) => {
      if (!host.getEnemy(primaryId)) return;
      deliverHit(hit, { tag: `${label} ECHO`, targetId: primaryId });
    });

    if (actionId === 'RUPTURE' && primaryOutcome.hit) {
      const brand = resolveRuptureBrandGain(host.getBrands(), primaryOutcome);
      if (brand.brandGain > 0) host.imprintBrand(brand.brandGain);
      if (brand.reason) host.log(`[RUPTURE] >> ${brand.reason}`);
    }

    if (actionId === 'NO_RESPITE' && primaryOutcome.hit && plan.noRespitePayoff) {
      host.refundActionPoints(plan.noRespiteApRefund);
      host.chargeReserve(plan.noRespiteReserveBonus);
      weaponState = { ...weaponState, noRespiteUsedThisPlayerTurn: true };
      host.log('[NO RESPITE] >> Fractured payoff — +1 AP, +10 Reserve.');
    }

    if (actionId === 'DREADBIND' && primaryOutcome.hit) {
      weaponState = applyDreadbound(weaponState, primaryId);
      host.log('[DREADBIND] >> Target watched.');
    }
  }

  if (plan.enterEclipse) {
    weaponState = enterEclipse(weaponState, host.getPlayerTurn() + 1);
    host.log('[ECLIPSE] >> Posture armed.');
  }
  if (plan.enterPoise) {
    weaponState = enterPoise(weaponState, host.getPlayerTurn() + 1);
    host.log('[POISE] >> Established.');
  }
  if (plan.stage === 'RELEASE') {
    weaponState = consumeDoomfallRelease(weaponState);
    if (!primaryOutcome.hit) {
      host.log('[DOOMFALL] >> Release missed — charge lost.');
    }
  }

  // Warden's / Unmaker baseline reserve already handled via hit.reserveGain.
  void aegisWeaponActionTags;
  void applyReserveGain;
  void applyApRefund;
  void RUNIC_BRAND_CAP;

  return { ok: true, weaponState, plan, playerActionId, staminaTouched };
}
