import type {
  CabalEmployerId,
  OperationCompletionEffect,
  OperationState,
  RunGenerationContext,
  RunModifierSnapshot,
  SectorId,
  SectorState,
  VeilAnchorState,
  WorldStatePersistedState,
} from '../types/worldState';
import {
  createDefaultContractBoard,
  createIndependentSelectedContract,
  freezeContractForRun,
  getSelectedContractSponsorId,
} from '../types/contract';
import { generateContractBoard, buildContractBoardFromPersisted } from './contractGenerator';
import { createEmptyContractMemory } from './contractProceduralEngine';
import {
  DEFAULT_OPERATION_PROGRESS_REQUIRED,
} from './worldStateHelpers';
import {
  describeCompletionEffectLines,
  formatOperationRewardPreview,
  resolveCompletionEffect,
  resolveContributionRules,
} from './operationRulesEngine';
import {
  beginOperationCompleted,
  getSectorOperationLifecycle,
  operationRunsRemaining,
} from './operationLifecycleEngine';
import { resolveSectorOperationTemplate } from './operationGenerator';
import type { SectorOperationTemplate } from './sectorWorldCatalog';
import {
  getSectorWorldTemplate,
  SECTOR_WORLD_TEMPLATES,
} from './sectorWorldCatalog';
import { sectorIdToVeilBiome } from './sectorBiomeBridge';
import { getBreachGradeTuning, normalizeBreachGradeId } from './breachGradeEngine';
import type { BreachGradeId } from '../types/progression';
import { buildScannerSignalBiasFromAnchor } from './anchorRegistry';
import {
  ensureAllSectorAnchorStates,
  ensureSectorAnchorState,
  getActiveAnchorInstance,
  getRecentlySuppressedAnchor,
  proceduralInstanceToVeilAnchorState,
  resolveLinkedAnchorId,
  suppressAnchorForSector,
  tickSectorAnchorDormancy,
} from './anchorLifecycleEngine';
import { resolveAnchorScannerBias } from './anchorProceduralEngine';
import {
  buildPreliminaryRunWorldContext,
  buildRunWorldBrief,
} from './runWorldBriefEngine';
import { createEmptyProceduralWorldMemory } from '../types/runWorldBrief';
import {
  directRunWorldBrief,
  getSectorAftermathModifiers,
  tickSectorAftermathForSector,
} from './proceduralDirectorEngine';

export interface EmployerPackage {
  maxHpBonusPct: number;
  kineticArmorBonus: number;
  rareLootBonusPct: number;
  blackMarketDiscountPct: number;
  firstTurnApBonus: number;
  creditBonusPct: number;
}

export const EMPLOYER_PACKAGES: Record<CabalEmployerId, EmployerPackage> = {
  TERRAN_GRID: {
    maxHpBonusPct: 10,
    kineticArmorBonus: 1,
    rareLootBonusPct: 0,
    blackMarketDiscountPct: 0,
    firstTurnApBonus: 0,
    creditBonusPct: 5,
  },
  LEGION: {
    maxHpBonusPct: 0,
    kineticArmorBonus: 1,
    rareLootBonusPct: 5,
    blackMarketDiscountPct: 0,
    firstTurnApBonus: 1,
    creditBonusPct: 0,
  },
  SOLARIS: {
    maxHpBonusPct: 0,
    kineticArmorBonus: 0,
    rareLootBonusPct: 10,
    blackMarketDiscountPct: 15,
    firstTurnApBonus: 0,
    creditBonusPct: 0,
  },
};

export function createDefaultWorldState(): WorldStatePersistedState {
  const deployRunIndex = 0;
  const base: WorldStatePersistedState = {
    selectedSectorId: 'THE_NULL_ZONE',
    selectedBreachGrade: 'I',
    contractBoard: {
      ...createDefaultContractBoard(deployRunIndex),
      contracts: generateContractBoard(deployRunIndex),
    },
    deployRunIndex,
    operationProgress: {},
    activeOperationIndex: {},
    temporarySectorModifiers: [],
    dormantAnchorRuns: {},
    operationLog: [],
    sectorOperationLifecycle: {},
    operationInstances: {},
    operationProceduralMemory: {},
    contractProceduralMemory: createEmptyContractMemory(),
    proceduralWorldMemory: createEmptyProceduralWorldMemory(),
    sectorAftermathModifiersBySector: {},
    aftermathMeta: {},
    version: 2,
  };
  return ensureAllSectorAnchorStates(base);
}

