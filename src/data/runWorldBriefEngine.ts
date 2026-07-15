import type { GeneratedContract } from '../types/contract';
import type { ContractSourceKind } from '../types/contractProcedural';
import type { ProceduralAnchorInstance } from '../types/anchorProcedural';
import type { OperationSignalOverlay } from '../types/operationProcedural';
import type { ResourceItemId } from '../types/resourceItem';
import type {
  EchoActivityLevel,
  OperationState,
  RunGenerationContext,
  SectorId,
  SectorState,
  WorldStatePersistedState,
} from '../types/worldState';
import type {
  CrisisTheme,
  PreliminaryRunWorldContext,
  ProceduralWorldMemory,
  ResourceStress,
  RunWorldBrief,
  SponsorInterestProfile,
  ThreatPressureTag,
  ThreatProfile,
} from '../types/runWorldBrief';
import { PROCEDURAL_WORLD_MEMORY_DEPTH, createEmptyProceduralWorldMemory } from '../types/runWorldBrief';
import { createDefaultWorldState } from './worldStateEngine';
import { getActiveAnchorInstance } from './anchorLifecycleEngine';
import {
  getAnchorDistortionBias,
  getAnchorLawBias,
  resolveAnchorScannerBias,
} from './anchorProceduralEngine';
import { SPONSOR_CONTRACT_PREFERENCES } from './contractSponsorPreferences';
import {
  ALL_CRISIS_THEMES,
  CRISIS_THEME_DEFINITIONS,
  fillCrisisSummary,
  getCrisisThemeDefinition,
} from './crisisThemeCatalog';
import { resourceIdFromFocusLabel } from './operationProceduralEngine';
import { canResourceSpawnInSector } from './resourceRegistry';
import { getSectorWorldTemplate } from './sectorWorldCatalog';
import { sectorIdToVeilBiome } from './sectorBiomeBridge';
import { resolveSectorOperationTemplate } from './operationGenerator';
import { resolveContributionRules } from './operationRulesEngine';
import { DEFAULT_OPERATION_PROGRESS_REQUIRED } from './worldStateHelpers';
import {
  buildRewardBiasFromTheme,
  combineDepthBias,
  combineEncounterBias,
  combineScannerBias,
  defaultRunScannerOverlayBias,
} from './runWorldBriefBiasEngine';
import type { CabalEmployerId, OperationObjectiveKind } from '../types/worldState';

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

function uniqueResources(ids: ResourceItemId[]): ResourceItemId[] {
  return [...new Set(ids)];
}

function resolveSectorResourceIds(
  sectorId: SectorId,
  focus: string[],
): ResourceItemId[] {
  return uniqueResources(
    focus
      .map((label) => resourceIdFromFocusLabel(label, sectorId))
      .filter((id): id is ResourceItemId => id != null),
  );
}

function buildResourceStress(
  sectorId: SectorId,
  sectorFocus: string[],
  operation: OperationState,
  anchor: ProceduralAnchorInstance | null,
  theme: CrisisTheme,
): ResourceStress {
  const sectorIds = resolveSectorResourceIds(sectorId, sectorFocus);
  const opIds = (operation.targetResourceIds ?? []).filter((id) =>
    canResourceSpawnInSector(id, sectorId),
  );
  const anchorIds = (anchor?.resourceBias ?? []).filter((id) =>
    canResourceSpawnInSector(id, sectorId),
  );
  const themeIds = getCrisisThemeDefinition(theme).resourceIds.filter((id) =>
    canResourceSpawnInSector(id, sectorId),
  );

  const primaryResourceIds = uniqueResources([...opIds, ...anchorIds.slice(0, 2), ...themeIds.slice(0, 2)]);
  const secondaryResourceIds = uniqueResources([
    ...sectorIds,
    ...anchorIds,
    ...themeIds,
  ]).filter((id) => !primaryResourceIds.includes(id));

  const highDemandResourceIds = primaryResourceIds.slice(0, 4);
  const unstableResourceIds = theme === 'UNSTABLE_CARGO_SURGE'
    ? uniqueResources(['breach-thread', 'veil-ash-canister', 'ossified-ley-knot', ...opIds])
      .filter((id) => canResourceSpawnInSector(id, sectorId))
    : [];
  const appraisableCargoIds = theme === 'CONTAINMENT_FAILURE'
    ? uniqueResources(['blacksite-specimen-jar', 'sealed-containment-casket', 'encrypted-grid-drive'])
      .filter((id) => canResourceSpawnInSector(id, sectorId))
    : [];

  const sourceReasonByResource: ResourceStress['sourceReasonByResource'] = {};
  primaryResourceIds.forEach((id) => { sourceReasonByResource[id] = 'crisis-primary'; });
  sectorIds.forEach((id) => { sourceReasonByResource[id] = sourceReasonByResource[id] ?? 'sector-focus'; });

  return {
    primaryResourceIds,
    secondaryResourceIds: secondaryResourceIds.slice(0, 6),
    highDemandResourceIds,
    unstableResourceIds,
    appraisableCargoIds,
    sourceReasonByResource,
  };
}

