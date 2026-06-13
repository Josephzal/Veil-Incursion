import type { IncursionNode, IncursionProgressState, NarrativeEventNode } from '../types/game';
import { buildMatrixNarrativeNode } from './narrativeEncounterMatrix';
import {
  refreshProceduralNarrativeLocks,
  shouldUseProceduralNarrative,
} from './narrative/narrativeProceduralEngine';
import type { ProceduralEligibilityContext } from './narrative/narrativeProceduralEngine';
import {
  pickAssemblyNarrativeEncounter,
  refreshAssemblyNarrativeLocks,
} from './narrative/narrativeAssemblyBridge';
import type { MacroBiomeFamily, ProceduralNarrativeAssembly } from '../types/narrativeProcedural';

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

function eligiblePool(nodesCleared: number): string[] {
  return OPEN_SECTOR_NARRATIVE_POOL.filter((id) => {
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
  if (shouldUseProceduralNarrative(macroFamily) && eligibility) {
    const seed = `${encounterNode?.id ?? 'narrative'}:${nodesCleared}:${encounterNode?.encounterIndex ?? 0}`;
    const usedAssemblyIds = progress.usedNarrativeEventIds.filter(
      (id) => id.startsWith('proc-') || id.startsWith('asm-'),
    );
    const generated = pickAssemblyNarrativeEncounter(
      {
        macroFamily,
        nodesCleared,
        seed,
        usedAssemblyIds,
        requiredContextTags: encounterNode?.narrativeTags,
      },
      eligibility,
    );
    return { node: generated.node, assembly: generated.assembly };
  }

  const pool = eligiblePool(nodesCleared);
  const matrixId = pickMatrixId(encounterNode, progress, pool.length > 0 ? pool : OPEN_SECTOR_NARRATIVE_POOL);
  const node = buildMatrixNarrativeNode(matrixId, progress);
  return { node, assembly: null };
}

export function enrichProceduralNarrativeNode(
  node: NarrativeEventNode,
  assembly: ProceduralNarrativeAssembly | null,
  eligibility: ProceduralEligibilityContext,
): NarrativeEventNode {
  if (!assembly || node.interactionMode !== 'procedural') return node;
  if (assembly.engineVersion === 'assembly-v1') {
    return refreshAssemblyNarrativeLocks(node, assembly, eligibility);
  }
  return refreshProceduralNarrativeLocks(node, assembly, eligibility);
}

export function isOpenSectorNarrative(node: NarrativeEventNode): boolean {
  const eventId = node.matrixEventId ?? node.id;
  return eventId.startsWith('sector-');
}

export function isProceduralNarrative(node: NarrativeEventNode): boolean {
  return node.interactionMode === 'procedural';
}
