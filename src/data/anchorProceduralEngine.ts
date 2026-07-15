import type {
  AnchorGenerationContext,
  AnchorInstanceModifier,
  AnchorScannerBias,
  ProceduralAnchorInstance,
  SectorAnchorState,
} from '../types/anchorProcedural';
import type { VeilAnchorType } from '../types/worldState';
import { ANCHOR_PROCEDURAL_MEMORY_DEPTH } from '../types/anchorProcedural';
import type { ResourceItemId } from '../types/resourceItem';
import type { OperationObjectiveKind, SectorId } from '../types/worldState';
import { getAnchorDefinition, getAnchorOperationWeights } from './anchorRegistry';
import {
  ALL_ANCHOR_MODIFIERS,
  ANCHOR_TYPE_ALIASES,
  ANCHOR_TYPE_DEPTH2_BIAS,
  ANCHOR_TYPE_DEPTH3_BIAS,
  ANCHOR_TYPE_ENCOUNTER_BIAS,
  ANCHOR_TYPE_OPERATION_BIAS,
  ANCHOR_TYPE_PRESSURE_TAGS,
  buildBaseAnchorScannerBias,
  mergeScannerBias,
  MODIFIER_ADJECTIVES,
  MODIFIER_COMPATIBILITY,
  MODIFIER_OPERATION_WEIGHT_BOOST,
} from './anchorTypeMetadata';
import { resourceIdFromFocusLabel } from './operationProceduralEngine';

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

function hashDisplayName(name: string): string {
  let h = 0;
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < normalized.length; i += 1) {
    h = ((h << 5) - h + normalized.charCodeAt(i)) | 0;
  }
  return `anh-${(h >>> 0).toString(36)}`;
}

export function proceduralAnchorInstanceId(
  sectorId: SectorId,
  type: VeilAnchorType,
  modifier: AnchorInstanceModifier | null,
  rotationIndex: number,
  generationSeed: string,
): string {
  const mod = modifier ?? 'base';
  return `anchor-${sectorId.toLowerCase()}-${type.toLowerCase()}-${mod.toLowerCase()}-r${rotationIndex}-${generationSeed.slice(-8)}`;
}

export function resolveAnchorResourceIds(
  type: VeilAnchorType,
  sectorId: SectorId,
  sectorResourceFocus: string[] = [],
): ResourceItemId[] {
  const def = getAnchorDefinition(type);
  const fromRegistry = def.resourceBias
    .map((label) => resourceIdFromFocusLabel(label, sectorId))
    .filter((id): id is ResourceItemId => id != null);
  const fromFocus = sectorResourceFocus
    .map((label) => resourceIdFromFocusLabel(label, sectorId))
    .filter((id): id is ResourceItemId => id != null);
  const anchorMarrow = resourceIdFromFocusLabel('Anchor Marrow', sectorId);
  const merged = [...fromRegistry, ...fromFocus];
  if (anchorMarrow && !merged.includes(anchorMarrow)) merged.push(anchorMarrow);
  return [...new Set(merged)];
}

export function resolveAnchorOperationBias(
  type: VeilAnchorType,
  modifier: AnchorInstanceModifier | null,
): OperationObjectiveKind[] {
  const base = ANCHOR_TYPE_OPERATION_BIAS[type] ?? [];
  const registryWeights = getAnchorOperationWeights(type);
  const sorted = [...base].sort((a, b) => (registryWeights[b] ?? 0) - (registryWeights[a] ?? 0));
  if (!modifier) return sorted.length > 0 ? sorted : Object.keys(registryWeights) as OperationObjectiveKind[];
  const boost = MODIFIER_OPERATION_WEIGHT_BOOST[modifier];
  if (!boost) return sorted;
  return [...sorted].sort((a, b) => (boost[b] ?? 1) - (boost[a] ?? 1));
}

export function resolveAnchorScannerBias(
  type: VeilAnchorType,
  modifier: AnchorInstanceModifier | null,
): AnchorScannerBias {
  return mergeScannerBias(buildBaseAnchorScannerBias(type), modifier);
}

