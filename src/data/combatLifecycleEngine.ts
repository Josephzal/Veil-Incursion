import type { CombatGridSlotId } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import {
  aliveUnits,
  getUnitById,
  reconcileSquadGridSlots,
  unitPlacedAtSlot,
  updateUnit,
} from './combatSquadEngine';
import { isFragileArchetype } from './enemyCombatConfig';
import { getAlphaMechanic } from './enemyAlphaConfig';
import type {
  CombatLifecycleContext,
  DeathHandler,
  DeathLifecycleResult,
  HitTakenHandler,
  HitTakenLifecycleResult,
  TurnStartHandler,
  TurnStartLifecycleResult,
} from '../types/combatLifecycle';

const EMPTY_TURN: TurnStartLifecycleResult = { squad: [], logLines: [] };
const EMPTY_HIT: HitTakenLifecycleResult = { squad: [], logLines: [] };
const EMPTY_DEATH: DeathLifecycleResult = { squad: [], logLines: [] };

function patchUnitInSquad(
  squad: EnemyCombatProfile[],
  unitId: string,
  patch: Partial<EnemyCombatProfile>,
): EnemyCombatProfile[] {
  return updateUnit(squad, unitId, patch);
}

export function swapUnitGridSlots(
  squad: EnemyCombatProfile[],
  unitIdA: string,
  unitIdB: string,
): EnemyCombatProfile[] {
  const a = getUnitById(squad, unitIdA);
  const b = getUnitById(squad, unitIdB);
  if (!a?.gridSlot || !b?.gridSlot) return squad;
  const slotA = a.gridSlot as CombatGridSlotId;
  const slotB = b.gridSlot as CombatGridSlotId;
  const swapped = squad.map((unit) => {
    if (unit.unitId === unitIdA) {
      return unitPlacedAtSlot(unit, slotB);
    }
    if (unit.unitId === unitIdB) {
      return unitPlacedAtSlot(unit, slotA);
    }
    return unit;
  });
  return reconcileSquadGridSlots(swapped);
}

function pickRandomLivingAlly(
  squad: EnemyCombatProfile[],
  excludeUnitId: string,
): EnemyCombatProfile | null {
  const candidates = aliveUnits(squad).filter((u) => u.unitId && u.unitId !== excludeUnitId);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function clearLeySirenTether(
  squad: EnemyCombatProfile[],
  tetheredIds: readonly string[],
): EnemyCombatProfile[] {
  const tethered = new Set(tetheredIds);
  return squad.map((unit) => {
    if (!unit.unitId || !tethered.has(unit.unitId)) return unit;
    return { ...unit, fractureImmune: false };
  });
}

// --- Turn start handlers ---

const gutterGoliathTurnStart: TurnStartHandler = (enemy, ctx) => {
  if (enemy.rosterId !== 'gutter-goliath' || !enemy.unitId) return { ...EMPTY_TURN, squad: ctx.squad };
  if (enemy.isEnraged) {
    return { squad: ctx.squad, logLines: [] };
  }
  if (enemy.currentHp >= enemy.maxHp) {
    return { squad: ctx.squad, logLines: [] };
  }
  if (ctx.extras.fleshWarpUnitIds[enemy.unitId]) {
    return {
      squad: ctx.squad,
      logLines: [`>> ${enemy.designation} REGENERATION BLOCKED — flesh-warp seal.`],
    };
  }
  const regenPerTurn = getAlphaMechanic(enemy, 'regenPerTurn', 15);
  const missing = enemy.maxHp - enemy.currentHp;
  const healAmount = Math.min(regenPerTurn, missing);
  if (healAmount <= 0) {
    return { squad: ctx.squad, logLines: [] };
  }
  const healed = Math.min(enemy.maxHp, enemy.currentHp + healAmount);
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, { currentHp: healed });
  return {
    squad,
    logLines: [`>> ${enemy.designation} REGENERATES — +${healed - enemy.currentHp} HP.`],
    statusFloatLabel: `+${healAmount} HP`,
    statusFloatUnitId: enemy.unitId,
  };
};

const spatialGlitchTurnStart: TurnStartHandler = (enemy, ctx) => {
  if (enemy.rosterId !== 'spatial-glitch' || !enemy.unitId) return { ...EMPTY_TURN, squad: ctx.squad };
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, { teleportReady: true });
  return {
    squad,
    logLines: [`>> ${enemy.designation} PHASE ANCHOR PRIMED — teleport matrix armed.`],
  };
};

