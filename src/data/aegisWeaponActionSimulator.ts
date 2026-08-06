/**
 * Phase B — pure weapon-action combat simulation for tests / deterministic resolve.
 * Hub applies the same plan outcomes via hurtEnemy + AegisWeaponCombatState.
 */
import type { AegisWeaponActionId } from '../types/aegisCombat';
import { PLAYER_ACTION_POINTS_PER_TURN, RUNIC_BRAND_CAP } from '../types/aegisCombat';
import {
  type AegisWeaponCombatState,
  applyDreadbound,
  armAegisTempo,
  beginAegisPlayerTurnWeaponState,
  clearEclipse,
  consumeAegisTempo,
  consumeDoomfallRelease,
  createDefaultAegisWeaponCombatState,
  enterDoomfallCharge,
  enterEclipse,
  enterPoise,
  expireAegisTempoAtPlayerTurnEnd,
  expireDoomfallReleaseAtTurnEnd,
  markDreadboundMastery,
  clearDreadbound,
} from './aegisWeaponCombatState';
import {
  DREADBIND_MASTERY_FRACTURE,
  DREADBOUND_DAMAGE_REDUCTION_PCT,
  ECLIPSE_EVADE_BONUS_PCT,
  POISE_DAMAGE_REDUCTION_PCT,
  planAegisWeaponAction,
  type AegisWeaponActionPlan,
  type WeaponHitPlan,
} from './aegisWeaponActionResolveEngine';
import {
  applyApRefund,
  applyPercentDamageReduction,
  applyReserveGain,
  isEligibleDirectEnemyAttack,
  resolveBothHitsBrandGain,
  resolveRuptureBrandGain,
  type AuthoredHitOutcome,
} from './aegisWeaponActionRuntime';
import { aegisWeaponActionApCost, aegisWeaponActionTags } from './aegisWeaponActionCatalog';
import { resolveAegisInboundHitDefense } from './aegisDoomfallInterruptEngine';

export interface SimEnemy {
  id: string;
  hp: number;
  maxHp: number;
  kineticArmor: number;
  fracture: number;
  fractureThreshold: number;
  fractured: boolean;
  row: 'FL' | 'BL';
}

export interface SimPlayer {
  ap: number;
  maxAp: number;
  reserve: number;
  brands: number;
  riposteReady: boolean;
  riposteCashedThisAction: boolean;
}

export interface SimWorld {
  playerTurn: number;
  player: SimPlayer;
  enemies: SimEnemy[];
  weapon: AegisWeaponCombatState;
  lastPlan: AegisWeaponActionPlan | null;
  log: string[];
  staminaChecks: number;
  staminaSpends: number;
}

export function createSimWorld(partial?: Partial<SimWorld>): SimWorld {
  return {
    playerTurn: 1,
    player: {
      ap: PLAYER_ACTION_POINTS_PER_TURN,
      maxAp: PLAYER_ACTION_POINTS_PER_TURN,
      reserve: 0,
      brands: 0,
      riposteReady: false,
      riposteCashedThisAction: false,
    },
    enemies: [
      {
        id: 'e0',
        hp: 100,
        maxHp: 100,
        kineticArmor: 0,
        fracture: 0,
        fractureThreshold: 100,
        fractured: false,
        row: 'FL',
      },
    ],
    weapon: createDefaultAegisWeaponCombatState(),
    lastPlan: null,
    log: [],
    staminaChecks: 0,
    staminaSpends: 0,
    ...partial,
  };
}

function enemy(world: SimWorld, id: string): SimEnemy {
  const e = world.enemies.find((x) => x.id === id);
  if (!e) throw new Error(`missing enemy ${id}`);
  return e;
}

function applyFracture(e: SimEnemy, amount: number): { enteredFractured: boolean } {
  if (amount <= 0 || e.fractured) return { enteredFractured: false };
  e.fracture = Math.min(e.fractureThreshold, e.fracture + amount);
  if (e.fracture >= e.fractureThreshold) {
    e.fractured = true;
    e.fracture = e.fractureThreshold;
    return { enteredFractured: true };
  }
  return { enteredFractured: false };
}

