/**
 * Progression Spine Phase 1H — Debrief progression theater.
 * Structured "what changed / what's next" cards. Never gates debrief exit.
 */
import type { ClassType, FactionType, PlayerAccount } from '../types/game';
import type { BreachGradeId, ProgressionProfile } from '../types/progression';
import type { SectorId } from '../types/worldState';
import type { OperationDebriefPayload } from './runDebriefEngine';
import { getAccountProgressionProfile } from './progressionDebugEngine';
import { clearanceXpProgress, computeRunnerClearanceXpGain, xpRequiredForClearanceRank } from './runnerClearanceEngine';
import {
  buildClassRankDebriefLines,
  classRankXpProgress,
  computeClassRankXpGain,
  xpRequiredForClassRank,
  CLASS_RANK_MAX,
} from './classRankEngine';
import {
  buildCabalRepDebriefLines,
  cabalRepXpProgress,
  computeCabalRepXpGain,
  xpRequiredForCabalTier,
  CABAL_REP_TIER_MAX,
  maxCabalTierForBreachGrade,
} from './cabalRepEngine';
import { buildBreachGradeDebriefLines, formatBreachGradeLabel } from './breachGradeEngine';
import {
  evaluateAllPinnedGoals,
  formatPinnedGoalDebriefCard,
  listAvailableGoalsToPin,
  maxPinnedGoalSlots,
  type ProgressionGoalDefinition,
} from './pinnedGoalEngine';
import {
  SECTOR_ACCESS_MANDATES,
  getMandateForRouteIntel,
  getActiveRouteIntelPityStatuses,
  buildFailureRecoveryDebriefLines,
} from './sectorAccessMandateEngine';
import { veilBiomeDisplayName, sectorIdToVeilBiome } from './sectorBiomeBridge';
import { getResourceDisplayName } from './resourceRegistry';
import type { ResourceItemId } from '../types/resourceItem';
import { formatCraftingOpportunityLines } from './runIntegration/runCraftingOpportunityEngine';
import { buildNextActionSuggestions } from './runIntegration/runNextActionEngine';
import type { SectorState, WorldStatePersistedState } from '../types/worldState';
import { listForgeVisibleRecipes } from './recipeVisibilityEngine';
import { sponsorDisplayName } from '../utils/contractUi';

export type DebriefTheaterCardKind =
  | 'CELEBRATE'
  | 'PROGRESS'
  | 'HINT'
  | 'PIN_GOAL';

export interface DebriefTheaterCard {
  id: string;
  kind: DebriefTheaterCardKind;
  title: string;
  lines: string[];
  /** When kind === PIN_GOAL */
  goalDefId?: string;
}

export interface DebriefTheaterSection {
  id: string;
  label: string;
  cards: DebriefTheaterCard[];
}

export interface DebriefProgressionTheater {
  sections: DebriefTheaterSection[];
  /** Flat celebrate titles for hub log. */
  celebrationTitles: string[];
  /** Goals recommended for pinning from this debrief. */
  pinSuggestions: ProgressionGoalDefinition[];
  pinSlotsUsed: number;
  pinSlotsMax: number;
}

export interface DebriefTheaterInput {
  account: PlayerAccount;
  debrief: OperationDebriefPayload;
  world: {
    persisted: WorldStatePersistedState;
    sectors: SectorState[];
    selectedSectorId: string | null;
  };
  /** Optional resolved contract after routing. */
  contractSucceeded?: boolean;
  sponsorId?: FactionType | null;
  reputationAwarded?: number;
}

function pushSection(
  sections: DebriefTheaterSection[],
  id: string,
  label: string,
  cards: DebriefTheaterCard[],
): void {
  if (cards.length === 0) return;
  sections.push({ id, label, cards });
}

function sectorName(sectorId: SectorId): string {
  return veilBiomeDisplayName(sectorIdToVeilBiome(sectorId));
}