export function resolveSectorOperationIndex(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
): number {
  return persisted.activeOperationIndex[sectorId] ?? 0;
}

function resolveOperationTemplateForSector(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
): SectorOperationTemplate {
  const operationIndex = resolveSectorOperationIndex(sectorId, persisted);
  const lifecycle = persisted.sectorOperationLifecycle[sectorId];
  return resolveSectorOperationTemplate(
    sectorId,
    operationIndex,
    persisted.deployRunIndex,
    persisted.sectorOperationOverrides,
    { seedRunIndex: lifecycle?.generatedAtRunIndex, persisted },
  );
}

function resolveRewardLevelBoost(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
): number {
  return persisted.temporarySectorModifiers
    .filter((mod) => mod.sectorId === sectorId && mod.runsRemaining > 0)
    .reduce((sum, mod) => sum + mod.rewardLevelBoost, 0);
}

function isAnchorDormant(anchorId: string, persisted: WorldStatePersistedState): boolean {
  return (persisted.dormantAnchorRuns[anchorId] ?? 0) > 0;
}

export function buildVeilAnchorState(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
): VeilAnchorState | null {
  const template = getSectorWorldTemplate(sectorId);
  if (!template.anchor) return null;

  const { persisted: withAnchors } = ensureSectorAnchorState(persisted, sectorId);
  const instance = getActiveAnchorInstance(withAnchors, sectorId);
  if (!instance) return null;
  if (isAnchorDormant(instance.id, withAnchors)) return null;

  return proceduralInstanceToVeilAnchorState(instance, template.anchor.description);
}

export function buildOperationState(
  sectorId: SectorId,
  progressCurrent: number,
  persisted: WorldStatePersistedState,
): OperationState {
  const template = getSectorWorldTemplate(sectorId);
  const operationTemplate = resolveOperationTemplateForSector(sectorId, persisted);
  const lifecycle = getSectorOperationLifecycle(persisted, sectorId, operationTemplate.id);
  const anchor = resolveLinkedAnchorId(persisted, sectorId);

  return {
    id: operationTemplate.id,
    sectorId,
    title: operationTemplate.title,
    description: operationTemplate.description,
    objectiveKind: operationTemplate.objectiveKind,
    linkedAnchorId: anchor,
    progressCurrent,
    progressRequired: operationTemplate.progressRequired ?? DEFAULT_OPERATION_PROGRESS_REQUIRED,
    rewardEmphasis: operationTemplate.rewardEmphasis,
    contributionRules: operationTemplate.contributionRules
      ?? resolveContributionRules(operationTemplate.objectiveKind),
    lifecycleStatus: lifecycle.status,
    runsRemaining: operationRunsRemaining(lifecycle),
    generatedAtRunIndex: lifecycle.generatedAtRunIndex,
    expiresAtRunIndex: lifecycle.expiresAtRunIndex,
    rewardPreview: formatOperationRewardPreview(operationTemplate.rewardEmphasis),
    procedural: operationTemplate.procedural,
    targetResourceIds: operationTemplate.targetResourceIds,
    targetDepths: operationTemplate.targetDepths,
    targetEnemyRoles: operationTemplate.targetEnemyRoles,
    targetNodeOverlays: operationTemplate.targetNodeOverlays,
    bonusObjectives: operationTemplate.bonusObjectives,
    completionEffectSummary: operationTemplate.completionEffectSummary,
    operationTags: operationTemplate.operationTags,
  };
}

