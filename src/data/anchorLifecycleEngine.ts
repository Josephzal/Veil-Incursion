import type {
  DormantAnchorRecord,
  ProceduralAnchorInstance,
  SectorAnchorState,
} from '../types/anchorProcedural';
import type { AnchorInstanceModifier } from '../types/anchorProcedural';
import type { SectorId, VeilAnchorType, WorldStatePersistedState } from '../types/worldState';
import { getAnchorRealityRules } from './anchorRegistry';
import {
  buildAnchorDescription,
  generateProceduralAnchorInstance,
  hashAnchorDisplayName,
  recordAnchorRotationInMemory,
  resolveAnchorOperationBias,
  resolveAnchorResourceIds,
  resolveAnchorScannerBias,
} from './anchorProceduralEngine';
import { ANCHOR_TYPE_ENCOUNTER_BIAS, ANCHOR_TYPE_PRESSURE_TAGS } from './anchorTypeMetadata';
import { getSectorAnchorPool } from './anchorSectorPools';
import {
  anchorIdForSector,
  getSectorWorldTemplate,
  SECTOR_WORLD_TEMPLATES,
} from './sectorWorldCatalog';

export function createMigratedAnchorInstance(
  sectorId: SectorId,
  deployRunIndex: number,
): ProceduralAnchorInstance | null {
  const template = getSectorWorldTemplate(sectorId);
  if (!template.anchor) return null;

  const { type, displayName } = template.anchor;
  const generationSeed = `migrate:${sectorId}:${type}`;
  const encounterBias = ANCHOR_TYPE_ENCOUNTER_BIAS[type];
  return {
    id: anchorIdForSector(sectorId, type),
    sectorId,
    type,
    displayName,
    baseDisplayName: displayName,
    modifier: null,
    generationSeed,
    createdAtRunIndex: deployRunIndex,
    lifecycleState: 'ACTIVE',
    pressureLevel: 2,
    resourceBias: resolveAnchorResourceIds(type, sectorId, template.resourceFocus),
    pressureTags: [...ANCHOR_TYPE_PRESSURE_TAGS[type]],
    operationBias: resolveAnchorOperationBias(type, null),
    scannerBias: resolveAnchorScannerBias(type, null),
    encounterBias: {
      favoredModifiers: { ...encounterBias.favoredModifiers },
      twistedTemplateWeights: { ...encounterBias.twistedTemplateWeights },
    },
    titleFlavorTags: [type.toLowerCase()],
    recentMemoryKey: hashAnchorDisplayName(displayName),
  };
}

export function createEmptySectorAnchorState(
  sectorId: SectorId,
  deployRunIndex: number,
): SectorAnchorState | null {
  const instance = createMigratedAnchorInstance(sectorId, deployRunIndex);
  if (!instance) return null;
  return {
    activeAnchorInstance: instance,
    recentAnchorTypes: [],
    recentAnchorModifiers: [],
    recentDisplayNameHashes: [],
    dormantAnchors: [],
    anchorRotationIndex: 0,
    lastRotatedRunIndex: deployRunIndex,
  };
}

function migrateDormantFromLegacy(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
): DormantAnchorRecord[] {
  const template = getSectorWorldTemplate(sectorId);
  if (!template.anchor) return [];

  const legacyId = anchorIdForSector(sectorId, template.anchor.type);
  const runs = persisted.dormantAnchorRuns[legacyId] ?? 0;
  if (runs <= 0) return [];

  return [{
    type: template.anchor.type,
    displayName: template.anchor.displayName,
    instanceId: legacyId,
    remainingRuns: runs,
    suppressedAtRunIndex: persisted.deployRunIndex,
  }];
}

