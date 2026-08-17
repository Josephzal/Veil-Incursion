import type { StrainId } from './nineStrain';

export const CONVERGENCE_IDS = {
  FATED_REFRAIN: 'CV_FATED_REFRAIN',
  SECOND_OUTCOME: 'CV_SECOND_OUTCOME',
  ECHOED_RITE: 'CV_ECHOED_RITE',
  STAYED_SENTENCE: 'CV_STAYED_SENTENCE',
  MEASURED_SILENCE: 'CV_MEASURED_SILENCE',
  SUSPENDED_ECHO: 'CV_SUSPENDED_ECHO',
  ENTANGLED_FATE: 'CV_ENTANGLED_FATE',
  TWOFOLD_RITE: 'CV_TWOFOLD_RITE',
  GHOST_THREAD: 'CV_GHOST_THREAD',
  DRAWN_TENSION: 'CV_DRAWN_TENSION',
} as const;

export const SECTOR_1_STRAIN_IDS: readonly StrainId[] = [
  'COUNTERFATE',
  'RITUAL_CADENCE',
  'AFTERIMAGE',
];

export const SECTOR_2_STRAIN_IDS: readonly StrainId[] = [
  'STILLPOINT',
  'WOUNDWEAVE',
];

export const SECTOR_3_STRAIN_IDS: readonly StrainId[] = [
  'FAULTLINE',
  'SOULWAKE',
];

export const SECTOR_2_CONVERGENCE_IDS = [
  CONVERGENCE_IDS.STAYED_SENTENCE,
  CONVERGENCE_IDS.MEASURED_SILENCE,
  CONVERGENCE_IDS.SUSPENDED_ECHO,
  CONVERGENCE_IDS.ENTANGLED_FATE,
  CONVERGENCE_IDS.TWOFOLD_RITE,
  CONVERGENCE_IDS.GHOST_THREAD,
  CONVERGENCE_IDS.DRAWN_TENSION,
] as const;

export interface EchoedRiteEmpowerment {
  sourceFinaleRootId: string | null;
  armedPlayerTurn: number;
  expireOnPlayerTurnIndex: number;
}

export interface GhostThreadCapture {
  traceId: string;
  linkGeneration: number;
  endpointA: string | null;
  endpointB: string | null;
  selfLink: boolean;
  portions: readonly { originalTargetId: string; partnerId: string; amount: number }[];
}

export interface SuspendedEchoLineage {
  traceId: string;
  sourceCycle: number;
  chargeSource: 'NATIVE' | 'FLEETING' | 'STORM_FREE' | 'STAYED_SENTENCE_FREE';
  restored: boolean;
}

export interface Sector1ConvergenceRuntimeState {
  fatedRefrainStoreUsedThisCombatCycle: boolean;
  fatedRefrainBeatIiUsedThisCombatCycle: boolean;
  pendingBeatII: boolean;
  secondOutcomeStoreUsedThisCombatCycle: boolean;
  echoedMeasureUsedThisPlayerTurn: boolean;
  echoedEmpowerment: EchoedRiteEmpowerment | null;
  stayedSentenceNativeUsedThisCombatCycle: boolean;
  stayedSentenceInstinctUsedThisEnemyCycle: boolean;
  measuredSilenceAdvanceUsedThisPlayerTurn: boolean;
  measuredSilenceRetainUsedThisPlayerTurn: boolean;
  suspendedEchoUsedThisCombatCycle: boolean;
  suspendedEchoLineages: readonly SuspendedEchoLineage[];
  entangledFateStoredRootId: string | null;
  twofoldFormationUsedThisPlayerTurn: boolean;
  twofoldEmpowerment: { sourceFinaleRootId: string; armed: boolean } | null;
  ghostThreadUsedThisPlayerTurn: boolean;
  ghostThreadCapture: GhostThreadCapture | null;
  drawnTensionFleetingUsedThisPlayerTurn: boolean;
}

export type NineStrainRewardKind =
  | 'FIRST_OMEN_STRAIN'
  | 'CONTACT'
  | 'ELITE_CONTACT'
  | 'BOSS_PREMIUM';

export interface PendingNineStrainOffer {
  kind: NineStrainRewardKind;
  sourceId: string;
  nodeId: string;
  depth: number;
  strainId: StrainId | null;
  cardIds: readonly string[];
  seed: string;
  rngCursor: number;
  replacementPreview: Readonly<Record<string, string>>;
  failClosedDiagnostic: string | null;
}

export interface NineStrainAcquisitionState {
  firstOmenClaimed: boolean;
  firstOmenPending: boolean;
  combatVictories: number;
  guaranteedContactClaimedByDepth: Partial<Record<1 | 2 | 3, boolean>>;
  consumedRewardSourceIds: string[];
  pendingOffer: PendingNineStrainOffer | null;
  acceptedSelectionCount: number;
  lastFailClosedDiagnostic: string | null;
}
