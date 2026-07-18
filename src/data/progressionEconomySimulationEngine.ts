/**
 * Progression Spine Phase 1J — Debug tools + economy simulation.
 * Offline career sims and audits for pacing / soft-locks / recipe deps.
 * Does not auto-resolve combat; abstracts extract success + route-intel pity rolls.
 */
import type { ClassType, FactionType } from '../types/game';
import type { BreachGradeId, ProgressionProfile } from '../types/progression';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import { createDefaultProgressionProfile } from './progressionProfileEngine';
import { ALL_SECTOR_IDS, veilBiomeDisplayName, sectorIdToVeilBiome } from './sectorBiomeBridge';
import {
  activateSectorAccessMandate,
  SECTOR_ACCESS_MANDATES,
  resolveSectorAccessFromRun,
  refreshSectorMandateAvailability,
} from './sectorAccessMandateEngine';
import {
  resolveRouteIntelPityTier,
  resolveRouteIntelSpawnChance,
} from './failureRecoveryEngine';
import {
  applyRunnerClearanceFromDebrief,
  clearanceXpProgress,
  computeRunnerClearanceXpGain,
} from './runnerClearanceEngine';
import {
  applyClassRankFromDebrief,
  computeClassRankXpGain,
} from './classRankEngine';
import {
  applyCabalRepFromDebrief,
  computeCabalRepXpGain,
} from './cabalRepEngine';
import { recordSectorHighestGradeCleared } from './breachGradeEngine';
import { rollCombatResourceDrops } from './combatRewardEngine';
import { CRAFTING_REGISTRY, type CraftingRecipe } from './craftingRegistry';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';
import {
  ALL_RESOURCE_ITEM_IDS,
  getResourceDisplayName,
  isResourceItemId,
  RESOURCE_REGISTRY,
} from './resourceRegistry';
import { getProgressionUnlockDefinition, ALL_PROGRESSION_UNLOCK_IDS } from './unlockRegistry';
import { evaluateProgressionRequirements } from './requirementEvaluator';

function createSeededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PacingRange {
  min: number;
  max: number;
  label: string;
}

/** Suggested v1 pacing targets from Progression Spine design. */
export const PROGRESSION_PACING_TARGETS = {
  sectorUnlockRuns: {
    THE_ABYSSAL_SINK: { min: 2, max: 4, label: 'Unlock Abyssal Sink' },
    THE_ASHEN_WASTES: { min: 4, max: 8, label: 'Unlock Ashen Wastes' },
    THE_SLAG_WORKS: { min: 8, max: 14, label: 'Unlock Slag Works' },
    THE_BLACKLINE_TERMINUS: { min: 14, max: 24, label: 'Unlock Blackline Terminus' },
  } as Record<Exclude<SectorId, 'THE_NULL_ZONE'>, PacingRange>,
  breachGradeUnlockRuns: {
    II: { min: 2, max: 4, label: 'Unlock Breach Grade II' },
    III: { min: 8, max: 14, label: 'Unlock Breach Grade III' },
  } as Record<'II' | 'III', PacingRange>,
  firstCabalTier2SponsoredRuns: { min: 4, max: 7, label: 'First Cabal Tier 2' },
  clearanceRank3Runs: { min: 2, max: 5, label: 'Runner Clearance 3 (Grade II gate)' },
  clearanceRank5Runs: { min: 8, max: 16, label: 'Runner Clearance 5 (Grade III gate)' },
} as const;

export interface ProgressionSimOptions {
  runCount?: number;
  seed?: string;
  /** Chance a simulated run extracts successfully. */
  extractSuccessRate?: number;
  /** Chance a sponsored contract succeeds on extract. */
  contractSuccessRate?: number;
  classId?: ClassType;
  sponsorId?: FactionType;
  /** Base contract reputation awarded on success (before cabal engine). */
  contractReputationAwarded?: number;
  autoActivateMandates?: boolean;
  /** Starting profile; defaults to fresh career. */
  startingProfile?: ProgressionProfile;
}

export interface MilestoneHit {
  id: string;
  label: string;
  runIndex: number;
  target?: PacingRange;
  withinTarget: boolean | null;
}