function clampPressure(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function buildThreatProfile(theme: CrisisTheme, hazard: number, echo: EchoActivityLevel): ThreatProfile {
  const def = getCrisisThemeDefinition(theme);
  const echoBase = echo === 'CRITICAL' ? 70 : echo === 'ELEVATED' ? 45 : 20;
  const hazardBase = hazard * 12;

  const profile: ThreatProfile = {
    pressureTags: [...def.pressureTags],
    rivalPressure: def.pressureTags.includes('RIVAL') ? clampPressure(40 + hazardBase * 0.3) : clampPressure(15),
    echoPressure: def.pressureTags.includes('ECHO') ? clampPressure(echoBase + 15) : clampPressure(echoBase * 0.5),
    anchorPressure: def.pressureTags.includes('ANCHOR') ? clampPressure(50 + hazardBase * 0.4) : clampPressure(25),
    extractionPressure: def.pressureTags.includes('EXTRACTION') ? clampPressure(55) : clampPressure(20),
    resourcePressure: def.pressureTags.includes('RESOURCE') ? clampPressure(50 + hazardBase * 0.2) : clampPressure(25),
    containmentPressure: def.pressureTags.includes('CONTAINMENT') ? clampPressure(55) : clampPressure(15),
    mirrorPressure: def.pressureTags.includes('MIRROR') ? clampPressure(50) : clampPressure(15),
    unstablePressure: def.pressureTags.includes('UNSTABLE') ? clampPressure(55 + hazardBase * 0.3) : clampPressure(20),
    summary: `${def.displayName} pressure across ${def.pressureTags.join(', ').toLowerCase()} vectors.`,
  };
  return profile;
}

function buildSponsorInterest(
  theme: CrisisTheme,
  resourceStress: ResourceStress,
): SponsorInterestProfile[] {
  const def = getCrisisThemeDefinition(theme);
  const sponsors: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

  return sponsors.map((sponsorId) => {
    const prefs = SPONSOR_CONTRACT_PREFERENCES[sponsorId];
    const themeBoost = def.sponsorBoost[sponsorId] ?? 0;
    const resourceOverlap = resourceStress.primaryResourceIds.filter((id) =>
      prefs.preferredResources.includes(id),
    ).length;
    const interestLevel = clampPressure(30 + themeBoost * 3 + resourceOverlap * 8);
    const preferredObjectiveKinds = Object.entries(def.contractKinds)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([kind]) => kind as import('../types/contract').ContractObjectiveKind)
      .filter((kind) => (prefs.objectiveKindWeights[kind] ?? 0) > 0);

    return {
      sponsorId,
      interestLevel,
      reasonTags: [theme, ...def.pressureTags.slice(0, 2)],
      preferredResourceIds: uniqueResources([
        ...resourceStress.highDemandResourceIds,
        ...prefs.preferredResources.filter((id) => resourceStress.secondaryResourceIds.includes(id)),
      ]).slice(0, 4),
      preferredObjectiveKinds: preferredObjectiveKinds.length > 0
        ? preferredObjectiveKinds
        : Object.keys(prefs.objectiveKindWeights).slice(0, 2) as import('../types/contract').ContractObjectiveKind[],
      flavorTone: [...prefs.tonePrefixes.slice(0, 2)],
    };
  });
}