function stripArmor(e: SimEnemy, stacks: number): { removedFinalArmor: boolean } {
  if (stacks <= 0 || e.kineticArmor <= 0) return { removedFinalArmor: false };
  const before = e.kineticArmor;
  e.kineticArmor = Math.max(0, e.kineticArmor - stacks);
  return { removedFinalArmor: before > 0 && e.kineticArmor === 0 };
}

function dealHit(
  world: SimWorld,
  e: SimEnemy,
  hit: WeaponHitPlan,
  opts: {
    actionId: AegisWeaponActionId;
    consumeFractured?: boolean;
    accuracyBonusPct?: number;
    forceMiss?: boolean;
    forceHit?: boolean;
    isBonusHit?: boolean;
  },
): AuthoredHitOutcome {
  if (opts.forceMiss) {
    return { hit: false, killed: false, isBonusHit: opts.isBonusHit };
  }
  // Accuracy/Evade abstracted: forceHit or default hit.
  const hits = opts.forceHit !== false && !opts.forceMiss;
  if (!hits) return { hit: false, killed: false, isBonusHit: opts.isBonusHit };

  const dmg = hit.kineticDamage + hit.occultDamage;
  // No Fractured damage multiplier — live hub never applied one; NO_RESPITE is AP/Reserve only.
  if (hit.channel === 'KINETIC' && e.kineticArmor > 0 && hit.armorStrip <= 0) {
    // armor present but strip handled separately
  }
  const armorResult = stripArmor(e, hit.armorStrip);
  e.hp = Math.max(0, e.hp - dmg);
  const frac = applyFracture(e, hit.fractureGain);
  if (hit.reserveGain > 0) {
    world.player.reserve = applyReserveGain(world.player.reserve, hit.reserveGain);
  }

  // Riposte once per authored action on first successful STRIKE-tagged hit.
  const tags = aegisWeaponActionTags(opts.actionId, {
    doomfallReleaseAvailable: world.weapon.doomfallReleaseAvailable,
  });
  if (
    tags.includes('STRIKE')
    && world.player.riposteReady
    && !world.player.riposteCashedThisAction
    && !opts.isBonusHit
  ) {
    if (e.hp > 0) {
      e.hp = Math.max(0, e.hp - 16);
    }
    world.player.riposteReady = false;
    world.player.riposteCashedThisAction = true;
    world.log.push('RIPOSTE +16');
  }

  if (opts.consumeFractured && e.fractured) {
    e.fractured = false;
    e.fracture = 0;
  }

  return {
    hit: true,
    killed: e.hp <= 0,
    removedFinalArmor: armorResult.removedFinalArmor,
    enteredFractured: frac.enteredFractured,
    isBonusHit: opts.isBonusHit,
  };
}

export interface CastWeaponActionArgs {
  actionId: AegisWeaponActionId;
  /** Single / release target. */
  targetId?: string;
  /** Divergence blade targets. */
  dualTargetIds?: readonly [string, string];
  /** Dread Horizon authored targets (max 2). */
  rowTargetIds?: readonly string[];
  forceMiss?: boolean | readonly boolean[];
  forceHit?: boolean;
}

