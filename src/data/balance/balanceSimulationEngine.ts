/**
 * Full Run Balance Phase C — generation / reward / contract / op sims.
 * Pure offline tools; wrap existing generators. No auto-resolve combat.
 */

import type { ProceduralNodeType, ProceduralRunTree } from '../../types/proceduralRunTree';
import type { OperationObjectiveKind } from '../../types/worldState';
import type { ResourceItemId } from '../../types/resourceItem';
import { assignPendingDepthTypes, generateRunTree } from '../nodeGenerator';
import {
  districtBossKillCredits,
  eliteKillCredits,
  primeBossKillCredits,
  standardKillCredits,
} from '../combatCredits';
import { rollCombatResourceDrops } from '../combatRewardEngine';
import { generateContractBoard } from '../contractGenerator';
import type { GeneratedContract } from '../../types/contract';
import { validateGeneratedContract } from '../runIntegration/contractValidationEngine';
import type { SectorId } from '../../types/worldState';
import { resolveContributionRules } from '../operationRulesEngine';
import {
  OPERATION_BALANCE_PROGRESS_REQUIRED,
  OPERATION_BALANCE_CONTRIBUTION,
} from './operationBalanceConfig';
import { OPERATION_COMPLETION_RUN_TARGET } from './balanceTargets';
import { getResourceDisplayName } from '../resourceRegistry';
import { simulateSealedCasketOpenRolls } from '../sealedCasketOpenEngine';
import { simulateSpecimenJarOpenRolls } from '../sealedSpecimenJarOpenEngine';
import {
  ECONOMY_CASKET_CONFIG,
  ECONOMY_SPECIMEN_JAR_CONFIG,
} from './economyBalanceConfig';
import { debugSimulateCompositionMatrix } from '../encounterCompositionDebugEngine';
import { getDistrictFromDepth, isPrimeBossDepth } from '../districtPacing';

const ALL_OP_KINDS: readonly OperationObjectiveKind[] = [
  'ANCHOR_ASSAULT',
  'ECHO_RECOVERY',
  'EXTRACTION_SURGE',
  'RESOURCE_SURVEY',
  'BOSS_SUPPRESSION',
];

