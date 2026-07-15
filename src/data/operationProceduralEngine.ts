import type { CrisisTheme, PreliminaryRunWorldContext } from '../types/runWorldBrief';
import type { RunDepth } from '../types/narrativeProcedural';
import type {
  OperationBonusObjective,
  OperationBonusRequirementKind,
  OperationEnemyRole,
  OperationGenerationContext,
  OperationProceduralMemory,
  OperationProceduralMemoryEntry,
  OperationSignalOverlay,
  ProceduralOperationFields,
  StoredOperationInstance,
} from '../types/operationProcedural';
import { OPERATION_PROCEDURAL_MEMORY_DEPTH } from '../types/operationProcedural';
import type { ResourceItemId } from '../types/resourceItem';
import type {
  OperationCompletionEffect,
  OperationContributionRules,
  OperationObjectiveKind,
  RewardEmphasis,
  SectorId,
  VeilAnchorType,
} from '../types/worldState';
import { OPERATION_BALANCE_PROGRESS_REQUIRED } from './balance/operationBalanceConfig';
import { getAnchorDefinition } from './anchorRegistry';
import {
  OPERATION_TEMPLATE_CATALOG,
} from './operationTemplates';
import { OPERATION_TEXT_VARIANTS } from './operationTemplateVariants';
import {
  resolveCompletionEffect,
  resolveContributionRules,
  resolveProceduralRewardEmphasis,
} from './operationRulesEngine';
import type { WorldStatePersistedState } from '../types/worldState';
import { getActiveAnchorInstance, resolveLinkedAnchorId } from './anchorLifecycleEngine';
import { resolveAnchorOperationBias } from './anchorProceduralEngine';
import { getSectorWorldTemplate } from './sectorWorldCatalog';
import type { SectorOperationTemplate } from './sectorWorldCatalog';
import {
  ALL_RESOURCE_ITEM_IDS,
  canResourceSpawnInSector,
  getResourceDefinition,
  RESOURCE_REGISTRY,
} from './resourceRegistry';
import { getAnchorOperationWeights } from './anchorRegistry';

export interface OperationPlaceholderContext {
  sector: string;
  anchor: string;
  resource: string;
  secondaryResource: string;
  depth: string;
  threat: string;
  operationVerb: string;
  targetNoun: string;
  employer: string;
  signal: string;
  modifier: string;
}

export interface RolledOperationParameters {
  objectiveKind: OperationObjectiveKind;
  targetResourceIds: ResourceItemId[];
  targetDepths: RunDepth[];
  targetEnemyRoles: OperationEnemyRole[];
  targetNodeOverlays: OperationSignalOverlay[];
  operationTags: string[];
  operationVerb: string;
  targetNoun: string;
  modifier: string;
  threat: string;
  signal: string;
}

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

function pickOne<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]!;
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[\s-]/g, '');
}

export function resourceIdFromFocusLabel(
  label: string,
  sectorId: SectorId,
): ResourceItemId | null {
  const norm = normalizeLabel(label);
  for (const id of ALL_RESOURCE_ITEM_IDS) {
    const def = RESOURCE_REGISTRY[id];
    if (
      normalizeLabel(def.name) === norm
      || normalizeLabel(def.shortName) === norm
    ) {
      if (canResourceSpawnInSector(id, sectorId)) return id;
    }
  }
  return null;
}

export function hashOperationTitle(title: string): string {
  let h = 0;
  const normalized = title.toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < normalized.length; i += 1) {
    h = ((h << 5) - h + normalized.charCodeAt(i)) | 0;
  }
  return `th-${(h >>> 0).toString(36)}`;
}

export function createEmptyOperationMemory(staticTitleHashes: string[] = []): OperationProceduralMemory {
  return { recent: [], staticTitleHashes };
}

export function buildStaticTitleHashes(sectorId: SectorId): string[] {
  const sector = getSectorWorldTemplate(sectorId);
  return sector.operations.map((op) => hashOperationTitle(op.title));
}