export interface ProgressionSimResult {
  runsSimulated: number;
  seed: string;
  finalProfile: ProgressionProfile;
  milestones: MilestoneHit[];
  avgClearanceXpPerExtract: number;
  avgClassXpPerExtract: number;
  avgCabalRepPerSponsoredSuccess: number;
  totalResourcesExtracted: ResourceQuantity;
  resourcesById: Array<{ id: ResourceItemId; count: number }>;
  sectorUnlockRunIndex: Partial<Record<SectorId, number>>;
  gradeUnlockRunIndex: Partial<Record<BreachGradeId, number>>;
  clearanceRankHitAt: Partial<Record<number, number>>;
  cabalTier2At: number | null;
  extractCount: number;
  failCount: number;
  sponsoredSuccessCount: number;
}

function listAllCraftingRecipes(): CraftingRecipe[] {
  return [...CRAFTING_REGISTRY, ...buildRunItemCraftingRecipes()];
}

function highestUnlockedGrade(profile: ProgressionProfile): BreachGradeId {
  const grades = profile.runner.unlockedBreachGrades;
  if (grades.includes('V')) return 'V';
  if (grades.includes('IV')) return 'IV';
  if (grades.includes('III')) return 'III';
  if (grades.includes('II')) return 'II';
  return 'I';
}

/** Prefer lower grades most of the time so XP pacing matches farming reality. */
function pickRunGrade(profile: ProgressionProfile, rng: () => number): BreachGradeId {
  const grades = profile.runner.unlockedBreachGrades;
  if (grades.length <= 1) return 'I';
  if (grades.includes('I') && rng() < 0.55) return 'I';
  if (grades.includes('II') && rng() < 0.75) return 'II';
  return highestUnlockedGrade(profile);
}

function pickRunSector(profile: ProgressionProfile, rng: () => number): SectorId {
  // Prefer source sectors for ACTIVE mandates that still need unlock.
  for (const mandate of SECTOR_ACCESS_MANDATES) {
    const target = profile.sectors[mandate.targetSectorId];
    if (!target || target.unlocked || target.accessMandateState !== 'ACTIVE') continue;
    const sources = mandate.sourceSectorIds.filter((id) => profile.sectors[id]?.unlocked);
    if (sources.length === 0) continue;
    return sources[Math.floor(rng() * sources.length)] ?? sources[0]!;
  }
  const unlocked = ALL_SECTOR_IDS.filter((id) => profile.sectors[id]?.unlocked);
  if (unlocked.length === 0) return 'THE_NULL_ZONE';
  return unlocked[Math.floor(rng() * unlocked.length)] ?? 'THE_NULL_ZONE';
}

function pickDepthTarget(profile: ProgressionProfile, rng: () => number): number {
  const rank = profile.runner.clearanceRank;
  if (rank >= 5) return rng() < 0.45 ? 3 : 2;
  if (rank >= 3) return rng() < 0.55 ? 2 : 1;
  return 1;
}

function tryActivateAvailableMandates(profile: ProgressionProfile): ProgressionProfile {
  let next = refreshSectorMandateAvailability(profile);
  SECTOR_ACCESS_MANDATES.forEach((mandate) => {
    const sector = next.sectors[mandate.targetSectorId];
    if (!sector || sector.unlocked) return;
    if (sector.accessMandateState !== 'AVAILABLE') return;
    const result = activateSectorAccessMandate(next, mandate.targetSectorId);
    if (result.ok) next = result.profile;
  });
  return next;
}

/** Roll whether route intel drops this run (synthetic elite/boss nodes). */
function rollRouteIntelForRun(
  profile: ProgressionProfile,
  runSectorId: SectorId,
  depth: number,
  rng: () => number,
): ResourceItemId[] {
  const found: ResourceItemId[] = [];
  SECTOR_ACCESS_MANDATES.forEach((mandate) => {
    const sector = profile.sectors[mandate.targetSectorId];
    if (!sector || sector.unlocked) return;
    if (sector.accessMandateState !== 'ACTIVE') return;
    if (!mandate.sourceSectorIds.includes(runSectorId)) return;
    if (depth < mandate.spawn.minDepth) return;

    // One elite + one boss attempt per run (avoid over-optimistic intel finds).
    const nodes: Array<{ isElite: boolean; isBoss: boolean }> = [
      { isElite: true, isBoss: false },
      { isElite: false, isBoss: true },
    ];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]!;
      const roll = resolveRouteIntelSpawnChance({
        failCount: sector.routeIntelFailCount ?? 0,
        isElite: node.isElite,
        isBoss: node.isBoss,
        eliteChance: mandate.spawn.eliteChance,
        bossChance: mandate.spawn.bossChance,
        boostFailCount: mandate.spawn.boostFailCount,
        guaranteeFailCount: mandate.spawn.guaranteeFailCount,
      });
      if (!roll.eligible) continue;
      if (rng() <= roll.chance) {
        found.push(mandate.routeIntelId);
        break;
      }
    }
  });
  return found;
}

