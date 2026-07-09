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
import { generateContractBoard } from './contractGenerator';
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
import {
  anchorIdForSector,
  getSectorWorldTemplate,
  SECTOR_WORLD_TEMPLATES,
} from './sectorWorldCatalog';
import { sectorIdToVeilBiome } from './sectorBiomeBridge';
import {
  buildScannerSignalBiasFromAnchor,
  getAnchorRealityRules,
} from './anchorRegistry';

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
  return {
    selectedSectorId: 'THE_SLAG_WORKS',
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
    version: 2,
  };
}

export function resolveSectorOperationIndex(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
): number {
  return persisted.activeOperationIndex[sectorId] ?? 0;
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

  const id = anchorIdForSector(sectorId, template.anchor.type);
  if (isAnchorDormant(id, persisted)) return null;

  return {
    id,
    sectorId,
    type: template.anchor.type,
    displayName: template.anchor.displayName,
    description: template.anchor.description,
    isActive: true,
    realityRules: getAnchorRealityRules(template.anchor.type),
  };
}

export function buildOperationState(
  sectorId: SectorId,
  progressCurrent: number,
  persisted: WorldStatePersistedState,
): OperationState {
  const template = getSectorWorldTemplate(sectorId);
  const operationIndex = resolveSectorOperationIndex(sectorId, persisted);
  const operationTemplate = resolveSectorOperationTemplate(
    sectorId,
    operationIndex,
    persisted.deployRunIndex,
    persisted.sectorOperationOverrides,
  );
  const lifecycle = getSectorOperationLifecycle(persisted, sectorId, operationTemplate.id);
  const anchor = template.anchor
    ? anchorIdForSector(sectorId, template.anchor.type)
    : undefined;

  return {
    id: operationTemplate.id,
    sectorId,
    title: operationTemplate.title,
    description: operationTemplate.description,
    objectiveKind: operationTemplate.objectiveKind,
    linkedAnchorId: anchor,
    progressCurrent,
    progressRequired: DEFAULT_OPERATION_PROGRESS_REQUIRED,
    rewardEmphasis: operationTemplate.rewardEmphasis,
    contributionRules: resolveContributionRules(operationTemplate.objectiveKind),
    lifecycleStatus: lifecycle.status,
    runsRemaining: operationRunsRemaining(lifecycle),
    generatedAtRunIndex: lifecycle.generatedAtRunIndex,
    expiresAtRunIndex: lifecycle.expiresAtRunIndex,
    rewardPreview: formatOperationRewardPreview(operationTemplate.rewardEmphasis),
  };
}

export function buildSectorState(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
  operationProgress: Record<string, number>,
): SectorState {
  const template = getSectorWorldTemplate(sectorId);
  const operationTemplate = resolveSectorOperationTemplate(
    sectorId,
    resolveSectorOperationIndex(sectorId, persisted),
    persisted.deployRunIndex,
    persisted.sectorOperationOverrides,
  );
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
  return SECTOR_WORLD_TEMPLATES.map((t) => buildSectorState(t.id, persisted, operationProgress));
}

export function buildRunGenerationContext(
  persisted: WorldStatePersistedState,
  operationProgress: Record<string, number>,
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

  const rewardModifiers = {
    creditBonusPct: employerPackage?.creditBonusPct ?? 0,
    rareLootBonusPct: (employerPackage?.rareLootBonusPct ?? 0)
      + Math.round(sectorState.rewardLevel * 2),
    blackMarketDiscountPct: employerPackage?.blackMarketDiscountPct ?? 0,
    maxHpBonusPct: employerPackage?.maxHpBonusPct ?? 0,
  };

  const encounterBias = {
    combatWeightDelta: anchor?.realityRules.combatBias ?? 0,
    eliteWeightDelta: anchor?.realityRules.eliteBias ?? 0,
    anomalyWeightDelta: anchor?.realityRules.anomalyBias ?? 0,
    echoWeightDelta: anchor?.realityRules.echoBias ?? 0,
  };

  const scannerSignalBias = buildScannerSignalBiasFromAnchor(anchor?.type ?? null, {
    hazardLevel: sectorState.hazardLevel,
    echoActivity: sectorState.echoActivity,
    anchorActive: anchor?.isActive ?? false,
  });

  return {
    sectorState,
    activeOperation: sectorState.activeOperation,
    activeAnchor: anchor,
    employerCabal: employer,
    activeContract,
    rewardModifiers,
    encounterBias,
    scannerSignalBias,
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
  };
}

export function resolveOperationCompletionEffect(
  sectorId: SectorId,
  operation: OperationState,
): OperationCompletionEffect {
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
  const effect = resolveOperationCompletionEffect(sectorId, operation);
  const template = getSectorWorldTemplate(sectorId);
  const logLines = [
    `>> OPERATION COMPLETE — ${operation.title.toUpperCase()}`,
  ];

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
    next.dormantAnchorRuns[operation.linkedAnchorId] = effect.deactivateAnchorForRuns;
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
): WorldStatePersistedState {
  const temporarySectorModifiers = persisted.temporarySectorModifiers
    .map((mod) => ({ ...mod, runsRemaining: mod.runsRemaining - 1 }))
    .filter((mod) => mod.runsRemaining > 0);

  const dormantAnchorRuns = Object.fromEntries(
    Object.entries(persisted.dormantAnchorRuns)
      .map(([id, runs]) => [id, runs - 1] as const)
      .filter(([, runs]) => runs > 0),
  );

  return { ...persisted, temporarySectorModifiers, dormantAnchorRuns };
}

export function refreshContractBoardAfterRun(
  persisted: WorldStatePersistedState,
): WorldStatePersistedState {
  const deployRunIndex = persisted.deployRunIndex + 1;
  const runSponsorId = getSelectedContractSponsorId(persisted.contractBoard.selectedContract);
  return {
    ...persisted,
    deployRunIndex,
    contractBoard: {
      contracts: generateContractBoard(deployRunIndex),
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