function weightCrisisThemes(
  sectorId: SectorId,
  anchor: ProceduralAnchorInstance | null,
  operation: OperationState,
  hazard: number,
  reward: number,
  echo: EchoActivityLevel,
  memory?: ProceduralWorldMemory,
): Record<CrisisTheme, number> {
  const weights = {} as Record<CrisisTheme, number>;
  const recent = memory?.recentCrisisThemesBySector[sectorId] ?? [];

  ALL_CRISIS_THEMES.forEach((theme) => {
    const def = CRISIS_THEME_DEFINITIONS[theme];
    let w = def.baseWeight;
    if (anchor) {
      w += def.anchorTypeBonus[anchor.type] ?? 0;
      if (anchor.modifier) w += def.anchorModifierBonus[anchor.modifier] ?? 0;
    }
    w += def.operationKindBonus[operation.objectiveKind] ?? 0;
    w += def.sectorBonus[sectorId] ?? 0;
    w += def.echoActivityBonus[echo] ?? 0;
    w += def.hazardBonus(hazard);
    w += def.rewardBonus(reward);
    const recentIdx = recent.indexOf(theme);
    if (recentIdx === 0) w *= 0.2;
    else if (recentIdx > 0) w *= 0.55;
    weights[theme] = Math.max(0.5, w);
  });
  return weights;
}

function pickCrisisTheme(
  weights: Record<CrisisTheme, number>,
  rand: () => number,
): CrisisTheme {
  const total = ALL_CRISIS_THEMES.reduce((sum, t) => sum + weights[t], 0);
  let roll = rand() * total;
  for (const theme of ALL_CRISIS_THEMES) {
    roll -= weights[theme];
    if (roll <= 0) return theme;
  }
  return ALL_CRISIS_THEMES[0]!;
}

export interface BuildPreliminaryContextInput {
  persisted: WorldStatePersistedState;
  sectorState: SectorState;
  operation: OperationState;
  anchor: ProceduralAnchorInstance | null;
  memory?: ProceduralWorldMemory;
  forceTheme?: CrisisTheme;
}

/** Build preliminary crisis context for procedural generation without full sector hydration. */
export function buildPreliminaryForSectorPersisted(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): PreliminaryRunWorldContext {
  const operationIndex = persisted.activeOperationIndex[sectorId] ?? 0;
  const lifecycleEntry = persisted.sectorOperationLifecycle[sectorId];
  const operationTemplate = resolveSectorOperationTemplate(
    sectorId,
    operationIndex,
    persisted.deployRunIndex,
    persisted.sectorOperationOverrides,
    { seedRunIndex: lifecycleEntry?.generatedAtRunIndex, persisted },
  );
  const template = getSectorWorldTemplate(sectorId);
  const rewardBoost = persisted.temporarySectorModifiers
    .filter((mod) => mod.sectorId === sectorId && mod.runsRemaining > 0)
    .reduce((sum, mod) => sum + mod.rewardLevelBoost, 0);
  const anchor = getActiveAnchorInstance(persisted, sectorId);
  const progressCurrent = persisted.operationProgress[operationTemplate.id] ?? 0;
  const activeOperation: OperationState = {
    id: operationTemplate.id,
    sectorId,
    title: operationTemplate.title,
    description: operationTemplate.description,
    objectiveKind: operationTemplate.objectiveKind,
    linkedAnchorId: anchor?.id,
    progressCurrent,
    progressRequired: operationTemplate.progressRequired ?? DEFAULT_OPERATION_PROGRESS_REQUIRED,
    rewardEmphasis: operationTemplate.rewardEmphasis,
    contributionRules: operationTemplate.contributionRules
      ?? resolveContributionRules(operationTemplate.objectiveKind),
    lifecycleStatus: lifecycleEntry?.operationId === operationTemplate.id
      ? lifecycleEntry.status
      : 'ACTIVE',
    runsRemaining: 0,
    generatedAtRunIndex: lifecycleEntry?.generatedAtRunIndex ?? persisted.deployRunIndex,
    expiresAtRunIndex: lifecycleEntry?.expiresAtRunIndex ?? persisted.deployRunIndex,
    rewardPreview: '',
    procedural: operationTemplate.procedural,
    targetResourceIds: operationTemplate.targetResourceIds,
    targetDepths: operationTemplate.targetDepths,
    targetEnemyRoles: operationTemplate.targetEnemyRoles,
    targetNodeOverlays: operationTemplate.targetNodeOverlays,
    bonusObjectives: operationTemplate.bonusObjectives,
    completionEffectSummary: operationTemplate.completionEffectSummary,
    operationTags: operationTemplate.operationTags,
  };
  const sectorState: SectorState = {
    id: sectorId,
    displayName: template.displayName,
    biome: template.biome,
    veilBiome: sectorIdToVeilBiome(sectorId),
    hazardLevel: template.hazardLevel,
    rewardLevel: template.rewardLevel + rewardBoost,
    resourceFocus: [...template.resourceFocus],
    activeAnchor: null,
    activeOperation,
    echoActivity: template.echoActivity,
    employerPresence: [...template.employerPresence],
  };

  return buildPreliminaryRunWorldContext({
    persisted,
    sectorState,
    operation: activeOperation,
    anchor,
  });
}

