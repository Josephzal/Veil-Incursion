import { laneForSlot } from '../types/combatGrid';
import type { CombatGridSlotId } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import { aliveUnits, getUnitById, updateUnit } from './combatSquadEngine';
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
  return squad.map((unit) => {
    if (unit.unitId === unitIdA) {
      return { ...unit, gridSlot: slotB, lane: laneForSlot(slotB) };
    }
    if (unit.unitId === unitIdB) {
      return { ...unit, gridSlot: slotA, lane: laneForSlot(slotA) };
    }
    return unit;
  });
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
  const healAmount = enemy.maxHp - enemy.currentHp >= 15 ? 15 : enemy.maxHp - enemy.currentHp;
  const healed = Math.min(enemy.maxHp, enemy.currentHp + 15);
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
  if (enemy.rosterId !== 'null-shade' || !enemy.unitId) return { ...EMPTY_HIT, squad: ctx.squad };
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
  return {
    squad,
    logLines: [
      `>> ${enemy.designation} SPATIAL SWAP — ${swapTarget.designation} displaced.`,
      '>> LAG FIELD — operative AP reduced next turn.',
    ],
    negateDamage: true,
    damageOverride: 0,
    extras: {
      playerApPenaltyNextTurn: ctx.extras.playerApPenaltyNextTurn + 1,
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
  if (enemy.rosterId !== 'ash-weeper' || !enemy.unitId) return { ...EMPTY_DEATH, squad: ctx.squad };
  if (killingBlow.channel !== 'KINETIC') {
    return { squad: ctx.squad, logLines: [], ashTokenSlot: enemy.gridSlot };
  }
  return {
    squad: ctx.squad,
    logLines: [`>> ${enemy.designation} ASH DETONATION — parry window to contain occult backlash.`],
    delayDissolve: true,
    triggerRetributionParry: { unitId: enemy.unitId, occultDamage: 15 },
    ashTokenSlot: enemy.gridSlot,
  };
};

const genericAshDeath: DeathHandler = (enemy, _killingBlow, ctx) => {
  if (enemy.rosterId === 'ley-siren' || enemy.rosterId === 'ash-weeper') {
    return { ...EMPTY_DEATH, squad: ctx.squad };
  }
  if (!enemy.unitId || !enemy.gridSlot) return { ...EMPTY_DEATH, squad: ctx.squad };
  return {
    squad: ctx.squad,
    logLines: [],
    ashTokenSlot: enemy.gridSlot,
  };
};

const TURN_START_HANDLERS: TurnStartHandler[] = [
  gutterGoliathTurnStart,
  spatialGlitchTurnStart,
];

const HIT_TAKEN_HANDLERS: HitTakenHandler[] = [
  echoingBruteHitTaken,
  nullShadeHitTaken,
  spatialGlitchHitTaken,
];

const DEATH_HANDLERS: DeathHandler[] = [
  leySirenDeath,
  ashWeeperDeath,
  genericAshDeath,
];

function mergeSquads(base: EnemyCombatProfile[], patch: EnemyCombatProfile[]): EnemyCombatProfile[] {
  if (patch.length === 0) return base;
  const byId = new Map(patch.filter((u) => u.unitId).map((u) => [u.unitId!, u]));
  return base.map((unit) => {
    if (!unit.unitId) return unit;
    return byId.get(unit.unitId) ?? unit;
  });
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

    for (const handler of TURN_START_HANDLERS) {
      const result = handler(enemy, { ...ctx, squad, extras });
      if (result.squad.length > 0) squad = mergeSquads(squad, result.squad);
      logLines.push(...result.logLines);
      extras = mergeExtras(extras, result.extras);
      if (result.statusFloatLabel) {
        statusFloatLabel = result.statusFloatLabel;
        statusFloatUnitId = result.statusFloatUnitId;
      }
    }

    return {
      squad,
      logLines,
      extras: extras !== ctx.extras ? extras : undefined,
      statusFloatLabel,
      statusFloatUnitId,
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
    }

    return {
      squad,
      logLines,
      negateDamage,
      damageOverride,
      showImmunePopup,
      immunePopupUnitId,
      extras: extras !== ctx.extras ? extras : undefined,
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

    for (const handler of DEATH_HANDLERS) {
      const result = handler(enemy, killingBlow, { ...ctx, squad, extras });
      if (result.squad.length > 0) squad = mergeSquads(squad, result.squad);
      logLines.push(...result.logLines);
      extras = mergeExtras(extras, result.extras);
      if (result.delayDissolve) delayDissolve = true;
      if (result.triggerRetributionParry) triggerRetributionParry = result.triggerRetributionParry;
      if (result.ashTokenSlot) ashTokenSlot = result.ashTokenSlot;
    }

    return {
      squad,
      logLines,
      delayDissolve,
      triggerRetributionParry,
      ashTokenSlot,
      extras: extras !== ctx.extras ? extras : undefined,
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
  };

  if (id === 'null-shade') {
    next = { ...next, occultImmune: true };
  }

  return next;
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
    return { ...unit, fractureImmune: true };
  });
  return {
    squad: nextSquad,
    tetheredIds,
    logLines: [`>> ${siren.designation} OCCULT TETHER — frontline fracture immunity active.`],
  };
}