export function castAegisWeaponAction(world: SimWorld, args: CastWeaponActionArgs): SimWorld {
  const next: SimWorld = {
    ...world,
    player: { ...world.player, riposteCashedThisAction: false },
    enemies: world.enemies.map((e) => ({ ...e })),
    weapon: { ...world.weapon, dreadboundByUnitId: { ...world.weapon.dreadboundByUnitId } },
    log: [...world.log],
  };

  // Aegis weapon actions never check or spend Stamina.
  next.staminaChecks += 0;
  next.staminaSpends += 0;

  const apCost = aegisWeaponActionApCost(args.actionId, {
    doomfallReleaseAvailable: next.weapon.doomfallReleaseAvailable,
  });
  if (next.player.ap < apCost) {
    next.log.push('REJECTED: insufficient AP');
    return next;
  }
  next.player.ap -= apCost;

  const primaryId = args.targetId
    ?? args.dualTargetIds?.[0]
    ?? args.rowTargetIds?.[0]
    ?? next.enemies[0]?.id;
  const primary = primaryId ? enemy(next, primaryId) : null;

  const plan = planAegisWeaponAction(args.actionId, {
    tempoArmed: next.weapon.tempoArmed,
    targetFracturedAtStart: primary?.fractured === true,
    noRespiteUsedThisTurn: next.weapon.noRespiteUsedThisPlayerTurn,
    doomfallReleaseAvailable: next.weapon.doomfallReleaseAvailable,
    doomfallOriginActionId: next.weapon.doomfallOriginActionId
      ?? `doomfall-sim-${next.playerTurn}`,
  });
  next.lastPlan = plan;

  if (plan.stage === 'CHARGE') {
    next.weapon = enterDoomfallCharge(next.weapon, plan.originActionId!);
    next.log.push('DOOMFALL CHARGE');
    return next;
  }

  const missFlags = Array.isArray(args.forceMiss)
    ? args.forceMiss
    : plan.hits.map(() => args.forceMiss === true);

  if (args.actionId === 'DIVERGENCE' && args.dualTargetIds) {
    const outcomes: AuthoredHitOutcome[] = [];
    for (let i = 0; i < 2; i++) {
      const tid = args.dualTargetIds[i]!;
      const e = enemy(next, tid);
      if (i === 1 && outcomes[0]?.killed && args.dualTargetIds[0] === tid) {
        next.log.push('Blade Two cancelled — target dead');
        break;
      }
      const outcome = dealHit(next, e, plan.hits[i]!, {
        actionId: args.actionId,
        forceMiss: missFlags[i],
        forceHit: args.forceHit,
      });
      outcomes.push(outcome);
    }
    const brand = resolveBothHitsBrandGain(next.player.brands, outcomes, 'Divergence');
    next.player.brands = Math.min(RUNIC_BRAND_CAP, next.player.brands + brand.brandGain);
    if (brand.reason) next.log.push(brand.reason);
    return next;
  }

  if (args.actionId === 'DREAD_HORIZON') {
    const ids = args.rowTargetIds ?? (primaryId ? [primaryId] : []);
    const outcomes: AuthoredHitOutcome[] = [];
    ids.slice(0, 2).forEach((tid, i) => {
      const e = enemy(next, tid);
      const outcome = dealHit(next, e, plan.hits[i] ?? plan.hits[0]!, {
        actionId: args.actionId,
        forceMiss: missFlags[i],
        forceHit: args.forceHit,
      });
      outcomes.push(outcome);
    });
    const brand = resolveBothHitsBrandGain(next.player.brands, outcomes, 'Dread Horizon');
    next.player.brands = Math.min(RUNIC_BRAND_CAP, next.player.brands + brand.brandGain);
    if (brand.reason) next.log.push(brand.reason);
    return next;
  }

  if (args.actionId === 'SEVERANCE' && primary) {
    const outcomes: AuthoredHitOutcome[] = [];
    for (let i = 0; i < plan.hits.length; i++) {
      if (i === 1 && outcomes[0]?.killed) {
        next.log.push('Blade Two cancelled — Tempo preserved');
        break;
      }
      const outcome = dealHit(next, primary, plan.hits[i]!, {
        actionId: args.actionId,
        forceMiss: missFlags[i],
        forceHit: args.forceHit,
      });
      outcomes.push(outcome);
      if (i === 1 && plan.tempoWasArmed && outcome.hit) {
        next.weapon = consumeAegisTempo(next.weapon);
        next.log.push('Tempo consumed (Severance Blade Two)');
      }
    }
    return next;
  }

  if (args.actionId === 'PAIRED_BLADES_STRIKE' && primary) {
    const primaryHit = dealHit(next, primary, plan.hits[0]!, {
      actionId: args.actionId,
      forceMiss: missFlags[0],
      forceHit: args.forceHit,
    });
    if (!primaryHit.hit) {
      next.log.push('Miss — Tempo preserved');
      return next;
    }
    if (plan.hits[1] && plan.tempoWasArmed) {
      dealHit(next, primary, plan.hits[1], {
        actionId: args.actionId,
        forceHit: true,
        isBonusHit: true,
      });
      next.weapon = consumeAegisTempo(next.weapon);
      next.log.push('Tempo consumed (Paired Strike rider)');
    }
    return next;
  }

  if (args.actionId === 'RUPTURE' && primary) {
    const outcome = dealHit(next, primary, plan.hits[0]!, {
      actionId: args.actionId,
      forceMiss: missFlags[0],
      forceHit: args.forceHit,
    });
    const brand = resolveRuptureBrandGain(next.player.brands, outcome);
    next.player.brands = Math.min(RUNIC_BRAND_CAP, next.player.brands + brand.brandGain);
    if (brand.reason) next.log.push(brand.reason);
    return next;
  }

  if (args.actionId === 'NO_RESPITE' && primary) {
    const outcome = dealHit(next, primary, plan.hits[0]!, {
      actionId: args.actionId,
      forceMiss: missFlags[0],
      forceHit: args.forceHit,
    });
    if (outcome.hit && plan.noRespitePayoff) {
      next.player.ap = applyApRefund(next.player.ap, plan.noRespiteApRefund, next.player.maxAp);
      next.player.reserve = applyReserveGain(next.player.reserve, plan.noRespiteReserveBonus);
      next.weapon = { ...next.weapon, noRespiteUsedThisPlayerTurn: true };
      next.log.push('No Respite payoff');
    }
    return next;
  }

  if (args.actionId === 'DREADBIND' && primary) {
    const outcome = dealHit(next, primary, plan.hits[0]!, {
      actionId: args.actionId,
      forceMiss: missFlags[0],
      forceHit: args.forceHit,
    });
    if (outcome.hit) {
      next.weapon = applyDreadbound(next.weapon, primary.id);
      next.log.push('Dreadbound applied');
    }
    return next;
  }

  if (args.actionId === 'ECLIPSE' && primary) {
    dealHit(next, primary, plan.hits[0]!, {
      actionId: args.actionId,
      forceMiss: missFlags[0],
      forceHit: args.forceHit,
    });
    // Posture on commit even if miss.
    next.weapon = enterEclipse(next.weapon, next.playerTurn + 1);
    next.log.push('Eclipse armed');
    return next;
  }

  if (args.actionId === 'UNBOWED' && primary) {
    dealHit(next, primary, plan.hits[0]!, {
      actionId: args.actionId,
      forceMiss: missFlags[0],
      forceHit: args.forceHit,
    });
    next.weapon = enterPoise(next.weapon, next.playerTurn + 1);
    next.log.push('Poise armed');
    return next;
  }

  if (plan.stage === 'RELEASE' && primary) {
    const outcome = dealHit(next, primary, plan.hits[0]!, {
      actionId: 'DOOMFALL',
      forceMiss: missFlags[0],
      forceHit: args.forceHit,
      consumeFractured: plan.doomfallConsumeFractured,
    });
    if (outcome.hit) {
      next.player.reserve = applyReserveGain(next.player.reserve, plan.noRespiteReserveBonus);
      if (plan.doomfallPostFracturePressure > 0) {
        applyFracture(primary, plan.doomfallPostFracturePressure);
      }
    }
    next.weapon = consumeDoomfallRelease(next.weapon);
    next.log.push(outcome.hit ? 'Doomfall Release hit' : 'Doomfall Release miss — charge lost');
    return next;
  }

  // Generic single-hit (Warden's / Unmaker Strike)
  if (primary && plan.hits[0]) {
    dealHit(next, primary, plan.hits[0], {
      actionId: args.actionId,
      forceMiss: missFlags[0],
      forceHit: args.forceHit,
    });
  }
  return next;
}