export function buildPreliminaryRunWorldContext(
  input: BuildPreliminaryContextInput,
): PreliminaryRunWorldContext {
  const { sectorState, operation, anchor, persisted } = input;
  const template = getSectorWorldTemplate(sectorState.id);
  const seed = `brief-prelim:${sectorState.id}:${persisted.deployRunIndex}:${operation.id}:${anchor?.id ?? 'no-anchor'}`;
  const rand = seededRandom(seed);
  const memory = input.memory ?? persisted.proceduralWorldMemory ?? createEmptyProceduralWorldMemory();

  const themeWeights = weightCrisisThemes(
    sectorState.id,
    anchor,
    operation,
    sectorState.hazardLevel,
    sectorState.rewardLevel,
    sectorState.echoActivity,
    memory,
  );
  const crisisTheme = input.forceTheme ?? pickCrisisTheme(themeWeights, rand);
  const themeDef = getCrisisThemeDefinition(crisisTheme);

  const resourceStress = buildResourceStress(
    sectorState.id,
    sectorState.resourceFocus,
    operation,
    anchor,
    crisisTheme,
  );
  const threatProfile = buildThreatProfile(crisisTheme, sectorState.hazardLevel, sectorState.echoActivity);
  const sponsorInterest = buildSponsorInterest(crisisTheme, resourceStress);

  const anchorScanner = anchor
    ? resolveAnchorScannerBias(anchor.type, anchor.modifier)
    : null;

  const operationOverlayBoost: Partial<import('../types/runWorldBrief').RunScannerOverlayBias> = {};
  (operation.targetNodeOverlays ?? []).forEach((overlay) => {
    switch (overlay) {
      case 'ANCHOR_SIGNAL': operationOverlayBoost.anchorSignal = 1.15; break;
      case 'ECHO_SIGNAL': operationOverlayBoost.echoSignal = 1.15; break;
      case 'OPERATION_TARGET': operationOverlayBoost.operationTarget = 1.15; break;
      case 'HIGH_RISK_ZONE': operationOverlayBoost.highRisk = 1.12; break;
      case 'HIGH_VALUE_RESOURCE': operationOverlayBoost.highValueResource = 1.15; break;
      case 'EXTRACTION': operationOverlayBoost.extraction = 1.15; break;
      default: break;
    }
  });

  const scannerBias = combineScannerBias(
    {
      anchorSignalMultiplier: 1,
      echoSignalMultiplier: 1,
      operationSignalMultiplier: 1,
      highRiskMultiplier: 1,
    },
    anchorScanner,
    themeDef,
    Object.keys(operationOverlayBoost).length ? operationOverlayBoost : undefined,
  );

  const encounterBias = combineEncounterBias(
    anchor?.encounterBias.favoredModifiers ?? {},
    anchor?.encounterBias.twistedTemplateWeights ?? {},
    themeDef,
    themeDef.rivalMercBoost,
  );

  const depthBias = combineDepthBias(
    anchor ? getAnchorDistortionBias(anchor) : {},
    anchor ? getAnchorLawBias(anchor) : {},
    themeDef,
  );

  const contractSources: Partial<Record<ContractSourceKind, number>> = { ...themeDef.contractSources };
  const contractBias = {
    preferredSponsors: Object.entries(themeDef.sponsorBoost)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([id]) => id as CabalEmployerId),
    preferredObjectiveKinds: Object.entries(themeDef.contractKinds)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([k]) => k as import('../types/contract').ContractObjectiveKind),
    preferredResourceIds: resourceStress.highDemandResourceIds,
    sourceWeights: contractSources,
  };

  const operationBias = {
    preferredObjectiveKinds: [...new Set([...themeDef.operationKinds, operation.objectiveKind])],
    targetResourceIds: operation.targetResourceIds ?? resourceStress.primaryResourceIds,
    targetDepths: operation.targetDepths ?? [],
    targetNodeOverlays: [...new Set([...themeDef.nodeOverlays, ...(operation.targetNodeOverlays ?? [])])],
  };

  const anchorName = anchor?.displayName ?? sectorState.activeAnchor?.displayName ?? 'the sector anchor';
  const crisisSummary = fillCrisisSummary(
    themeDef.summaryTemplate,
    sectorState.displayName,
    anchorName,
  );

  return {
    seed,
    deployRunIndex: persisted.deployRunIndex,
    sectorId: sectorState.id,
    sectorDisplayName: sectorState.displayName,
    crisisTheme,
    crisisDisplayName: themeDef.displayName,
    crisisSummary,
    resourceStress,
    threatProfile,
    sponsorInterest,
    scannerBias,
    encounterBias,
    rewardBias: buildRewardBiasFromTheme(themeDef),
    depthBias,
    operationBias,
    contractBias,
  };
}