export function getAnchorDistortionBias(
  instance: ProceduralAnchorInstance,
): Partial<Record<import('../types/depthIdentity').VeilDistortionId, number>> {
  return { ...ANCHOR_TYPE_DEPTH2_BIAS[instance.type], ...instance.depth2DistortionBias };
}

export function getAnchorLawBias(
  instance: ProceduralAnchorInstance,
): Partial<Record<import('../types/depthIdentity').DeepVeilLawId, number>> {
  return { ...ANCHOR_TYPE_DEPTH3_BIAS[instance.type], ...instance.depth3LawBias };
}

function weightedPickType(
  ctx: AnchorGenerationContext,
  rand: () => number,
  forceType?: VeilAnchorType,
): VeilAnchorType {
  if (forceType) return forceType;

  const dormantTypes = new Set(
    ctx.dormantAnchors.filter((d) => d.remainingRuns > 0).map((d) => d.type),
  );

  let pool = ctx.anchorPool
    .filter((entry) => entry.weight > 0)
    .map((entry) => {
      let weight = entry.weight;
      if (dormantTypes.has(entry.type)) weight *= 0.05;
      const recentIdx = ctx.recentAnchorTypes.indexOf(entry.type);
      if (recentIdx === 0) weight *= 0.2;
      else if (recentIdx > 0) weight *= 0.55;
      return { type: entry.type, weight };
    });

  if (pool.every((e) => e.weight <= 0)) {
    pool = ctx.anchorPool
      .filter((entry) => entry.weight > 0)
      .map((entry) => ({ type: entry.type, weight: entry.weight }));
  }

  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return ctx.anchorPool[0]?.type ?? 'CHOIR_SPIRE';

  let roll = rand() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return pool[pool.length - 1]!.type;
}

function weightedPickModifier(
  type: VeilAnchorType,
  ctx: AnchorGenerationContext,
  rand: () => number,
  forceModifier?: AnchorInstanceModifier | null,
): AnchorInstanceModifier | null {
  if (forceModifier !== undefined) return forceModifier;

  const compat = MODIFIER_COMPATIBILITY[type] ?? {};
  const pool = ALL_ANCHOR_MODIFIERS.map((modifier) => {
    let weight = compat[modifier] ?? 1;
    const recentIdx = ctx.recentAnchorModifiers.indexOf(modifier);
    if (recentIdx === 0) weight *= 0.25;
    else if (recentIdx > 0) weight *= 0.6;
    if (rand() < 0.18) weight *= 0.3;
    return { modifier, weight };
  });

  const noModifierWeight = 2.5;
  const total = pool.reduce((sum, e) => sum + e.weight, 0) + noModifierWeight;
  let roll = rand() * total;
  roll -= noModifierWeight;
  if (roll <= 0) return null;

  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.modifier;
  }
  return pool[pool.length - 1]?.modifier ?? null;
}

function pickDisplayAlias(
  type: VeilAnchorType,
  ctx: AnchorGenerationContext,
  rand: () => number,
): string {
  const aliases = [...ANCHOR_TYPE_ALIASES[type]];
  const recentHashes = new Set(ctx.recentDisplayNameHashes);
  const shuffled = aliases.sort(() => rand() - 0.5);
  for (const alias of shuffled) {
    const hash = hashDisplayName(alias);
    if (!recentHashes.has(hash)) return alias;
  }
  return pickOne(aliases, rand);
}

function pickOne<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]!;
}

function buildDisplayName(
  modifier: AnchorInstanceModifier | null,
  baseDisplayName: string,
): string {
  if (!modifier) return baseDisplayName;
  return `${MODIFIER_ADJECTIVES[modifier]} ${baseDisplayName}`;
}

export interface GenerateAnchorOptions {
  forceType?: VeilAnchorType;
  forceModifier?: AnchorInstanceModifier | null;
}