export function buildOperationGenerationContext(
  sectorId: SectorId,
  operationIndex: number,
  deployRunIndex: number,
  memory?: OperationProceduralMemory,
  persisted?: WorldStatePersistedState,
  preliminary?: PreliminaryRunWorldContext | null,
): OperationGenerationContext {
  const sector = getSectorWorldTemplate(sectorId);
  const proceduralInstance = persisted ? getActiveAnchorInstance(persisted, sectorId) : null;
  const catalogAnchor = sector.anchor;
  const anchorType = proceduralInstance?.type ?? catalogAnchor?.type ?? null;
  const anchorDisplayName = proceduralInstance?.displayName ?? catalogAnchor?.displayName ?? null;
  const anchorDef = anchorType ? getAnchorDefinition(anchorType) : null;
  const mem = memory ?? createEmptyOperationMemory(buildStaticTitleHashes(sectorId));
  if (mem.staticTitleHashes.length === 0) {
    mem.staticTitleHashes = buildStaticTitleHashes(sectorId);
  }

  const resourceBiasLabels = proceduralInstance
    ? proceduralInstance.resourceBias.map((id) => getResourceDefinition(id).name)
    : anchorDef
      ? [...anchorDef.resourceBias]
      : [];

  let crisisTheme: CrisisTheme | null = preliminary?.crisisTheme ?? null;
  const preferredObjectiveKinds = preliminary?.operationBias.preferredObjectiveKinds;
  const preferredResourceIds = preliminary?.resourceStress.primaryResourceIds;

  return {
    seed: `op-v2:${sectorId}:${deployRunIndex}:${operationIndex}`,
    deployRunIndex,
    sectorId,
    operationIndex,
    sectorDisplayName: sector.displayName,
    sectorResourceFocus: [...sector.resourceFocus],
    hazardLevel: sector.hazardLevel,
    rewardLevel: sector.rewardLevel,
    echoActivity: sector.echoActivity,
    activeAnchorType: anchorType,
    activeAnchorDisplayName: anchorDisplayName,
    activeAnchorId: persisted ? resolveLinkedAnchorId(persisted, sectorId) : null,
    anchorResourceBias: resourceBiasLabels,
    anchorModifier: proceduralInstance?.modifier ?? null,
    anchorOperationBias: proceduralInstance?.operationBias
      ?? (anchorType ? resolveAnchorOperationBias(anchorType, null) : []),
    recentOperationMemory: mem,
    crisisTheme,
    preferredObjectiveKinds,
    preferredResourceIds,
  };
}

function weightedPickObjectiveKind(
  ctx: OperationGenerationContext,
  rand: () => number,
  avoidKind?: OperationObjectiveKind,
): OperationObjectiveKind {
  const weights = getAnchorOperationWeights(ctx.activeAnchorType);
  const compatible = ctx.activeAnchorType
    ? getAnchorDefinition(ctx.activeAnchorType).compatibleOperationTypes
    : OPERATION_TEMPLATE_CATALOG.map((t) => t.objectiveKind);
  const biasKinds = ctx.anchorOperationBias ?? [];
  let pool = OPERATION_TEMPLATE_CATALOG
    .filter((template) => compatible.includes(template.objectiveKind))
    .map((template) => {
      let weight = weights[template.objectiveKind] ?? 1;
      if (biasKinds.includes(template.objectiveKind)) weight *= 1.35;
      if (ctx.preferredObjectiveKinds?.includes(template.objectiveKind)) weight *= 1.28;
      if (ctx.crisisTheme === 'ECHO_OUTBREAK' && template.objectiveKind === 'ECHO_RECOVERY') weight *= 1.35;
      if (ctx.crisisTheme === 'RESOURCE_BLOOM' && template.objectiveKind === 'RESOURCE_SURVEY') weight *= 1.35;
      if (ctx.crisisTheme === 'FALSE_EXTRACTION_WAVE' && template.objectiveKind === 'EXTRACTION_SURGE') weight *= 1.35;
      if (ctx.crisisTheme === 'ANCHOR_BREACH' && template.objectiveKind === 'ANCHOR_ASSAULT') weight *= 1.35;
      if (ctx.crisisTheme === 'RIVAL_SALVAGE_RUSH' && template.objectiveKind === 'BOSS_SUPPRESSION') weight *= 1.2;
      const last = ctx.recentOperationMemory.recent[0];
      if (last?.objectiveKind === template.objectiveKind) weight *= 0.35;
      if (avoidKind && template.objectiveKind === avoidKind) weight *= 0.2;
      return { kind: template.objectiveKind, weight };
    });
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    pool = OPERATION_TEMPLATE_CATALOG.map((t) => ({ kind: t.objectiveKind, weight: 1 }));
  }
  const rollTotal = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rand() * rollTotal;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.kind;
  }
  return pool[0]?.kind ?? 'EXTRACTION_SURGE';
}

function validOperationResources(
  sectorId: SectorId,
  candidates: ResourceItemId[],
): ResourceItemId[] {
  return candidates.filter(
    (id) => RESOURCE_REGISTRY[id].canBeOperationTarget
      && canResourceSpawnInSector(id, sectorId),
  );
}

