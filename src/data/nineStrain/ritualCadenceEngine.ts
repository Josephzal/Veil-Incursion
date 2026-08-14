import type { CanonicalRootActionContext, InstinctGrade, TargetNativeResult } from '../../types/nineStrain';
import type { CounterfateActionSurface } from '../../types/counterfate';
import type {
  DownbeatEvidence,
  MeasureBeat,
  MeasureOutcomeKind,
  MeasurePreview,
  QualifyingSurface,
  RitualCadenceRuntimeState,
} from '../../types/ritualCadence';
import { roundCounterfateAmount } from './counterfateMath';

export function createDefaultRitualCadenceState(): RitualCadenceRuntimeState {
  return {
    measure: 'EMPTY',
    previousSurface: null,
    pendingFinaleRootId: null,
    pendingFinaleSurface: null,
    instinctCommitmentUsedThisCombatCycle: false,
    instinctCommitmentRootId: null,
    improvisedUsedThisTurn: false,
    heldResonance: { armed: false, ammoType: null },
    downbeatProtected: false,
    grandFinaleRootId: null,
    lastFinaleSurface: null,
    lastFinaleRootId: null,
    lastPostFinaleReason: null,
    lastOutcome: null,
    cooldownAdvanced: false,
  };
}

export function classifyQualifyingSurface(args: {
  actionSurface?: CounterfateActionSurface;
  sourceKind: CanonicalRootActionContext['sourceKind'];
  classification: CanonicalRootActionContext['classification'];
  grandCadenceOwned: boolean;
  measure: MeasureBeat;
}): QualifyingSurface | null {
  if (args.classification === 'DERIVATIVE') return null;
  if (args.sourceKind === 'ULTIMATE' || args.actionSurface === 'ULTIMATE') {
    if (args.grandCadenceOwned && args.measure === 'BEAT_II') return 'VERDICT';
    return null;
  }
  if (args.sourceKind === 'INSTINCT' || args.actionSurface === 'INSTINCT') return 'INSTINCT';
  if (args.actionSurface === 'TECHNIQUE' || args.actionSurface === 'FLEX') return 'DISCIPLINE';
  if (args.actionSurface === 'WEAPON' || args.actionSurface === 'BASIC') return 'ARMAMENT';
  if (args.sourceKind === 'PLAYER_ACTION') return 'ARMAMENT';
  return null;
}

function nextBeat(current: MeasureBeat): { beat: MeasureBeat; finale: boolean } {
  if (current === 'EMPTY') return { beat: 'BEAT_I', finale: false };
  if (current === 'BEAT_I') return { beat: 'BEAT_II', finale: false };
  return { beat: current, finale: true };
}

export function previewMeasureStep(args: {
  state: RitualCadenceRuntimeState;
  surface: QualifyingSurface | null;
  improvisedOwned: boolean;
}): MeasurePreview {
  const from = args.state.measure;
  const emptyPreview = (outcome: MeasureOutcomeKind, to: MeasureBeat): MeasurePreview => ({
    surface: args.surface,
    outcome,
    from,
    to,
    finale: outcome === 'FINALE',
    grandFinale: false,
    held: outcome === 'HOLD',
    closingStrikeBonusPct: 0,
    measuredInvocationAp: null,
    heldResonancePreview: 0,
    improvisedAvailable: args.improvisedOwned && !args.state.improvisedUsedThisTurn,
  });
  if (!args.surface) return emptyPreview('IGNORE', from);
  const same = args.state.previousSurface === args.surface;
  if (from === 'EMPTY') {
    return emptyPreview('ADVANCE', 'BEAT_I');
  }
  if (same) {
    const canHold = args.improvisedOwned
      && !args.state.improvisedUsedThisTurn
      && (from === 'BEAT_I' || from === 'BEAT_II');
    if (canHold) return emptyPreview('HOLD', from);
    return emptyPreview('RESTART', 'BEAT_I');
  }
  const stepped = nextBeat(from);
  if (stepped.finale) {
    return {
      ...emptyPreview('FINALE', from),
      grandFinale: args.surface === 'VERDICT',
    };
  }
  return emptyPreview('ADVANCE', stepped.beat);
}