export interface BuildRunWorldBriefInput {
  persisted: WorldStatePersistedState;
  sectorState: SectorState;
  contractBoard: GeneratedContract[];
  selectedContractId: string | null;
  preliminary?: PreliminaryRunWorldContext;
  memory?: ProceduralWorldMemory;
  compatibilityBrief?: boolean;
}

export function buildRunWorldBrief(input: BuildRunWorldBriefInput): RunWorldBrief {
  const { persisted, sectorState, contractBoard } = input;
  const anchor = getActiveAnchorInstance(persisted, sectorState.id);
  const operation = sectorState.activeOperation;
  const operationProcedural = persisted.operationInstances?.[operation.id] ?? null;

  const preliminary = input.preliminary ?? buildPreliminaryRunWorldContext({
    persisted,
    sectorState,
    operation,
    anchor,
    memory: input.memory,
  });

  const anchorName = anchor?.displayName ?? sectorState.activeAnchor?.displayName ?? 'the sector anchor';
  const crisisSummary = preliminary.crisisSummary ?? fillCrisisSummary(
    getCrisisThemeDefinition(preliminary.crisisTheme).summaryTemplate,
    sectorState.displayName,
    anchorName,
  );

  const briefId = [
    'brief',
    sectorState.id.toLowerCase(),
    String(persisted.deployRunIndex),
    anchor?.id ?? 'no-anchor',
    operation.id,
    preliminary.crisisTheme.toLowerCase(),
  ].join('-');

  const seed = `brief-v1:${persisted.deployRunIndex}:${sectorState.id}:${preliminary.crisisTheme}:${anchor?.id ?? 'na'}:${operation.id}`;

  const tags: RunWorldBrief['tags'] = [preliminary.crisisTheme];
  if (anchor?.modifier) tags.push('PROCEDURAL_ANCHOR');
  if (operation.procedural) tags.push('PROCEDURAL_OPERATION');
  if (input.compatibilityBrief) tags.push('COMPATIBILITY_BRIEF');

  return {
    id: briefId,
    seed,
    deployRunIndex: persisted.deployRunIndex,
    sectorId: sectorState.id,
    sectorDisplayName: sectorState.displayName,
    createdAt: Date.now(),
    anchorInstance: anchor,
    operationInstance: operation,
    operationProcedural,
    contractBoard: contractBoard.map((c) => ({ ...c })),
    selectedContractId: input.selectedContractId,
    crisisTheme: preliminary.crisisTheme,
    crisisDisplayName: preliminary.crisisDisplayName,
    crisisSummary,
    resourceStress: preliminary.resourceStress,
    threatProfile: preliminary.threatProfile,
    sponsorInterest: preliminary.sponsorInterest,
    scannerBias: preliminary.scannerBias,
    encounterBias: preliminary.encounterBias,
    rewardBias: preliminary.rewardBias,
    depthBias: preliminary.depthBias,
    operationBias: preliminary.operationBias,
    contractBias: preliminary.contractBias,
    tags,
    recentMemoryKeys: [
      preliminary.crisisTheme,
      anchor?.type ?? 'no-anchor',
      operation.objectiveKind,
      operation.id,
    ],
    generationDebug: input.compatibilityBrief
      ? { compatibilityBrief: true, preliminaryTheme: preliminary.crisisTheme }
      : { preliminaryTheme: preliminary.crisisTheme },
  };
}