const thrallSlumpTurnStart: TurnStartHandler = (enemy, ctx) => {
  if ((enemy.rosterId !== 'thrall' && enemy.rosterId !== 'remembering-thrall') || !enemy.unitId) {
    return { ...EMPTY_TURN, squad: ctx.squad };
  }
  if (!enemy.isSlumped) return { squad: ctx.squad, logLines: [] };
  const remaining = (enemy.slumpTurnsRemaining ?? 0) - 1;
  if (remaining > 0) {
    const squad = patchUnitInSquad(ctx.squad, enemy.unitId, { slumpTurnsRemaining: remaining });
    return {
      squad,
      logLines: [`>> ${enemy.designation} SLUMPED — revival in ${remaining} turn(s).`],
    };
  }
  if (ctx.extras.fleshWarpUnitIds[enemy.unitId]) {
    return {
      squad: ctx.squad,
      logLines: [`>> ${enemy.designation} REVIVAL BLOCKED — flesh-warp seal.`],
    };
  }
  const reviveHpPercent = getAlphaMechanic(enemy, 'reviveHpPercent', 0.5);
  const revivedHp = Math.floor(enemy.maxHp * reviveHpPercent);
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, {
    isSlumped: false,
    slumpTurnsRemaining: 0,
    currentHp: revivedHp,
  });
  return {
    squad,
    logLines: [`>> ${enemy.designation} REVIVES — ${revivedHp} HP.`],
    statusFloatLabel: `+${revivedHp} HP`,
    statusFloatUnitId: enemy.unitId,
  };
};

const golemVentTurnStart: TurnStartHandler = (enemy, ctx) => {
  if ((enemy.rosterId !== 'golem' && enemy.rosterId !== 'blood-rusted-golem') || !enemy.unitId) {
    return { ...EMPTY_TURN, squad: ctx.squad };
  }
  const heat = enemy.heatCharge ?? 0;
  const threshold = enemy.golemHeatVentThreshold ?? 3;
  if (heat < threshold) return { squad: ctx.squad, logLines: [] };
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, { heatCharge: 0 });
  return {
    squad,
    logLines: [`>> ${enemy.designation} VENTING CORE — catastrophic heat discharge.`],
    playerHpDelta: -Math.floor(enemy.baseDamage * 2.5),
  };
};

const churnFleshAmmoTurnStart: TurnStartHandler = (enemy, ctx) => {
  if ((enemy.rosterId !== 'churn' && enemy.rosterId !== 'grave-engine-churn') || !enemy.unitId) {
    return { ...EMPTY_TURN, squad: ctx.squad };
  }
  const shrapnelDmg = Math.floor(enemy.baseDamage * 1.5);
  if (enemy.churnSelfFiring) {
    return {
      squad: ctx.squad,
      logLines: [
        `>> ${enemy.designation} SHRAPNEL BLAST — no sacrifice required.`,
        `>> ${shrapnelDmg} damage.`,
      ],
      playerHpDelta: -shrapnelDmg,
    };
  }
  const fragile = aliveUnits(ctx.squad).find(
    (u) => u.unitId !== enemy.unitId && isFragileArchetype(u.rosterId),
  );
  if (!fragile?.unitId) return { squad: ctx.squad, logLines: [] };
  let squad = patchUnitInSquad(ctx.squad, fragile.unitId, { currentHp: 0 });
  return {
    squad,
    logLines: [
      `>> ${enemy.designation} FLESH AMMO — ${fragile.designation} consumed.`,
      `>> SHRAPNEL BLAST — ${Math.floor(enemy.baseDamage * 1.5)} damage.`,
    ],
    playerHpDelta: -Math.floor(enemy.baseDamage * 1.5),
  };
};

const resonanceCasterTurnStart: TurnStartHandler = (enemy, ctx) => {
  if (
    (enemy.rosterId !== 'resonance-caster' && enemy.rosterId !== 'choir-bound-resonance-caster')
    || !enemy.unitId
  ) {
    return { ...EMPTY_TURN, squad: ctx.squad };
  }
  const stack = (enemy.resonanceStack ?? 0) + 1;
  const scalingPerTurn = getAlphaMechanic(enemy, 'damageScalingPerTurn', 0.5);
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, { resonanceStack: stack });
  const pctBoost = Math.round(stack * scalingPerTurn * 100);
  return {
    squad,
    logLines: [`>> ${enemy.designation} FREQUENCY ESCALATION — +${pctBoost}% attack power.`],
  };
};

const hollowLungTurnStart: TurnStartHandler = (_enemy, ctx) => ({ ...EMPTY_TURN, squad: ctx.squad });

