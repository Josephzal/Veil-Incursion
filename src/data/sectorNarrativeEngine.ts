import type { IncursionNode, IncursionProgressState, NarrativeEventNode } from '../types/game';
import type { EnvironmentType } from '../types/sector';
import { buildMatrixNarrativeNode } from './narrativeEncounterMatrix';
import {
  generateNarrativeEncounter,
  refreshProceduralNarrativeLocks,
  shouldUseProceduralNarrative,
} from './narrative/narrativeProceduralEngine';
import type { ProceduralEligibilityContext } from './narrative/narrativeProceduralEngine';
import type { MacroBiomeFamily, ProceduralNarrativeAssembly } from '../types/narrativeProcedural';

const SECTOR_NARRATIVE_BY_ENVIRONMENT: Record<EnvironmentType, readonly string[]> = {
  SUBWAY_CHASM: ['sector-01', 'sector-03', 'sector-07'],
  BLEEDING_HIGH_RISE: ['sector-02', 'sector-04', 'sector-05'],
  DESECRATED_SANCTUARY: ['sector-02', 'sector-06', 'sector-04'],
};

const OPEN_SECTOR_NARRATIVE_POOL = [
  'sector-01',
  'sector-02',
  'sector-03',
  'sector-04',
  'sector-05',
  'sector-06',
  'sector-07',
] as const;

const LATE_SECTOR_CONDITIONAL_IDS = new Set(['sector-06']);

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function environmentPool(environment: EnvironmentType): readonly string[] {
  return SECTOR_NARRATIVE_BY_ENVIRONMENT[environment] ?? OPEN_SECTOR_NARRATIVE_POOL;
}

function eligiblePool(
  environment: EnvironmentType,
  nodesCleared: number,
): string[] {
  return environmentPool(environment).filter((id) => {
    if (LATE_SECTOR_CONDITIONAL_IDS.has(id) && nodesCleared < 8) return false;
    return true;
  });
}

function pickMatrixId(
  encounterNode: IncursionNode | null,
  progress: IncursionProgressState,
  pool: readonly string[],
): string {
  const unused = pool.filter((id) => !progress.usedNarrativeEventIds.includes(id));
  const candidates = unused.length > 0 ? unused : [...pool];
  const seed = `${encounterNode?.id ?? 'sector'}:${encounterNode?.encounterIndex ?? 0}`;
  return candidates[hashSeed(seed) % candidates.length] ?? candidates[0] ?? 'sector-01';
}

function tagEnvironmentOnNode(
  node: NarrativeEventNode,
  environment: EnvironmentType,
): NarrativeEventNode {
  return { ...node, environmentType: environment };
}

export interface SectorNarrativePickResult {
  node: NarrativeEventNode;
  assembly: ProceduralNarrativeAssembly | null;
}

export function pickSectorNarrativeForNode(
  encounterNode: IncursionNode | null,
  progress: IncursionProgressState,
  nodesCleared = 0,
  eligibility?: ProceduralEligibilityContext,
  macroFamily: MacroBiomeFamily = 'CITY_STREETS',
): SectorNarrativePickResult {
  const environment = encounterNode?.environmentType ?? 'SUBWAY_CHASM';

  if (shouldUseProceduralNarrative(macroFamily) && eligibility) {
    const seed = `${encounterNode?.id ?? 'narrative'}:${nodesCleared}:${encounterNode?.encounterIndex ?? 0}`;
    const usedAssemblyIds = progress.usedNarrativeEventIds.filter((id) => id.startsWith('proc-'));
    const generated = generateNarrativeEncounter(
      {
        macroFamily,
        nodesCleared,
        seed,
        usedAssemblyIds,
        requiredContextTags: encounterNode?.narrativeTags,
      },
      eligibility,
    );
    const node = tagEnvironmentOnNode(generated.node, environment);
    return { node, assembly: generated.assembly };
  }

  const pool = eligiblePool(environment, nodesCleared);
  const matrixId = pickMatrixId(encounterNode, progress, pool.length > 0 ? pool : OPEN_SECTOR_NARRATIVE_POOL);
  const node = buildMatrixNarrativeNode(matrixId, progress);
  return { node: tagEnvironmentOnNode(node, environment), assembly: null };
}

export function enrichProceduralNarrativeNode(
  node: NarrativeEventNode,
  assembly: ProceduralNarrativeAssembly | null,
  eligibility: ProceduralEligibilityContext,
): NarrativeEventNode {
  if (!assembly || node.interactionMode !== 'procedural') return node;
  return refreshProceduralNarrativeLocks(node, assembly, eligibility);
}

export function isOpenSectorNarrative(node: NarrativeEventNode): boolean {
  const eventId = node.matrixEventId ?? node.id;
  return eventId.startsWith('sector-');
}

export function isProceduralNarrative(node: NarrativeEventNode): boolean {
  return node.interactionMode === 'procedural';
}
