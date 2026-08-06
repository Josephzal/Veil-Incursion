/**
 * E.4 — Preview derived from the same planEnvoyWeaponAction rules (no mutation, no RNG).
 */
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnvoyWeaponActionId } from '../types/envoyWeaponAction';
import type { EnemyCombatProfile } from '../types/run';
import type { ResolvedWeaponState, WeaponFamilyId } from '../types/weapon';
import type { EnvoyWeaponFamilyId } from './envoyWeaponActionRegistry';
import {
  planEnvoyWeaponAction,
  previewGraveTransferDestinationStacks,
  type EnvoyWeaponActionPlanResult,
} from './envoyWeaponActionPlanEngine';
import { getVeilRotStacks } from './envoyRotEngine';
import { canonicalizeEnvoyCombatActionId } from './envoyCombatCompatibility';
import { isEnvoyWeaponActionId } from './envoyWeaponActionRegistry';

export interface EnvoyWeaponActionPreview {
  ok: boolean;
  actionId: EnvoyWeaponActionId | null;
  rejectReason: string | null;
  apCost: number;
  staminaCost: number;
  fluxCost: number;
  fluxGain: number;
  expectedFluxDelta: number;
  expectedPostFlux: number | null;
  hpSacrificeRequired: number;
  hpSacrificePayable: number;
  sacrificeFullPay: boolean;
  brinkArmed: boolean;
  brinkMultiplier: number | null;
  fullPayMultiplierApplies: boolean;
  exposureArmedOnTarget: boolean;
  exposureMultiplierApplies: boolean;
  authoredOccultDamage: number;
  /** Conditional occult including legal Catalyst amp; not a crit promise. */
  expectedOccultDamage: number;
  damageType: 'OCCULT' | 'NONE';
  wardStrip: number;
  rotApply: number;
  rotTransfer: number;
  rotConsume: number;
  rotSourceAfter: number | null;
  rotDestAfter: number | null;
  catalystPrime: string | null;
  catalystSequenceLabel: string | null;
  catalystPayoffConditional: boolean;
  selfHeal: number;
  apDrain: number;
  smokeArcAccuracyDown: boolean;
  armSanguineExposure: boolean;
  provenanceActionId: string | null;
  historicalSourceId: string | null;
  conditionalNotes: string[];
}

export function previewEnvoyWeaponAction(args: {
  actionId: string;
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId;
  classState: ClassCombatEncounterState;
  squad: readonly EnemyCombatProfile[];
  targetId: string | null;
  secondaryTargetId?: string | null;
  veilFlux: number;
  operativeHp: number;
  maxHp: number;
  resolvedWeapon: ResolvedWeaponState | null;
}): EnvoyWeaponActionPreview {
  const empty: EnvoyWeaponActionPreview = {
    ok: false,
    actionId: null,
    rejectReason: null,
    apCost: 0,
    staminaCost: 0,
    fluxCost: 0,
    fluxGain: 0,
    expectedFluxDelta: 0,
    expectedPostFlux: null,
    hpSacrificeRequired: 0,
    hpSacrificePayable: 0,
    sacrificeFullPay: false,
    brinkArmed: false,
    brinkMultiplier: null,
    fullPayMultiplierApplies: false,
    exposureArmedOnTarget: false,
    exposureMultiplierApplies: false,
    authoredOccultDamage: 0,
    expectedOccultDamage: 0,
    damageType: 'NONE',
    wardStrip: 0,
    rotApply: 0,
    rotTransfer: 0,
    rotConsume: 0,
    rotSourceAfter: null,
    rotDestAfter: null,
    catalystPrime: null,
    catalystSequenceLabel: null,
    catalystPayoffConditional: false,
    selfHeal: 0,
    apDrain: 0,
    smokeArcAccuracyDown: false,
    armSanguineExposure: false,
    provenanceActionId: null,
    historicalSourceId: null,
    conditionalNotes: [],
  };

  const canon = canonicalizeEnvoyCombatActionId(args.actionId, args.familyId);
  if (canon.kind !== 'WEAPON_ACTION' || !isEnvoyWeaponActionId(canon.canonicalId)) {
    return { ...empty, rejectReason: `Not a weapon action: ${args.actionId}` };
  }

  const planned: EnvoyWeaponActionPlanResult = planEnvoyWeaponAction({
    actionId: canon.canonicalId,
    familyId: args.familyId,
    classState: args.classState,
    squad: args.squad,
    targetId: args.targetId,
    secondaryTargetId: args.secondaryTargetId,
    veilFlux: args.veilFlux,
    operativeHp: args.operativeHp,
    maxHp: args.maxHp,
    resolvedWeapon: args.resolvedWeapon,
    previousCatalystForCleanCycle: args.classState.currentCatalyst ?? null,
  });

  if (!planned.ok) {
    return {
      ...empty,
      rejectReason: planned.message,
      apCost: planned.apCost,
      historicalSourceId: canon.historicalSourceId,
    };
  }

  const notes: string[] = [];
  if (planned.cleanCatalystCycle) notes.push('CLEAN_CYCLE armed');
  if (planned.brinkAmplified) notes.push('Brink amp applied');
  if (planned.sacrificePaidFully) notes.push('Full sacrifice payment');
  else if (planned.intendedHpSacrifice > 0) notes.push('Partial or withheld sacrifice payoff');
  if (planned.exposureAmplified) notes.push('Exposure amp applied');
  if (planned.catalystPreview.payoff?.damageBonusPercent) {
    notes.push('Catalyst damage amp conditional on current sequence');
  }
  if (planned.rotConsume > 0) {
    notes.push(`Rot Knell consumes ${planned.rotConsume} stack(s) — damage stack-dependent`);
  }

  let rotSourceAfter: number | null = null;
  let rotDestAfter: number | null = null;
  if (planned.rotTransfer > 0 && planned.sourceUnitId && planned.destUnitId) {
    const t = previewGraveTransferDestinationStacks(
      args.classState,
      planned.sourceUnitId,
      planned.destUnitId,
      planned.rotTransfer,
    );
    rotSourceAfter = t.sourceAfter;
    rotDestAfter = t.destAfter;
  } else if (planned.rotConsume > 0 && planned.sourceUnitId) {
    rotSourceAfter = getVeilRotStacks(args.classState, planned.sourceUnitId) - planned.rotConsume;
  }

  const prev = planned.catalystPreview.previous;
  const cur = planned.catalystPreview.current;
  const sequenceLabel = cur ? (prev ? `${prev}→${cur}` : String(cur)) : null;

  return {
    ok: true,
    actionId: planned.actionId,
    rejectReason: null,
    apCost: planned.apCost,
    staminaCost: planned.staminaCost,
    fluxCost: planned.fluxCost,
    fluxGain: planned.fluxGain,
    expectedFluxDelta: planned.fluxDelta,
    expectedPostFlux: Math.max(0, args.veilFlux + planned.fluxDelta),
    hpSacrificeRequired: planned.intendedHpSacrifice,
    hpSacrificePayable: planned.hpSacrifice,
    sacrificeFullPay: planned.sacrificePaidFully,
    brinkArmed: planned.brinkAmplified || args.veilFlux <= 25 && planned.def.brinkEligible,
    brinkMultiplier: planned.brinkAmplified ? 1.2 : null,
    fullPayMultiplierApplies: planned.sacrificePaidFully,
    exposureArmedOnTarget: planned.armSanguineExposure || planned.exposureAmplified,
    exposureMultiplierApplies: planned.exposureAmplified,
    authoredOccultDamage: planned.authoredOccultDamage,
    expectedOccultDamage: planned.occultDamage,
    damageType: planned.def.damageChannel === 'NONE' ? 'NONE' : 'OCCULT',
    wardStrip: planned.wardStrip,
    rotApply: planned.rotApply,
    rotTransfer: planned.rotTransfer,
    rotConsume: planned.rotConsume,
    rotSourceAfter,
    rotDestAfter,
    catalystPrime: planned.catalystPrime,
    catalystSequenceLabel: sequenceLabel,
    catalystPayoffConditional: Boolean(planned.catalystPreview.previous),
    selfHeal: planned.selfHeal,
    apDrain: planned.apDrain,
    smokeArcAccuracyDown: planned.smokeArcAccuracyDown,
    armSanguineExposure: planned.armSanguineExposure,
    provenanceActionId: planned.provenanceActionId,
    historicalSourceId: canon.historicalSourceId,
    conditionalNotes: notes,
  };
}

