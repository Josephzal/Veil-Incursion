/**
 * Phase B — pure resolve plans for Aegis weapon actions.
 * Hub/executor applies damage, spends AP, mutates combat state.
 */
import type { AegisWeaponActionId } from '../types/aegisCombat';
import { RUNIC_BRAND_CAP } from '../types/aegisCombat';

export interface WeaponHitPlan {
  kineticDamage: number;
  occultDamage: number;
  fractureGain: number;
  armorStrip: number;
  reserveGain: number;
  accuracyBonusPct: number;
  channel: 'KINETIC' | 'OCCULT';
}

export interface AegisWeaponActionPlan {
  actionId: AegisWeaponActionId;
  apCost: number;
  /** Shared origin for Doomfall Charge/Release hooks. */
  originActionId?: string;
  stage: 'NORMAL' | 'CHARGE' | 'RELEASE';
  hits: WeaponHitPlan[];
  /** Dual-target indices into caller-provided target list. */
  dualTarget?: boolean;
  rowTarget?: boolean;
  brandGain: number;
  brandReason: string | null;
  enterDreadbound: boolean;
  enterEclipse: boolean;
  enterPoise: boolean;
  enterCommitted: boolean;
  consumeTempo: boolean;
  tempoWasArmed: boolean;
  noRespitePayoff: boolean;
  noRespiteApRefund: number;
  noRespiteReserveBonus: number;
  snapshotTargetFractured: boolean;
  doomfallConsumeFractured: boolean;
  doomfallPostFracturePressure: number;
  notes: string[];
  /** Cancel later hits if primary kill (Divergence same-target / Severance). */
  cancelRemainingOnPrimaryKill: boolean;
}

function hit(partial: Partial<WeaponHitPlan> & { kineticDamage?: number }): WeaponHitPlan {
  return {
    kineticDamage: partial.kineticDamage ?? 0,
    occultDamage: partial.occultDamage ?? 0,
    fractureGain: partial.fractureGain ?? 0,
    armorStrip: partial.armorStrip ?? 0,
    reserveGain: partial.reserveGain ?? 0,
    accuracyBonusPct: partial.accuracyBonusPct ?? 0,
    channel: partial.channel ?? (partial.occultDamage && !partial.kineticDamage ? 'OCCULT' : 'KINETIC'),
  };
}

export function clampBrandGain(current: number, gain: number): number {
  if (gain <= 0) return 0;
  return Math.min(gain, Math.max(0, RUNIC_BRAND_CAP - current));
}

