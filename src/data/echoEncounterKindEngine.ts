import type { EchoEncounterKind } from '../types/echoEncounter';
import type { ProceduralNodeType } from '../types/proceduralRunTree';
import type { NodeContextModifiers, RunGenerationContext } from '../types/worldState';
import { seededRandom } from './encounterGenerator';

interface EchoKindWeight {
  kind: EchoEncounterKind;
  weight: number;
}

function boostKind(
  weights: EchoKindWeight[],
  kind: EchoEncounterKind,
  multiplier: number,
): EchoKindWeight[] {
  return weights.map((entry) => (
    entry.kind === kind
      ? { ...entry, weight: entry.weight * multiplier }
      : entry
  ));
}

function baseWeightsForDepth(depthIndex: 1 | 2 | 3): EchoKindWeight[] {
  if (depthIndex === 1) {
    return [
      { kind: 'FALLEN_RUNNER_ECHO', weight: 40 },
      { kind: 'CARGO_ECHO', weight: 35 },
      { kind: 'ASSIST_ECHO', weight: 15 },
      { kind: 'HOSTILE_ECHO', weight: 8 },
      { kind: 'EXTRACTION_ECHO', weight: 2 },
    ];
  }
  if (depthIndex === 2) {
    return [
      { kind: 'FALLEN_RUNNER_ECHO', weight: 25 },
      { kind: 'CARGO_ECHO', weight: 25 },
      { kind: 'HOSTILE_ECHO', weight: 25 },
      { kind: 'ASSIST_ECHO', weight: 10 },
      { kind: 'EXTRACTION_ECHO', weight: 15 },
    ];
  }
  return [
    { kind: 'HOSTILE_ECHO', weight: 35 },
    { kind: 'FALLEN_RUNNER_ECHO', weight: 25 },
    { kind: 'CARGO_ECHO', weight: 25 },
    { kind: 'EXTRACTION_ECHO', weight: 12 },
    { kind: 'ASSIST_ECHO', weight: 3 },
  ];
}

export function buildEchoEncounterKindWeights(
  depthIndex: 1 | 2 | 3,
  nodeType: ProceduralNodeType,
  runContext: RunGenerationContext,
  _modifiers: NodeContextModifiers,
): EchoKindWeight[] {
  let weights = baseWeightsForDepth(depthIndex);
  const anchorType = runContext.activeAnchor?.type ?? null;
  const isEchoRecovery = runContext.activeOperation.objectiveKind === 'ECHO_RECOVERY';

  if (isEchoRecovery) {
    weights = boostKind(weights, 'FALLEN_RUNNER_ECHO', 1.4);
    weights = boostKind(weights, 'HOSTILE_ECHO', 1.35);
    weights = boostKind(weights, 'CARGO_ECHO', 1.35);
  }

  switch (anchorType) {
    case 'CHOIR_SPIRE':
      weights = boostKind(weights, 'FALLEN_RUNNER_ECHO', 1.3);
      weights = boostKind(weights, 'HOSTILE_ECHO', 1.2);
      break;
    case 'NULL_MONOLITH':
      weights = boostKind(weights, 'FALLEN_RUNNER_ECHO', 1.25);
      break;
    case 'LEY_NEXUS':
      weights = boostKind(weights, 'CARGO_ECHO', 1.4);
      break;
    case 'ASHEN_HEART':
      if (depthIndex >= 2) {
        weights = boostKind(weights, 'HOSTILE_ECHO', 1.35);
      }
      break;
    case 'RIFT_ENGINE':
      weights = boostKind(weights, 'EXTRACTION_ECHO', 1.2);
      weights = boostKind(weights, 'HOSTILE_ECHO', 1.1);
      break;
    default:
      break;
  }

  if (nodeType === 'RESOURCE') {
    weights = boostKind(weights, 'CARGO_ECHO', 1.35);
  }
  if (nodeType === 'EXTRACTION') {
    weights = boostKind(weights, 'EXTRACTION_ECHO', 1.5);
  }
  if (nodeType === 'ELITE' || nodeType === 'COMBAT') {
    weights = boostKind(weights, 'HOSTILE_ECHO', 1.15);
  }

  return weights;
}

export function pickEchoEncounterKind(
  weights: readonly EchoKindWeight[],
  seed: string,
): EchoEncounterKind {
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return 'FALLEN_RUNNER_ECHO';

  const rand = seededRandom(`echo-kind:${seed}`)() * total;
  let cursor = 0;
  for (const entry of weights) {
    cursor += entry.weight;
    if (rand <= cursor) return entry.kind;
  }
  return weights[weights.length - 1]?.kind ?? 'FALLEN_RUNNER_ECHO';
}