export function applyMeasureStep(
  state: RitualCadenceRuntimeState,
  preview: MeasurePreview,
): RitualCadenceRuntimeState {
  if (preview.outcome === 'IGNORE') return { ...state, lastOutcome: 'IGNORE' };
  if (preview.outcome === 'HOLD') {
    return {
      ...state,
      improvisedUsedThisTurn: true,
      lastOutcome: 'HOLD',
      previousSurface: preview.surface,
    };
  }
  if (preview.outcome === 'RESTART') {
    return {
      ...state,
      measure: 'BEAT_I',
      previousSurface: preview.surface,
      lastOutcome: 'RESTART',
      downbeatProtected: false,
    };
  }
  if (preview.outcome === 'FINALE') {
    return {
      ...state,
      pendingFinaleRootId: state.pendingFinaleRootId,
      pendingFinaleSurface: preview.surface,
      lastOutcome: 'FINALE',
      previousSurface: preview.surface,
    };
  }
  return {
    ...state,
    measure: preview.to,
    previousSurface: preview.surface,
    lastOutcome: 'ADVANCE',
  };
}

export function measuredInvocationPaidAp(authored: number, finale: boolean, owned: boolean): number {
  if (!owned || !finale) return authored;
  if (authored <= 0) return authored;
  return Math.max(1, authored - 1);
}

export function applyNativeDamageModifier(
  rows: readonly TargetNativeResult[],
  percent: number,
): TargetNativeResult[] {
  return rows.map((row) => {
    if (row.nativeDirectDamage <= 0 || row.misses > 0 && row.hits === 0) return row;
    const bonus = roundCounterfateAmount(row.nativeDirectDamage * percent);
    if (bonus <= 0) return row;
    const kinetic = row.kineticNativeDamage;
    const occult = row.occultNativeDamage;
    const totalChannels = (kinetic ?? 0) + (occult ?? 0);
    let nextKinetic = kinetic;
    let nextOccult = occult;
    if (kinetic != null && occult != null && totalChannels > 0) {
      const kineticShare = roundCounterfateAmount(bonus * (kinetic / totalChannels));
      nextKinetic = kinetic + kineticShare;
      nextOccult = occult + (bonus - kineticShare);
    }
    return {
      ...row,
      nativeDirectDamage: row.nativeDirectDamage + bonus,
      kineticNativeDamage: nextKinetic,
      occultNativeDamage: nextOccult,
    };
  });
}

export function evaluateDownbeat(evidence: DownbeatEvidence): boolean {
  return evidence.killed
    || evidence.kineticArmorBroken
    || evidence.occultWardBroken
    || evidence.intentCountered
    || evidence.bossThreshold
    || evidence.objectiveProgress;
}

export function resolvePostFinale(
  state: RitualCadenceRuntimeState,
  args: {
    surface: QualifyingSurface;
    rootActionId: string;
    unbrokenOwned: boolean;
    downbeatOwned: boolean;
    downbeatSuccess: boolean;
    heldResonanceOwned: boolean;
    ammoType: string | null;
  },
): RitualCadenceRuntimeState {
  const grand = args.surface === 'VERDICT';
  let reason: RitualCadenceRuntimeState['lastPostFinaleReason'] = 'EMPTY';
  let measure: MeasureBeat = 'EMPTY';
  if (grand) {
    measure = 'BEAT_I';
    reason = 'GRAND_CADENCE';
  } else if (args.unbrokenOwned) {
    measure = 'BEAT_I';
    reason = 'UNBROKEN_RITE';
  } else if (args.downbeatOwned && args.downbeatSuccess) {
    measure = 'BEAT_I';
    reason = 'DOWNBEAT';
  }
  const protectedBeat = args.downbeatOwned && args.downbeatSuccess;
  return {
    ...state,
    measure,
    previousSurface: args.surface,
    pendingFinaleRootId: null,
    pendingFinaleSurface: null,
    lastFinaleSurface: args.surface,
    lastFinaleRootId: args.rootActionId,
    lastPostFinaleReason: reason,
    lastOutcome: 'FINALE',
    downbeatProtected: protectedBeat,
    grandFinaleRootId: grand ? args.rootActionId : null,
    heldResonance: args.heldResonanceOwned
      ? { armed: true, ammoType: args.ammoType }
      : state.heldResonance,
  };
}