function pickResourcesForKind(
  kind: OperationObjectiveKind,
  ctx: OperationGenerationContext,
  rand: () => number,
): ResourceItemId[] {
  const sectorId = ctx.sectorId;
  const focusIds = ctx.sectorResourceFocus
    .map((label) => resourceIdFromFocusLabel(label, sectorId))
    .filter((id): id is ResourceItemId => id != null);
  const biasIds = ctx.anchorResourceBias
    .map((label) => resourceIdFromFocusLabel(label, sectorId))
    .filter((id): id is ResourceItemId => id != null);

  const pools: Record<OperationObjectiveKind, ResourceItemId[]> = {
    ANCHOR_ASSAULT: validOperationResources(sectorId, [
      'anchor-marrow',
      ...focusIds,
      ...biasIds,
      'echo-glass-shard',
      'resonant-filament',
    ]),
    ECHO_RECOVERY: validOperationResources(sectorId, [
      'resonant-filament',
      'echo-glass-shard',
      ...focusIds,
      'tarnished-dog-tags',
    ]),
    EXTRACTION_SURGE: validOperationResources(sectorId, [
      'cinder-wire',
      'containment-seal',
      ...focusIds,
      'echo-glass-shard',
    ]),
    RESOURCE_SURVEY: validOperationResources(sectorId, [
      ...focusIds,
      'nullcrete-shard',
      'mycelial-ichor',
      'cinder-wire',
      'rail-capacitor',
      'containment-seal',
      'breach-thread',
    ]),
    BOSS_SUPPRESSION: validOperationResources(sectorId, [
      ...focusIds,
      'anchor-marrow',
      ...biasIds,
    ]),
  };

  const pool = pools[kind];
  if (pool.length === 0) return focusIds.slice(0, 1);
  const stressBoost = ctx.preferredResourceIds ?? [];
  const weightedPool = [
    ...stressBoost.filter((id) => pool.includes(id)),
    ...pool.filter((id) => !stressBoost.includes(id)),
  ];
  const lastRes = ctx.recentOperationMemory.recent[0]?.targetResourceIds[0];
  const filtered = lastRes
    ? weightedPool.filter((id) => id !== lastRes)
    : weightedPool;
  const pickPool = filtered.length > 0 ? filtered : weightedPool;
  const primary = pickOne(pickPool, rand);
  const secondary = pickPool.find((id) => id !== primary);
  return secondary ? [primary, secondary] : [primary];
}

export function rollOperationParameters(
  objectiveKind: OperationObjectiveKind,
  ctx: OperationGenerationContext,
  rand: () => number,
): RolledOperationParameters {
  const targetResourceIds = pickResourcesForKind(objectiveKind, ctx, rand);
  const hazard = ctx.hazardLevel;
  const depthBase: RunDepth = hazard >= 4 ? 3 : hazard >= 3 ? 2 : 1;

  const depthPools: Record<OperationObjectiveKind, RunDepth[]> = {
    ANCHOR_ASSAULT: [2, 3],
    ECHO_RECOVERY: ctx.echoActivity === 'LOW' ? [1, 2] : [2, 3],
    EXTRACTION_SURGE: [1, 2, 3],
    RESOURCE_SURVEY: hazard >= 3 ? [2, 3] : [1, 2],
    BOSS_SUPPRESSION: [2, 3],
  };
  const targetDepths = [...new Set(depthPools[objectiveKind])].sort() as RunDepth[];

  const overlayPools: Record<OperationObjectiveKind, OperationSignalOverlay[]> = {
    ANCHOR_ASSAULT: ['ANCHOR_SIGNAL', 'OPERATION_TARGET', 'HIGH_RISK_ZONE'],
    ECHO_RECOVERY: ['ECHO_SIGNAL', 'OPERATION_TARGET', 'HIGH_VALUE_RESOURCE'],
    EXTRACTION_SURGE: ['EXTRACTION', 'HIGH_RISK_ZONE', 'OPERATION_TARGET'],
    RESOURCE_SURVEY: ['HIGH_VALUE_RESOURCE', 'OPERATION_TARGET', 'HIGH_RISK_ZONE'],
    BOSS_SUPPRESSION: ['HIGH_RISK_ZONE', 'OPERATION_TARGET', 'ANCHOR_SIGNAL'],
  };
  const targetNodeOverlays = overlayPools[objectiveKind];

  const rolePools: Record<OperationObjectiveKind, OperationEnemyRole[]> = {
    ANCHOR_ASSAULT: ['ANCHOR_TAGGED', 'ELITE'],
    ECHO_RECOVERY: ['SUPPORT', 'ELITE'],
    EXTRACTION_SURGE: ['ARTILLERY', 'SUPPORT'],
    RESOURCE_SURVEY: ['SUPPORT', 'ELITE'],
    BOSS_SUPPRESSION: ['ELITE', 'BOSS', 'DEPTH_3_EXCLUSIVE', 'ANCHOR_TAGGED'],
  };

  const verbs = ['Trace', 'Sever', 'Stabilize', 'Suppress', 'Harvest', 'Secure'];
  const nouns = ['Conduit', 'Bloom', 'Vein', 'Relay', 'Surge', 'Channel'];
  const modifiers = ['Fractured ', 'Rail-Warped ', 'False ', 'Dead ', ''];
  const threats = ['Elite Surge', 'Anchor Pressure', 'Echo Bleed', 'High-Risk Cluster'];
  const signals = ['Anchor Signal', 'Echo Residue', 'Operation Target', 'Resource Bloom'];

  return {
    objectiveKind,
    targetResourceIds,
    targetDepths,
    targetEnemyRoles: rolePools[objectiveKind],
    targetNodeOverlays,
    operationTags: [objectiveKind.toLowerCase(), `h${hazard}`, `d${depthBase}`],
    operationVerb: pickOne(verbs, rand),
    targetNoun: pickOne(nouns, rand),
    modifier: pickOne(modifiers, rand),
    threat: pickOne(threats, rand),
    signal: pickOne(signals, rand),
  };
}