export function recordBriefInMemory(
  memory: ProceduralWorldMemory,
  brief: RunWorldBrief,
): ProceduralWorldMemory {
  const sectorId = brief.sectorId;
  const recentCrisis = [brief.crisisTheme, ...(memory.recentCrisisThemesBySector[sectorId] ?? [])]
    .slice(0, PROCEDURAL_WORLD_MEMORY_DEPTH);
  const recentBriefIds = [brief.id, ...(memory.recentBriefIdsBySector[sectorId] ?? [])]
    .slice(0, PROCEDURAL_WORLD_MEMORY_DEPTH);
  const recentResources = [...brief.resourceStress.primaryResourceIds, ...(memory.recentResourceStressBySector[sectorId] ?? [])]
    .slice(0, PROCEDURAL_WORLD_MEMORY_DEPTH);
  const recentThreat = [...brief.threatProfile.pressureTags, ...(memory.recentThreatTagsBySector[sectorId] ?? [])]
    .slice(0, PROCEDURAL_WORLD_MEMORY_DEPTH);

  return {
    ...memory,
    recentCrisisThemesBySector: { ...memory.recentCrisisThemesBySector, [sectorId]: recentCrisis },
    recentBriefIdsBySector: { ...memory.recentBriefIdsBySector, [sectorId]: recentBriefIds },
    recentResourceStressBySector: { ...memory.recentResourceStressBySector, [sectorId]: recentResources },
    recentThreatTagsBySector: { ...memory.recentThreatTagsBySector, [sectorId]: recentThreat },
  };
}

export function buildCompatibilityRunWorldBrief(
  context: RunGenerationContext,
  opts?: {
    persisted?: WorldStatePersistedState;
    contractBoard?: GeneratedContract[];
  },
): RunWorldBrief {
  const persisted = opts?.persisted ?? {
    ...createDefaultWorldState(),
    selectedSectorId: context.sectorState.id,
    deployRunIndex: context.sectorState.activeOperation.generatedAtRunIndex ?? 0,
  };
  return buildRunWorldBrief({
    persisted,
    sectorState: context.sectorState,
    contractBoard: opts?.contractBoard ?? [],
    selectedContractId: context.activeContract.contractId,
    compatibilityBrief: true,
  });
}

export function getRunWorldBriefFromContext(
  context: RunGenerationContext | null | undefined,
  fallbackBrief?: RunWorldBrief | null,
): RunWorldBrief | null {
  return context?.runWorldBrief ?? fallbackBrief ?? null;
}

/** Ensure scanner/encounter rolls see the deploy-time brief. */
export function attachBriefToRunGenerationContext(
  context: RunGenerationContext | null | undefined,
  brief: RunWorldBrief | null | undefined,
): RunGenerationContext | null {
  if (!context) return null;
  if (!brief) return context;
  if (context.runWorldBrief === brief) return context;
  return { ...context, runWorldBrief: brief };
}