export function requestClearMeasure(state: RitualCadenceRuntimeState): RitualCadenceRuntimeState {
  if (state.downbeatProtected && state.measure !== 'EMPTY') {
    return { ...state, downbeatProtected: false };
  }
  return { ...state, measure: 'EMPTY', downbeatProtected: false };
}

export function resetEncounterRitualCadence(): RitualCadenceRuntimeState {
  return createDefaultRitualCadenceState();
}

export function resetPlayerTurnRitualCadence(state: RitualCadenceRuntimeState): RitualCadenceRuntimeState {
  return { ...state, improvisedUsedThisTurn: false };
}

export function resetCombatCycleRitualCadence(state: RitualCadenceRuntimeState): RitualCadenceRuntimeState {
  return {
    ...state,
    instinctCommitmentUsedThisCombatCycle: false,
    instinctCommitmentRootId: null,
  };
}

export function hydrateRitualCadenceState(raw: unknown): RitualCadenceRuntimeState {
  const base = createDefaultRitualCadenceState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const measure = row.measure === 'BEAT_I' || row.measure === 'BEAT_II' ? row.measure : 'EMPTY';
  const surface = (value: unknown): QualifyingSurface | null => (
    value === 'ARMAMENT' || value === 'DISCIPLINE' || value === 'INSTINCT' || value === 'VERDICT'
      ? value
      : null
  );
  return {
    ...base,
    measure,
    previousSurface: surface(row.previousSurface),
    pendingFinaleRootId: typeof row.pendingFinaleRootId === 'string' ? row.pendingFinaleRootId : null,
    pendingFinaleSurface: surface(row.pendingFinaleSurface),
    instinctCommitmentUsedThisCombatCycle: row.instinctCommitmentUsedThisCombatCycle === true,
    instinctCommitmentRootId: typeof row.instinctCommitmentRootId === 'string' ? row.instinctCommitmentRootId : null,
    improvisedUsedThisTurn: row.improvisedUsedThisTurn === true,
    heldResonance: {
      armed: Boolean((row.heldResonance as { armed?: boolean } | undefined)?.armed ?? row.heldResonance === true),
      ammoType: typeof (row.heldResonance as { ammoType?: string } | undefined)?.ammoType === 'string'
        ? (row.heldResonance as { ammoType: string }).ammoType
        : null,
    },
    downbeatProtected: row.downbeatProtected === true,
    grandFinaleRootId: typeof row.grandFinaleRootId === 'string' ? row.grandFinaleRootId : null,
    lastFinaleSurface: surface(row.lastFinaleSurface),
    lastFinaleRootId: typeof row.lastFinaleRootId === 'string' ? row.lastFinaleRootId : null,
    lastPostFinaleReason: row.lastPostFinaleReason === 'DOWNBEAT'
      || row.lastPostFinaleReason === 'UNBROKEN_RITE'
      || row.lastPostFinaleReason === 'GRAND_CADENCE'
      || row.lastPostFinaleReason === 'EMPTY'
      ? row.lastPostFinaleReason
      : null,
    lastOutcome: typeof row.lastOutcome === 'string' ? row.lastOutcome as MeasureOutcomeKind : null,
    cooldownAdvanced: row.cooldownAdvanced === true,
  };
}

export function forceAdvance(
  state: RitualCadenceRuntimeState,
  surface: QualifyingSurface,
): { state: RitualCadenceRuntimeState; finale: boolean } {
  const stepped = nextBeat(state.measure);
  if (stepped.finale) {
    return {
      finale: true,
      state: {
        ...state,
        pendingFinaleSurface: surface,
        lastOutcome: 'FINALE',
        previousSurface: surface,
      },
    };
  }
  return {
    finale: false,
    state: {
      ...state,
      measure: stepped.beat,
      previousSurface: surface,
      lastOutcome: 'ADVANCE',
    },
  };
}

export function instinctBonusEligible(grade: InstinctGrade, differentSurface: boolean, alreadyFinale: boolean): boolean {
  if (!differentSurface || alreadyFinale) return false;
  return grade === 'CLEAN' || grade === 'PERFECT';
}
