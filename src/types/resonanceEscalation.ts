export interface ResonanceEscalationState {
  /** Next N scanner sessions force corrupted readout and breach-blind only. */
  terminalBlindNodesRemaining: number;
  /** Extraction conduit was severed — emergency link may be a hostile decoy. */
  vectorSeveredTriggered: boolean;
  /** Next emergency extraction vector in cluster is an elite ambush trap. */
  extractionDecoyPending: boolean;
  /** Graph node id tagged as the relocated extraction relay. */
  relayExtractionNodeId: string | null;
  /** Veil Stalker is hunting the operative through sanctuary and market nodes. */
  veilStalkerHuntActive: boolean;
}

export function createDefaultResonanceEscalationState(): ResonanceEscalationState {
  return {
    terminalBlindNodesRemaining: 0,
    vectorSeveredTriggered: false,
    extractionDecoyPending: false,
    relayExtractionNodeId: null,
    veilStalkerHuntActive: false,
  };
}