/** Build the Phase 1H progression theater for the REWARDS step (preview — pre-apply). */
export function buildDebriefProgressionTheater(
  input: DebriefTheaterInput,
): DebriefProgressionTheater {
  const profile = getAccountProgressionProfile(input.account);
  const debrief = input.debrief;
  const breachGrade = (debrief.breachGrade ?? 'I') as BreachGradeId;
  const runOutcome = debrief.runOutcome;
  const depthReached = Math.max(
    1,
    debrief.balanceTelemetry?.maxDepthReached
      ?? debrief.routingState?.contractProgress.highestDepthReached
      ?? 1,
  );
  const contractSucceeded = input.contractSucceeded
    ?? debrief.contractResult.status === 'SUCCESS';
  const sections: DebriefTheaterSection[] = [];
  const celebrationTitles: string[] = [];

  // --- RUN RESULT ---
  pushSection(sections, 'run_result', 'Run Result', [
    {
      id: 'run-result',
      kind: 'PROGRESS',
      title: runOutcome === 'EXTRACTED' ? 'EXTRACTION SECURED' : 'RUN FAILED',
      lines: [
        `${debrief.sectorName} // ${formatBreachGradeLabel(breachGrade, true)}`,
        debrief.operationTitle,
        `Depth ${depthReached} // ${debrief.extractionKind.replace(/_/g, ' ')}`,
      ],
    },
  ]);

  // --- CARGO EXTRACTED (compact) ---
  const cargoLines: string[] = [];
  debrief.resourceSections.slice(0, 3).forEach((section) => {
    cargoLines.push(`${section.title}: ${section.totalItems} stacks`);
  });
  if (debrief.craftingOpportunities.highlightResources.length > 0) {
    cargoLines.push(
      `Key mats: ${debrief.craftingOpportunities.highlightResources
        .slice(0, 4)
        .map((id) => getResourceDisplayName(id, true))
        .join(', ')}`,
    );
  }
  if (cargoLines.length > 0) {
    pushSection(sections, 'cargo', 'Cargo Extracted', [
      {
        id: 'cargo-summary',
        kind: 'PROGRESS',
        title: runOutcome === 'EXTRACTED' ? 'CARGO SECURED' : 'CARGO RESOLUTION',
        lines: cargoLines,
      },
    ]);
  }

  // --- PINNED GOAL PROGRESS ---
  const pinnedStatuses = evaluateAllPinnedGoals(profile);
  const pinnedCards: DebriefTheaterCard[] = pinnedStatuses.map((status) => {
    const card = formatPinnedGoalDebriefCard(status);
    if (status.completed) {
      celebrationTitles.push(card.title);
    }
    return {
      id: `pin-${status.pinned.id}`,
      kind: status.completed ? 'CELEBRATE' : 'PROGRESS',
      title: card.title,
      lines: card.lines,
    };
  });
  pushSection(sections, 'pinned_goals', 'Pinned Goal Progress', pinnedCards);

  // --- SECTOR ACCESS ---
  const sectorCards: DebriefTheaterCard[] = [];
  const extracted = debrief.runResourceLedger?.extracted ?? {};
  if (runOutcome === 'EXTRACTED') {
    SECTOR_ACCESS_MANDATES.forEach((mandate) => {
      const qty = extracted[mandate.routeIntelId] ?? 0;
      if (qty <= 0) return;
      const sector = profile.sectors[mandate.targetSectorId];
      if (sector?.unlocked) return;
      const name = sectorName(mandate.targetSectorId);
      const title = `${name} — UNLOCK READY`;
      celebrationTitles.push(title);
      sectorCards.push({
        id: `sector-${mandate.targetSectorId}`,
        kind: 'CELEBRATE',
        title,
        lines: [
          `${getResourceDisplayName(mandate.routeIntelId)} extracted`,
          'Sector unlocks on return to hub.',
        ],
      });
    });
  } else {
    const lost = debrief.runResourceLedger?.lostOnDeath ?? {};
    const lostIntelIds: ResourceItemId[] = [];
    Object.keys(lost).forEach((id) => {
      if ((lost[id as ResourceItemId] ?? 0) <= 0) return;
      if (!getMandateForRouteIntel(id as ResourceItemId)) return;
      lostIntelIds.push(id as ResourceItemId);
    });
    buildFailureRecoveryDebriefLines(profile, { lostRouteIntelIds: lostIntelIds }).forEach((line, i) => {
      const celebrate = line.includes('GUARANTEED') || line.includes('guaranteed') || line.includes('BOOSTED') || line.includes('boosted');
      sectorCards.push({
        id: `recovery-${i}`,
        kind: celebrate ? 'CELEBRATE' : 'HINT',
        title: line.startsWith('FAILURE RECOVERY') ? 'FAILURE RECOVERY' : 'ROUTE INTEL LOST',
        lines: [line],
      });
    });
  }
  // Active pity status on successful extracts (still hunting another sector).
  if (runOutcome === 'EXTRACTED') {
    getActiveRouteIntelPityStatuses(profile).forEach((status) => {
      if (status.tier === 'NONE' && status.failCount === 0) return;
      sectorCards.push({
        id: `pity-${status.targetSectorId}`,
        kind: status.tier === 'GUARANTEED' ? 'CELEBRATE' : 'PROGRESS',
        title: `${status.mandateLabel} // ${status.tier}`,
        lines: [status.summaryLine],
      });
    });
  }
  pushSection(sections, 'sector_access', 'Sector Access Progress', sectorCards);

  // --- RUNNER CLEARANCE + BREACH GRADE UNLOCKS ---
  const clearanceGain = computeRunnerClearanceXpGain({
    runOutcome,
    extractionKind: debrief.extractionKind,
    depthReached,
    contractSucceeded,
    breachGrade,
  });
  const clearance = clearanceXpProgress(profile);
  const clearanceCards: DebriefTheaterCard[] = [
    {
      id: 'clearance',
      kind: 'PROGRESS',
      title: `Runner Clearance ${clearance.rank}`,
      lines: [
        `+${clearanceGain} XP // ${clearance.current}/${clearance.required} to next`,
      ],
    },
  ];
  // Predict rank-ups for celebration.
  let simXp = clearance.current + clearanceGain;
  let simRank = clearance.rank;
  const unlockedGrades: BreachGradeId[] = [];
  if (runOutcome === 'EXTRACTED') {
    while (simXp >= xpRequiredForClearanceRank(simRank)) {
      simXp -= xpRequiredForClearanceRank(simRank);
      simRank += 1;
      if (simRank === 3 && !profile.runner.unlockedBreachGrades.includes('II')) {
        unlockedGrades.push('II');
      }
      if (simRank === 5 && !profile.runner.unlockedBreachGrades.includes('III')) {
        unlockedGrades.push('III');
      }
    }
    if (simRank > clearance.rank) {
      const title = `CLEARANCE RANK UP → ${simRank}`;
      celebrationTitles.push(title);
      clearanceCards.push({
        id: 'clearance-rankup',
        kind: 'CELEBRATE',
        title,
        lines: ['Applied on return to hub.'],
      });
    }
  }
  unlockedGrades.forEach((grade) => {
    const title = `BREACH GRADE ${grade} UNLOCKED`;
    celebrationTitles.push(title);
    clearanceCards.push({
      id: `grade-${grade}`,
      kind: 'CELEBRATE',
      title,
      lines: buildBreachGradeDebriefLines(grade).slice(0, 2),
    });
  });
  if (runOutcome === 'EXTRACTED') {
    clearanceCards.push({
      id: 'grade-run',
      kind: 'PROGRESS',
      title: formatBreachGradeLabel(breachGrade),
      lines: buildBreachGradeDebriefLines(breachGrade).slice(1),
    });
  }
  pushSection(sections, 'clearance', 'Runner Clearance // Breach Grade', clearanceCards);

  // --- CLASS RANK ---
  const classId = input.account.activeClass as ClassType;
  const classXp = computeClassRankXpGain({
    runOutcome,
    depthReached,
    contractSucceeded,
    breachGrade,
  });
  const classProgress = classRankXpProgress(profile, classId);
  const classCards: DebriefTheaterCard[] = [
    {
      id: 'class-rank',
      kind: 'PROGRESS',
      title: `${classId.replace(/_/g, ' ')} Rank ${classProgress.rank}`,
      lines: buildClassRankDebriefLines(profile, classId, classXp),
    },
  ];
  if (runOutcome === 'EXTRACTED' && classProgress.rank < CLASS_RANK_MAX) {
    let cXp = classProgress.current + classXp;
    let cRank = classProgress.rank;
    while (cRank < CLASS_RANK_MAX && cXp >= xpRequiredForClassRank(cRank)) {
      cXp -= xpRequiredForClassRank(cRank);
      cRank += 1;
    }
    if (cRank > classProgress.rank) {
      const title = `CLASS RANK UP → ${cRank}`;
      celebrationTitles.push(title);
      classCards.push({
        id: 'class-rankup',
        kind: 'CELEBRATE',
        title,
        lines: ['Rank rewards unlock on return to hub.'],
      });
    }
  }
  pushSection(sections, 'class_rank', 'Class Rank Progress', classCards);

  // --- CABAL REP ---
  const sponsorId = (input.sponsorId
    ?? (debrief.contractResult.sponsorId as FactionType | null)
    ?? input.account.alignedFaction
    ?? 'TERRAN_GRID') as FactionType;
  const reputationAwarded = input.reputationAwarded
    ?? (debrief.contractResult.reputationAwarded + debrief.contractResult.bonusReputationAwarded);
  const cabalGain = contractSucceeded
    ? computeCabalRepXpGain({
      contractSucceeded: true,
      reputationAwarded,
      sponsorId,
      breachGrade,
    })
    : 0;
  const cabalProgress = cabalRepXpProgress(profile, sponsorId);
  const cabalCards: DebriefTheaterCard[] = [
    {
      id: 'cabal-rep',
      kind: 'PROGRESS',
      title: `${sponsorDisplayName(sponsorId)} Tier ${cabalProgress.tier}`,
      lines: buildCabalRepDebriefLines(profile, sponsorId, cabalGain, breachGrade),
    },
  ];
  if (cabalGain > 0 && cabalProgress.tier < CABAL_REP_TIER_MAX) {
    const cap = maxCabalTierForBreachGrade(breachGrade);
    let rXp = cabalProgress.current + cabalGain;
    let rTier = cabalProgress.tier;
    while (
      rTier < cap
      && rTier < CABAL_REP_TIER_MAX
      && rXp >= xpRequiredForCabalTier(rTier)
    ) {
      rXp -= xpRequiredForCabalTier(rTier);
      rTier += 1;
    }
    if (rTier > cabalProgress.tier) {
      const title = `CABAL TIER UP → ${rTier}`;
      celebrationTitles.push(title);
      cabalCards.push({
        id: 'cabal-tierup',
        kind: 'CELEBRATE',
        title,
        lines: [`${sponsorDisplayName(sponsorId)} standing improved.`],
      });
    }
  }
  pushSection(sections, 'cabal_rep', 'Cabal Reputation Progress', cabalCards);

  // --- SECTOR MASTERY ---
  const runSectorId = (debrief.balanceTelemetry?.sectorId as SectorId | undefined)
    ?? (input.world.selectedSectorId as SectorId | null)
    ?? null;
  if (runSectorId && profile.sectors[runSectorId]) {
    const sector = profile.sectors[runSectorId];
    pushSection(sections, 'sector_mastery', 'Sector Mastery Progress', [
      {
        id: 'mastery',
        kind: 'PROGRESS',
        title: `${sectorName(runSectorId)} Mastery ${sector.masteryLevel}`,
        lines: [
          `Mastery XP ${sector.masteryXp}`,
          `Highest grade cleared: ${sector.highestGradeCleared ?? '—'}`,
          runOutcome === 'EXTRACTED'
            ? 'Successful extract grants mastery XP on return.'
            : 'Extract successfully to build mastery.',
        ],
      },
    ]);
  }

  // --- NEWLY CRAFTABLE + RECIPE RUMORS ---
  const craftLines = formatCraftingOpportunityLines(debrief.craftingOpportunities);
  const craftCards: DebriefTheaterCard[] = [];
  debrief.craftingOpportunities.newlyCraftable.slice(0, 4).forEach((entry) => {
    craftCards.push({
      id: `craft-${entry.recipeId}`,
      kind: 'CELEBRATE',
      title: `CRAFT NOW — ${entry.label}`,
      lines: [entry.detail],
    });
    celebrationTitles.push(`CRAFT NOW — ${entry.label}`);
  });
  debrief.craftingOpportunities.nearlyCraftable.slice(0, 3).forEach((entry) => {
    craftCards.push({
      id: `near-${entry.recipeId}`,
      kind: 'HINT',
      title: `NEARLY READY — ${entry.label}`,
      lines: [entry.detail],
    });
  });
  listForgeVisibleRecipes(profile, input.account)
    .filter((s) => s.visibility === 'RUMORED')
    .slice(0, 2)
    .forEach((s) => {
      craftCards.push({
        id: `rumor-${s.recipe.id}`,
        kind: 'HINT',
        title: `RUMORED — ${s.recipe.label}`,
        lines: [s.meta.rumoredPurpose, s.meta.sourceHint],
      });
    });
  if (craftCards.length === 0 && craftLines.length > 0) {
    craftCards.push({
      id: 'craft-generic',
      kind: 'HINT',
      title: 'CRAFTING',
      lines: craftLines.slice(0, 4),
    });
  }
  pushSection(sections, 'craftable', 'Newly Craftable', craftCards);

  // --- NEW UNLOCKS (aggregate celebrations) ---
  const unlockCards = sections
    .flatMap((s) => s.cards)
    .filter((c) => c.kind === 'CELEBRATE')
    .map((c) => ({ ...c, id: `unlock-${c.id}` }));
  // Dedupe by title for the New Unlocks reel
  const seen = new Set<string>();
  const uniqueUnlocks = unlockCards.filter((c) => {
    if (seen.has(c.title)) return false;
    seen.add(c.title);
    return true;
  });
  pushSection(sections, 'new_unlocks', 'New Unlocks', uniqueUnlocks.slice(0, 8));

  // --- NEXT RECOMMENDED GOALS ---
  const pinSlotsMax = maxPinnedGoalSlots(profile);
  const pinSlotsUsed = profile.pinnedGoals.length;
  const pinSuggestions = listAvailableGoalsToPin(profile).slice(0, 4);
  const nextCards: DebriefTheaterCard[] = pinSuggestions.map((goal) => ({
    id: `suggest-${goal.id}`,
    kind: 'PIN_GOAL' as const,
    title: goal.label,
    lines: [
      goal.summary,
      goal.recommendedSectorId
        ? `Sector: ${sectorName(goal.recommendedSectorId)}`
        : '',
      goal.recommendedGrade
        ? `Grade: ${formatBreachGradeLabel(goal.recommendedGrade, true)}`
        : '',
      goal.recommendedSponsorId
        ? `Sponsor: ${sponsorDisplayName(goal.recommendedSponsorId)}`
        : '',
    ].filter(Boolean),
    goalDefId: goal.id,
  }));
  const nextActions = buildNextActionSuggestions(debrief, input.account, input.world);
  nextActions.forEach((line, i) => {
    nextCards.push({
      id: `next-action-${i}`,
      kind: 'HINT',
      title: 'NEXT STEP',
      lines: [line],
    });
  });
  pushSection(sections, 'next_goals', 'Next Recommended Goals', nextCards);

  return {
    sections,
    celebrationTitles: [...new Set(celebrationTitles)],
    pinSuggestions,
    pinSlotsUsed,
    pinSlotsMax,
  };
}

/** Format theater for DevTest / hub log dump. */
export function formatDebriefProgressionTheaterReport(
  theater: DebriefProgressionTheater,
): string {
  const lines = [
    '=== DEBRIEF PROGRESSION THEATER (PHASE 1H) ===',
    `Celebrations: ${theater.celebrationTitles.length}`,
    `Pin slots: ${theater.pinSlotsUsed}/${theater.pinSlotsMax}`,
    '',
  ];
  theater.sections.forEach((section) => {
    lines.push(`--- ${section.label.toUpperCase()} ---`);
    section.cards.forEach((card) => {
      lines.push(`[${card.kind}] ${card.title}`);
      card.lines.forEach((line) => lines.push(`  ${line}`));
    });
    lines.push('');
  });
  return lines.join('\n');
}