/** Compact HUD effect line from E.4 preview facts (no value recalculation). */
export function formatEnvoyWeaponActionEffectLine(preview: EnvoyWeaponActionPreview): string {
  if (!preview.ok) {
    return preview.rejectReason ?? 'Unavailable';
  }
  const parts: string[] = [];
  if (preview.damageType === 'OCCULT' && preview.expectedOccultDamage > 0) {
    parts.push(`${preview.expectedOccultDamage} OCCULT`);
  }
  if (preview.selfHeal > 0) parts.push(`HEAL ${preview.selfHeal}`);
  if (preview.rotApply > 0) parts.push(`ROT +${preview.rotApply}`);
  if (preview.rotTransfer > 0) parts.push(`ROT XFER ${preview.rotTransfer}`);
  if (preview.rotConsume > 0) parts.push(`ROT −${preview.rotConsume}`);
  if (preview.wardStrip > 0) parts.push(`WARD −${preview.wardStrip}`);
  if (preview.apDrain > 0) parts.push(`AP −${preview.apDrain}`);
  if (preview.smokeArcAccuracyDown) parts.push('ACC −10%');
  if (preview.armSanguineExposure) parts.push('EXPOSE');
  if (preview.exposureMultiplierApplies) parts.push('EXPOSURE AMP');
  if (preview.brinkArmed) parts.push('BRINK');
  if (preview.hpSacrificeRequired > 0) {
    parts.push(
      preview.sacrificeFullPay
        ? `HP −${preview.hpSacrificePayable}`
        : `HP −${preview.hpSacrificePayable}/${preview.hpSacrificeRequired}`,
    );
  }
  if (preview.catalystPrime) parts.push(`CAT ${preview.catalystPrime}`);
  if (preview.fluxGain > 0 && preview.fluxCost === 0) parts.push(`FLUX +${preview.fluxGain}`);
  return parts.length > 0 ? parts.join(' // ') : preview.conditionalNotes[0] ?? '—';
}

/** Expanded tooltip / staged description from E.4 preview. */
export function formatEnvoyWeaponActionExpandedDescription(
  preview: EnvoyWeaponActionPreview,
  catalogDescription: string,
): string {
  if (!preview.ok) {
    return preview.rejectReason ?? catalogDescription;
  }
  const extras = [
    ...preview.conditionalNotes,
    preview.catalystSequenceLabel ? `Catalyst ${preview.catalystSequenceLabel}` : null,
    preview.catalystPayoffConditional ? 'Sequence payoff conditional' : null,
  ].filter(Boolean);
  return extras.length > 0
    ? `${catalogDescription}\n${extras.join(' · ')}`
    : catalogDescription;
}