function pct(n: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((n / total) * 1000) / 10}%`;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function histogramLines(map: Map<string, number>, total: number, limit = 12): string[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => `  ${key}: ${count} (${pct(count, total)})`);
}

/** Realize pending node types across the full tree (depths 2..maxDepth-1). */
export function realizeRunTreeTypes(
  tree: ProceduralRunTree,
  depthIndex: 1 | 2 | 3 = 1,
): ProceduralRunTree {
  let next = tree;
  const max = next.maxDepth;
  for (let depth = 2; depth < max; depth += 1) {
    next = assignPendingDepthTypes(next, depth, { depthIndex });
  }
  return next;
}

export function simulateOneRunTreeGeneration(opts?: {
  seed?: string | number;
  depthIndex?: 1 | 2 | 3;
}): {
  tree: ProceduralRunTree;
  typeCounts: Record<string, number>;
  totalNodes: number;
  hasSanctuary: boolean;
  hasMarket: boolean;
  hasExtraction: boolean;
} {
  const depthIndex = opts?.depthIndex ?? 1;
  const seed = opts?.seed ?? `balance-tree:${Date.now()}`;
  const tree = realizeRunTreeTypes(generateRunTree(seed, { depthIndex }), depthIndex);
  const typeCounts: Record<string, number> = {};
  let totalNodes = 0;
  Object.values(tree.nodes).forEach((node) => {
    totalNodes += 1;
    const key = node.type ?? 'UNKNOWN';
    typeCounts[key] = (typeCounts[key] ?? 0) + 1;
  });
  return {
    tree,
    typeCounts,
    totalNodes,
    hasSanctuary: (typeCounts.SANCTUARY ?? 0) > 0,
    hasMarket: (typeCounts.MARKET ?? 0) > 0,
    hasExtraction: (typeCounts.EXTRACTION ?? 0) > 0,
  };
}

export function simulateRunTreeGenerations(
  count = 100,
  opts?: { depthIndex?: 1 | 2 | 3; seedBase?: string },
): {
  runs: number;
  typeTotals: Map<string, number>;
  totalNodes: number;
  sanctuaryRate: number;
  marketRate: number;
  extractionRate: number;
} {
  const depthIndex = opts?.depthIndex ?? 1;
  const seedBase = opts?.seedBase ?? `balance-trees:${Date.now()}`;
  const typeTotals = new Map<string, number>();
  let totalNodes = 0;
  let sanctuaryHits = 0;
  let marketHits = 0;
  let extractionHits = 0;

  for (let i = 0; i < count; i += 1) {
    const sample = simulateOneRunTreeGeneration({
      seed: `${seedBase}:${i}`,
      depthIndex,
    });
    totalNodes += sample.totalNodes;
    if (sample.hasSanctuary) sanctuaryHits += 1;
    if (sample.hasMarket) marketHits += 1;
    if (sample.hasExtraction) extractionHits += 1;
    Object.entries(sample.typeCounts).forEach(([type, n]) => {
      typeTotals.set(type, (typeTotals.get(type) ?? 0) + n);
    });
  }

  return {
    runs: count,
    typeTotals,
    totalNodes,
    sanctuaryRate: sanctuaryHits / count,
    marketRate: marketHits / count,
    extractionRate: extractionHits / count,
  };
}

export function formatRunTreeGenerationReport(count = 100, depthIndex: 1 | 2 | 3 = 1): string {
  const one = simulateOneRunTreeGeneration({ seed: `balance-one:${depthIndex}`, depthIndex });
  const batch = simulateRunTreeGenerations(count, { depthIndex, seedBase: `balance-batch:${depthIndex}` });
  return [
    'BALANCE SIM — RUN TREE GENERATION',
    `chapter depthIndex D${depthIndex} // sample ${batch.runs} trees`,
    '',
    'ONE TREE SNAPSHOT',
    `  nodes: ${one.totalNodes}`,
    ...Object.entries(one.typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `  ${t}: ${n}`),
    `  sanctuary/market/extract present: ${one.hasSanctuary}/${one.hasMarket}/${one.hasExtraction}`,
    '',
    `AGGREGATE (${batch.runs} trees, ${batch.totalNodes} nodes)`,
    ...histogramLines(batch.typeTotals, batch.totalNodes),
    `  trees with sanctuary: ${pct(batch.sanctuaryRate * batch.runs, batch.runs)}`,
    `  trees with market: ${pct(batch.marketRate * batch.runs, batch.runs)}`,
    `  trees with extraction: ${pct(batch.extractionRate * batch.runs, batch.runs)}`,
  ].join('\n');
}

export type RewardSimKind = 'STANDARD' | 'ELITE' | 'BOSS';

export function simulateRewardRolls(opts: {
  depth: number;
  kind?: RewardSimKind;
  count?: number;
  seedBase?: string;
}): {
  credits: number[];
  resourceCounts: Map<ResourceItemId, number>;
  dropTotals: number;
  avgCredits: number;
} {
  const kind = opts.kind ?? 'STANDARD';
  const count = opts.count ?? 100;
  const seedBase = opts.seedBase ?? `reward:${opts.depth}:${kind}`;
  const credits: number[] = [];
  const resourceCounts = new Map<ResourceItemId, number>();
  let dropTotals = 0;

  for (let i = 0; i < count; i += 1) {
    let credit = 0;
    if (kind === 'STANDARD') credit = standardKillCredits(opts.depth);
    else if (kind === 'ELITE') credit = eliteKillCredits(opts.depth);
    else if (isPrimeBossDepth(opts.depth)) credit = primeBossKillCredits(opts.depth);
    else credit = districtBossKillCredits(opts.depth);
    credits.push(credit);

    const drops = rollCombatResourceDrops({
      depth: opts.depth,
      isElite: kind === 'ELITE',
      isGatekeeper: kind === 'BOSS',
      seed: `${seedBase}:${i}`,
      districtDepth: getDistrictFromDepth(opts.depth),
    });
    dropTotals += drops.length;
    drops.forEach((id) => {
      resourceCounts.set(id, (resourceCounts.get(id) ?? 0) + 1);
    });
  }

  return {
    credits,
    resourceCounts,
    dropTotals,
    avgCredits: avg(credits),
  };
}