export function resolveProceduralProgressRequired(
  ctx: OperationGenerationContext,
  kind: OperationObjectiveKind,
  params: RolledOperationParameters,
): number {
  const base = OPERATION_BALANCE_PROGRESS_REQUIRED;
  const ranges: Record<OperationObjectiveKind, [number, number]> = {
    RESOURCE_SURVEY: [88, 108],
    ECHO_RECOVERY: [88, 112],
    EXTRACTION_SURGE: [92, 112],
    ANCHOR_ASSAULT: [96, 118],
    BOSS_SUPPRESSION: [96, 118],
  };
  const [min, max] = ranges[kind];
  const hazardBump = Math.floor((ctx.hazardLevel - 3) * 3);
  const echoBump = ctx.echoActivity === 'CRITICAL' ? 4 : ctx.echoActivity === 'ELEVATED' ? 2 : 0;
  const depthBump = params.targetDepths.includes(3) ? 3 : 0;
  const rarityBump = params.targetResourceIds.some((id) =>
    ['anomalous-core', 'anchor-marrow', 'breach-thread'].includes(id)) ? 2 : 0;
  const raw = min + hazardBump + echoBump + depthBump + rarityBump;
  return Math.min(max + 6, Math.max(min - 4, Math.min(base + 15, raw)));
}

export function buildParameterizedContributionRules(
  kind: OperationObjectiveKind,
  params: RolledOperationParameters,
): OperationContributionRules {
  const base = { ...resolveContributionRules(kind) };
  switch (kind) {
    case 'ANCHOR_ASSAULT':
      return {
        ...base,
        clearOperationTarget: Math.max(base.clearOperationTarget ?? 2, 2),
        defeatAnchorElite: Math.max(base.defeatAnchorElite ?? 3, 3),
        extractTargetResource: params.targetResourceIds.length > 0
          ? Math.max(base.extractTargetResource ?? 2, 2)
          : base.extractTargetResource,
      };
    case 'ECHO_RECOVERY':
      return {
        ...base,
        defeatEcho: Math.max(base.defeatEcho ?? 3, 3),
        extractTargetResource: params.targetResourceIds.length > 0 ? 1 : base.extractTargetResource,
        clearOperationTarget: 2,
      };
    case 'EXTRACTION_SURGE':
      return {
        ...base,
        successfulExtraction: Math.max(base.successfulExtraction ?? 3, 3),
        clearOperationTarget: 2,
      };
    case 'RESOURCE_SURVEY':
      return {
        ...base,
        extractTargetResource: 1,
        clearOperationTarget: Math.max(base.clearOperationTarget ?? 3, 3),
      };
    case 'BOSS_SUPPRESSION':
      return {
        ...base,
        defeatElite: Math.max(base.defeatElite ?? 2, 2),
        defeatDepthBoss: Math.max(base.defeatDepthBoss ?? 5, 5),
      };
    default:
      return base;
  }
}