export function ensureSectorAnchorState(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): { persisted: WorldStatePersistedState; state: SectorAnchorState | null } {
  const existing = persisted.anchorStateBySector?.[sectorId];
  if (existing?.activeAnchorInstance) {
    return { persisted, state: existing };
  }

  const empty = createEmptySectorAnchorState(sectorId, persisted.deployRunIndex);
  if (!empty) return { persisted, state: null };

  const dormantAnchors = migrateDormantFromLegacy(sectorId, persisted);
  const state: SectorAnchorState = {
    ...empty,
    dormantAnchors: dormantAnchors.length > 0 ? dormantAnchors : empty.dormantAnchors,
  };

  const anchorStateBySector = {
    ...persisted.anchorStateBySector,
    [sectorId]: state,
  };

  return {
    persisted: { ...persisted, anchorStateBySector },
    state,
  };
}

export function ensureAllSectorAnchorStates(
  persisted: WorldStatePersistedState,
): WorldStatePersistedState {
  let next = persisted;
  for (const sector of SECTOR_WORLD_TEMPLATES) {
    const result = ensureSectorAnchorState(next, sector.id);
    next = result.persisted;
  }
  return next;
}

export function getSectorAnchorState(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): SectorAnchorState | null {
  const { state } = ensureSectorAnchorState(persisted, sectorId);
  return state;
}

export function getActiveAnchorInstance(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): ProceduralAnchorInstance | null {
  const state = getSectorAnchorState(persisted, sectorId);
  if (!state) return null;
  if (state.activeAnchorInstance.lifecycleState !== 'ACTIVE') return null;
  return state.activeAnchorInstance;
}

export function isAnchorTypeDormant(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  anchorType: VeilAnchorType,
): boolean {
  const state = getSectorAnchorState(persisted, sectorId);
  if (!state) return false;
  return state.dormantAnchors.some(
    (d) => d.type === anchorType && d.remainingRuns > 0,
  );
}

export function getRecentlySuppressedAnchor(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): DormantAnchorRecord | null {
  const state = getSectorAnchorState(persisted, sectorId);
  if (!state) return null;
  return state.dormantAnchors.find((d) => d.remainingRuns > 0) ?? null;
}

function buildGenerationContext(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  state: SectorAnchorState,
  seedSuffix: string,
) {
  const template = getSectorWorldTemplate(sectorId);
  return {
    seed: `anchor-v2:${sectorId}:${persisted.deployRunIndex}:${state.anchorRotationIndex + 1}:${seedSuffix}`,
    deployRunIndex: persisted.deployRunIndex,
    sectorId,
    sectorDisplayName: template.displayName,
    anchorPool: getSectorAnchorPool(sectorId),
    recentAnchorTypes: state.recentAnchorTypes,
    recentAnchorModifiers: state.recentAnchorModifiers,
    recentDisplayNameHashes: state.recentDisplayNameHashes,
    dormantAnchors: state.dormantAnchors,
    rotationIndex: state.anchorRotationIndex + 1,
    sectorResourceFocus: template.resourceFocus,
    hazardLevel: template.hazardLevel,
    rewardLevel: template.rewardLevel,
    echoActivity: template.echoActivity,
  };
}

export function rotateAnchorForSector(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  reason: string,
  options?: {
    forceType?: VeilAnchorType;
    forceModifier?: AnchorInstanceModifier | null;
  },
): WorldStatePersistedState {
  const { persisted: withState, state } = ensureSectorAnchorState(persisted, sectorId);
  if (!state) return withState;

  const ctx = buildGenerationContext(withState, sectorId, state, reason);
  const instance = generateProceduralAnchorInstance(ctx, options);
  const nextState = recordAnchorRotationInMemory(state, instance);

  return {
    ...withState,
    anchorStateBySector: {
      ...withState.anchorStateBySector,
      [sectorId]: nextState,
    },
    operationLog: [
      `>> ANCHOR ROTATION — ${instance.displayName.toUpperCase()} RISING IN ${getSectorWorldTemplate(sectorId).displayName.toUpperCase()}.`,
      ...withState.operationLog,
    ].slice(0, 24),
  };
}

