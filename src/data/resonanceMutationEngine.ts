import type { ActiveIncursionState } from '../types/game';
import type { SectorGraph } from '../types/sector';
import type { ResonanceEscalationState } from '../types/resonanceEscalation';
import type { PatrolState } from '../types/overworldPatrol';
import { applyResonanceEscalationsOnSpike } from './resonanceEscalationEngine';
import { applyVectorSeveredToGraph } from './sectorGraphEngine';
import { clampResonanceDelta } from './resonanceHeatVentEngine';
import { resolvePatrolState } from './patrolSpawnEngine';
import { shouldSpawnGridHound } from './overworldFeatureEngine';

export interface ResonanceMutationPatch {
  resonancePercent: number;
  resonanceEscalations: ResonanceEscalationState;
  sectorGraph: SectorGraph;
  patrolState: PatrolState;
  escalationLogLines: string[];
  spawnGridHound?: boolean;
}

export function buildResonanceMutationPatch(
  inc: ActiveIncursionState,
  delta: number,
  patrolSeed: number,
): ResonanceMutationPatch {
  const prevPercent = inc.resonance.percent;
  const nextPercent = clampResonanceDelta(prevPercent, delta, inc.collapseActive);

  const escalationTick = applyResonanceEscalationsOnSpike(
    prevPercent,
    nextPercent,
    inc.resonanceEscalations,
    inc.sectorGraph,
    inc.currentNodeId,
  );

  let sectorGraph = inc.sectorGraph;
  if (
    escalationTick.escalations.vectorSeveredTriggered
    && escalationTick.escalations.relayExtractionNodeId
    && !inc.resonanceEscalations.vectorSeveredTriggered
  ) {
    sectorGraph = applyVectorSeveredToGraph(
      sectorGraph,
      escalationTick.escalations.relayExtractionNodeId,
    );
  }

  const patrolState = resolvePatrolState(
    nextPercent,
    inc.currentDistrict,
    patrolSeed,
  );

  const spawnGridHound = shouldSpawnGridHound(prevPercent, nextPercent)
    && !inc.overworldSession.gridHound?.active;

  return {
    resonancePercent: nextPercent,
    resonanceEscalations: escalationTick.escalations,
    sectorGraph,
    patrolState,
    escalationLogLines: escalationTick.logLines,
    spawnGridHound,
  };
}

export function buildPatrolStatePatch(
  inc: ActiveIncursionState,
  patrolSeed: number,
): PatrolState {
  return resolvePatrolState(
    inc.resonance.percent,
    inc.currentDistrict,
    patrolSeed,
  );
}