const graveRobberTurnStart: TurnStartHandler = (enemy, ctx) => {
  if (enemy.rosterId !== 'grave-robber' || !enemy.unitId) return { ...EMPTY_TURN, squad: ctx.squad };
  const feeds = enemy.graveRobberFeeds ?? 0;
  if (feeds >= 3) return { squad: ctx.squad, logLines: [] };

  const corpse = ctx.squad.find(
    (u) => u.unitId !== enemy.unitId && (u.isSlumped || u.currentHp <= 0),
  );
  if (!corpse?.unitId) return { squad: ctx.squad, logLines: [] };

  const hpBonus = Math.floor(enemy.maxHp * 0.2);
  const dmgBonus = Math.floor(enemy.baseDamage * 0.1);
  const nextMaxHp = enemy.maxHp + hpBonus;
  const growthBlocked = ctx.extras.fleshWarpUnitIds[enemy.unitId] === true;
  const nextHp = growthBlocked
    ? enemy.currentHp
    : Math.min(nextMaxHp, enemy.currentHp + hpBonus);
  let squad = patchUnitInSquad(ctx.squad, enemy.unitId, {
    graveRobberFeeds: feeds + 1,
    maxHp: nextMaxHp,
    currentHp: nextHp,
    baseDamage: enemy.baseDamage + dmgBonus,
  });
  squad = squad.filter((u) => u.unitId !== corpse.unitId);
  return {
    squad,
    logLines: [
      `>> ${enemy.designation} MACABRE HARVEST — consumed ${corpse.designation}.`,
      growthBlocked
        ? '>> GROWTH — HP gain blocked by flesh-warp seal.'
        : `>> FEAST — +${hpBonus} max HP, +${dmgBonus} damage (${feeds + 1}/3).`,
    ],
  };
};

const burnerTurnStart: TurnStartHandler = (enemy, ctx) => {
  if (enemy.rosterId !== 'burner' || !enemy.unitId) return { ...EMPTY_TURN, squad: ctx.squad };
  const buttonCount = getAlphaMechanic(enemy, 'burnedButtonCount', 1);
  const slots: number[] = [];
  while (slots.length < Math.min(buttonCount, 3)) {
    const slot = Math.floor(Math.random() * 3);
    if (!slots.includes(slot)) slots.push(slot);
  }
  const primarySlot = slots[0] ?? 0;
  return {
    squad: ctx.squad,
    logLines: [
      buttonCount > 1
        ? `>> ${enemy.designation} BURNING STANCE — augment slots ${slots.map((s) => s + 1).join(', ')} ignited.`
        : `>> ${enemy.designation} BURNING STANCE — augment slot ${primarySlot + 1} ignited.`,
    ],
    extras: { jammedAugmentSlot: primarySlot, jammedAugmentSlots: slots },
  };
};

// --- Hit taken handlers ---

const echoingBruteHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (enemy.rosterId !== 'echoing-brute' || !enemy.unitId) return { ...EMPTY_HIT, squad: ctx.squad };
  if (attack.channel !== 'KINETIC') return { squad: ctx.squad, logLines: [] };
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, { adaptedElement: 'Kinetic' });
  return {
    squad,
    logLines: [`>> ${enemy.designation} ADAPTS — kinetic echo stored.`],
  };
};

const nullShadeHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (
    (enemy.rosterId !== 'null-shade' && enemy.rosterId !== 'null-crown-shade')
    || !enemy.unitId
  ) {
    return { ...EMPTY_HIT, squad: ctx.squad };
  }
  if (attack.channel !== 'OCCULT' && !enemy.occultImmune) return { squad: ctx.squad, logLines: [] };
  if (attack.channel !== 'OCCULT') return { squad: ctx.squad, logLines: [] };
  const immuneSeq = { ...ctx.extras.immunePopupSeq };
  immuneSeq[enemy.unitId] = (immuneSeq[enemy.unitId] ?? 0) + 1;
  return {
    squad: ctx.squad,
    logLines: [`>> ${enemy.designation} NULL FIELD — occult channel rejected.`],
    negateDamage: true,
    damageOverride: 0,
    showImmunePopup: true,
    immunePopupUnitId: enemy.unitId,
    extras: { immunePopupSeq: immuneSeq },
  };
};

const spatialGlitchHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (enemy.rosterId !== 'spatial-glitch' || !enemy.unitId || !enemy.teleportReady) {
    return { squad: ctx.squad, logLines: [] };
  }
  if (attack.projectedHpAfter <= 0) {
    return { squad: ctx.squad, logLines: [] };
  }
  const swapTarget = pickRandomLivingAlly(ctx.squad, enemy.unitId);
  if (!swapTarget?.unitId) {
    return { squad: ctx.squad, logLines: [] };
  }
  let squad = swapUnitGridSlots(ctx.squad, enemy.unitId, swapTarget.unitId);
  squad = patchUnitInSquad(squad, enemy.unitId, { teleportReady: false });
  const staminaDrain = getAlphaMechanic(enemy, 'staminaDrainOnTeleport', 0);
  const logLines = [
    `>> ${enemy.designation} SPATIAL SWAP — ${swapTarget.designation} displaced.`,
  ];
  if (staminaDrain > 0) {
    logLines.push(`>> PARADOX TELEPORT — ${staminaDrain} stamina siphoned.`);
  } else {
    logLines.push('>> LAG FIELD — operative AP reduced next turn.');
  }
  return {
    squad,
    logLines,
    negateDamage: true,
    damageOverride: 0,
    playerStaminaDelta: staminaDrain > 0 ? -staminaDrain : undefined,
    extras: staminaDrain > 0
      ? undefined
      : {
          playerApPenaltyNextTurn: ctx.extras.playerApPenaltyNextTurn + 1,
        },
  };
};

const scuttlerHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (enemy.rosterId === 'phase-scuttler' && enemy.unitId && attack.projectedHpAfter > 0) {
    const squad = patchUnitInSquad(ctx.squad, enemy.unitId, {
      evadeActive: true,
      evadeTurnsRemaining: Math.max(enemy.evadeTurnsRemaining ?? 0, 1),
    });
    return {
      squad,
      logLines: [`>> ${enemy.designation} PHASE SLIP — next strike suffers reduced accuracy.`],
    };
  }
  if (enemy.rosterId !== 'scuttler' || !enemy.unitId) return { ...EMPTY_HIT, squad: ctx.squad };
  if (attack.source !== 'STRIKE' && attack.source !== 'SLICE') return { squad: ctx.squad, logLines: [] };
  const evadeChance = enemy.evadeChance ?? getAlphaMechanic(enemy, 'evadeChance', 0.5);
  if (Math.random() >= evadeChance) return { squad: ctx.squad, logLines: [] };
  const counterDmg = Math.max(4, Math.floor(enemy.baseDamage * 0.6));
  return {
    squad: ctx.squad,
    logLines: [`>> ${enemy.designation} EVASIVE MANEUVER — attack dodged. Counter: ${counterDmg}.`],
    negateDamage: true,
    damageOverride: 0,
    playerHpDelta: -counterDmg,
    scuttlerCounter: true,
  };
};

const ironMaidenHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (enemy.rosterId !== 'iron-maiden' || !enemy.unitId) return { ...EMPTY_HIT, squad: ctx.squad };
  if (attack.channel !== 'KINETIC' || attack.raw <= 0) return { squad: ctx.squad, logLines: [] };
  const reflectPct = getAlphaMechanic(enemy, 'physicalReflectPercent', 0.2);
  const reflect = Math.max(1, Math.floor(attack.raw * reflectPct));
  return {
    squad: ctx.squad,
    logLines: [`>> ${enemy.designation} SPIKED CARAPACE — ${reflect} reflected.`],
    playerHpDelta: -reflect,
  };
};

const golemHeatHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (
    (enemy.rosterId !== 'golem' && enemy.rosterId !== 'blood-rusted-golem')
    || !enemy.unitId
    || attack.raw <= 0
  ) {
    return { ...EMPTY_HIT, squad: ctx.squad };
  }
  const heat = (enemy.heatCharge ?? 0) + 1;
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, { heatCharge: heat });
  return {
    squad,
    logLines: heat >= 3
      ? [`>> ${enemy.designation} CORE OVERHEAT — vent imminent (${heat}/3).`]
      : [`>> ${enemy.designation} heat charge ${heat}/3.`],
  };
};

const slagBloodHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (enemy.rosterId !== 'slag-blood' || !enemy.unitId || enemy.isEnraged) {
    return { ...EMPTY_HIT, squad: ctx.squad };
  }
  const projected = attack.projectedHpAfter;
  const desperationThreshold = getAlphaMechanic(enemy, 'desperationThreshold', 0.3);
  const threshold = Math.floor(enemy.maxHp * desperationThreshold);
  if (projected > threshold) return { squad: ctx.squad, logLines: [] };
  const desperationMult = getAlphaMechanic(enemy, 'desperationDamageMult', 2.0);
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, {
    isEnraged: true,
    kineticArmor: 0,
    occultWards: 0,
    baseDamage: Math.floor(enemy.baseDamage * desperationMult),
  });
  return {
    squad,
    logLines: [`>> ${enemy.designation} DESPERATION PROTOCOL — enraged, armor stripped.`],
  };
};

const cutterHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (enemy.rosterId !== 'cutter' || !enemy.unitId) return { ...EMPTY_HIT, squad: ctx.squad };
  if (attack.projectedHpAfter <= 0) return { squad: ctx.squad, logLines: [] };
  const ally = pickRandomLivingAlly(ctx.squad, enemy.unitId);
  if (!ally?.unitId) return { squad: ctx.squad, logLines: [] };
  const evadeBuff = getAlphaMechanic(enemy, 'evadeBuffAfterSwap', 0);
  let squad = swapUnitGridSlots(ctx.squad, enemy.unitId, ally.unitId);
  if (evadeBuff > 0) {
    squad = patchUnitInSquad(squad, enemy.unitId, {
      evadeActive: true,
      evadeTurnsRemaining: Math.max(enemy.evadeTurnsRemaining ?? 0, 1),
    });
  }
  const logLines = [`>> ${enemy.designation} EMERGENCY SWAP — repositioned with ${ally.designation}.`];
  if (evadeBuff > 0) {
    logLines.push(`>> PHANTOM EVASION — heightened dodge posture (${Math.round(evadeBuff * 100)}%).`);
  }
  return {
    squad,
    logLines,
  };
};

const wireGhoulHitTaken: HitTakenHandler = (enemy, attack, ctx) => {
  if (enemy.rosterId !== 'wire-ghoul' || !enemy.unitId || attack.raw <= 0) {
    return { ...EMPTY_HIT, squad: ctx.squad };
  }
  const apTax = getAlphaMechanic(enemy, 'glitchApCostIncrease', 1);
  return {
    squad: ctx.squad,
    logLines: [`>> ${enemy.designation} GLITCH SURGE — −${apTax} AP next turn.`],
    extras: {
      playerApPenaltyNextTurn: ctx.extras.playerApPenaltyNextTurn + apTax,
    },
  };
};

// --- Death handlers ---

const leySirenDeath: DeathHandler = (enemy, _killingBlow, ctx) => {
  if (enemy.rosterId !== 'ley-siren') return { ...EMPTY_DEATH, squad: ctx.squad };
  const tethered = ctx.extras.leySirenTetheredUnitIds;
  if (tethered.length === 0) {
    return { squad: ctx.squad, logLines: [] };
  }
  const squad = clearLeySirenTether(ctx.squad, tethered);
  return {
    squad,
    logLines: ['>> LEY-SIREN SILENCED — occult tether dissolved. Fracture immunity cleared.'],
    extras: {
      leySirenTetheredUnitIds: [],
      leySirenSourceUnitId: null,
    },
  };
};

const ashWeeperDeath: DeathHandler = (enemy, killingBlow, ctx) => {
  if ((enemy.rosterId !== 'ash-weeper' && enemy.rosterId !== 'rootbound-weeper') || !enemy.unitId) {
    return { ...EMPTY_DEATH, squad: ctx.squad };
  }
  const explosionType = getAlphaMechanic<string>(enemy, 'kineticDeathExplosionType', 'OCCULT');
  const explosionDamage = getAlphaMechanic(enemy, 'explosionDamage', 15);
  if (killingBlow.channel !== 'KINETIC') {
    return { squad: ctx.squad, logLines: [], ashTokenSlot: enemy.gridSlot };
  }
  const isTrueDamage = explosionType === 'TRUE_DAMAGE';
  return {
    squad: ctx.squad,
    logLines: [
      isTrueDamage
        ? `>> ${enemy.designation} CINDER DETONATION — parry window to contain ${explosionDamage} true damage.`
        : `>> ${enemy.designation} ASH DETONATION — parry window to contain occult backlash.`,
    ],
    delayDissolve: true,
    triggerRetributionParry: { unitId: enemy.unitId, occultDamage: explosionDamage },
    ashTokenSlot: enemy.gridSlot,
  };
};

const genericAshDeath: DeathHandler = (enemy, _killingBlow, ctx) => {
  if (enemy.rosterId === 'ley-siren' || enemy.rosterId === 'ash-weeper' || enemy.rosterId === 'rootbound-weeper') {
    return { ...EMPTY_DEATH, squad: ctx.squad };
  }
  if (!enemy.unitId || !enemy.gridSlot) return { ...EMPTY_DEATH, squad: ctx.squad };
  return {
    squad: ctx.squad,
    logLines: [],
    ashTokenSlot: enemy.gridSlot,
  };
};

