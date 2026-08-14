export type MeasureBeat = 'EMPTY' | 'BEAT_I' | 'BEAT_II';

export type QualifyingSurface = 'ARMAMENT' | 'DISCIPLINE' | 'INSTINCT' | 'VERDICT';

export type MeasureOutcomeKind = 'ADVANCE' | 'RESTART' | 'HOLD' | 'FINALE' | 'IGNORE';

export const RITUAL_CADENCE_CORE_IDS = {
  CLOSING_STRIKE: 'RC_CORE_CLOSING_STRIKE',
  MEASURED_INVOCATION: 'RC_CORE_MEASURED_INVOCATION',
  SYNCOPATED_REFLEX: 'RC_CORE_SYNCOPATED_REFLEX',
  HELD_RESONANCE: 'RC_CORE_HELD_RESONANCE',
} as const;

export const RITUAL_CADENCE_SUPPORT_IDS = {
  IMPROVISED_MEASURE: 'RC_SUPPORT_IMPROVISED_MEASURE',
  DOWNBEAT: 'RC_SUPPORT_DOWNBEAT',
} as const;

export const RITUAL_CADENCE_MANIFESTATION_ID = 'RC_MANIFESTATION_UNBROKEN_RITE';
export const RITUAL_CADENCE_VERDICT_ID = 'RC_VERDICT_GRAND_CADENCE';

export interface HeldResonanceCharge {
  armed: boolean;
  ammoType: string | null;
}

export interface RitualCadenceRuntimeState {
  measure: MeasureBeat;
  previousSurface: QualifyingSurface | null;
  pendingFinaleRootId: string | null;
  pendingFinaleSurface: QualifyingSurface | null;
  instinctCommitmentUsedThisCombatCycle: boolean;
  instinctCommitmentRootId: string | null;
  improvisedUsedThisTurn: boolean;
  heldResonance: HeldResonanceCharge;
  downbeatProtected: boolean;
  grandFinaleRootId: string | null;
  lastFinaleSurface: QualifyingSurface | null;
  lastFinaleRootId: string | null;
  lastPostFinaleReason: 'EMPTY' | 'DOWNBEAT' | 'UNBROKEN_RITE' | 'GRAND_CADENCE' | null;
  lastOutcome: MeasureOutcomeKind | null;
  cooldownAdvanced: boolean;
}

export interface MeasurePreview {
  surface: QualifyingSurface | null;
  outcome: MeasureOutcomeKind;
  from: MeasureBeat;
  to: MeasureBeat;
  finale: boolean;
  grandFinale: boolean;
  held: boolean;
  closingStrikeBonusPct: number;
  measuredInvocationAp: { authored: number; paid: number } | null;
  heldResonancePreview: number;
  improvisedAvailable: boolean;
}

export interface DownbeatEvidence {
  killed: boolean;
  kineticArmorBroken: boolean;
  occultWardBroken: boolean;
  intentCountered: boolean;
  bossThreshold: boolean;
  objectiveProgress: boolean;
}