export function buildSectorState(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
  operationProgress: Record<string, number>,
): SectorState {
  const template = getSectorWorldTemplate(sectorId);
  const operationTemplate = resolveOperationTemplateForSector(sectorId, persisted);
  const progressCurrent = operationProgress[operationTemplate.id] ?? 0;
  const rewardBoost = resolveRewardLevelBoost(sectorId, persisted);

  return {
    id: sectorId,
    displayName: template.displayName,
    biome: template.biome,
    veilBiome: sectorIdToVeilBiome(sectorId),
    hazardLevel: template.hazardLevel,
    rewardLevel: template.rewardLevel + rewardBoost,
    resourceFocus: [...template.resourceFocus],
    activeAnchor: buildVeilAnchorState(sectorId, persisted),
    activeOperation: buildOperationState(sectorId, progressCurrent, persisted),
    echoActivity: template.echoActivity,
    employerPresence: [...template.employerPresence],
  };
}

export function buildAllSectorStates(
  persisted: WorldStatePersistedState,
  operationProgress: Record<string, number>,
): SectorState[] {
  const withAnchors = ensureAllSectorAnchorStates(persisted);
  return SECTOR_WORLD_TEMPLATES.map((t) => buildSectorState(t.id, withAnchors, operationProgress));
}

export function buildRunGenerationContext(
  persisted: WorldStatePersistedState,
  operationProgress: Record<string, number>,
  options?: { breachGrade?: BreachGradeId },
): RunGenerationContext {
  const sectorState = buildSectorState(
    persisted.selectedSectorId,
    persisted,
    operationProgress,
  );
  const employer = getSelectedContractSponsorId(persisted.contractBoard.selectedContract);
  const employerPackage = employer ? EMPLOYER_PACKAGES[employer] : null;
  const activeContract = freezeContractForRun(
    persisted.contractBoard.selectedContract,
    persisted.deployRunIndex,
  );
  const anchor = sectorState.activeAnchor;
  const breachGrade = normalizeBreachGradeId(
    options?.breachGrade ?? persisted.selectedBreachGrade ?? 'I',
  );
  const gradeTuning = getBreachGradeTuning(breachGrade);

  const memory = {
    ...createEmptyProceduralWorldMemory(),
    ...persisted.proceduralWorldMemory,
  };

  const rawBrief = buildRunWorldBrief({
    persisted: { ...persisted, proceduralWorldMemory: memory },
    sectorState,
    contractBoard: persisted.contractBoard.contracts,
    selectedContractId: persisted.contractBoard.selectedContract.kind === 'SPONSOR'
      ? persisted.contractBoard.selectedContract.contract?.id ?? null
      : null,
  });

  const aftermathModifiers = getSectorAftermathModifiers(persisted, sectorState.id);
  const directed = directRunWorldBrief(rawBrief, {
    persisted,
    sectorState,
    contractBoard: persisted.contractBoard.contracts,
    selectedContractId: persisted.contractBoard.selectedContract.kind === 'SPONSOR'
      ? persisted.contractBoard.selectedContract.contract?.id ?? null
      : null,
    memory,
    aftermathModifiers,
  });
  const runWorldBrief = directed.brief;

  const rewardModifiers = {
    creditBonusPct: (employerPackage?.creditBonusPct ?? 0) + gradeTuning.creditBonusPct,
    rareLootBonusPct: (employerPackage?.rareLootBonusPct ?? 0)
      + Math.round(sectorState.rewardLevel * 2)
      + gradeTuning.rareLootBonusPct,
    blackMarketDiscountPct: employerPackage?.blackMarketDiscountPct ?? 0,
    maxHpBonusPct: employerPackage?.maxHpBonusPct ?? 0,
  };

  const procInstance = getActiveAnchorInstance(persisted, persisted.selectedSectorId);
  const scannerSignalBias = buildScannerSignalBiasFromAnchor(anchor?.type ?? null, {
    hazardLevel: sectorState.hazardLevel,
    echoActivity: sectorState.echoActivity,
    anchorActive: anchor?.isActive ?? false,
    proceduralScannerBias: runWorldBrief.scannerBias
      ? {
        anchorSignalMultiplier: runWorldBrief.scannerBias.anchorSignalMultiplier,
        echoSignalMultiplier: runWorldBrief.scannerBias.echoSignalMultiplier,
        operationSignalMultiplier: runWorldBrief.scannerBias.operationSignalMultiplier,
        highRiskMultiplier: runWorldBrief.scannerBias.highRiskMultiplier,
        highValueResourceMultiplier: runWorldBrief.scannerBias.highValueResourceMultiplier,
        extractionUncertainty: runWorldBrief.scannerBias.overlayBias.extractionUncertainty,
        scannerLabelDegradeChance: runWorldBrief.scannerBias.overlayBias.scannerLabelDegrade,
      }
      : procInstance
        ? resolveAnchorScannerBias(procInstance.type, procInstance.modifier)
        : undefined,
  });

  const encounterBias = {
    combatWeightDelta: (anchor?.realityRules.combatBias ?? 0)
      + (runWorldBrief.threatProfile.unstablePressure > 50 ? 0.03 : 0)
      + gradeTuning.combatWeightDelta,
    eliteWeightDelta: (anchor?.realityRules.eliteBias ?? 0)
      + (runWorldBrief.encounterBias.eliteWeight > 1 ? 0.05 : 0)
      + gradeTuning.eliteWeightDelta,
    anomalyWeightDelta: anchor?.realityRules.anomalyBias ?? 0,
    echoWeightDelta: (anchor?.realityRules.echoBias ?? 0)
      + (runWorldBrief.threatProfile.echoPressure > 50 ? 0.05 : 0),
  };

  return {
    sectorState,
    activeOperation: sectorState.activeOperation,
    activeAnchor: anchor,
    employerCabal: employer,
    activeContract,
    rewardModifiers,
    encounterBias,
    scannerSignalBias,
    runWorldBrief,
    breachGrade,
  };
}