export function generateProceduralAnchorInstance(
  ctx: AnchorGenerationContext,
  options?: GenerateAnchorOptions,
): ProceduralAnchorInstance {
  const rand = seededRandom(ctx.seed);
  const type = weightedPickType(ctx, rand, options?.forceType);
  const modifier = weightedPickModifier(type, ctx, rand, options?.forceModifier);
  const baseDisplayName = pickDisplayAlias(type, ctx, rand);
  const displayName = buildDisplayName(modifier, baseDisplayName);
  const generationSeed = ctx.seed;
  const id = proceduralAnchorInstanceId(
    ctx.sectorId,
    type,
    modifier,
    ctx.rotationIndex,
    generationSeed,
  );

  const sectorFocus = ctx.sectorResourceFocus ?? [];
  const resourceBias = resolveAnchorResourceIds(type, ctx.sectorId, sectorFocus);
  const operationBias = resolveAnchorOperationBias(type, modifier);
  const scannerBias = resolveAnchorScannerBias(type, modifier);
  const encounterBias = ANCHOR_TYPE_ENCOUNTER_BIAS[type];
  const pressureTags = [...ANCHOR_TYPE_PRESSURE_TAGS[type]];
  const def = getAnchorDefinition(type);
  const pressureLevel = Math.min(
    5,
    Math.max(1, 2 + def.threatModifier + (modifier === 'OVERFED' || modifier === 'RAVENOUS' ? 1 : 0)),
  );

  return {
    id,
    sectorId: ctx.sectorId,
    type,
    displayName,
    baseDisplayName,
    modifier,
    generationSeed,
    createdAtRunIndex: ctx.deployRunIndex,
    lifecycleState: 'ACTIVE',
    pressureLevel,
    resourceBias,
    pressureTags,
    operationBias,
    scannerBias,
    encounterBias: {
      favoredModifiers: { ...encounterBias.favoredModifiers },
      twistedTemplateWeights: { ...encounterBias.twistedTemplateWeights },
    },
    depth2DistortionBias: { ...ANCHOR_TYPE_DEPTH2_BIAS[type] },
    depth3LawBias: { ...ANCHOR_TYPE_DEPTH3_BIAS[type] },
    titleFlavorTags: modifier ? [modifier.toLowerCase(), type.toLowerCase()] : [type.toLowerCase()],
    recentMemoryKey: hashDisplayName(displayName),
  };
}

export function recordAnchorRotationInMemory(
  state: SectorAnchorState,
  instance: ProceduralAnchorInstance,
): SectorAnchorState {
  const recentAnchorTypes = [instance.type, ...state.recentAnchorTypes].slice(
    0,
    ANCHOR_PROCEDURAL_MEMORY_DEPTH,
  );
  const recentAnchorModifiers = [instance.modifier, ...state.recentAnchorModifiers].slice(
    0,
    ANCHOR_PROCEDURAL_MEMORY_DEPTH,
  );
  const recentDisplayNameHashes = [
    instance.recentMemoryKey,
    ...state.recentDisplayNameHashes,
  ].slice(0, ANCHOR_PROCEDURAL_MEMORY_DEPTH);

  return {
    ...state,
    activeAnchorInstance: instance,
    recentAnchorTypes,
    recentAnchorModifiers,
    recentDisplayNameHashes,
    anchorRotationIndex: state.anchorRotationIndex + 1,
    lastRotatedRunIndex: instance.createdAtRunIndex,
  };
}

export function buildAnchorDescription(
  instance: ProceduralAnchorInstance,
  catalogDescription?: string,
): string {
  const def = getAnchorDefinition(instance.type);
  const modifierFlavor = instance.modifier
    ? `${MODIFIER_ADJECTIVES[instance.modifier]} pressure bleeds through the sector. `
    : '';
  if (catalogDescription && instance.modifier == null) return catalogDescription;
  return `${modifierFlavor}${def.theme}.`;
}

export function hashAnchorDisplayName(displayName: string): string {
  return hashDisplayName(displayName);
}