const spallDeath: DeathHandler = (enemy, _killingBlow, ctx) => {
  if (enemy.rosterId !== 'spall') return { ...EMPTY_DEATH, squad: ctx.squad };
  const explosionDamage = getAlphaMechanic(enemy, 'explosionDamage', 12);
  if (!enemy.unitId) {
    return {
      squad: ctx.squad,
      logLines: [`>> ${enemy.designation} VOLATILE SHATTER — ${explosionDamage} shrapnel damage.`],
      playerHpDelta: -explosionDamage,
      ashTokenSlot: enemy.gridSlot,
    };
  }
  return {
    squad: ctx.squad,
    logLines: [
      `>> ${enemy.designation} VOLATILE SHATTER — parry window to contain ${explosionDamage} shrapnel.`,
    ],
    delayDissolve: true,
    triggerRetributionParry: { unitId: enemy.unitId, occultDamage: explosionDamage },
    ashTokenSlot: enemy.gridSlot,
  };
};

const thrallDeath: DeathHandler = (enemy, killingBlow, ctx) => {
  if ((enemy.rosterId !== 'thrall' && enemy.rosterId !== 'remembering-thrall') || !enemy.unitId) {
    return { ...EMPTY_DEATH, squad: ctx.squad };
  }
  const isHeavy = killingBlow.damage >= 25
    || killingBlow.source === 'EVISCERATE'
    || killingBlow.source === 'RUIN'
    || killingBlow.source === 'GRAVE_BIND';
  if (isHeavy) {
    return {
      squad: ctx.squad,
      logLines: [`>> ${enemy.designation} TRUE DEATH — heavy blow confirmed.`],
      ashTokenSlot: enemy.gridSlot,
    };
  }
  const slumpTurns = getAlphaMechanic(enemy, 'reviveTurns', 2);
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, {
    isSlumped: true,
    slumpTurnsRemaining: slumpTurns,
    currentHp: 0,
  });
  return {
    squad,
    logLines: [`>> ${enemy.designation} SLUMPS — requires heavy strike to finish.`],
    delayDissolve: true,
    enterSlump: true,
  };
};

const amalgamArmorRegenTurnStart: TurnStartHandler = (enemy, ctx) => {
  if (
    (enemy.rosterId !== 'amalgam' && enemy.rosterId !== 'core-sick-amalgam')
    || !enemy.regeneratesArmor
    || !enemy.unitId
  ) {
    return { squad: ctx.squad, logLines: [] };
  }
  const squad = patchUnitInSquad(ctx.squad, enemy.unitId, {
    kineticArmor: (enemy.kineticArmor ?? 0) + 1,
  });
  return {
    squad,
    logLines: [`>> ${enemy.designation} ARMOR REGROW — +1 kinetic armor.`],
  };
};

const TURN_START_HANDLERS: TurnStartHandler[] = [
  thrallSlumpTurnStart,
  hollowLungTurnStart,
  graveRobberTurnStart,
  burnerTurnStart,
  gutterGoliathTurnStart,
  spatialGlitchTurnStart,
  golemVentTurnStart,
  churnFleshAmmoTurnStart,
  resonanceCasterTurnStart,
  amalgamArmorRegenTurnStart,
];

const HIT_TAKEN_HANDLERS: HitTakenHandler[] = [
  scuttlerHitTaken,
  echoingBruteHitTaken,
  nullShadeHitTaken,
  spatialGlitchHitTaken,
  ironMaidenHitTaken,
  golemHeatHitTaken,
  slagBloodHitTaken,
  cutterHitTaken,
  wireGhoulHitTaken,
];

const DEATH_HANDLERS: DeathHandler[] = [
  thrallDeath,
  spallDeath,
  leySirenDeath,
  ashWeeperDeath,
  genericAshDeath,
];

function isFullSquadReplacement(
  base: EnemyCombatProfile[],
  patch: EnemyCombatProfile[],
): boolean {
  if (patch.length === 0 || patch.length !== base.length) return false;
  const baseIds = new Set(base.map((unit) => unit.unitId).filter((id): id is string => Boolean(id)));
  if (baseIds.size !== base.length) return false;
  return patch.every((unit) => unit.unitId != null && baseIds.has(unit.unitId));
}