export function runGenerationContextToModifiers(
  context: RunGenerationContext,
): RunModifierSnapshot {
  const employer = context.employerCabal;
  const pkg = employer ? EMPLOYER_PACKAGES[employer] : null;

  return {
    maxHpBonusPct: context.rewardModifiers.maxHpBonusPct,
    kineticArmorBonus: pkg?.kineticArmorBonus ?? 0,
    rareLootBonusPct: context.rewardModifiers.rareLootBonusPct,
    blackMarketDiscountPct: context.rewardModifiers.blackMarketDiscountPct,
    firstTurnApBonus: pkg?.firstTurnApBonus ?? 0,
    creditBonusPct: context.rewardModifiers.creditBonusPct,
  };
}

export function resolveOperationCompletionEffect(
  sectorId: SectorId,
  operation: OperationState,
  persisted?: WorldStatePersistedState,
): OperationCompletionEffect {
  const cached = persisted?.operationInstances?.[operation.id]?.completionEffect;
  if (cached) return cached;

  if (persisted) {
    const template = resolveOperationTemplateForSector(sectorId, persisted);
    if (template.completionEffect) return template.completionEffect;
  }

  return resolveCompletionEffect(
    operation.objectiveKind,
    sectorId,
    operation.linkedAnchorId,
  );
}