export function suppressAnchorForSector(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  instanceId: string,
  dormantRuns: number,
  reason = 'suppression',
): WorldStatePersistedState {
  const { persisted: withState, state } = ensureSectorAnchorState(persisted, sectorId);
  if (!state) return withState;

  const current = state.activeAnchorInstance;
  const suppressed: DormantAnchorRecord = {
    type: current.type,
    displayName: current.displayName,
    instanceId: instanceId || current.id,
    remainingRuns: dormantRuns,
    suppressedAtRunIndex: withState.deployRunIndex,
  };

  const dormantAnchors = [
    suppressed,
    ...state.dormantAnchors.filter((d) => d.instanceId !== suppressed.instanceId),
  ];

  const stateWithDormant: SectorAnchorState = {
    ...state,
    dormantAnchors,
    activeAnchorInstance: {
      ...current,
      lifecycleState: 'SUPPRESSED',
      suppressedAtRunIndex: withState.deployRunIndex,
      dormantRunsRemaining: dormantRuns,
    },
  };

  const dormantAnchorRuns = {
    ...withState.dormantAnchorRuns,
    [suppressed.instanceId]: dormantRuns,
  };

  let next: WorldStatePersistedState = {
    ...withState,
    dormantAnchorRuns,
    anchorStateBySector: {
      ...withState.anchorStateBySector,
      [sectorId]: stateWithDormant,
    },
    operationLog: [
      `>> ANCHOR SUPPRESSED — ${current.displayName.toUpperCase()} DORMANT FOR ${dormantRuns} RUN(S).`,
      ...withState.operationLog,
    ].slice(0, 24),
  };

  next = rotateAnchorForSector(next, sectorId, reason);

  const rotatedState = next.anchorStateBySector?.[sectorId];
  if (rotatedState) {
    next = {
      ...next,
      operationLog: [
        `>> NEW ANCHOR — ${rotatedState.activeAnchorInstance.displayName.toUpperCase()}.`,
        ...next.operationLog,
      ].slice(0, 24),
    };
  }

  return next;
}

export function tickSectorAnchorDormancy(
  persisted: WorldStatePersistedState,
): WorldStatePersistedState {
  const anchorStateBySector = { ...persisted.anchorStateBySector };
  let dormantAnchorRuns = { ...persisted.dormantAnchorRuns };

  for (const [sectorId, state] of Object.entries(anchorStateBySector)) {
    if (!state) continue;
    const dormantAnchors = state.dormantAnchors
      .map((d) => ({ ...d, remainingRuns: d.remainingRuns - 1 }))
      .filter((d) => d.remainingRuns > 0);

    dormantAnchors.forEach((d) => {
      dormantAnchorRuns[d.instanceId] = d.remainingRuns;
    });

    state.dormantAnchors
      .filter((d) => d.remainingRuns <= 1)
      .forEach((d) => {
        delete dormantAnchorRuns[d.instanceId];
      });

    anchorStateBySector[sectorId as SectorId] = {
      ...state,
      dormantAnchors,
    };
  }

  return { ...persisted, anchorStateBySector, dormantAnchorRuns };
}

export function proceduralInstanceToVeilAnchorState(
  instance: ProceduralAnchorInstance,
  catalogDescription?: string,
): import('../types/worldState').VeilAnchorState {
  return {
    id: instance.id,
    sectorId: instance.sectorId,
    type: instance.type,
    displayName: instance.displayName,
    baseDisplayName: instance.baseDisplayName,
    description: buildAnchorDescription(instance, catalogDescription),
    isActive: instance.lifecycleState === 'ACTIVE',
    realityRules: getAnchorRealityRules(instance.type),
    modifier: instance.modifier,
    resourceBias: instance.resourceBias,
    operationBias: instance.operationBias,
    pressureTags: instance.pressureTags,
    pressureLevel: instance.pressureLevel,
  };
}

export function resolveLinkedAnchorId(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): string | undefined {
  const instance = getActiveAnchorInstance(persisted, sectorId);
  if (instance) return instance.id;
  const template = getSectorWorldTemplate(sectorId);
  if (!template.anchor) return undefined;
  return anchorIdForSector(sectorId, template.anchor.type);
}
