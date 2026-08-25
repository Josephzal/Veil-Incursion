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
  BROKEN_OUTCOME: 'CV_BROKEN_OUTCOME',
  BREAKING_MEASURE: 'CV_BREAKING_MEASURE',
  ECHOED_FAULT: 'CV_ECHOED_FAULT',
  CRITICAL_PRESSURE: 'CV_CRITICAL_PRESSURE',
  SPLIT_SEAM: 'CV_SPLIT_SEAM',
  PAIN_FORETOLD: 'CV_PAIN_FORETOLD',
  PULSE_RITE: 'CV_PULSE_RITE',
  PHANTOM_PAIN: 'CV_PHANTOM_PAIN',
  HELD_BREATH: 'CV_HELD_BREATH',
  SYMPATHETIC_WOUND: 'CV_SYMPATHETIC_WOUND',
  LIVING_FAULT: 'CV_LIVING_FAULT',
  FATE_OUT_OF_PLACE: 'CV_FATE_OUT_OF_PLACE',
  TURNING_RITE: 'CV_TURNING_RITE',
  PARALLAX_ECHO: 'CV_PARALLAX_ECHO',
  STORED_VECTOR: 'CV_STORED_VECTOR',
  TETHERED_ORBIT: 'CV_TETHERED_ORBIT',
  TECTONIC_SHIFT: 'CV_TECTONIC_SHIFT',
  TRAUMA_VECTOR: 'CV_TRAUMA_VECTOR',
  FATED_FACET: 'CV_FATED_FACET',
  PRISMATIC_RITE: 'CV_PRISMATIC_RITE',
  PHANTOM_FACET: 'CV_PHANTOM_FACET',
  STILLGLASS: 'CV_STILLGLASS',
  CRYSTAL_LIGATURE: 'CV_CRYSTAL_LIGATURE',
  FAULTGLASS: 'CV_FAULTGLASS',
  SOULGLASS: 'CV_SOULGLASS',
  IMPACT_LATTICE: 'CV_IMPACT_LATTICE',
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

export const SECTOR_3_CONVERGENCE_IDS = [
  CONVERGENCE_IDS.BROKEN_OUTCOME,
  CONVERGENCE_IDS.BREAKING_MEASURE,
  CONVERGENCE_IDS.ECHOED_FAULT,
  CONVERGENCE_IDS.CRITICAL_PRESSURE,
  CONVERGENCE_IDS.SPLIT_SEAM,
  CONVERGENCE_IDS.PAIN_FORETOLD,
  CONVERGENCE_IDS.PULSE_RITE,
  CONVERGENCE_IDS.PHANTOM_PAIN,
  CONVERGENCE_IDS.HELD_BREATH,
  CONVERGENCE_IDS.SYMPATHETIC_WOUND,
  CONVERGENCE_IDS.LIVING_FAULT,
] as const;

/** Sector 4 pairs every Gravemark and Shardskin Core against the other eight Strains. */
export const SECTOR_4_STRAIN_IDS: readonly StrainId[] = [
  'GRAVEMARK',
  'SHARDSKIN',
];

export const SECTOR_4_CONVERGENCE_IDS = [
  CONVERGENCE_IDS.FATE_OUT_OF_PLACE,
  CONVERGENCE_IDS.TURNING_RITE,
  CONVERGENCE_IDS.PARALLAX_ECHO,
  CONVERGENCE_IDS.STORED_VECTOR,
  CONVERGENCE_IDS.TETHERED_ORBIT,
  CONVERGENCE_IDS.TECTONIC_SHIFT,
  CONVERGENCE_IDS.TRAUMA_VECTOR,
  CONVERGENCE_IDS.FATED_FACET,
  CONVERGENCE_IDS.PRISMATIC_RITE,
  CONVERGENCE_IDS.PHANTOM_FACET,
  CONVERGENCE_IDS.STILLGLASS,
  CONVERGENCE_IDS.CRYSTAL_LIGATURE,
  CONVERGENCE_IDS.FAULTGLASS,
  CONVERGENCE_IDS.SOULGLASS,
  CONVERGENCE_IDS.IMPACT_LATTICE,
] as const;

export interface EchoedFaultEmpowerment {
  targetId: string;
  armedAfterTraceId: string | null;
}

export interface PhantomPainTraceMeta {
  traceId: string;
  wakeValueAtCommit: number;
  wakeGenerationId: number;
  sourceRootId: string;
  restored: boolean;
}