export function planWardensStrike(): AegisWeaponActionPlan {
  return {
    actionId: 'WARDENS_STRIKE',
    apCost: 1,
    stage: 'NORMAL',
    hits: [hit({ kineticDamage: 14, fractureGain: 20, armorStrip: 1, reserveGain: 8 })],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ["Warden's Strike — baseline kinetic."],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planRupture(input: {
  removedFinalArmor: boolean;
  enteredFractured: boolean;
}): AegisWeaponActionPlan {
  const mastery = input.removedFinalArmor || input.enteredFractured;
  return {
    actionId: 'RUPTURE',
    apCost: 1,
    stage: 'NORMAL',
    hits: [hit({
      kineticDamage: 8,
      fractureGain: 40,
      armorStrip: 2,
      accuracyBonusPct: 15,
    })],
    brandGain: mastery ? 1 : 0,
    brandReason: mastery
      ? (input.removedFinalArmor && input.enteredFractured
        ? 'Armor break + Fracture entry — 1 Brand.'
        : input.removedFinalArmor
          ? 'Final Armor removed — 1 Brand.'
          : 'Entered Fractured — 1 Brand.')
      : null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ['Rupture — high Fracture pressure.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planDreadbind(): AegisWeaponActionPlan {
  return {
    actionId: 'DREADBIND',
    apCost: 1,
    stage: 'NORMAL',
    hits: [hit({ kineticDamage: 10, fractureGain: 18 })],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: true,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ['Dreadbind — watch target next action.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export const DREADBIND_MASTERY_FRACTURE = 22;

export function planNoRespite(input: {
  targetFracturedAtStart: boolean;
  alreadyUsedThisTurn: boolean;
}): AegisWeaponActionPlan {
  const payoff = input.targetFracturedAtStart && !input.alreadyUsedThisTurn;
  return {
    actionId: 'NO_RESPITE',
    apCost: 2,
    stage: 'NORMAL',
    hits: [hit({ kineticDamage: 24, fractureGain: 0 })],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: payoff,
    noRespiteApRefund: payoff ? 1 : 0,
    noRespiteReserveBonus: payoff ? 10 : 0,
    snapshotTargetFractured: input.targetFracturedAtStart,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: payoff
      ? ['No Respite — Fractured cashout: +1 AP, +10 Reserve.']
      : ['No Respite — baseline.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planPairedBladesStrike(input: { tempoArmed: boolean }): AegisWeaponActionPlan {
  const hits = [
    hit({ kineticDamage: 11, fractureGain: 12, reserveGain: 6 }),
  ];
  if (input.tempoArmed) {
    hits.push(hit({ occultDamage: 4, channel: 'OCCULT' }));
  }
  return {
    actionId: 'PAIRED_BLADES_STRIKE',
    apCost: 1,
    stage: 'NORMAL',
    hits,
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: input.tempoArmed,
    tempoWasArmed: input.tempoArmed,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: input.tempoArmed
      ? ['Paired Strike — Tempo Occult rider armed.']
      : ['Paired Strike — Tempo cold.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planDivergence(): AegisWeaponActionPlan {
  return {
    actionId: 'DIVERGENCE',
    apCost: 1,
    stage: 'NORMAL',
    dualTarget: true,
    hits: [
      hit({ kineticDamage: 5, fractureGain: 8, reserveGain: 2 }),
      hit({ kineticDamage: 5, fractureGain: 8, reserveGain: 2 }),
    ],
    brandGain: 0, // applied by executor when both hit
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ['Divergence — dual blades (5+5).'],
    cancelRemainingOnPrimaryKill: true,
  };
}

export function planEclipse(): AegisWeaponActionPlan {
  return {
    actionId: 'ECLIPSE',
    apCost: 1,
    stage: 'NORMAL',
    hits: [hit({ kineticDamage: 10, fractureGain: 12 })],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: true,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ['Eclipse — posture on commit.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planSeverance(input: { tempoArmed: boolean }): AegisWeaponActionPlan {
  const blade2 = input.tempoArmed
    ? hit({ occultDamage: 20, fractureGain: 10, reserveGain: 12, channel: 'OCCULT' })
    : hit({ kineticDamage: 12, fractureGain: 10, reserveGain: 4 });
  return {
    actionId: 'SEVERANCE',
    apCost: 2,
    stage: 'NORMAL',
    hits: [
      hit({ kineticDamage: 12, fractureGain: 10, reserveGain: 4 }),
      blade2,
    ],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false, // only if enhanced blade 2 hits — executor
    tempoWasArmed: input.tempoArmed,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: input.tempoArmed
      ? ['Severance — Tempo enhances Blade Two.']
      : ['Severance — baseline dual blades.'],
    cancelRemainingOnPrimaryKill: true,
  };
}

export function planUnmakerStrike(): AegisWeaponActionPlan {
  return {
    actionId: 'UNMAKER_STRIKE',
    apCost: 1,
    stage: 'NORMAL',
    hits: [hit({ kineticDamage: 15, fractureGain: 26, reserveGain: 4 })],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ['Unmaker Strike.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planDreadHorizon(): AegisWeaponActionPlan {
  return {
    actionId: 'DREAD_HORIZON',
    apCost: 2,
    stage: 'NORMAL',
    rowTarget: true,
    hits: [
      hit({ kineticDamage: 12, fractureGain: 30, reserveGain: 3 }),
      hit({ kineticDamage: 12, fractureGain: 30, reserveGain: 3 }),
    ],
    brandGain: 0, // executor if both hit
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ['Dread Horizon — occupied row.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planUnbowed(): AegisWeaponActionPlan {
  return {
    actionId: 'UNBOWED',
    apCost: 1,
    stage: 'NORMAL',
    hits: [hit({ kineticDamage: 10, fractureGain: 20 })],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: true,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ['Unbowed — Poise established.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planDoomfallCharge(originActionId: string): AegisWeaponActionPlan {
  return {
    actionId: 'DOOMFALL',
    apCost: 1,
    originActionId,
    stage: 'CHARGE',
    hits: [],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: true,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 0,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 0,
    notes: ['Doomfall Charge — Committed.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export function planDoomfallRelease(input: {
  originActionId: string;
  targetFracturedAtStart: boolean;
}): AegisWeaponActionPlan {
  if (input.targetFracturedAtStart) {
    return {
      actionId: 'DOOMFALL',
      apCost: 0,
      originActionId: input.originActionId,
      stage: 'RELEASE',
      hits: [hit({ kineticDamage: 32 + 14, fractureGain: 0 })],
      brandGain: 0,
      brandReason: null,
      enterDreadbound: false,
      enterEclipse: false,
      enterPoise: false,
      enterCommitted: false,
      consumeTempo: false,
      tempoWasArmed: false,
      noRespitePayoff: false,
      noRespiteApRefund: 0,
      noRespiteReserveBonus: 24,
      snapshotTargetFractured: true,
      doomfallConsumeFractured: true,
      doomfallPostFracturePressure: 0,
      notes: ['Doomfall Release — Fractured cashout.'],
      cancelRemainingOnPrimaryKill: false,
    };
  }
  return {
    actionId: 'DOOMFALL',
    apCost: 0,
    originActionId: input.originActionId,
    stage: 'RELEASE',
    hits: [hit({ kineticDamage: 32, fractureGain: 0 })],
    brandGain: 0,
    brandReason: null,
    enterDreadbound: false,
    enterEclipse: false,
    enterPoise: false,
    enterCommitted: false,
    consumeTempo: false,
    tempoWasArmed: false,
    noRespitePayoff: false,
    noRespiteApRefund: 0,
    noRespiteReserveBonus: 8,
    snapshotTargetFractured: false,
    doomfallConsumeFractured: false,
    doomfallPostFracturePressure: 42,
    notes: ['Doomfall Release — baseline.'],
    cancelRemainingOnPrimaryKill: false,
  };
}

export const ECLIPSE_EVADE_BONUS_PCT = 20;
export const POISE_DAMAGE_REDUCTION_PCT = 35;
export const DREADBOUND_DAMAGE_REDUCTION_PCT = 25;

export function planAegisWeaponAction(
  actionId: AegisWeaponActionId,
  ctx: {
    tempoArmed: boolean;
    targetFracturedAtStart?: boolean;
    noRespiteUsedThisTurn?: boolean;
    doomfallReleaseAvailable?: boolean;
    doomfallOriginActionId?: string | null;
    ruptureMastery?: { removedFinalArmor: boolean; enteredFractured: boolean };
  },
): AegisWeaponActionPlan {
  switch (actionId) {
    case 'WARDENS_STRIKE':
      return planWardensStrike();
    case 'RUPTURE':
      return planRupture(ctx.ruptureMastery ?? {
        removedFinalArmor: false,
        enteredFractured: false,
      });
    case 'DREADBIND':
      return planDreadbind();
    case 'NO_RESPITE':
      return planNoRespite({
        targetFracturedAtStart: ctx.targetFracturedAtStart === true,
        alreadyUsedThisTurn: ctx.noRespiteUsedThisTurn === true,
      });
    case 'PAIRED_BLADES_STRIKE':
      return planPairedBladesStrike({ tempoArmed: ctx.tempoArmed });
    case 'DIVERGENCE':
      return planDivergence();
    case 'ECLIPSE':
      return planEclipse();
    case 'SEVERANCE':
      return planSeverance({ tempoArmed: ctx.tempoArmed });
    case 'UNMAKER_STRIKE':
      return planUnmakerStrike();
    case 'DREAD_HORIZON':
      return planDreadHorizon();
    case 'UNBOWED':
      return planUnbowed();
    case 'DOOMFALL':
      if (ctx.doomfallReleaseAvailable) {
        return planDoomfallRelease({
          originActionId: ctx.doomfallOriginActionId ?? `doomfall-${Date.now()}`,
          targetFracturedAtStart: ctx.targetFracturedAtStart === true,
        });
      }
      return planDoomfallCharge(ctx.doomfallOriginActionId ?? `doomfall-${Date.now()}`);
    default: {
      const _exhaustive: never = actionId;
      throw new Error(`Unhandled weapon action ${_exhaustive}`);
    }
  }
}