export function formatRewardRollsReport(
  depth = 8,
  kind: RewardSimKind = 'STANDARD',
  count = 100,
): string {
  const result = simulateRewardRolls({ depth, kind, count });
  const sortedCredits = [...result.credits].sort((a, b) => a - b);
  const minC = sortedCredits[0] ?? 0;
  const maxC = sortedCredits[sortedCredits.length - 1] ?? 0;
  return [
    'BALANCE SIM — REWARD ROLLS',
    `depth ${depth} (district ${getDistrictFromDepth(depth)}) // ${kind} × ${count}`,
    `credits — avg ${result.avgCredits} // min ${minC} // max ${maxC}`,
    `resource drops — total ${result.dropTotals} // avg/fight ${avg([result.dropTotals / count])}`,
    'top resources:',
    ...histogramLines(
      new Map([...result.resourceCounts.entries()].map(([k, v]) => [getResourceDisplayName(k), v])),
      result.dropTotals,
      10,
    ),
  ].join('\n');
}

export function simulateContractGeneration(boardCount = 50): {
  boards: number;
  contracts: number;
  byDifficulty: Map<string, number>;
  byKind: Map<string, number>;
  bySponsor: Map<string, number>;
  avgCredits: number;
  validationFailures: number;
} {
  const byDifficulty = new Map<string, number>();
  const byKind = new Map<string, number>();
  const bySponsor = new Map<string, number>();
  let contracts = 0;
  let creditSum = 0;
  let validationFailures = 0;

  for (let i = 0; i < boardCount; i += 1) {
    const board = generateContractBoard(10_000 + i);
    board.forEach((c: GeneratedContract) => {
      contracts += 1;
      creditSum += c.reward.credits;
      const dKey = String(c.difficulty);
      byDifficulty.set(dKey, (byDifficulty.get(dKey) ?? 0) + 1);
      byKind.set(c.objectiveKind, (byKind.get(c.objectiveKind) ?? 0) + 1);
      bySponsor.set(c.sponsorId, (bySponsor.get(c.sponsorId) ?? 0) + 1);
      const probeSector = (c.validSectorIds[0] ?? 'THE_NULL_ZONE') as SectorId;
      const issues = validateGeneratedContract(c, probeSector).filter((issue) => issue.severity === 'error');
      if (issues.length > 0) validationFailures += 1;
    });
  }

  return {
    boards: boardCount,
    contracts,
    byDifficulty,
    byKind,
    bySponsor,
    avgCredits: contracts > 0 ? Math.round(creditSum / contracts) : 0,
    validationFailures,
  };
}

export function formatContractGenerationReport(boardCount = 50): string {
  const sim = simulateContractGeneration(boardCount);
  return [
    'BALANCE SIM — CONTRACT GENERATION',
    `boards ${sim.boards} // contracts ${sim.contracts} // avg credits ${sim.avgCredits}`,
    `validation failures: ${sim.validationFailures} (${pct(sim.validationFailures, sim.contracts)})`,
    '',
    'BY DIFFICULTY',
    ...histogramLines(sim.byDifficulty, sim.contracts),
    '',
    'BY KIND',
    ...histogramLines(sim.byKind, sim.contracts),
    '',
    'BY SPONSOR',
    ...histogramLines(sim.bySponsor, sim.contracts),
  ].join('\n');
}

