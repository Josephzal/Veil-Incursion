import type { OperationObjectiveKind, SectorId, VeilAnchorType } from '../types/worldState';
import type { SectorOperationTemplate } from './sectorWorldCatalog';
import {
  getSectorWorldTemplate,
  anchorIdForSector,
} from './sectorWorldCatalog';
import {
  ANCHOR_OPERATION_WEIGHTS,
  OPERATION_TEMPLATE_CATALOG,
  fillOperationTemplate,
} from './operationTemplates';

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
  const weights = anchorType ? ANCHOR_OPERATION_WEIGHTS[anchorType] : {};
  const pool = OPERATION_TEMPLATE_CATALOG.map((template) => ({
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

export function generateProceduralOperation(
  sectorId: SectorId,
  opts: {
    anchorType: VeilAnchorType | null;
    anchorDisplayName: string;
    operationIndex: number;
    deployRunIndex: number;
  },
): SectorOperationTemplate {
  const sector = getSectorWorldTemplate(sectorId);
  const rand = seededRandom(`op-gen:${sectorId}:${opts.deployRunIndex}:${opts.operationIndex}`);
  const objectiveKind = weightedPickObjectiveKind(opts.anchorType, rand);
  const template = OPERATION_TEMPLATE_CATALOG.find((t) => t.objectiveKind === objectiveKind)
    ?? OPERATION_TEMPLATE_CATALOG[0];
  const filled = fillOperationTemplate(template, opts.anchorDisplayName, sector.displayName);
  const anchorSuffix = opts.anchorType ? `-${opts.anchorType.toLowerCase()}` : '';
  const id = `op-${sectorId.toLowerCase().replace(/_/g, '-')}-gen-${opts.operationIndex}-${opts.deployRunIndex}${anchorSuffix}`;

  return {
    id,
    title: filled.title,
    description: filled.description,
    objectiveKind: template.objectiveKind,
    rewardEmphasis: { ...template.rewardEmphasis },
  };
}

export function resolveSectorOperationTemplate(
  sectorId: SectorId,
  operationIndex: number,
  deployRunIndex: number,
): SectorOperationTemplate {
  const sector = getSectorWorldTemplate(sectorId);
  const staticIndex = ((operationIndex % sector.operations.length) + sector.operations.length)
    % sector.operations.length;
  const staticOp = sector.operations[staticIndex];

  if (operationIndex < sector.operations.length) {
    return staticOp;
  }

  const anchor = sector.anchor;
  return generateProceduralOperation(sectorId, {
    anchorType: anchor?.type ?? null,
    anchorDisplayName: anchor?.displayName ?? 'Veil Anchor',
    operationIndex,
    deployRunIndex,
  });
}

export function anchorIdForGeneratedOperation(
  sectorId: SectorId,
  anchorType: VeilAnchorType | null,
): string | undefined {
  if (!anchorType) return undefined;
  return anchorIdForSector(sectorId, anchorType);
}