function bonusAchievable(
  kind: OperationBonusRequirementKind,
  ctx: OperationGenerationContext,
  params: RolledOperationParameters,
): boolean {
  switch (kind) {
    case 'CLEAR_ANCHOR_SIGNAL_DEPTH_2':
    case 'DEFEAT_ANCHOR_ELITE':
      return ctx.activeAnchorType != null;
    case 'CLEAR_ECHO_RESIDUE':
      return ctx.echoActivity !== 'LOW' || params.targetNodeOverlays.includes('ECHO_SIGNAL');
    case 'EXTRACT_TARGET_RESOURCE':
      return params.targetResourceIds.length > 0;
    case 'CLEAR_HIGH_RISK':
      return params.targetNodeOverlays.includes('HIGH_RISK_ZONE');
    case 'STABILIZE_FALSE_EXTRACTION':
      return params.objectiveKind === 'EXTRACTION_SURGE';
    case 'CLEAR_RESOURCE_BLOOM':
      return params.objectiveKind === 'RESOURCE_SURVEY';
    case 'DEFEAT_DEPTH_BOSS':
    case 'DEFEAT_ELITE':
      return params.objectiveKind === 'BOSS_SUPPRESSION' || params.targetDepths.includes(2);
    default:
      return true;
  }
}

export function rollBonusObjectives(
  ctx: OperationGenerationContext,
  params: RolledOperationParameters,
  rand: () => number,
): OperationBonusObjective[] {
  const count = rand() < 0.45 ? 0 : rand() < 0.75 ? 1 : 2;
  if (count === 0) return [];

  const candidates: Array<{
    kind: OperationBonusRequirementKind;
    description: string;
    reward: OperationBonusObjective['reward'];
  }> = [
    {
      kind: 'CLEAR_ANCHOR_SIGNAL_DEPTH_2',
      description: 'Clear one Anchor Signal in Depth 2+.',
      reward: { operationProgress: 2, debriefCallout: 'Anchor signal cleared in deep sector.' },
    },
    {
      kind: 'EXTRACT_TARGET_RESOURCE',
      description: `Extract 2 stacks of target resource.`,
      reward: { operationProgress: 2, credits: 25, debriefCallout: 'Bonus resource quota met.' },
    },
    {
      kind: 'CLEAR_HIGH_RISK',
      description: 'Clear one High-Risk Zone combat.',
      reward: { operationProgress: 3, debriefCallout: 'High-risk zone suppressed.' },
    },
    {
      kind: 'DEFEAT_ELITE',
      description: 'Defeat one elite encounter.',
      reward: { operationProgress: 2, debriefCallout: 'Elite suppression confirmed.' },
    },
    {
      kind: 'CLEAR_ECHO_RESIDUE',
      description: 'Resolve one Echo Residue node.',
      reward: { operationProgress: 2, debriefCallout: 'Echo residue resolved.' },
    },
    {
      kind: 'STABILIZE_FALSE_EXTRACTION',
      description: 'Stabilize a False Extraction Signal.',
      reward: { operationProgress: 3, debriefCallout: 'False extraction stabilized.' },
    },
    {
      kind: 'CLEAR_RESOURCE_BLOOM',
      description: 'Clear one Resource Bloom node.',
      reward: { operationProgress: 2, debriefCallout: 'Resource bloom catalogued.' },
    },
    {
      kind: 'DEFEAT_DEPTH_BOSS',
      description: 'Defeat a depth boss.',
      reward: { operationProgress: 4, credits: 40, debriefCallout: 'Depth boss eliminated.' },
    },
    {
      kind: 'DEFEAT_ANCHOR_ELITE',
      description: 'Defeat an Anchor-tagged elite.',
      reward: { operationProgress: 3, debriefCallout: 'Anchor elite destroyed.' },
    },
  ];

  const picked: OperationBonusObjective[] = [];
  const shuffled = [...candidates].sort(() => rand() - 0.5);
  for (const entry of shuffled) {
    if (picked.length >= count) break;
    if (!bonusAchievable(entry.kind, ctx, params)) continue;
    if (picked.some((p) => p.requirement.kind === entry.kind)) continue;
    picked.push({
      id: `bonus-${entry.kind.toLowerCase()}-${picked.length}`,
      description: entry.description,
      requirement: {
        kind: entry.kind,
        targetDepth: entry.kind.includes('DEPTH') ? 2 : undefined,
        targetQuantity: entry.kind === 'EXTRACT_TARGET_RESOURCE' ? 2 : undefined,
      },
      reward: entry.reward,
      completed: false,
    });
  }
  return picked;
}

export interface CompletionVariant {
  effect: OperationCompletionEffect;
  summary: string;
  metadataOnly?: boolean;
}