/** Heuristic ordinary vs focused run contribution for op completion estimates. */
export function estimateOperationRunContribution(kind: OperationObjectiveKind): {
  ordinary: number;
  focused: number;
  ordinaryRunsToComplete: number;
  focusedRunsToComplete: number;
  rules: ReturnType<typeof resolveContributionRules>;
} {
  const rules = resolveContributionRules(kind);
  const v = OPERATION_BALANCE_CONTRIBUTION;

  let ordinary = 0;
  let focused = 0;

  if (rules.successfulExtraction) {
    ordinary += rules.successfulExtraction;
    focused += rules.successfulExtraction;
  }
  if (rules.emergencyRecallExtraction) {
    focused += rules.emergencyRecallExtraction;
  }
  if (rules.bankAtSafehouse) {
    ordinary += rules.bankAtSafehouse;
    focused += rules.bankAtSafehouse * 2;
  }
  if (rules.defeatElite) {
    ordinary += rules.defeatElite;
    focused += rules.defeatElite * 2;
  }
  if (rules.defeatDepthBoss) {
    focused += rules.defeatDepthBoss;
  }
  if (rules.defeatEcho) {
    ordinary += Math.floor((rules.defeatEcho ?? 0) * 0.5);
    focused += rules.defeatEcho;
  }
  if (rules.defeatAnchorElite) {
    ordinary += Math.floor((rules.defeatAnchorElite ?? 0) * 0.5);
    focused += rules.defeatAnchorElite;
  }
  if (rules.clearAnchorCore) {
    focused += rules.clearAnchorCore;
  }
  if (rules.clearOperationTarget) {
    ordinary += rules.clearOperationTarget;
    focused += rules.clearOperationTarget * 2;
  }
  if (rules.extractTargetResource) {
    ordinary += Math.min(2, v.extractTargetResourceStack * 2);
    focused += Math.min(5, v.extractTargetResourceStack * 5);
  }

  // Fallback so empty rules still show extract pressure.
  if (ordinary <= 0) ordinary = v.successfulExtraction;
  if (focused <= 0) focused = Math.max(ordinary, v.defeatDepthBoss + v.successfulExtraction);

  const goal = OPERATION_BALANCE_PROGRESS_REQUIRED;
  return {
    ordinary,
    focused,
    ordinaryRunsToComplete: Math.ceil(goal / ordinary),
    focusedRunsToComplete: Math.ceil(goal / focused),
    rules,
  };
}

export function formatOperationProgressReport(): string {
  const target = OPERATION_COMPLETION_RUN_TARGET;
  const lines = [
    'BALANCE SIM — OPERATION PROGRESS',
    `goal: ${OPERATION_BALANCE_PROGRESS_REQUIRED} // target focused runs ${target.min}–${target.max}`,
    '',
  ];
  ALL_OP_KINDS.forEach((kind) => {
    const est = estimateOperationRunContribution(kind);
    const flag =
      est.focusedRunsToComplete < target.min
        ? '⚠️ fast'
        : est.focusedRunsToComplete > target.max
          ? '⚠️ slow'
          : 'ok';
    lines.push(
      `${kind}`,
      `  ordinary ~${est.ordinary}/run → ${est.ordinaryRunsToComplete} runs`,
      `  focused  ~${est.focused}/run → ${est.focusedRunsToComplete} runs  [${flag}]`,
    );
  });
  return lines.join('\n');
}

