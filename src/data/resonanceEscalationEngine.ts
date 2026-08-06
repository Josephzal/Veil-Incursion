import type { SectorGraph, SectorGraphNode } from '../types/sector';
import {
  RESONANCE_TIER_CRITICAL,
  RESONANCE_TIER_VECTOR_SEVERED,
  TERMINAL_BLIND_NODE_COUNT,
} from '../types/sector';
import type { ResonanceEscalationState } from '../types/resonanceEscalation';
import { createDefaultResonanceEscalationState } from '../types/resonanceEscalation';

export interface EscalationTickResult {
  escalations: ResonanceEscalationState;
  logLines: string[];
}

function pickRelayExtractionNode(
  graph: SectorGraph,
  currentNodeId: string,
): SectorGraphNode | null {
  const current = graph.nodes[currentNodeId];
  if (!current) return null;

  const candidates = Object.values(graph.nodes)
    .filter(
      (node) =>
        !node.isCompleted
        && node.graphDepth > current.graphDepth
        && !node.isAnomalyNest
        && node.type !== 'BOSS_COMBAT',
    )
    .sort((a, b) => b.graphDepth - a.graphDepth);

  return candidates[0] ?? null;
}

/** Apply tier-crossing escalations when resonance rises after vector engage. */
export function applyResonanceEscalationsOnSpike(
  prevPercent: number,
  nextPercent: number,
  escalations: ResonanceEscalationState,
  graph: SectorGraph,
  currentNodeId: string,
): EscalationTickResult {
  let next = { ...escalations };
  const logLines: string[] = [];

  if (
    prevPercent < RESONANCE_TIER_CRITICAL
    && nextPercent >= RESONANCE_TIER_CRITICAL
  ) {
    next.terminalBlindNodesRemaining = TERMINAL_BLIND_NODE_COUNT;
    logLines.push('>> TERMINAL_BLIND — scanner feed corrupted for next 2 nodes. Focus disabled.');
  }

  if (
    prevPercent < RESONANCE_TIER_VECTOR_SEVERED
    && nextPercent >= RESONANCE_TIER_VECTOR_SEVERED
    && !next.vectorSeveredTriggered
  ) {
    const relay = pickRelayExtractionNode(graph, currentNodeId);
    if (relay) {
      next = {
        ...next,
        vectorSeveredTriggered: true,
        extractionDecoyPending: true,
        relayExtractionNodeId: relay.id,
      };
      logLines.push('>> VECTOR_SEVERED — extraction conduit hostile. Relay tagged deeper in sector graph.');
    }
  }

  return { escalations: next, logLines };
}

/** Decrement terminal-blind counter when a new scanner session opens after node clear. */
export function tickTerminalBlindOnScannerSession(
  escalations: ResonanceEscalationState,
): ResonanceEscalationState {
  if (escalations.terminalBlindNodesRemaining <= 0) return escalations;
  return {
    ...escalations,
    terminalBlindNodesRemaining: escalations.terminalBlindNodesRemaining - 1,
  };
}

export function isTerminalBlindActive(escalations: ResonanceEscalationState): boolean {
  return escalations.terminalBlindNodesRemaining > 0;
}

export function consumeExtractionDecoy(
  escalations: ResonanceEscalationState,
): ResonanceEscalationState {
  if (!escalations.extractionDecoyPending) return escalations;
  return { ...escalations, extractionDecoyPending: false };
}

export function resetResonanceEscalations(): ResonanceEscalationState {
  return createDefaultResonanceEscalationState();
}
