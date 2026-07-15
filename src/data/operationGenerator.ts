import type { OperationObjectiveKind, SectorId, VeilAnchorType, WorldStatePersistedState } from '../types/worldState';
import { USE_PROCEDURAL_OPERATIONS_FROM_START } from '../types/operationProcedural';
import type { SectorOperationTemplate } from './sectorWorldCatalog';
import {
  getSectorWorldTemplate,
  anchorIdForSector,
} from './sectorWorldCatalog';
import {
  getAnchorDefinition,
  getAnchorOperationWeights,
} from './anchorRegistry';
import {
  resolveProceduralRewardEmphasis,
} from './operationRulesEngine';
import {
  OPERATION_TEMPLATE_CATALOG,
  fillOperationTemplate,
  pickProceduralVariantIndex,
} from './operationTemplates';
import {
  adaptStaticOperationTemplate,
  buildOperationGenerationContext,
  generateProceduralOperationV2,
  getSectorOperationMemory,
  recordOperationInMemory,
  storeOperationInstance,
} from './operationProceduralEngine';
import { buildPreliminaryForSectorPersisted } from './runWorldBriefEngine';

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

function weightedPickObjectiveKind(
  anchorType: VeilAnchorType | null,
  rand: () => number,
): OperationObjectiveKind {
  const weights = getAnchorOperationWeights(anchorType);
  const compatible = anchorType
    ? getAnchorDefinition(anchorType).compatibleOperationTypes
    : OPERATION_TEMPLATE_CATALOG.map((t) => t.objectiveKind);
  const pool = OPERATION_TEMPLATE_CATALOG
    .filter((template) => compatible.includes(template.objectiveKind))
    .map((template) => ({
      kind: template.objectiveKind,
      weight: weights[template.objectiveKind] ?? 1,
    }));
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rand() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.kind;
  }
  return pool[0]?.kind ?? 'EXTRACTION_SURGE';
}

/** @deprecated Use generateProceduralOperationV2 via resolveSectorOperationTemplate */
export function generateProceduralOperation(
  sectorId: SectorId,
  opts: {
    anchorType: VeilAnchorType | null;
    anchorDisplayName: string;
    operationIndex: number;
    deployRunIndex: number;
  },
  persisted?: WorldStatePersistedState,
): SectorOperationTemplate {
  const memory = persisted
    ? getSectorOperationMemory(persisted, sectorId)
    : undefined;
  const ctx = buildOperationGenerationContext(
    sectorId,
    opts.operationIndex,
    opts.deployRunIndex,
    memory,
    persisted,
  );
  return generateProceduralOperationV2(ctx);
}

export function buildForcedOperationTemplate(
  sectorId: SectorId,
  objectiveKind: OperationObjectiveKind,
  operationIndex: number,
  deployRunIndex: number,
  persisted?: WorldStatePersistedState,
): SectorOperationTemplate {
  const memory = persisted
    ? getSectorOperationMemory(persisted, sectorId)
    : undefined;
  const ctx = buildOperationGenerationContext(
    sectorId,
    operationIndex,
    deployRunIndex,
    memory,
  );
  return generateProceduralOperationV2(ctx, { forceKind: objectiveKind });
}

export interface ResolveSectorOperationOptions {
  seedRunIndex?: number;
  persisted?: WorldStatePersistedState;
  preliminary?: import('../types/runWorldBrief').PreliminaryRunWorldContext | null;
}

export function resolveSectorOperationTemplate(
  sectorId: SectorId,
  operationIndex: number,
  deployRunIndex: number,
  overrides?: Partial<Record<SectorId, SectorOperationTemplate>>,
  options?: ResolveSectorOperationOptions,
): SectorOperationTemplate {
  if (overrides?.[sectorId]) {
    return adaptStaticOperationTemplate(overrides[sectorId], sectorId);
  }

  const persisted = options?.persisted;
  const seedRunIndex = options?.seedRunIndex ?? deployRunIndex;
  const sector = getSectorWorldTemplate(sectorId);
  const staticCount = sector.operations.length;
  const useProceduralFromStart = USE_PROCEDURAL_OPERATIONS_FROM_START;

  if (!useProceduralFromStart && operationIndex < staticCount) {
    const staticOp = sector.operations[operationIndex]!;
    return adaptStaticOperationTemplate(staticOp, sectorId);
  }

  const cached = persisted?.operationInstances;
  if (cached) {
    const match = Object.values(cached).find(
      (inst) => inst.operationIndex === operationIndex && inst.procedural,
    );
    if (match) {
      return match as SectorOperationTemplate;
    }
  }

  const memory = persisted
    ? getSectorOperationMemory(persisted, sectorId)
    : undefined;
  const ctx = buildOperationGenerationContext(
    sectorId,
    operationIndex,
    seedRunIndex,
    memory,
    persisted,
    options?.preliminary,
  );
  return generateProceduralOperationV2(ctx);
}

export function resolveAndCacheSectorOperation(
  sectorId: SectorId,
  operationIndex: number,
  deployRunIndex: number,
  persisted: WorldStatePersistedState,
  overrides?: Partial<Record<SectorId, SectorOperationTemplate>>,
  options?: Pick<ResolveSectorOperationOptions, 'preliminary'>,
): { template: SectorOperationTemplate; persisted: WorldStatePersistedState } {
  const lifecycle = persisted.sectorOperationLifecycle[sectorId];
  const seedRunIndex = lifecycle?.generatedAtRunIndex ?? deployRunIndex;
  const preliminary = options?.preliminary
    ?? (persisted ? buildPreliminaryForSectorPersisted(persisted, sectorId) : null);
  const template = resolveSectorOperationTemplate(
    sectorId,
    operationIndex,
    deployRunIndex,
    overrides,
    { seedRunIndex, persisted, preliminary },
  );

  let next = persisted;
  if (template.procedural) {
    const instances = storeOperationInstance(
      persisted.operationInstances ?? {},
      template,
    );
    const memory = recordOperationInMemory(
      getSectorOperationMemory(persisted, sectorId),
      template,
      operationIndex,
    );
    next = {
      ...persisted,
      operationInstances: instances,
      operationProceduralMemory: {
        ...persisted.operationProceduralMemory,
        [sectorId]: memory,
      },
    };
  }

  return { template, persisted: next };
}

export function anchorIdForGeneratedOperation(
  sectorId: SectorId,
  anchorType: VeilAnchorType | null,
): string | undefined {
  if (!anchorType) return undefined;
  return anchorIdForSector(sectorId, anchorType);
}

// Legacy v1 generator kept for tests — delegates to v2
void weightedPickObjectiveKind;
void seededRandom;