function sampleResourceDrops(
  depth: number,
  grade: BreachGradeId,
  seed: string,
  rng: () => number,
): ResourceItemId[] {
  const drops: ResourceItemId[] = [];
  const combatCount = grade === 'I' ? 3 : grade === 'II' ? 4 : 5;
  for (let i = 0; i < combatCount; i += 1) {
    const isElite = rng() < 0.25;
    const isGatekeeper = i === combatCount - 1 && depth >= 2 && rng() < 0.4;
    drops.push(...rollCombatResourceDrops({
      depth: depth * 4 + i,
      isElite,
      isGatekeeper,
      seed: `${seed}:loot:${i}`,
    }));
  }
  return drops;
}

function addQuantity(bag: ResourceQuantity, id: ResourceItemId, qty = 1): void {
  bag[id] = (bag[id] ?? 0) + qty;
}

function pacingStatus(runIndex: number | undefined, target?: PacingRange): boolean | null {
  if (runIndex == null || !target) return null;
  return runIndex >= target.min && runIndex <= target.max;
}

export function simulateProgressionCareer(
  options: ProgressionSimOptions = {},
): ProgressionSimResult {
  const runCount = Math.max(1, Math.min(500, options.runCount ?? 100));
  const seed = options.seed ?? `prog-sim:${Date.now()}`;
  const extractSuccessRate = options.extractSuccessRate ?? 0.72;
  const contractSuccessRate = options.contractSuccessRate ?? 0.7;
  const classId = options.classId ?? 'AEGIS';
  const sponsorId = options.sponsorId ?? 'TERRAN_GRID';
  const contractRep = options.contractReputationAwarded ?? 35;
  const autoActivate = options.autoActivateMandates !== false;
  const rng = createSeededRng(seed);

  let profile = options.startingProfile
    ? { ...options.startingProfile }
    : createDefaultProgressionProfile();
  if (autoActivate) {
    profile = tryActivateAvailableMandates(profile);
  }

  const milestones: MilestoneHit[] = [];
  const sectorUnlockRunIndex: Partial<Record<SectorId, number>> = {
    THE_NULL_ZONE: 0,
  };
  const gradeUnlockRunIndex: Partial<Record<BreachGradeId, number>> = {
    I: 0,
  };
  const clearanceRankHitAt: Partial<Record<number, number>> = {
    [profile.runner.clearanceRank]: 0,
  };
  let cabalTier2At: number | null = profile.cabals[sponsorId]?.repTier >= 2 ? 0 : null;

  let totalClearanceXp = 0;
  let totalClassXp = 0;
  let totalCabalRep = 0;
  let extractCount = 0;
  let failCount = 0;
  let sponsoredSuccessCount = 0;
  const totalResourcesExtracted: ResourceQuantity = {};

  const markMilestone = (
    id: string,
    label: string,
    runIndex: number,
    target?: PacingRange,
  ) => {
    if (milestones.some((m) => m.id === id)) return;
    milestones.push({
      id,
      label,
      runIndex,
      target,
      withinTarget: pacingStatus(runIndex, target),
    });
  };

  for (let run = 1; run <= runCount; run += 1) {
    if (autoActivate) {
      profile = tryActivateAvailableMandates(profile);
    }

    const sectorId = pickRunSector(profile, rng);
    const grade = pickRunGrade(profile, rng);
    const depth = pickDepthTarget(profile, rng);
    const extracted = rng() < extractSuccessRate;
    const contractSucceeded = extracted && rng() < contractSuccessRate;
    const runSeed = `${seed}:run:${run}`;

    const intelFound = rollRouteIntelForRun(profile, sectorId, depth, rng);
    const extractedBag: ResourceQuantity = {};
    const lostBag: ResourceQuantity = {};

    if (extracted) {
      extractCount += 1;
      intelFound.forEach((id) => addQuantity(extractedBag, id, 1));
      sampleResourceDrops(depth, grade, runSeed, rng).forEach((id) => {
        addQuantity(extractedBag, id, 1);
        addQuantity(totalResourcesExtracted, id, 1);
      });
    } else {
      failCount += 1;
      intelFound.forEach((id) => addQuantity(lostBag, id, 1));
    }

    const beforeSectors = { ...profile.sectors };
    const beforeGrades = [...profile.runner.unlockedBreachGrades];
    const beforeClearance = profile.runner.clearanceRank;
    const beforeCabalTier = profile.cabals[sponsorId]?.repTier ?? 0;

    const access = resolveSectorAccessFromRun(profile, {
      extractedSuccessfully: extracted,
      extracted: extractedBag,
      lostOnDeath: lostBag,
      runSectorId: sectorId,
    });
    profile = access.profile;

    const clearance = applyRunnerClearanceFromDebrief(profile, {
      runOutcome: extracted ? 'EXTRACTED' : 'FAILED',
      extractionKind: 'STANDARD',
      depthReached: depth,
      contractSucceeded,
      breachGrade: grade,
    });
    profile = clearance.profile;
    totalClearanceXp += clearance.xpGained;

    const classResult = applyClassRankFromDebrief(profile, classId, {
      runOutcome: extracted ? 'EXTRACTED' : 'FAILED',
      depthReached: depth,
      contractSucceeded,
      breachGrade: grade,
    });
    profile = classResult.profile;
    totalClassXp += classResult.xpGained;

    if (contractSucceeded) {
      sponsoredSuccessCount += 1;
      const cabal = applyCabalRepFromDebrief(profile, {
        contractSucceeded: true,
        reputationAwarded: contractRep,
        sponsorId,
        breachGrade: grade,
      });
      profile = cabal.profile;
      totalCabalRep += cabal.repGained;
    }

    if (extracted) {
      profile = recordSectorHighestGradeCleared(profile, sectorId, grade).profile;
    }

    ALL_SECTOR_IDS.forEach((id) => {
      if (!beforeSectors[id]?.unlocked && profile.sectors[id]?.unlocked) {
        sectorUnlockRunIndex[id] = run;
        const target = (PROGRESSION_PACING_TARGETS.sectorUnlockRuns as Record<string, PacingRange>)[id];
        markMilestone(
          `sector:${id}`,
          `Unlock ${veilBiomeDisplayName(sectorIdToVeilBiome(id))}`,
          run,
          target,
        );
      }
    });

    (['II', 'III', 'IV', 'V'] as BreachGradeId[]).forEach((g) => {
      if (!beforeGrades.includes(g) && profile.runner.unlockedBreachGrades.includes(g)) {
        gradeUnlockRunIndex[g] = run;
        const target = (PROGRESSION_PACING_TARGETS.breachGradeUnlockRuns as Record<string, PacingRange>)[g];
        markMilestone(`grade:${g}`, `Unlock Breach Grade ${g}`, run, target);
      }
    });

    if (profile.runner.clearanceRank > beforeClearance) {
      for (let r = beforeClearance + 1; r <= profile.runner.clearanceRank; r += 1) {
        clearanceRankHitAt[r] = run;
        if (r === 3) {
          markMilestone('clearance:3', PROGRESSION_PACING_TARGETS.clearanceRank3Runs.label, run, PROGRESSION_PACING_TARGETS.clearanceRank3Runs);
        }
        if (r === 5) {
          markMilestone('clearance:5', PROGRESSION_PACING_TARGETS.clearanceRank5Runs.label, run, PROGRESSION_PACING_TARGETS.clearanceRank5Runs);
        }
      }
    }

    const cabalTier = profile.cabals[sponsorId]?.repTier ?? 0;
    if (cabalTier2At == null && cabalTier >= 2 && beforeCabalTier < 2) {
      cabalTier2At = run;
      markMilestone(
        'cabal:tier2',
        PROGRESSION_PACING_TARGETS.firstCabalTier2SponsoredRuns.label,
        run,
        PROGRESSION_PACING_TARGETS.firstCabalTier2SponsoredRuns,
      );
    }
  }

  const resourcesById = Object.entries(totalResourcesExtracted)
    .map(([id, count]) => ({ id: id as ResourceItemId, count: count ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    runsSimulated: runCount,
    seed,
    finalProfile: profile,
    milestones,
    avgClearanceXpPerExtract: extractCount > 0 ? Math.round((totalClearanceXp / extractCount) * 10) / 10 : 0,
    avgClassXpPerExtract: extractCount > 0 ? Math.round((totalClassXp / extractCount) * 10) / 10 : 0,
    avgCabalRepPerSponsoredSuccess:
      sponsoredSuccessCount > 0
        ? Math.round((totalCabalRep / sponsoredSuccessCount) * 10) / 10
        : 0,
    totalResourcesExtracted,
    resourcesById,
    sectorUnlockRunIndex,
    gradeUnlockRunIndex,
    clearanceRankHitAt,
    cabalTier2At,
    extractCount,
    failCount,
    sponsoredSuccessCount,
  };
}

export function formatProgressionPacingTargetsReport(): string {
  const lines = [
    '=== PROGRESSION PACING TARGETS (PHASE 1J) ===',
    'Suggested v1 run-count bands (successful career sims should land inside):',
    '',
  ];
  Object.values(PROGRESSION_PACING_TARGETS.sectorUnlockRuns).forEach((t) => {
    lines.push(`- ${t.label}: ${t.min}–${t.max} runs`);
  });
  Object.values(PROGRESSION_PACING_TARGETS.breachGradeUnlockRuns).forEach((t) => {
    lines.push(`- ${t.label}: ${t.min}–${t.max} runs`);
  });
  lines.push(
    `- ${PROGRESSION_PACING_TARGETS.clearanceRank3Runs.label}: ${PROGRESSION_PACING_TARGETS.clearanceRank3Runs.min}–${PROGRESSION_PACING_TARGETS.clearanceRank3Runs.max} runs`,
  );
  lines.push(
    `- ${PROGRESSION_PACING_TARGETS.clearanceRank5Runs.label}: ${PROGRESSION_PACING_TARGETS.clearanceRank5Runs.min}–${PROGRESSION_PACING_TARGETS.clearanceRank5Runs.max} runs`,
  );
  lines.push(
    `- ${PROGRESSION_PACING_TARGETS.firstCabalTier2SponsoredRuns.label}: ${PROGRESSION_PACING_TARGETS.firstCabalTier2SponsoredRuns.min}–${PROGRESSION_PACING_TARGETS.firstCabalTier2SponsoredRuns.max} sponsored runs`,
  );
  lines.push('=== END PACING TARGETS ===');
  return lines.join('\n');
}

export function formatProgressionEconomySimulationReport(
  result: ProgressionSimResult,
): string {
  const xp = clearanceXpProgress(result.finalProfile);
  const lines = [
    '=== PROGRESSION ECONOMY SIM (PHASE 1J) ===',
    `Seed: ${result.seed}`,
    `Runs: ${result.runsSimulated} // extracts ${result.extractCount} // fails ${result.failCount}`,
    `Sponsored successes: ${result.sponsoredSuccessCount}`,
    `Avg clearance XP / extract: ${result.avgClearanceXpPerExtract}`,
    `Avg class XP / extract: ${result.avgClassXpPerExtract}`,
    `Avg cabal rep / sponsored success: ${result.avgCabalRepPerSponsoredSuccess}`,
    `Final clearance: ${xp.rank} (${xp.current}/${xp.required} XP)`,
    `Final grades: ${result.finalProfile.runner.unlockedBreachGrades.join(', ')}`,
    '',
    '--- MILESTONES vs TARGETS ---',
  ];

  if (result.milestones.length === 0) {
    lines.push('(no milestones hit)');
  } else {
    result.milestones.forEach((m) => {
      const band = m.target ? `${m.target.min}–${m.target.max}` : '—';
      const flag = m.withinTarget == null ? '?' : m.withinTarget ? 'OK' : 'OFF';
      lines.push(`[${flag}] ${m.label} @ run ${m.runIndex} (target ${band})`);
    });
  }

  lines.push('');
  lines.push('--- SECTOR UNLOCK INDEX ---');
  ALL_SECTOR_IDS.forEach((id) => {
    const at = result.sectorUnlockRunIndex[id];
    const name = veilBiomeDisplayName(sectorIdToVeilBiome(id));
    lines.push(`${name}: ${at == null ? 'LOCKED' : `run ${at}`}`);
  });

  lines.push('');
  lines.push('--- TOP RESOURCES EXTRACTED ---');
  result.resourcesById.slice(0, 12).forEach((entry) => {
    lines.push(`  ${getResourceDisplayName(entry.id, true)}: ${entry.count}`);
  });

  lines.push('');
  lines.push('--- ACTIVE MANDATE PITY ---');
  SECTOR_ACCESS_MANDATES.forEach((mandate) => {
    const sector = result.finalProfile.sectors[mandate.targetSectorId];
    if (!sector || sector.unlocked || sector.accessMandateState !== 'ACTIVE') return;
    const boostAt = mandate.spawn.boostFailCount ?? 2;
    const guaranteeAt = mandate.spawn.guaranteeFailCount ?? 3;
    const tier = resolveRouteIntelPityTier(sector.routeIntelFailCount, boostAt, guaranteeAt);
    lines.push(
      `${mandate.label}: fails ${sector.routeIntelFailCount} // ${tier}`,
    );
  });

  lines.push('=== END PROGRESSION ECONOMY SIM ===');
  return lines.join('\n');
}

export interface RecipeDependencyIssue {
  recipeId: string;
  recipeLabel: string;
  resourceId: string;
  issue: 'MISSING_RESOURCE' | 'ZERO_QUANTITY';
}

export interface ResourceUsageAudit {
  unusedResourceIds: ResourceItemId[];
  overusedResourceIds: Array<{ id: ResourceItemId; recipeCount: number }>;
  recipeIngredientCounts: Array<{ id: ResourceItemId; recipeCount: number }>;
  missingIngredientIssues: RecipeDependencyIssue[];
}

/** Audit recipe ↔ resource registry wiring. */
export function auditRecipeResourceDependencies(): ResourceUsageAudit {
  const recipes = listAllCraftingRecipes();
  const ingredientCounts = new Map<ResourceItemId, number>();
  const missingIngredientIssues: RecipeDependencyIssue[] = [];

  recipes.forEach((recipe) => {
    recipe.requirements.forEach((req) => {
      if (!isResourceItemId(req.resourceId)) {
        missingIngredientIssues.push({
          recipeId: recipe.id,
          recipeLabel: recipe.label,
          resourceId: req.resourceId,
          issue: 'MISSING_RESOURCE',
        });
        return;
      }
      if (req.quantity <= 0) {
        missingIngredientIssues.push({
          recipeId: recipe.id,
          recipeLabel: recipe.label,
          resourceId: req.resourceId,
          issue: 'ZERO_QUANTITY',
        });
      }
      ingredientCounts.set(
        req.resourceId,
        (ingredientCounts.get(req.resourceId) ?? 0) + 1,
      );
    });
  });

  const craftRelevant = ALL_RESOURCE_ITEM_IDS.filter((id) => {
    const def = RESOURCE_REGISTRY[id];
    return def.canBeCraftingIngredient || def.primaryRole === 'CRAFTING_MATERIAL';
  });

  const unusedResourceIds = craftRelevant.filter((id) => !ingredientCounts.has(id));
  const recipeIngredientCounts = [...ingredientCounts.entries()]
    .map(([id, recipeCount]) => ({ id, recipeCount }))
    .sort((a, b) => b.recipeCount - a.recipeCount);
  const overusedResourceIds = recipeIngredientCounts.filter((e) => e.recipeCount >= 4);

  return {
    unusedResourceIds,
    overusedResourceIds,
    recipeIngredientCounts,
    missingIngredientIssues,
  };
}

export interface SoftLockIssue {
  id: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

/** Detect progression soft-locks on a profile. */
export function auditProgressionSoftLocks(profile: ProgressionProfile): SoftLockIssue[] {
  const issues: SoftLockIssue[] = [];
  const refreshed = refreshSectorMandateAvailability(profile);

  SECTOR_ACCESS_MANDATES.forEach((mandate) => {
    const sector = refreshed.sectors[mandate.targetSectorId];
    if (!sector || sector.unlocked) return;
    if (sector.accessMandateState !== 'ACTIVE' && sector.accessMandateState !== 'AVAILABLE') {
      return;
    }
    const unlockedSources = mandate.sourceSectorIds.filter((id) => refreshed.sectors[id]?.unlocked);
    if (unlockedSources.length === 0) {
      issues.push({
        id: `mandate-no-source:${mandate.targetSectorId}`,
        severity: 'ERROR',
        message:
          `${mandate.label} is ${sector.accessMandateState} but no source sector is unlocked`
          + ` (${mandate.sourceSectorIds.join(', ')}).`,
      });
    }
    if (sector.accessMandateState === 'ACTIVE' && sector.routeIntelFailCount >= 3) {
      const pityTier = resolveRouteIntelPityTier(
        sector.routeIntelFailCount,
        mandate.spawn.boostFailCount ?? 2,
        mandate.spawn.guaranteeFailCount ?? 3,
      );
      if (pityTier !== 'GUARANTEED') {
        issues.push({
          id: `pity-mismatch:${mandate.targetSectorId}`,
          severity: 'WARNING',
          message:
            `${mandate.label} has ${sector.routeIntelFailCount} fail(s) but pity tier is ${pityTier}.`,
        });
      }
    }
  });

  ALL_PROGRESSION_UNLOCK_IDS.forEach((unlockId) => {
    const def = getProgressionUnlockDefinition(unlockId);
    if (!def || refreshed.grantedUnlocks.includes(unlockId)) return;
    // Only flag unlocks that look permanently unreachable (empty reqs already owned path).
    if (def.requirements.length === 0) return;
    const evalResult = evaluateProgressionRequirements(refreshed, def.requirements);
    if (!evalResult.ok && unlockId.startsWith('sector.') && unlockId !== 'sector.null_zone') {
      // Not an error by itself — just note locked sectors without active mandate.
      const sectorId = def.rewards.find((r) => r.kind === 'SET_SECTOR_UNLOCKED')?.targetId as SectorId | undefined;
      if (sectorId) {
        const st = refreshed.sectors[sectorId];
        if (st && !st.unlocked && st.accessMandateState === 'LOCKED' && refreshed.runner.clearanceRank >= 6) {
          issues.push({
            id: `sector-stuck:${sectorId}`,
            severity: 'WARNING',
            message: `${def.label} still LOCKED at clearance ${refreshed.runner.clearanceRank}.`,
          });
        }
      }
    }
  });

  if (!refreshed.sectors.THE_NULL_ZONE?.unlocked) {
    issues.push({
      id: 'null-zone-locked',
      severity: 'ERROR',
      message: 'Null Zone is locked — starter sector must always be unlocked.',
    });
  }

  return issues;
}

export function formatProgressionAuditReport(profile?: ProgressionProfile): string {
  const recipeAudit = auditRecipeResourceDependencies();
  const softLocks = auditProgressionSoftLocks(profile ?? createDefaultProgressionProfile());
  const lines = [
    '=== PROGRESSION AUDIT (PHASE 1J) ===',
    '',
    '--- RECIPE / RESOURCE DEPENDENCIES ---',
    `Recipes scanned: ${listAllCraftingRecipes().length}`,
    `Missing / bad ingredients: ${recipeAudit.missingIngredientIssues.length}`,
  ];
  if (recipeAudit.missingIngredientIssues.length === 0) {
    lines.push('  (none)');
  } else {
    recipeAudit.missingIngredientIssues.forEach((issue) => {
      lines.push(`  [${issue.issue}] ${issue.recipeLabel} → ${issue.resourceId}`);
    });
  }
  lines.push(`Craft-mat resources unused by any recipe: ${recipeAudit.unusedResourceIds.length}`);
  recipeAudit.unusedResourceIds.slice(0, 16).forEach((id) => {
    lines.push(`  - ${getResourceDisplayName(id)} (${id})`);
  });
  lines.push('Most-used craft ingredients:');
  recipeAudit.recipeIngredientCounts.slice(0, 10).forEach((entry) => {
    lines.push(`  ${getResourceDisplayName(entry.id, true)}: ${entry.recipeCount} recipes`);
  });
  lines.push(`Overused (≥4 recipes): ${recipeAudit.overusedResourceIds.length}`);
  recipeAudit.overusedResourceIds.forEach((entry) => {
    lines.push(`  ${getResourceDisplayName(entry.id, true)}: ${entry.recipeCount}`);
  });

  lines.push('');
  lines.push('--- SOFT-LOCK CHECK ---');
  if (softLocks.length === 0) {
    lines.push('  (no soft-lock issues)');
  } else {
    softLocks.forEach((issue) => {
      lines.push(`  [${issue.severity}] ${issue.message}`);
    });
  }

  lines.push('=== END PROGRESSION AUDIT ===');
  return lines.join('\n');
}

/** Quick XP / rep preview for a single hypothetical run (no mutation). */
export function formatProgressionPerRunPreview(opts?: {
  depth?: number;
  breachGrade?: BreachGradeId;
  extracted?: boolean;
  contractSucceeded?: boolean;
  reputationAwarded?: number;
  classId?: ClassType;
  sponsorId?: FactionType;
}): string {
  const depth = opts?.depth ?? 2;
  const grade = opts?.breachGrade ?? 'I';
  const extracted = opts?.extracted !== false;
  const contractSucceeded = opts?.contractSucceeded ?? extracted;
  const classId = opts?.classId ?? 'AEGIS';
  const sponsorId = opts?.sponsorId ?? 'TERRAN_GRID';
  const reputationAwarded = opts?.reputationAwarded ?? 35;

  const clearanceXp = computeRunnerClearanceXpGain({
    runOutcome: extracted ? 'EXTRACTED' : 'FAILED',
    extractionKind: 'STANDARD',
    depthReached: depth,
    contractSucceeded,
    breachGrade: grade,
  });
  const classXp = computeClassRankXpGain({
    runOutcome: extracted ? 'EXTRACTED' : 'FAILED',
    depthReached: depth,
    contractSucceeded,
    breachGrade: grade,
  });
  const cabalRep = contractSucceeded
    ? computeCabalRepXpGain({
      contractSucceeded: true,
      reputationAwarded,
      sponsorId,
      breachGrade: grade,
    })
    : 0;

  return [
    '=== PER-RUN PROGRESSION PREVIEW (PHASE 1J) ===',
    `Depth ${depth} // Grade ${grade} // ${extracted ? 'EXTRACT' : 'FAIL'} // contract ${contractSucceeded ? 'OK' : 'NO'}`,
    `Runner Clearance XP: +${clearanceXp}`,
    `Class XP (${classId}): +${classXp}`,
    `Cabal Rep (${sponsorId}): +${cabalRep}`,
    '=== END PREVIEW ===',
  ].join('\n');
}

/** Compare a sim result against pacing targets as a compact pass/fail board. */
export function formatProgressionPacingScorecard(result: ProgressionSimResult): string {
  const lines = [
    '=== PACING SCORECARD (PHASE 1J) ===',
    `Sim ${result.runsSimulated} runs // seed ${result.seed}`,
    '',
  ];
  let ok = 0;
  let off = 0;
  let miss = 0;
  result.milestones.forEach((m) => {
    if (m.withinTarget === true) ok += 1;
    else if (m.withinTarget === false) off += 1;
    else miss += 1;
    const band = m.target ? `${m.target.min}–${m.target.max}` : '—';
    const flag = m.withinTarget == null ? '  ?' : m.withinTarget ? ' OK' : 'OFF';
    lines.push(`${flag}  ${m.label.padEnd(36)} run ${String(m.runIndex).padStart(3)}  target ${band}`);
  });
  const expected = [
    ...Object.keys(PROGRESSION_PACING_TARGETS.sectorUnlockRuns).map((id) => `sector:${id}`),
    ...Object.keys(PROGRESSION_PACING_TARGETS.breachGradeUnlockRuns).map((g) => `grade:${g}`),
    'clearance:3',
    'clearance:5',
    'cabal:tier2',
  ];
  expected.forEach((id) => {
    if (!result.milestones.some((m) => m.id === id)) {
      miss += 1;
      lines.push(`MISS  ${id} not reached in ${result.runsSimulated} runs`);
    }
  });
  lines.push('');
  lines.push(`Summary: OK ${ok} // OFF ${off} // MISS ${miss}`);
  lines.push('=== END SCORECARD ===');
  return lines.join('\n');
}