function mergeSquads(base: EnemyCombatProfile[], patch: EnemyCombatProfile[]): EnemyCombatProfile[] {
  if (patch.length === 0) return base;
  if (isFullSquadReplacement(base, patch)) {
    return reconcileSquadGridSlots(patch);
  }
  const byId = new Map(patch.filter((u) => u.unitId).map((u) => [u.unitId!, u]));
  return reconcileSquadGridSlots(
    base.map((unit) => {
      if (!unit.unitId) return unit;
      return byId.get(unit.unitId) ?? unit;
    }),
  );
}

function mergeExtras(
  base: CombatLifecycleContext['extras'],
  patch?: Partial<CombatLifecycleContext['extras']>,
): CombatLifecycleContext['extras'] {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    immunePopupSeq: patch.immunePopupSeq ?? base.immunePopupSeq,
    leySirenTetheredUnitIds: patch.leySirenTetheredUnitIds ?? base.leySirenTetheredUnitIds,
    playerApPenaltyNextTurn: patch.playerApPenaltyNextTurn ?? base.playerApPenaltyNextTurn,
    playerApCapNextTurn: patch.playerApCapNextTurn !== undefined
      ? patch.playerApCapNextTurn
      : base.playerApCapNextTurn,
  };
}

/** Central combat lifecycle manager — scale by registering handlers above. */
export const CombatLifecycleManager = {
  runOnTurnStart(
    enemy: EnemyCombatProfile,
    ctx: CombatLifecycleContext,
  ): TurnStartLifecycleResult {
    let squad = ctx.squad;
    const logLines: string[] = [];
    let extras = ctx.extras;
    let statusFloatLabel: string | undefined;
    let statusFloatUnitId: string | undefined;
    let playerHpDelta: number | undefined;

    for (const handler of TURN_START_HANDLERS) {
      const result = handler(enemy, { ...ctx, squad, extras });
      if (result.squad.length > 0) squad = mergeSquads(squad, result.squad);
      logLines.push(...result.logLines);
      extras = mergeExtras(extras, result.extras);
      if (result.statusFloatLabel) {
        statusFloatLabel = result.statusFloatLabel;
        statusFloatUnitId = result.statusFloatUnitId;
      }
      if (result.playerHpDelta != null) {
        playerHpDelta = (playerHpDelta ?? 0) + result.playerHpDelta;
      }
    }

    return {
      squad,
      logLines,
      extras: extras !== ctx.extras ? extras : undefined,
      statusFloatLabel,
      statusFloatUnitId,
      playerHpDelta,
    };
  },

  runOnHitTaken(
    enemy: EnemyCombatProfile,
    attack: import('../types/combatLifecycle').AttackData,
    ctx: CombatLifecycleContext,
  ): HitTakenLifecycleResult {
    let squad = ctx.squad;
    const logLines: string[] = [];
    let extras = ctx.extras;
    let negateDamage = false;
    let damageOverride: number | undefined;
    let showImmunePopup = false;
    let immunePopupUnitId: string | undefined;
    let playerHpDelta: number | undefined;

    for (const handler of HIT_TAKEN_HANDLERS) {
      const result = handler(enemy, attack, { ...ctx, squad, extras });
      if (result.squad.length > 0) squad = mergeSquads(squad, result.squad);
      logLines.push(...result.logLines);
      extras = mergeExtras(extras, result.extras);
      if (result.negateDamage) negateDamage = true;
      if (result.damageOverride != null) damageOverride = result.damageOverride;
      if (result.showImmunePopup) {
        showImmunePopup = true;
        immunePopupUnitId = result.immunePopupUnitId ?? enemy.unitId;
      }
      if (result.playerHpDelta != null) {
        playerHpDelta = (playerHpDelta ?? 0) + result.playerHpDelta;
      }
    }

    return {
      squad,
      logLines,
      negateDamage,
      damageOverride,
      showImmunePopup,
      immunePopupUnitId,
      extras: extras !== ctx.extras ? extras : undefined,
      playerHpDelta,
    };
  },

  runOnDeath(
    enemy: EnemyCombatProfile,
    killingBlow: import('../types/combatLifecycle').KillingBlowData,
    ctx: CombatLifecycleContext,
  ): DeathLifecycleResult {
    let squad = ctx.squad;
    const logLines: string[] = [];
    let extras = ctx.extras;
    let delayDissolve = false;
    let triggerRetributionParry: DeathLifecycleResult['triggerRetributionParry'];
    let ashTokenSlot: DeathLifecycleResult['ashTokenSlot'];
    let playerHpDelta: number | undefined;
    let enterSlump = false;

    for (const handler of DEATH_HANDLERS) {
      const result = handler(enemy, killingBlow, { ...ctx, squad, extras });
      if (result.squad.length > 0) squad = mergeSquads(squad, result.squad);
      logLines.push(...result.logLines);
      extras = mergeExtras(extras, result.extras);
      if (result.delayDissolve) delayDissolve = true;
      if (result.triggerRetributionParry) triggerRetributionParry = result.triggerRetributionParry;
      if (result.ashTokenSlot) ashTokenSlot = result.ashTokenSlot;
      if (result.playerHpDelta != null) {
        playerHpDelta = (playerHpDelta ?? 0) + result.playerHpDelta;
      }
      if (result.enterSlump) enterSlump = true;
    }

    return {
      squad,
      logLines,
      delayDissolve,
      triggerRetributionParry,
      ashTokenSlot,
      extras: extras !== ctx.extras ? extras : undefined,
      playerHpDelta,
      enterSlump,
    };
  },
};