export function simBeginPlayerTurn(world: SimWorld): SimWorld {
  const playerTurn = world.playerTurn + 1;
  return {
    ...world,
    playerTurn,
    player: { ...world.player, ap: world.player.maxAp },
    weapon: beginAegisPlayerTurnWeaponState(world.weapon, playerTurn),
    log: [...world.log, `PLAYER TURN ${playerTurn}`],
  };
}

export function simEndPlayerTurn(world: SimWorld): SimWorld {
  let weapon = expireAegisTempoAtPlayerTurnEnd(world.weapon, world.playerTurn);
  weapon = expireDoomfallReleaseAtTurnEnd(weapon);
  return { ...world, weapon, log: [...world.log, 'END PLAYER TURN'] };
}

export function simEnemyAction(world: SimWorld, args: {
  attackerId: string;
  damage: number;
  blockable?: boolean;
  perfectParry?: boolean;
  ordinaryParry?: boolean;
  evade?: boolean;
  hit?: boolean;
  stunOrKnockdown?: boolean;
  unblockable?: boolean;
  environmental?: boolean;
  damageOverTime?: boolean;
}): SimWorld {
  const next: SimWorld = {
    ...world,
    player: { ...world.player },
    enemies: world.enemies.map((e) => ({ ...e })),
    weapon: { ...world.weapon, dreadboundByUnitId: { ...world.weapon.dreadboundByUnitId } },
    log: [...world.log],
  };

  const eligible = isEligibleDirectEnemyAttack({
    unblockable: args.unblockable,
    environmental: args.environmental,
    damageOverTime: args.damageOverTime,
    targetsAegis: true,
    isDamaging: args.damage > 0,
  });

  // Committed: cannot Parry/Evade.
  if (next.weapon.committed && (args.perfectParry || args.ordinaryParry || args.evade)) {
    next.log.push('Committed — defense suppressed');
  }

  // Eclipse
  if (eligible && next.weapon.eclipseActive) {
    const evadeBonus = ECLIPSE_EVADE_BONUS_PCT;
    next.log.push(`Eclipse +${evadeBonus}% Evade`);
    if (args.evade || args.perfectParry) {
      next.weapon = armAegisTempo(clearEclipse(next.weapon), next.playerTurn);
      next.player.brands = Math.min(RUNIC_BRAND_CAP, next.player.brands + 1);
      next.log.push('Eclipse reward — Tempo + Brand');
      if (args.perfectParry) {
        next.player.riposteReady = true;
      }
      return next;
    }
    if (args.ordinaryParry || args.hit) {
      next.weapon = clearEclipse(next.weapon);
      next.log.push('Eclipse consumed without reward');
    }
  }

  // Dreadbound watch
  const bound = next.weapon.dreadboundByUnitId[args.attackerId];
  if (bound && eligible && args.blockable !== false) {
    args = { ...args, damage: applyPercentDamageReduction(args.damage, DREADBOUND_DAMAGE_REDUCTION_PCT) };
    next.log.push(`Dreadbound −${DREADBOUND_DAMAGE_REDUCTION_PCT}%`);
    if (args.perfectParry && !bound.masteryAwarded) {
      next.weapon = markDreadboundMastery(next.weapon, args.attackerId);
      next.player.brands = Math.min(RUNIC_BRAND_CAP, next.player.brands + 1);
      const attacker = enemy(next, args.attackerId);
      applyFracture(attacker, DREADBIND_MASTERY_FRACTURE);
      next.log.push('Dreadbind mastery — Brand + Fracture');
      next.player.riposteReady = true;
    }
    next.weapon = clearDreadbound(next.weapon, args.attackerId);
  } else if (bound && !eligible) {
    next.weapon = clearDreadbound(next.weapon, args.attackerId);
    next.log.push('Dreadbound expired — ineligible');
  }

  // Poise + Committed + control — shared ordering with hub runtime.
  {
    const damagingHit = Boolean(
      args.hit && !args.evade && !args.perfectParry && !args.ordinaryParry,
    );
    const controls = args.stunOrKnockdown ? (['STUN'] as const) : [];
    const hadPoise = next.weapon.poiseActive;
    const inbound = resolveAegisInboundHitDefense({
      weaponState: next.weapon,
      damage: damagingHit ? args.damage : 0,
      eligible: eligible && (damagingHit || !!args.stunOrKnockdown),
      controlEffects: [...controls],
      authoredActionId: `sim-${args.attackerId}`,
      currentBrands: next.player.brands,
    });
    if (damagingHit) {
      args = { ...args, damage: inbound.damage };
    }
    next.weapon = inbound.weaponState;
    next.player.brands = Math.min(RUNIC_BRAND_CAP, next.player.brands + inbound.brandGain);
    next.log.push(...inbound.logs);
    if (
      hadPoise
      && !inbound.poiseConsumed
      && (args.evade || args.perfectParry || args.ordinaryParry)
      && !args.stunOrKnockdown
    ) {
      next.log.push('Poise held — no eligible damage');
    }
  }

  if (args.perfectParry && !bound) {
    next.player.riposteReady = true;
    // Normal Perfect Parry does NOT grant Brand.
  }

  return next;
}

export { ECLIPSE_EVADE_BONUS_PCT, POISE_DAMAGE_REDUCTION_PCT, DREADBOUND_DAMAGE_REDUCTION_PCT };