/** Approximate resource income from a decent Depth-1/2 combat run (no full play). */
export function simulateRunResourceIncome(opts?: {
  standardCombats?: number;
  eliteCombats?: number;
  bossCombats?: number;
  baseDepth?: number;
  samples?: number;
}): {
  avgByResource: Map<ResourceItemId, number>;
  avgTotalStacks: number;
  avgCredits: number;
} {
  const standardCombats = opts?.standardCombats ?? 8;
  const eliteCombats = opts?.eliteCombats ?? 1;
  const bossCombats = opts?.bossCombats ?? 1;
  const baseDepth = opts?.baseDepth ?? 8;
  const samples = opts?.samples ?? 40;
  const totals = new Map<ResourceItemId, number>();
  let creditSum = 0;

  for (let s = 0; s < samples; s += 1) {
    let credits = 0;
    const fight = (
      kind: RewardSimKind,
      depth: number,
      index: number,
    ) => {
      const rolled = simulateRewardRolls({
        depth,
        kind,
        count: 1,
        seedBase: `income:${s}:${kind}:${index}`,
      });
      credits += rolled.credits[0] ?? 0;
      rolled.resourceCounts.forEach((n, id) => {
        totals.set(id, (totals.get(id) ?? 0) + n);
      });
    };

    for (let i = 0; i < standardCombats; i += 1) {
      fight('STANDARD', Math.max(1, baseDepth - 2 + (i % 3)), i);
    }
    for (let i = 0; i < eliteCombats; i += 1) {
      fight('ELITE', baseDepth, i);
    }
    for (let i = 0; i < bossCombats; i += 1) {
      fight('BOSS', 15, i);
    }
    creditSum += credits;
  }

  const avgByResource = new Map<ResourceItemId, number>();
  totals.forEach((n, id) => {
    avgByResource.set(id, Math.round((n / samples) * 100) / 100);
  });

  const avgTotalStacks = [...avgByResource.values()].reduce((a, b) => a + b, 0);
  return {
    avgByResource,
    avgTotalStacks: Math.round(avgTotalStacks * 100) / 100,
    avgCredits: Math.round(creditSum / samples),
  };
}

export function formatRunResourceIncomeReport(): string {
  const income = simulateRunResourceIncome();
  return [
    'BALANCE SIM — RUN RESOURCE INCOME (approx)',
    'model: 8 standard + 1 elite + 1 D1 boss @ ~depth 8',
    `avg run credits: ${income.avgCredits}`,
    `avg resource stacks: ${income.avgTotalStacks}`,
    'top avg resources / run:',
    ...[...income.avgByResource.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id, n]) => `  ${getResourceDisplayName(id)}: ${n}`),
  ].join('\n');
}

export function formatSealedOpenBalanceReport(count = 50): string {
  const casket = simulateSealedCasketOpenRolls(count);
  const jar = simulateSpecimenJarOpenRolls(count);
  const casketTiers = new Map<string, number>();
  const jarTiers = new Map<string, number>();
  casket.forEach((r) => casketTiers.set(r.tierId, (casketTiers.get(r.tierId) ?? 0) + 1));
  jar.forEach((r) => jarTiers.set(r.tierId, (jarTiers.get(r.tierId) ?? 0) + 1));

  return [
    'BALANCE SIM — SEALED CONTAINER OPENS',
    `rolls each: ${count}`,
    '',
    `CASKET — sealed sell ${ECONOMY_CASKET_CONFIG.sealedSellValue} // open fee ${ECONOMY_CASKET_CONFIG.openingFee}`,
    ...histogramLines(casketTiers, count),
    '',
    `JAR — sealed sell ${ECONOMY_SPECIMEN_JAR_CONFIG.sealedSellValue} // open fee ${ECONOMY_SPECIMEN_JAR_CONFIG.openingFee}`,
    ...histogramLines(jarTiers, count),
  ].join('\n');
}

export function formatEncounterDistributionReport(): string {
  return [
    'BALANCE SIM — ENCOUNTER DISTRIBUTION',
    '(wraps composition matrix + tree type mix)',
    '',
    debugSimulateCompositionMatrix({ encountersPerCell: 4 }),
    '',
    formatRunTreeGenerationReport(40, 1).split('\n').slice(0, 18).join('\n'),
  ].join('\n');
}

/** One-shot bundle of Phase C sims for DevTest. */
export function formatBalanceSimulationBundle(): string {
  return [
    '══════════════════════════════════════',
    'BALANCE SIMULATION BUNDLE — Phase C',
    '══════════════════════════════════════',
    '',
    formatRunTreeGenerationReport(50, 1),
    '',
    formatRewardRollsReport(8, 'STANDARD', 60),
    '',
    formatRewardRollsReport(20, 'ELITE', 40),
    '',
    formatContractGenerationReport(30),
    '',
    formatOperationProgressReport(),
    '',
    formatRunResourceIncomeReport(),
    '',
    formatSealedOpenBalanceReport(40),
  ].join('\n');
}

export type { ProceduralNodeType };