export function pickCompletionEffectVariant(
  kind: OperationObjectiveKind,
  ctx: OperationGenerationContext,
  params: RolledOperationParameters,
  rand: () => number,
  linkedAnchorId?: string,
): CompletionVariant {
  const base = resolveCompletionEffect(kind, ctx.sectorId, linkedAnchorId);
  const variants: CompletionVariant[] = [];

  switch (kind) {
    case 'ANCHOR_ASSAULT':
      variants.push(
        { effect: base, summary: `Anchor dormant for ${base.deactivateAnchorForRuns ?? 0} runs after completion.` },
        { effect: { ...base, increaseRewardLevelForRuns: (base.increaseRewardLevelForRuns ?? 2) + 1 }, summary: 'Sector reward surge elevated after anchor assault.' },
        { effect: base, summary: 'Anchor signal frequency reduced temporarily.', metadataOnly: true },
      );
      break;
    case 'ECHO_RECOVERY':
      variants.push(
        { effect: base, summary: `Echo activity calmed for ${base.deactivateAnchorForRuns ?? 0} runs.` },
        { effect: base, summary: 'Resonant material drop chance improved temporarily.', metadataOnly: true },
        { effect: { ...base, increaseRewardLevelForRuns: 3 }, summary: 'Echo reward yield improved for upcoming runs.' },
      );
      break;
    case 'EXTRACTION_SURGE':
      variants.push(
        { effect: base, summary: `Extraction payout bonus for ${base.increaseRewardLevelForRuns ?? 0} runs.` },
        { effect: base, summary: 'Extraction nodes more readable next runs.', metadataOnly: true },
        { effect: base, summary: 'Dirty extraction pressure slightly reduced.', metadataOnly: true },
      );
      break;
    case 'RESOURCE_SURVEY':
      variants.push(
        { effect: base, summary: `Target resource focus unlocked: ${params.targetResourceIds[0] ?? 'sector materials'}.` },
        { effect: base, summary: 'Sector resource drop chance increased temporarily.' },
        { effect: base, summary: 'Scanner resource visibility improved.', metadataOnly: !base.unlockTemporarySectorModifier },
      );
      break;
    case 'BOSS_SUPPRESSION':
      variants.push(
        { effect: base, summary: `Elite nest pressure reduced for ${base.deactivateAnchorForRuns ?? 0} runs.` },
        { effect: { ...base, increaseRewardLevelForRuns: 4 }, summary: 'High-risk combat rewards improved temporarily.' },
        { effect: base, summary: 'Sector threat reduced temporarily.', metadataOnly: true },
      );
      break;
    default:
      variants.push({ effect: base, summary: 'Operation completion surge applied.' });
  }

  return pickOne(variants, rand);
}

export function buildPlaceholderContext(
  ctx: OperationGenerationContext,
  params: RolledOperationParameters,
): OperationPlaceholderContext {
  const primary = params.targetResourceIds[0];
  const secondary = params.targetResourceIds[1];
  const resourceName = primary ? getResourceDefinition(primary).shortName : ctx.sectorResourceFocus[0] ?? 'sector materials';
  const secondaryName = secondary
    ? getResourceDefinition(secondary).shortName
    : ctx.sectorResourceFocus[1] ?? resourceName;

  return {
    sector: ctx.sectorDisplayName,
    anchor: ctx.activeAnchorDisplayName ?? 'Veil Anchor',
    resource: resourceName,
    secondaryResource: secondaryName,
    depth: String(params.targetDepths[params.targetDepths.length - 1] ?? 2),
    threat: params.threat,
    operationVerb: params.operationVerb,
    targetNoun: params.targetNoun,
    employer: ctx.sectorResourceFocus[0] ? 'Cabal' : 'Grid',
    signal: params.signal,
    modifier: params.modifier,
  };
}