export interface Sector3ConvergenceRuntimeState {
  brokenOutcomeWindowKey: string | null;
  brokenOutcomeStoredThisWindow: boolean;
  brokenOutcomeReleaseLineageId: string | null;
  brokenOutcomeReleaseFaultApplied: boolean;
  breakingMeasureDeferredBeat: boolean;
  breakingMeasureRuptureAdvancedThisPlayerTurn: boolean;
  echoedFaultTraceTargetsThisPlayerTurn: readonly string[];
  echoedFaultEmpowerments: readonly EchoedFaultEmpowerment[];
  criticalPressureRestoreUsedThisPlayerTurn: boolean;
  splitSeamTransferRootId: string | null;
  splitSeamExtensionThroughPlayerTurn: number | null;
  painForetoldWakeStoreUsedThisPlayerTurn: boolean;
  painForetoldHostileRootIds: readonly string[];
  pulseRiteOverdrawUsedThisPlayerTurn: boolean;
  pulseRiteFinaleCarryUsedThisPlayerTurn: boolean;
  phantomPainMintUsedThisPlayerTurn: boolean;
  phantomPainTraces: readonly PhantomPainTraceMeta[];
  heldBreathOverdrawUsedThisPlayerTurn: boolean;
  heldBreathEndTurnCarryUsedThisPlayerTurn: boolean;
  sympatheticWoundPacketUsedThisPlayerTurn: boolean;
  sympatheticWoundCarryUsedThisPlayerTurn: boolean;
  livingFaultApplyUsedThisPlayerTurn: boolean;
  livingFaultCarryUsedThisPlayerTurn: boolean;
}

export interface Sector4ConvergenceRuntimeState {
  // Fate Out of Place (Counterfate x Gravemark)
  fateOutOfPlaceStoreEventId: string | null;
  fateOutOfPlaceReleaseBonusUsedThisEnemyCycle: boolean;
  // Turning Rite (Ritual Cadence x Gravemark)
  turningRiteAdvanceUsedThisPlayerTurn: boolean;
  turningRiteDeferredBeat: boolean;
  turningRiteFinaleBonusAppliedRootId: string | null;
  // Parallax Echo (Afterimage x Gravemark)
  parallaxEchoMovementUsedThisPlayerTurn: boolean;
  parallaxEchoArmUsedThisPlayerTurn: boolean;
  parallaxEchoArmed: boolean;
  // Stored Vector (Stillpoint x Gravemark)
  storedVectorProcessedRootId: string | null;
  // Tethered Orbit (Woundweave x Gravemark)
  tetheredOrbitArmedPartnerId: string | null;
  tetheredOrbitArmedAfterRootId: string | null;
  tetheredOrbitBonusUsedThisPlayerTurn: boolean;
  // Tectonic Shift (Faultline x Gravemark)
  tectonicShiftFaultAppliedTargetIds: readonly string[];
  tectonicShiftRuptureBonusUsedThisCombatCycle: boolean;
  // Trauma Vector (Soulwake x Gravemark)
  traumaVectorUsedThisCombatCycle: boolean;
  // Fated Facet (Counterfate x Shardskin)
  fatedFacetThresholdWindowKey: string | null;
  fatedFacetThresholdCrossedThisWindow: boolean;
  fatedFacetAbsorptionLineageId: string | null;
  fatedFacetAbsorptionStoredThisLineage: number;
  // Prismatic Rite (Ritual Cadence x Shardskin)
  prismaticRiteFinaleShardsRootId: string | null;
  prismaticRiteDeferredBeat: boolean;
  prismaticRiteCathedralPendingRootId: string | null;
  // Phantom Facet (Afterimage x Shardskin)
  phantomFacetGenerationUsedThisPlayerTurn: boolean;
  phantomFacetArmed: boolean;
  phantomFacetArmedRootId: string | null;
  // Stillglass (Stillpoint x Shardskin)
  stillglassAbsorptionArmedThisEnemyCycle: boolean;
  stillglassPendingFleeting: boolean;
  // Crystal Ligature (Woundweave x Shardskin)
  crystalLigatureFormationUsedThisPlayerTurn: boolean;
  // Faultglass (Faultline x Shardskin)
  faultglassRuptureUsedThisPlayerTurn: boolean;
  // Soulglass (Soulwake x Shardskin)
  soulglassGenerationUsedThisPlayerTurn: boolean;
  // Impact Lattice (Gravemark x Shardskin)
  impactLatticeGenerationUsedThisCombatCycle: boolean;
}

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
  sector3: Sector3ConvergenceRuntimeState;
  sector4: Sector4ConvergenceRuntimeState;
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