export function initRosterLifecycleDefaults(
  profile: EnemyCombatProfile,
  entryId?: string,
): EnemyCombatProfile {
  const id = entryId ?? profile.rosterId;
  let next = {
    ...profile,
    fractureImmune: profile.fractureImmune ?? false,
    occultImmune: profile.occultImmune ?? false,
    adaptedElement: profile.adaptedElement ?? null,
    isCharging: profile.isCharging ?? false,
    teleportReady: profile.teleportReady ?? false,
    isEnraged: profile.isEnraged ?? false,
    queuedAction: profile.queuedAction ?? null,
    isUntargetable: profile.isUntargetable ?? false,
    rosterAbilityCooldown: profile.rosterAbilityCooldown ?? 0,
    isSlumped: profile.isSlumped ?? false,
    slumpTurnsRemaining: profile.slumpTurnsRemaining ?? 0,
    heatCharge: profile.heatCharge ?? 0,
    resonanceStack: profile.resonanceStack ?? 0,
    spotterLockedOn: profile.spotterLockedOn ?? false,
    graveRobberFeeds: profile.graveRobberFeeds ?? 0,
    emergencySwapUsed: profile.emergencySwapUsed ?? false,
    bloodRushActive: profile.bloodRushActive ?? false,
    guardBreakPrimed: profile.guardBreakPrimed ?? false,
    rivalWardCharges: profile.rivalWardCharges ?? 0,
    laserLockTurnsRemaining: profile.laserLockTurnsRemaining ?? 0,
  };

  if (id === 'null-shade') {
    next = { ...next, occultImmune: true };
  }

  return next;
}

export function applyHookWeaverTetherAction(
  squad: EnemyCombatProfile[],
  weaver: EnemyCombatProfile,
): { squad: EnemyCombatProfile[]; tetheredId: string | null; logLines: string[] } {
  if (!weaver.unitId) return { squad, tetheredId: null, logLines: [] };
  const frontline = aliveUnits(squad).filter(
    (u) => u.unitId !== weaver.unitId && u.gridSlot?.startsWith('FL'),
  );
  const target = frontline[Math.floor(Math.random() * frontline.length)] ?? null;
  if (!target?.unitId) return { squad, tetheredId: null, logLines: [] };
  const nextSquad = patchUnitInSquad(squad, weaver.unitId, { tetheredAllyUnitId: target.unitId });
  return {
    squad: nextSquad,
    tetheredId: target.unitId,
    logLines: [`>> ${weaver.designation} STAMINA TETHER — ${target.designation} linked.`],
  };
}

export function applyLeySirenTetherAction(
  squad: EnemyCombatProfile[],
  siren: EnemyCombatProfile,
): { squad: EnemyCombatProfile[]; tetheredIds: string[]; logLines: string[] } {
  if (!siren.unitId) {
    return { squad, tetheredIds: [], logLines: [] };
  }
  const tetheredIds = aliveUnits(squad)
    .filter((u) => u.gridSlot?.startsWith('FL') && u.unitId)
    .map((u) => u.unitId!);
  const nextSquad = squad.map((unit) => {
    if (!unit.unitId || !tetheredIds.includes(unit.unitId)) return unit;
    const bonusArmor = siren.leySirenGrantArmor ?? 0;
    return {
      ...unit,
      fractureImmune: true,
      occultWards: (unit.occultWards ?? 0) + bonusArmor,
    };
  });
  return {
    squad: nextSquad,
    tetheredIds,
    logLines: [`>> ${siren.designation} OCCULT TETHER — frontline fracture immunity active.`],
  };
}