export function applyOperationCompletion(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operation: OperationState,
): { next: WorldStatePersistedState; logLines: string[] } {
  const operationTemplate = resolveOperationTemplateForSector(sectorId, persisted);
  const effect = resolveOperationCompletionEffect(sectorId, operation, persisted);
  const template = getSectorWorldTemplate(sectorId);
  const logLines = [
    `>> OPERATION COMPLETE — ${operation.title.toUpperCase()}`,
  ];

  if (operationTemplate.completionEffectSummary) {
    logLines.push(`>> ${operationTemplate.completionEffectSummary.toUpperCase()}`);
  }

  let next: WorldStatePersistedState = {
    ...persisted,
    operationProgress: {
      ...persisted.operationProgress,
      [operation.id]: 0,
    },
    activeOperationIndex: { ...persisted.activeOperationIndex },
    temporarySectorModifiers: [...persisted.temporarySectorModifiers],
    dormantAnchorRuns: { ...persisted.dormantAnchorRuns },
    operationLog: [...persisted.operationLog],
  };

  if (effect.deactivateAnchorForRuns && operation.linkedAnchorId) {
    next = suppressAnchorForSector(
      next,
      sectorId,
      operation.linkedAnchorId,
      effect.deactivateAnchorForRuns,
      'operation-completion',
    );
  }

  const effectLines = describeCompletionEffectLines(
    operation.objectiveKind,
    template.anchor?.displayName ?? 'Anchor',
    effect,
  );
  logLines.push(...effectLines);

  if (effect.increaseRewardLevelForRuns) {
    next.temporarySectorModifiers.push({
      sectorId,
      rewardLevelBoost: 1,
      runsRemaining: effect.increaseRewardLevelForRuns,
      label: `${template.displayName} post-operation surge`,
    });
    const rewardAlreadyLogged = effectLines.some((line) =>
      /REWARD|PAYOUT|SURGE|YIELD/i.test(line));
    if (!rewardAlreadyLogged) {
      logLines.push(`>> SECTOR REWARD SURGE — +1 REWARD LEVEL FOR ${effect.increaseRewardLevelForRuns} RUNS IN ${template.displayName.toUpperCase()}.`);
    }
  }

  if (effect.unlockResourceFocus && !effectLines.some((line) => line.includes('RESOURCE FOCUS UNLOCKED'))) {
    logLines.push(`>> RESOURCE FOCUS UNLOCKED — ${effect.unlockResourceFocus.toUpperCase()}.`);
  }

  if (effect.rotateToNextOperation) {
    next = beginOperationCompleted(next, sectorId, operation.id);
  }

  logLines.push('>> CHECK OPERATIONAL BRIEFING FOR UPDATED SECTOR STATUS.');
  next.operationLog = [...logLines, ...next.operationLog].slice(0, 24);

  return { next, logLines };
}

export function tickTemporarySectorModifiers(
  persisted: WorldStatePersistedState,
  sectorId?: SectorId,
): WorldStatePersistedState {
  const withAnchorTick = tickSectorAnchorDormancy(persisted);
  const tickTarget = sectorId ?? persisted.selectedSectorId;
  const withAftermath = tickSectorAftermathForSector(withAnchorTick, tickTarget);
  const temporarySectorModifiers = withAftermath.temporarySectorModifiers
    .map((mod) => ({ ...mod, runsRemaining: mod.runsRemaining - 1 }))
    .filter((mod) => mod.runsRemaining > 0);

  return { ...withAftermath, temporarySectorModifiers };
}

/** Recently suppressed anchor for debrief — first dormant entry with runs remaining. */
export function getSectorSuppressedAnchorBrief(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
) {
  return getRecentlySuppressedAnchor(persisted, sectorId);
}

export function refreshContractBoardAfterRun(
  persisted: WorldStatePersistedState,
): WorldStatePersistedState {
  const deployRunIndex = persisted.deployRunIndex + 1;
  const runSponsorId = getSelectedContractSponsorId(persisted.contractBoard.selectedContract);
  const nextPersisted: WorldStatePersistedState = {
    ...persisted,
    deployRunIndex,
  };
  const sector = buildSectorState(
    nextPersisted.selectedSectorId,
    nextPersisted,
    nextPersisted.operationProgress,
  );
  const anchor = getActiveAnchorInstance(nextPersisted, sector.id);
  const preliminary = buildPreliminaryRunWorldContext({
    persisted: nextPersisted,
    sectorState: sector,
    operation: sector.activeOperation,
    anchor,
  });
  const { contracts, memory } = buildContractBoardFromPersisted(nextPersisted, sector, {
    crisisTheme: preliminary.crisisTheme,
    resourceStress: preliminary.resourceStress,
    threatProfile: preliminary.threatProfile,
    contractBias: preliminary.contractBias,
    sponsorInterest: preliminary.sponsorInterest,
  });
  return {
    ...nextPersisted,
    contractProceduralMemory: memory,
    contractBoard: {
      contracts,
      selectedContract: createIndependentSelectedContract(),
      boardRefreshRunIndex: deployRunIndex,
      lastUsedSponsorId: runSponsorId ?? persisted.contractBoard.lastUsedSponsorId ?? null,
    },
  };
}

export function getHubBlackMarketDiscount(
  persisted: WorldStatePersistedState,
  operationProgress: Record<string, number>,
): number {
  const context = buildRunGenerationContext(persisted, operationProgress);
  return context.rewardModifiers.blackMarketDiscountPct;
}