export function fillOperationPlaceholders(
  text: string,
  placeholders: OperationPlaceholderContext,
): string {
  const map: Record<string, string> = {
    sector: placeholders.sector,
    anchor: placeholders.anchor,
    resource: placeholders.resource,
    secondaryResource: placeholders.secondaryResource,
    depth: placeholders.depth,
    threat: placeholders.threat,
    operationVerb: placeholders.operationVerb,
    targetNoun: placeholders.targetNoun,
    employer: placeholders.employer,
    signal: placeholders.signal,
    modifier: placeholders.modifier,
  };
  let result = text;
  for (const [key, value] of Object.entries(map)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result.replace(/\{[a-zA-Z]+\}/g, '').replace(/\s+/g, ' ').trim();
}

function isDuplicateTitle(
  titleHash: string,
  ctx: OperationGenerationContext,
): boolean {
  const recent = ctx.recentOperationMemory.recent;
  const last3 = recent.slice(0, 3);
  if (last3.some((entry) => entry.titleHash === titleHash)) return true;
  if (ctx.recentOperationMemory.staticTitleHashes.includes(titleHash)) return true;
  return false;
}

export function resolveProceduralRewardEmphasisV2(
  kind: OperationObjectiveKind,
  ctx: OperationGenerationContext,
  params: RolledOperationParameters,
): RewardEmphasis {
  const base = resolveProceduralRewardEmphasis(
    kind,
    ctx.sectorResourceFocus,
    ctx.activeAnchorType,
  );
  const resourceNames = params.targetResourceIds.map((id) => getResourceDefinition(id).name);
  const mergedTargets = [...new Set([...(base.targetResources ?? []), ...resourceNames])];
  const hazardBoost = ctx.hazardLevel >= 4 ? 0.05 : 0;
  return {
    ...base,
    targetResources: mergedTargets.length > 0 ? mergedTargets : base.targetResources,
    rareLoot: (base.rareLoot ?? 0) + hazardBoost,
  };
}

function buildOperationId(
  sectorId: SectorId,
  operationIndex: number,
  deployRunIndex: number,
  anchorType: VeilAnchorType | null,
  kind: OperationObjectiveKind,
): string {
  const anchorSuffix = anchorType ? `-${anchorType.toLowerCase()}` : '';
  return `op-${sectorId.toLowerCase().replace(/_/g, '-')}-gen-${operationIndex}-${deployRunIndex}-${kind.toLowerCase()}${anchorSuffix}`;
}

export function generateProceduralOperationV2(
  ctx: OperationGenerationContext,
  opts?: { forceKind?: OperationObjectiveKind },
): SectorOperationTemplate {
  const rand = seededRandom(ctx.seed);
  let objectiveKind = opts?.forceKind ?? weightedPickObjectiveKind(ctx, rand);
  let params = rollOperationParameters(objectiveKind, ctx, rand);
  let variantIndex = Math.floor(rand() * OPERATION_TEXT_VARIANTS[objectiveKind].titleVariants.length);
  let placeholders = buildPlaceholderContext(ctx, params);
  let title = fillOperationPlaceholders(
    OPERATION_TEXT_VARIANTS[objectiveKind].titleVariants[variantIndex % 10]!,
    placeholders,
  );
  let titleHash = hashOperationTitle(title);

  for (let attempt = 0; attempt < 5 && isDuplicateTitle(titleHash, ctx); attempt += 1) {
    if (attempt < 2) {
      variantIndex = (variantIndex + 1 + Math.floor(rand() * 3)) % 10;
    } else if (attempt < 4) {
      objectiveKind = weightedPickObjectiveKind(ctx, rand, objectiveKind);
      params = rollOperationParameters(objectiveKind, ctx, rand);
      variantIndex = Math.floor(rand() * 10);
    } else {
      params = rollOperationParameters(objectiveKind, ctx, rand);
      placeholders = buildPlaceholderContext(ctx, params);
      title = `${fillOperationPlaceholders(
        OPERATION_TEXT_VARIANTS[objectiveKind].titleVariants[variantIndex % 10]!,
        placeholders,
      )} — Phase ${ctx.operationIndex}`;
    }
    placeholders = buildPlaceholderContext(ctx, params);
    title = fillOperationPlaceholders(
      OPERATION_TEXT_VARIANTS[objectiveKind].titleVariants[variantIndex % 10]!,
      placeholders,
    );
    titleHash = hashOperationTitle(title);
  }

  const description = fillOperationPlaceholders(
    OPERATION_TEXT_VARIANTS[objectiveKind].descriptionVariants[variantIndex % 10]!,
    placeholders,
  );

  const progressRequired = resolveProceduralProgressRequired(ctx, objectiveKind, params);
  const contributionRules = buildParameterizedContributionRules(objectiveKind, params);
  const bonusObjectives = rollBonusObjectives(ctx, params, rand);
  const completionVariant = pickCompletionEffectVariant(
    objectiveKind,
    ctx,
    params,
    rand,
    ctx.activeAnchorId ?? (
      ctx.activeAnchorType
        ? `anchor-${ctx.sectorId.toLowerCase()}-${ctx.activeAnchorType.toLowerCase()}`
        : undefined
    ),
  );
  const rewardEmphasis = resolveProceduralRewardEmphasisV2(objectiveKind, ctx, params);
  const id = buildOperationId(
    ctx.sectorId,
    ctx.operationIndex,
    ctx.deployRunIndex,
    ctx.activeAnchorType,
    objectiveKind,
  );

  const procedural: ProceduralOperationFields = {
    procedural: true,
    generationSeed: ctx.seed,
    operationIndex: ctx.operationIndex,
    createdAtRunIndex: ctx.deployRunIndex,
    targetAnchorType: ctx.activeAnchorType,
    targetAnchorDisplayName: ctx.activeAnchorDisplayName,
    targetResourceIds: params.targetResourceIds,
    targetDepths: params.targetDepths,
    targetEnemyRoles: params.targetEnemyRoles,
    targetNodeOverlays: params.targetNodeOverlays,
    progressRequired,
    contributionRules,
    bonusObjectives,
    completionEffect: completionVariant.effect,
    completionEffectSummary: completionVariant.summary,
    aftermathEffect: completionVariant.metadataOnly
      ? { summary: completionVariant.summary, metadataOnly: true }
      : undefined,
    operationTags: params.operationTags,
    titleHash,
    recentMemoryKey: `${ctx.sectorId}:${objectiveKind}:${titleHash}`,
  };

  return {
    id,
    title,
    description,
    objectiveKind,
    rewardEmphasis,
    ...procedural,
  };
}

export function adaptStaticOperationTemplate(
  staticOp: SectorOperationTemplate,
  sectorId: SectorId,
): SectorOperationTemplate {
  if (staticOp.procedural) return staticOp;
  const sector = getSectorWorldTemplate(sectorId);
  const focusIds = sector.resourceFocus
    .map((label) => resourceIdFromFocusLabel(label, sectorId))
    .filter((id): id is ResourceItemId => id != null);

  return {
    ...staticOp,
    procedural: false,
    progressRequired: staticOp.progressRequired ?? OPERATION_BALANCE_PROGRESS_REQUIRED,
    contributionRules: staticOp.contributionRules ?? resolveContributionRules(staticOp.objectiveKind),
    targetResourceIds: staticOp.targetResourceIds ?? focusIds,
    targetDepths: staticOp.targetDepths ?? [1, 2],
    targetEnemyRoles: staticOp.targetEnemyRoles ?? [],
    targetNodeOverlays: staticOp.targetNodeOverlays ?? [],
    bonusObjectives: staticOp.bonusObjectives ?? [],
    completionEffect: staticOp.completionEffect
      ?? resolveCompletionEffect(staticOp.objectiveKind, sectorId),
    completionEffectSummary: staticOp.completionEffectSummary
      ?? 'Standard operation completion effects apply.',
    operationTags: staticOp.operationTags ?? ['static'],
    titleHash: staticOp.titleHash ?? hashOperationTitle(staticOp.title),
    recentMemoryKey: staticOp.recentMemoryKey ?? `static:${staticOp.id}`,
  };
}

export function recordOperationInMemory(
  memory: OperationProceduralMemory,
  template: SectorOperationTemplate,
  operationIndex: number,
  completedAtRunIndex?: number,
): OperationProceduralMemory {
  const entry: OperationProceduralMemoryEntry = {
    operationIndex,
    objectiveKind: template.objectiveKind,
    titleHash: template.titleHash ?? hashOperationTitle(template.title),
    targetResourceIds: template.targetResourceIds ?? [],
    targetAnchorType: template.targetAnchorType ?? null,
    completedAtRunIndex,
  };
  const recent = [entry, ...memory.recent].slice(0, OPERATION_PROCEDURAL_MEMORY_DEPTH);
  return { ...memory, recent };
}

export function getSectorOperationMemory(
  persisted: { operationProceduralMemory?: Partial<Record<SectorId, OperationProceduralMemory>> },
  sectorId: SectorId,
): OperationProceduralMemory {
  const existing = persisted.operationProceduralMemory?.[sectorId];
  if (existing) {
    return {
      recent: [...existing.recent],
      staticTitleHashes: existing.staticTitleHashes.length > 0
        ? [...existing.staticTitleHashes]
        : buildStaticTitleHashes(sectorId),
    };
  }
  return createEmptyOperationMemory(buildStaticTitleHashes(sectorId));
}

export function storeOperationInstance(
  instances: Record<string, StoredOperationInstance>,
  template: SectorOperationTemplate,
): Record<string, StoredOperationInstance> {
  return { ...instances, [template.id]: template };
}

export function formatTargetResourceLabels(ids: ResourceItemId[]): string[] {
  return ids.map((id) => getResourceDefinition(id).shortName);
}

export function formatTargetDepthLabel(depths: RunDepth[]): string {
  if (depths.length === 0) return 'Any depth';
  if (depths.length === 1) return `Depth ${depths[0]}`;
  return `Depth ${depths[0]}–${depths[depths.length - 1]}`;
}
