import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import TerminalResultsLayout from '../components/layout/TerminalResultsLayout';
import CargoRoutingPanel from '../components/debrief/CargoRoutingPanel';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useWorldState } from '../context/WorldStateContext';
import { useTerminal } from '../context/TerminalContext';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { useImmersiveScreenPadding } from '../hooks/useImmersiveScreenPadding';
import { formatDebriefResourceLine } from '../data/runDebriefResourceEngine';
import { buildDebriefSourceHintLines } from '../data/resourceSourceHintEngine';
import { getAccountProgressionProfile } from '../data/progressionDebugEngine';
import { ensureEconomyRunTelemetry } from '../data/economyRunTelemetryEngine';
import { createEmptyRunResourceLedger } from '../types/runResourceLedger';
import { formatUnstableCargoDebriefLine } from '../data/runDebriefUnstableCargoEngine';
import {
  formatEchoDebriefContributionLine,
  formatEchoGlassResolutionLine,
} from '../data/runDebriefEchoEngine';
import {
  buildDefaultRoutingDecisions,
  enrichRoutableItemsWithSealedMeta,
  appraiseSealedRoutingItem,
  formatAutoStashedSummary,
  previewPostRunCargoRouting,
  resolveFinalContractResultAfterRouting,
  validateCargoRoutingDecisions,
} from '../data/postRunCargoRoutingEngine';
import { getAppraisalBandLabel } from '../data/sealedCasketAppraisalEngine';
import type { AppraisalValueBand, CasketAppraisalResult, SealedCargoState } from '../types/sealedCargo';
import type { ContractResult } from '../types/contract';
import type { CargoRoutingAction, CargoRoutingDecision, CargoRoutingResult } from '../types/postRunCargoRouting';
import {
  buildDeathCargoRoutingSummary,
  formatCasketOpenRewardsSummary,
  formatCargoRoutingDebriefContributionLine,
  formatSessionCargoRoutingDebriefLines,
} from '../data/runDebriefCargoRoutingEngine';
import { formatActiveContractCargoDeliveryHints } from '../data/cargoRoutingIntelEngine';
import { outcomeKindLabel } from '../data/bribeOfferEngine';
import { formatCareerCargoRoutingSummary } from '../data/postRunCargoRoutingRunState';
import { formatBalanceDashboard } from '../data/balance/balanceDashboardEngine';
import { normalizeBreachGradeId } from '../data/breachGradeEngine';
import type { SectorId } from '../types/worldState';
import { formatRunBalanceTelemetryReport } from '../data/runIntegration/runBalanceTelemetryEngine';
import { operationProgressPercent } from '../data/worldStateHelpers';
import { formatContractSourceReasonLabel, formatExtractionKindLabel, sponsorDisplayName } from '../utils/contractUi';
import { getResourceDisplayName } from '../data/resourceRegistry';
import { formatTimeAliveMmSs } from '../types/runDeathSummary';
import { formatRunWorldBriefDebriefLines } from '../data/runWorldBriefDebriefEngine';
import {
  formatCommunityProgressLine,
  formatProgressThisRunLine,
  filterDebriefCompletionEffectLines,
} from '../utils/operationDebriefUi';
import { formatRunOutcomeDetailLabel } from '../data/runIntegration/runOutcomeDetailEngine';
import {
  buildDebriefProgressionTheater,
  type DebriefTheaterCard,
} from '../data/debriefProgressionTheaterEngine';
import { maxPinnedGoalSlots } from '../data/pinnedGoalEngine';
import { SELECT_ACCENT } from '../constants/dossierSurface';
import { VEIL } from '../theme/veilTerminalTokens';

const TERMINAL_ACCENT = VEIL.mint;
const FAILURE_ACCENT = VEIL.blood;
const PENDING_ACCENT = VEIL.occultPale;

type DebriefStep = 'SUMMARY' | 'CONTRACT' | 'OPERATION' | 'ROUTING' | 'REWARDS';

function contractStatusLabel(status: ContractResult['status'], outcomeKind?: ContractResult['outcomeKind']): string {
  if (outcomeKind && outcomeKind !== 'COMPLETE' && outcomeKind !== 'FAILED') {
    return outcomeKindLabel(outcomeKind).toUpperCase();
  }
  switch (status) {
    case 'SUCCESS':
      return 'CONTRACT COMPLETE';
    case 'PENDING_DELIVERY':
      return 'AWAITING SPONSOR DELIVERY';
    case 'FAILED':
      return 'CONTRACT FAILED';
    default:
      return 'NO CONTRACT';
  }
}

function contractStatusColor(status: ContractResult['status']): string {
  switch (status) {
    case 'SUCCESS':
      return TERMINAL_ACCENT;
    case 'PENDING_DELIVERY':
      return PENDING_ACCENT;
    case 'FAILED':
      return FAILURE_ACCENT;
    default:
      return VEIL.textMuted;
  }
}

export default function OperationDebriefScreen(): React.JSX.Element | null {
  const { theme } = useTerminal();
  const { pendingDebrief, setPendingDebrief, clearPendingDebrief, tickAfterRunComplete, applyOperationContribution, applyPostRunAftermath, persisted, sectors } = useWorldState();
  const { appendHubLog, applyPostRunCargoRouting, applyBetrayalConsequences, grantContractRewards, account, addCredits, recordCareerBalanceTelemetry, applyRunnerClearanceFromRun, applySectorAccessFromRun, applyBreachGradeClearFromRun, syncPinnedGoalsFromRun, applyClassRankFromRun, applyCabalRepFromRun, syncRecipeVisibilityFromStash, pinProgressionGoalId } = usePlayerAccount();
  const { goToHub } = useGameFlow();
  const immersivePadding = useImmersiveScreenPadding();

  const [stepIndex, setStepIndex] = useState(0);
  const [decisions, setDecisions] = useState<CargoRoutingDecision[]>([]);
  const [routingResult, setRoutingResult] = useState<CargoRoutingResult | null>(null);
  const [resolvedContractResult, setResolvedContractResult] = useState<ContractResult | null>(null);
  const [routingApplied, setRoutingApplied] = useState(false);
  const [cargoOperationProgress, setCargoOperationProgress] = useState(0);
  const [displayProgressAfterPct, setDisplayProgressAfterPct] = useState<number | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [sealedAppraisalByItemKey, setSealedAppraisalByItemKey] = useState<
    Record<string, { state: SealedCargoState; valueBand?: AppraisalValueBand }>
  >({});
  const [routingAppraisalResults, setRoutingAppraisalResults] = useState<CasketAppraisalResult[]>([]);
  const [routingAppraisalCount, setRoutingAppraisalCount] = useState(0);

  const routingState = pendingDebrief?.routingState ?? null;

  const pendingRoutingItems = useMemo(() => {
    if (!routingState?.requiresRouting) return [];
    return enrichRoutableItemsWithSealedMeta(
      routingState.pendingItems,
      sealedAppraisalByItemKey,
      routingState.routingContext,
      routingState.bribeOfferSeed,
    );
  }, [routingState, sealedAppraisalByItemKey]);

  useEffect(() => {
    if (!routingState?.requiresRouting) {
      setDecisions([]);
      return;
    }
    setDecisions(buildDefaultRoutingDecisions(routingState.pendingItems));
    setRoutingResult(null);
    setResolvedContractResult(null);
    setRoutingApplied(false);
    setCargoOperationProgress(0);
    setDisplayProgressAfterPct(null);
    setRoutingError(null);
    setSealedAppraisalByItemKey({});
    setRoutingAppraisalResults([]);
    setRoutingAppraisalCount(0);
    setStepIndex(0);
  }, [pendingDebrief, routingState]);

  const steps = useMemo<DebriefStep[]>(() => {
    if (!pendingDebrief) return ['SUMMARY'];
    const compactExtract = pendingDebrief.runOutcome === 'EXTRACTED' && !routingState?.requiresRouting;
    const compactFailure = pendingDebrief.runOutcome === 'FAILED';
    if (compactExtract || compactFailure) {
      return ['SUMMARY', 'REWARDS'];
    }
    const list: DebriefStep[] = ['SUMMARY'];
    if (pendingDebrief.contractResult.status !== 'NONE') {
      list.push('CONTRACT');
    }
    list.push('OPERATION');
    if (routingState?.requiresRouting) {
      list.push('ROUTING');
    }
    list.push('REWARDS');
    return list;
  }, [pendingDebrief, routingState?.requiresRouting]);

  const currentStep = steps[stepIndex] ?? 'SUMMARY';

  if (!pendingDebrief) {
    return null;
  }

  const {
    runOutcome,
    sectorName,
    operationTitle,
    contribution,
    progressBeforePct,
    progressAfterPct,
    totalContributionThisRun,
    completed,
    completionLogLines,
    credits,
    riftIron,
    residueVaulted,
    nextOperationTitle,
    contractResult,
    activeContract,
    resourceSections,
    unstableCargoSummary,
    echoSummary,
    cargoRoutingSummary,
    extractionKind,
    deathStats,
    midRunContributionTransmitted,
    deferredWorldTick,
    runResourceLedger,
    cargoRoutingRunState,
    keepsakeSummary,
    keepsakeRuntime,
    runItemSummary,
    runOutcomeDetail,
    anchorSummary,
    depthIdentitySummary,
    encounterCompositionSummary,
    balanceTelemetry,
    operationBonusLines,
    completionEffectSummary,
    worldBriefSummary,
    aftermathInput,
  } = pendingDebrief;
  const breachGrade = normalizeBreachGradeId(pendingDebrief.breachGrade);

  const aftermathPreviewLines = worldBriefSummary?.aftermathCreated ?? [];

  const recordedBalanceRunRef = useRef<string | null>(null);
  const clearanceXpAppliedRef = useRef(false);
  useEffect(() => {
    clearanceXpAppliedRef.current = false;
  }, [pendingDebrief]);
  useEffect(() => {
    if (!balanceTelemetry) return;
    const key = `${balanceTelemetry.extractionType}:${balanceTelemetry.nodesCleared}:${balanceTelemetry.sectorId ?? ''}:${balanceTelemetry.timeAliveMs ?? 0}`;
    if (recordedBalanceRunRef.current === key) return;
    recordedBalanceRunRef.current = key;
    recordCareerBalanceTelemetry(balanceTelemetry, {
      run: {
        ...ensureEconomyRunTelemetry(pendingDebrief.economyRunTelemetry),
        recipesNewlyCraftable: pendingDebrief.craftingOpportunities?.newlyCraftable?.length ?? 0,
      },
      ledger: pendingDebrief.runResourceLedger ?? createEmptyRunResourceLedger(),
    });
  }, [balanceTelemetry, recordCareerBalanceTelemetry, pendingDebrief]);

  const progressionTheater = useMemo(() => {
    if (!pendingDebrief) {
      return null;
    }
    const display = resolvedContractResult ?? pendingDebrief.contractResult;
    return buildDebriefProgressionTheater({
      account,
      debrief: pendingDebrief,
      world: {
        persisted,
        sectors,
        selectedSectorId: persisted.selectedSectorId,
      },
      contractSucceeded: display.status === 'SUCCESS',
      sponsorId: display.sponsorId ?? null,
      reputationAwarded:
        display.status === 'SUCCESS'
          ? display.reputationAwarded + display.bonusReputationAwarded
          : 0,
    });
  }, [account, pendingDebrief, persisted, resolvedContractResult, sectors]);

  const theaterCardColor = (card: DebriefTheaterCard): string => {
    switch (card.kind) {
      case 'CELEBRATE':
        return TERMINAL_ACCENT;
      case 'PIN_GOAL':
        return SELECT_ACCENT;
      case 'HINT':
        return theme.mutedColor;
      default:
        return theme.textColor;
    }
  };

  const [pinnedThisDebrief, setPinnedThisDebrief] = useState<string[]>([]);
  useEffect(() => {
    setPinnedThisDebrief([]);
  }, [pendingDebrief]);

  const handlePinGoalFromDebrief = (goalDefId: string) => {
    const result = pinProgressionGoalId(goalDefId);
    appendHubLog(result.logLine);
    if (result.ok) {
      setPinnedThisDebrief((prev) => (prev.includes(goalDefId) ? prev : [...prev, goalDefId]));
    }
  };

  const livePinSlots = useMemo(() => {
    const profile = getAccountProgressionProfile(account);
    return {
      used: profile.pinnedGoals.length,
      max: maxPinnedGoalSlots(profile),
      pinnedIds: new Set(profile.pinnedGoals.map((g) => g.id)),
    };
  }, [account]);

  const displayContractResult = resolvedContractResult ?? contractResult;
  const isFailure = runOutcome === 'FAILED';
  const accentColor = isFailure ? FAILURE_ACCENT : TERMINAL_ACCENT;
  const resolvedProgressAfterPct = displayProgressAfterPct ?? progressAfterPct;
  const progressThisRunLine = formatProgressThisRunLine({
    totalContributionThisRun: totalContributionThisRun + cargoOperationProgress,
    progressBeforePct,
    progressAfterPct: resolvedProgressAfterPct,
    midRunTransmitted: midRunContributionTransmitted,
    extractedSuccessfully: !isFailure,
  });
  const communityProgressLine = formatCommunityProgressLine(progressBeforePct, resolvedProgressAfterPct);
  const hasExtractContribution = contribution.breakdown.length > 0 || cargoOperationProgress > 0;
  const showNoProgressGenerated = totalContributionThisRun + cargoOperationProgress <= 0;
  const completionEffectLines = filterDebriefCompletionEffectLines(completionLogLines);
  const isFinalStep = stepIndex >= steps.length - 1;
  const isCompactFlow = steps.length === 2;

  const deathCargoSummary = useMemo(() => (
    isFailure && runResourceLedger
      ? buildDeathCargoRoutingSummary(runResourceLedger, cargoRoutingRunState)
      : null
  ), [isFailure, runResourceLedger, cargoRoutingRunState]);

  const sourceHintLines = useMemo(() => {
    const profile = getAccountProgressionProfile(account);
    return buildDebriefSourceHintLines({
      profile,
      extracted: runResourceLedger?.extracted,
      stash: account.resourceStash,
      discovery: account.resourceDiscovery,
    });
  }, [account, runResourceLedger?.extracted]);

  const routingValidationIssues = useMemo(() => (
    routingState?.requiresRouting
      ? validateCargoRoutingDecisions(pendingRoutingItems, decisions)
      : []
  ), [routingState, pendingRoutingItems, decisions]);

  const activeRoutingState = useMemo(() => (
    routingState
      ? { ...routingState, pendingItems: pendingRoutingItems, sealedAppraisalByItemKey }
      : null
  ), [routingState, pendingRoutingItems, sealedAppraisalByItemKey]);

  const routingPreview = useMemo(() => (
    activeRoutingState?.requiresRouting && !routingApplied
      ? previewPostRunCargoRouting({
        decisions,
        items: pendingRoutingItems,
        routingState: activeRoutingState,
        ledger: runResourceLedger,
        keepsakeRuntime,
        cabalCredits: account.cabalCredits,
      })
      : null
  ), [activeRoutingState, pendingRoutingItems, decisions, routingApplied, runResourceLedger, keepsakeRuntime, account.cabalCredits]);

  const canConfirmRouting = routingState?.requiresRouting
    ? routingValidationIssues.length === 0 && (routingPreview?.valid ?? false)
    : true;

  const handleDecisionChange = (resourceId: CargoRoutingDecision['resourceId'], action: CargoRoutingAction) => {
    setRoutingError(null);
    setDecisions((prev) => prev.map((entry) => {
      if (entry.resourceId !== resourceId) return entry;
      const item = pendingRoutingItems.find((pending) => pending.resourceId === resourceId);
      return {
        ...entry,
        action,
        rivalSponsorId: action === 'DELIVER_RIVAL_SPONSOR'
          ? item?.bribeOffer?.rivalSponsorId
          : undefined,
      };
    }));
  };

  const handleQuantityChange = (resourceId: CargoRoutingDecision['resourceId'], quantity: number) => {
    setRoutingError(null);
    setDecisions((prev) => prev.map((entry) => (
      entry.resourceId === resourceId ? { ...entry, quantity } : entry
    )));
  };

  const handleAppraiseSealed = (resourceId: CargoRoutingDecision['resourceId']) => {
    if (!activeRoutingState) return;
    const item = pendingRoutingItems.find((entry) => entry.resourceId === resourceId);
    if (!item?.canAppraise) return;
    setRoutingError(null);
    const appraisal = appraiseSealedRoutingItem({
      item,
      cabalCredits: account.cabalCredits,
      sealedAppraisalByItemKey,
    });
    if (!appraisal.ok || !appraisal.result) {
      setRoutingError(appraisal.error ?? 'Appraisal failed.');
      return;
    }
    addCredits(-appraisal.result.feePaid);
    setSealedAppraisalByItemKey(appraisal.nextSealedAppraisalByItemKey);
    setRoutingAppraisalResults((prev) => [...prev, appraisal.result!]);
    setRoutingAppraisalCount((prev) => prev + 1);
    appendHubLog(`>> APPRAISED — ${getAppraisalBandLabel(appraisal.result.valueBand, appraisal.result.resourceId).toUpperCase()} (−${appraisal.result.feePaid} CR)`);
  };

  const applyRouting = async (): Promise<boolean> => {
    if (!activeRoutingState || routingApplied || !canConfirmRouting) return false;
    try {
      setRoutingError(null);
      const result = applyPostRunCargoRouting({
        decisions,
        routingState: activeRoutingState,
        autoStashAlreadyDeposited: true,
        keepsakeRuntime,
        routingAppraisalCount,
      });
      const finalContract = resolveFinalContractResultAfterRouting(
        activeRoutingState,
        result,
        decisions,
        pendingRoutingItems,
        true,
        runResourceLedger,
        keepsakeRuntime,
      );
      applyBetrayalConsequences({
        contractResult: finalContract,
        routingResult: result,
        routingState: activeRoutingState,
        decisions,
        playerClass: account.activeClass,
        depthReached: activeRoutingState.contractProgress.highestDepthReached,
      });
      if (finalContract.status === 'SUCCESS') {
        grantContractRewards(finalContract);
        appendHubLog(
          `>> CONTRACT PAID — ${finalContract.title.toUpperCase()} // +${finalContract.creditsAwarded + finalContract.bonusCreditsAwarded} CR`,
        );
      } else if (finalContract.betrayalSummary) {
        appendHubLog(`>> CONTRACT BETRAYAL — ${finalContract.betrayalSummary.toUpperCase()}`);
      } else if (finalContract.status === 'PENDING_DELIVERY') {
        appendHubLog(
          `>> CONTRACT AWAITING DELIVERY — ${finalContract.title.toUpperCase()} // ${finalContract.progressText}`,
        );
      }
      result.outcomeLines.forEach((line) => {
        appendHubLog(`>> CARGO ROUTING — ${line.label.toUpperCase()}`);
      });
      if (result.creditsFromFence > 0) {
        appendHubLog(`>> CARGO ROUTING — FENCE PAYOUT +${result.creditsFromFence} CR`);
      }
      if (result.creditsFromRivalDelivery > 0) {
        appendHubLog(`>> CARGO ROUTING — RIVAL PAYOUT +${result.creditsFromRivalDelivery} CR`);
      }
      if (result.creditsFromCasketOpen > 0) {
        appendHubLog(`>> CARGO ROUTING — CASKET PAYOUT +${result.creditsFromCasketOpen} CR`);
      }
      if (result.operationProgressFromCargo > 0) {
        appendHubLog(`>> CARGO ROUTING — OPERATION +${result.operationProgressFromCargo} FROM CARGO`);
      }
      let routedOperationProgress = 0;
      let nextProgressAfter = pendingDebrief?.progressAfter ?? 0;
      let nextProgressAfterPct = pendingDebrief?.progressAfterPct ?? progressAfterPct;
      if (result.operationProgressFromCargo > 0 && activeRoutingState.operationId) {
        const contributionResult = await applyOperationContribution(
          activeRoutingState.operationId,
          result.operationProgressFromCargo,
        );
        routedOperationProgress = result.operationProgressFromCargo;
        nextProgressAfter = contributionResult.progressAfter;
        nextProgressAfterPct = operationProgressPercent(
          contributionResult.progressAfter,
          contributionResult.progressRequired,
        );
        setDisplayProgressAfterPct(nextProgressAfterPct);
      }
      setRoutingResult(result);
      setResolvedContractResult(finalContract);
      setCargoOperationProgress(routedOperationProgress);
      setRoutingApplied(true);
      if (pendingDebrief) {
        setPendingDebrief({
          ...pendingDebrief,
          cargoRoutingResult: result,
          progressAfter: nextProgressAfter,
          progressAfterPct: nextProgressAfterPct,
          progressDelta: nextProgressAfter - pendingDebrief.progressBefore,
          totalContributionThisRun: pendingDebrief.totalContributionThisRun + routedOperationProgress,
        });
      }
      return true;
    } catch (error) {
      setRoutingError(error instanceof Error ? error.message : 'Cargo routing failed.');
      return false;
    }
  };

  const handleAdvance = async () => {
    if (currentStep === 'ROUTING' && routingState?.requiresRouting && !routingApplied) {
      const applied = await applyRouting();
      if (applied) {
        setStepIndex((index) => Math.min(index + 1, steps.length - 1));
      }
      return;
    }

    if (!isFinalStep) {
      setStepIndex((index) => index + 1);
      return;
    }

    appendHubLog(
      `>> RUN DEBRIEF — ${sectorName.toUpperCase()} // ${runOutcome} // +${totalContributionThisRun + cargoOperationProgress} OPERATION`,
    );
    if (displayContractResult.status === 'SUCCESS' && !routingApplied) {
      appendHubLog(
        `>> CONTRACT PAID — ${displayContractResult.title.toUpperCase()} // +${displayContractResult.creditsAwarded + displayContractResult.bonusCreditsAwarded} CR`,
      );
    } else if (displayContractResult.status === 'FAILED') {
      appendHubLog(
        `>> CONTRACT UNPAID — ${displayContractResult.title.toUpperCase()} // ${displayContractResult.progressText}`,
      );
    }
    if (completed) {
      completionLogLines.forEach((line) => appendHubLog(line));
      if (nextOperationTitle) {
        appendHubLog(`>> NEW OPERATION ACTIVE: ${nextOperationTitle.toUpperCase()}`);
      }
    }
    if (aftermathInput) {
      const aftermathLines = applyPostRunAftermath(aftermathInput);
      aftermathLines.forEach((line) => appendHubLog(`>> SECTOR AFTERMATH — ${line.toUpperCase()}`));
    }
    if (isFailure || deferredWorldTick) {
      tickAfterRunComplete();
    }

    const depthReached = Math.max(
      1,
      pendingDebrief.balanceTelemetry?.maxDepthReached
        ?? pendingDebrief.routingState?.contractProgress.highestDepthReached
        ?? 1,
    );
    if (!clearanceXpAppliedRef.current) {
      clearanceXpAppliedRef.current = true;
      const clearanceResult = applyRunnerClearanceFromRun({
        runOutcome,
        extractionKind,
        depthReached,
        contractSucceeded: displayContractResult.status === 'SUCCESS',
        breachGrade,
      });
      if (clearanceResult.ranksGained > 0) {
        appendHubLog(
          `>> RUNNER CLEARANCE — NOW RANK ${clearanceResult.newRank}`,
        );
      }

      applySectorAccessFromRun({
        extractedSuccessfully: runOutcome === 'EXTRACTED',
        extracted: runResourceLedger?.extracted ?? {},
        lostOnDeath: runResourceLedger?.lostOnDeath ?? {},
        runSectorId: (balanceTelemetry?.sectorId as SectorId | null | undefined) ?? null,
      });

      applyBreachGradeClearFromRun({
        extractedSuccessfully: runOutcome === 'EXTRACTED',
        sectorId: (balanceTelemetry?.sectorId as SectorId | null | undefined) ?? null,
        breachGrade,
      });

      applyClassRankFromRun({
        runOutcome,
        depthReached,
        contractSucceeded: displayContractResult.status === 'SUCCESS',
        breachGrade,
      });

      if (
        displayContractResult.status === 'SUCCESS'
        && displayContractResult.sponsorId
      ) {
        applyCabalRepFromRun({
          contractSucceeded: true,
          reputationAwarded:
            displayContractResult.reputationAwarded + displayContractResult.bonusReputationAwarded,
          sponsorId: displayContractResult.sponsorId,
          breachGrade,
        });
      }

      syncRecipeVisibilityFromStash();
      syncPinnedGoalsFromRun();

      progressionTheater?.celebrationTitles.forEach((title) => {
        appendHubLog(`>> PROGRESSION — ${title.toUpperCase()}`);
      });
    }

    clearPendingDebrief();
    goToHub();
  };

  const stepLabel = currentStep.replace('_', ' ');
  const footerLabel = currentStep === 'ROUTING'
    ? (canConfirmRouting ? '[ CONFIRM CARGO ROUTING ]' : '[ FIX ROUTING ISSUES ]')
    : isFinalStep
      ? '[ RETURN TO OPERATIONAL BRIEFING ]'
      : `[ CONTINUE — ${stepLabel} ]`;
  // Phase 1H always-exit: REWARDS (and all non-ROUTING steps) never block Return.
  // Only incomplete cargo routing may disable the footer.
  const footerDisabled = currentStep === 'ROUTING' && routingState?.requiresRouting && !canConfirmRouting;

  const contractForDeliveryHints = routingState?.activeContract ?? activeContract;

  const renderContractBlock = () => (
    <>
      <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CONTRACT RESULT</Text>
      {displayContractResult.status === 'NONE' ? (
        <Text style={[styles.stat, { color: theme.mutedColor }]}>
          Independent Breach — no sponsor contract.
        </Text>
      ) : (
        <>
          <Text style={[styles.stat, { color: theme.textColor }]}>
            {displayContractResult.title.toUpperCase()}
          </Text>
          {displayContractResult.sponsorId ? (
            <Text style={[styles.stat, { color: theme.mutedColor }]}>
              {sponsorDisplayName(displayContractResult.sponsorId).toUpperCase()}
            </Text>
          ) : null}
          {displayContractResult.boundContextReason ? (
            <Text style={[styles.stat, { color: theme.mutedColor }]}>
              {`SOURCE: ${formatContractSourceReasonLabel(displayContractResult.boundContextReason)?.toUpperCase() ?? displayContractResult.boundContextReason}`}
            </Text>
          ) : null}
          {displayContractResult.linkedOperationTitle ? (
            <Text style={[styles.stat, { color: theme.mutedColor }]}>
              {`LINKED OPERATION: ${displayContractResult.linkedOperationTitle.toUpperCase()}`}
            </Text>
          ) : null}
          {displayContractResult.linkedAnchorDisplayName ? (
            <Text style={[styles.stat, { color: theme.mutedColor }]}>
              {`LINKED ANCHOR: ${displayContractResult.linkedAnchorDisplayName.toUpperCase()}`}
            </Text>
          ) : null}
          <Text style={[styles.stat, { color: theme.mutedColor }]}>
            {displayContractResult.progressText}
          </Text>
          {displayContractResult.sealedClauseText ? (
            <Text style={[styles.stat, { color: theme.mutedColor }]}>
              {`SEALED CLAUSE — ${displayContractResult.sealedClauseText}`}
            </Text>
          ) : null}
          {displayContractResult.sealedClauseProgressText ? (
            <Text style={[styles.stat, { color: displayContractResult.sealedClauseMet ? theme.statusColor : theme.mutedColor }]}>
              {displayContractResult.sealedClauseProgressText.toUpperCase()}
            </Text>
          ) : null}
          <Text
            style={[
              styles.statAccent,
              { color: contractStatusColor(displayContractResult.status) },
            ]}
          >
            {contractStatusLabel(displayContractResult.status, displayContractResult.outcomeKind)}
          </Text>
          {displayContractResult.finalCargoDestination ? (
            <Text style={[styles.stat, { color: theme.mutedColor }]}>
              {`Final destination: ${displayContractResult.finalCargoDestination}`}
            </Text>
          ) : null}
          {displayContractResult.betrayalSummary ? (
            <>
              <View style={styles.sectionGap} />
              <Text style={[styles.sectionLabel, { color: FAILURE_ACCENT }]}>BETRAYAL SUMMARY</Text>
              <Text style={[styles.stat, { color: FAILURE_ACCENT }]}>
                {displayContractResult.betrayalSummary.toUpperCase()}
              </Text>
            </>
          ) : null}
          {displayContractResult.status === 'SUCCESS' ? (
            <>
              <Text style={[styles.stat, { color: theme.statusColor }]}>
                {`+${displayContractResult.creditsAwarded + displayContractResult.bonusCreditsAwarded} CR // +${displayContractResult.reputationAwarded + displayContractResult.bonusReputationAwarded} REP`}
              </Text>
              {displayContractResult.resourceBonusIds.length > 0 ? (
                <Text style={[styles.stat, { color: theme.mutedColor }]}>
                  {`Bonus cargo: ${displayContractResult.resourceBonusIds.map((id) => getResourceDisplayName(id, true)).join(', ')}`}
                </Text>
              ) : null}
            </>
          ) : null}
          {displayContractResult.status === 'PENDING_DELIVERY' && contractForDeliveryHints ? (
            <>
              <View style={styles.sectionGap} />
              <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>POST-RUN DELIVERY</Text>
              {formatActiveContractCargoDeliveryHints(contractForDeliveryHints).map((line) => (
                <Text key={line} style={[styles.stat, { color: PENDING_ACCENT }]}>
                  {line.toUpperCase()}
                </Text>
              ))}
              <Text style={[styles.stat, { color: theme.mutedColor }]}>
                CONFIRM SPONSOR DELIVERY ON THE UPCOMING CARGO ROUTING STEP.
              </Text>
            </>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <TerminalSafeArea style={immersivePadding}>
      <TerminalResultsLayout
        accentBorderColor={`${accentColor}44`}
        narrative={(
          <>
            <Text style={[styles.title, { color: accentColor }]}>RUN DEBRIEF</Text>
            <Text style={[styles.subtitle, { color: theme.textColor }]}>
              {sectorName.toUpperCase()} // {operationTitle.toUpperCase()}
            </Text>
            <Text style={[styles.body, { color: theme.mutedColor }]}>
              {isFailure
                ? deathCargoSummary?.headline
                  ?? 'Incursion failed. Banked safehouse cargo routed to hub stash; unbanked cargo lost.'
                : routingState?.requiresRouting
                  ? 'Sector extraction secured. Route special cargo before returning to the Veil Front.'
                  : 'Sector extraction secured. Payload archived to hub stash.'}
            </Text>
            <Text style={[styles.stepBanner, { color: theme.mutedColor }]}>
              {`STEP ${stepIndex + 1}/${steps.length} — ${stepLabel}`}
            </Text>
            {completed ? (
              <Text style={[styles.completeBanner, { color: TERMINAL_ACCENT }]}>
                OPERATION COMPLETE
              </Text>
            ) : null}
          </>
        )}
        summary={(
          <View style={[styles.statsBox, { borderColor: theme.borderColor }]}>
            {currentStep === 'SUMMARY' ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RUN OUTCOME</Text>
                <Text style={[styles.statAccent, { color: accentColor }]}>
                  {formatRunOutcomeDetailLabel(runOutcomeDetail).toUpperCase()}
                </Text>
                {runOutcome === 'EXTRACTED' ? (
                  <Text style={[styles.stat, { color: theme.mutedColor }]}>
                    {formatExtractionKindLabel(extractionKind).toUpperCase()}
                  </Text>
                ) : null}
                {deathStats ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RUN STATS</Text>
                    <Text style={[styles.stat, { color: theme.primaryColor }]}>
                      {`TIME ALIVE: ${formatTimeAliveMmSs(deathStats.timeAliveMs)}`}
                    </Text>
                    <Text style={[styles.stat, { color: FAILURE_ACCENT }]}>
                      {`CAUSE: ${deathStats.causeOfDeath.toUpperCase()}`}
                    </Text>
                  </>
                ) : null}
                {deathCargoSummary ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CARGO RESOLUTION</Text>
                    <Text style={[styles.stat, { color: deathCargoSummary.bankedTotal > 0 ? TERMINAL_ACCENT : theme.mutedColor }]}>
                      {`BANKED AT SAFEHOUSE: ${deathCargoSummary.bankedSummary.toUpperCase()}`}
                    </Text>
                    <Text style={[styles.stat, { color: deathCargoSummary.lostTotal > 0 ? FAILURE_ACCENT : theme.mutedColor }]}>
                      {`LOST IN THE VEIL: ${deathCargoSummary.lostSummary.toUpperCase()}`}
                    </Text>
                    {deathCargoSummary.runTelemetryLines.map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                    {deathCargoSummary.extractRoutingNote ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {deathCargoSummary.extractRoutingNote.toUpperCase()}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {runOutcome === 'EXTRACTED' ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>EXTRACTION PAYOUT</Text>
                    <Text style={[styles.stat, { color: theme.primaryColor }]}>
                      +{credits} CREDITS // +{riftIron} RIFT IRON
                    </Text>
                    {residueVaulted > 0 ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        +{residueVaulted} VEIL RESIDUE VAULTED
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {unstableCargoSummary ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CARGO PRESSURE</Text>
                    {unstableCargoSummary.resolution.lost.length > 0 ? (
                      <Text style={[styles.stat, { color: FAILURE_ACCENT }]}>
                        {`LOST UNSTABLE CARGO: ${unstableCargoSummary.resolution.lost.length} STACK(S)`}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {aftermathPreviewLines.length > 0 ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>SECTOR AFTERMATH</Text>
                    {aftermathPreviewLines.map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                  </>
                ) : null}
                {worldBriefSummary ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>SECTOR CRISIS</Text>
                    {formatRunWorldBriefDebriefLines(worldBriefSummary).map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                    {worldBriefSummary.flavorLine ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {worldBriefSummary.flavorLine.toUpperCase()}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {anchorSummary ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>ANCHOR ACTIVITY</Text>
                    <Text style={[styles.statAccent, { color: accentColor }]}>
                      {anchorSummary.anchorType.toUpperCase()}
                    </Text>
                    <Text style={[styles.stat, { color: theme.mutedColor }]}>
                      {anchorSummary.anchorTheme.toUpperCase()}
                    </Text>
                    <Text style={[styles.stat, { color: theme.textColor }]}>
                      {`SIGNALS CLEARED: ${anchorSummary.signalsCleared}`}
                    </Text>
                    {anchorSummary.contributionNote ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {anchorSummary.contributionNote.toUpperCase()}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {depthIdentitySummary && depthIdentitySummary.lines.length > 0 ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>DEPTH EFFECTS</Text>
                    {depthIdentitySummary.distortionName ? (
                      <Text style={[styles.statAccent, { color: accentColor }]}>
                        {`BREACH DISTORTION: ${depthIdentitySummary.distortionName.toUpperCase()}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.distortionSummary ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {depthIdentitySummary.distortionSummary.toUpperCase()}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.lawName ? (
                      <Text style={[styles.statAccent, { color: accentColor }]}>
                        {`${depthIdentitySummary.intensified ? 'DEEP VEIL LAW (INTENSIFIED)' : 'DEEP VEIL LAW'}: ${depthIdentitySummary.lawName.toUpperCase()}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.lawSummary ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {depthIdentitySummary.lawSummary.toUpperCase()}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.modifiersSeen.length > 0 ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {`MODIFIERS SEEN: ${depthIdentitySummary.modifiersSeen.join(', ').toUpperCase()}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.modifiersCleared.length > 0 ? (
                      <Text style={[styles.statAccent, { color: accentColor }]}>
                        {`MODIFIERS CLEARED: ${depthIdentitySummary.modifiersCleared.join(', ').toUpperCase()}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.twistedSeen.length > 0 ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {`TWISTED SEEN: ${depthIdentitySummary.twistedSeen.join(', ').toUpperCase()}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.twistedCleared.length > 0 ? (
                      <Text style={[styles.statAccent, { color: accentColor }]}>
                        {`TWISTED CLEARED: ${depthIdentitySummary.twistedCleared.join(', ').toUpperCase()}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.twistedOutcomes.map((outcome) => (
                      <Text key={outcome} style={[styles.stat, { color: theme.mutedColor }]}>
                        {`OUTCOME: ${outcome.toUpperCase()}`}
                      </Text>
                    ))}
                    {depthIdentitySummary.depth2VariantsDefeated.length > 0 ? (
                      <Text style={[styles.statAccent, { color: accentColor }]}>
                        {`D2 VARIANTS DEFEATED: ${depthIdentitySummary.depth2VariantsDefeated.join(', ').toUpperCase()}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.depth3ExclusivesDefeated.length > 0 ? (
                      <Text style={[styles.statAccent, { color: accentColor }]}>
                        {`D3 EXCLUSIVES DEFEATED: ${depthIdentitySummary.depth3ExclusivesDefeated.join(', ').toUpperCase()}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.depthIdentityOpProgressGained > 0 ? (
                      <Text style={[styles.stat, { color: theme.textColor }]}>
                        {`DEPTH OP PROGRESS: +${depthIdentitySummary.depthIdentityOpProgressGained}`}
                      </Text>
                    ) : null}
                    {depthIdentitySummary.sectorDepthFlavor ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {depthIdentitySummary.sectorDepthFlavor.toUpperCase()}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {encounterCompositionSummary && encounterCompositionSummary.lines.length > 0 ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>ENCOUNTER HIGHLIGHTS</Text>
                    {encounterCompositionSummary.lines.map((line) => (
                      <Text key={line} style={[styles.statAccent, { color: accentColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                  </>
                ) : null}
                {echoSummary && echoSummary.signalsDiscovered > 0 ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>ECHOES</Text>
                    <Text style={[styles.stat, { color: theme.textColor }]}>
                      {`ECHO SIGNALS: ${echoSummary.signalsDiscovered} discovered / ${echoSummary.signalsResolved} resolved`}
                    </Text>
                    {echoSummary.hostileEchoesDefeated > 0 ? (
                      <Text style={[styles.stat, { color: TERMINAL_ACCENT }]}>
                        {`HOSTILE ECHOES DEFEATED: ${echoSummary.hostileEchoesDefeated}`}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {keepsakeSummary ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>EXPEDITION RELIC</Text>
                    <Text style={[styles.statAccent, { color: accentColor }]}>
                      {keepsakeSummary.name.toUpperCase()}
                    </Text>
                    <Text style={[styles.stat, { color: theme.mutedColor }]}>
                      {keepsakeSummary.effectSummary.toUpperCase()}
                    </Text>
                    <Text style={[styles.stat, { color: keepsakeSummary.triggered ? TERMINAL_ACCENT : theme.mutedColor }]}>
                      {keepsakeSummary.triggered
                        ? `TRIGGERED ${keepsakeSummary.triggerCount} TIME(S)`
                        : 'RELIC EFFECT DID NOT TRIGGER THIS RUN.'}
                    </Text>
                    {keepsakeSummary.decisionLines.length > 0 ? (
                      <>
                        <Text style={[styles.stat, { color: theme.mutedColor, marginTop: 4 }]}>
                          DECISIONS MADE
                        </Text>
                        {keepsakeSummary.decisionLines.map((line) => (
                          <Text key={`decision-${line}`} style={[styles.stat, { color: theme.textColor }]}>
                            {line.toUpperCase()}
                          </Text>
                        ))}
                      </>
                    ) : null}
                    {keepsakeSummary.riskLines.length > 0 ? (
                      <>
                        <Text style={[styles.stat, { color: theme.mutedColor, marginTop: 4 }]}>
                          RISKS ADDED
                        </Text>
                        {keepsakeSummary.riskLines.map((line) => (
                          <Text key={`risk-${line}`} style={[styles.stat, { color: PENDING_ACCENT }]}>
                            {line.toUpperCase()}
                          </Text>
                        ))}
                      </>
                    ) : null}
                    {keepsakeSummary.statLines.map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                    {keepsakeSummary.messages.length > 0 ? (
                      <>
                        <Text style={[styles.stat, { color: theme.mutedColor, marginTop: 4 }]}>
                          TRIGGER LOG
                        </Text>
                        {keepsakeSummary.messages.map((message) => (
                          <Text key={`msg-${message}`} style={[styles.stat, { color: theme.mutedColor }]}>
                            {message.toUpperCase()}
                          </Text>
                        ))}
                      </>
                    ) : null}
                    {keepsakeSummary.note ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {keepsakeSummary.note.toUpperCase()}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {runItemSummary ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RUN ITEMS</Text>
                    <Text style={[styles.stat, { color: theme.textColor }]}>
                      {`BROUGHT — COMBAT: ${runItemSummary.combatBrought.map((id) => id.replace(/-/g, ' ')).join(', ').toUpperCase() || 'NONE'}`}
                    </Text>
                    <Text style={[styles.stat, { color: theme.textColor }]}>
                      {`BROUGHT — FIELD: ${runItemSummary.fieldBrought.map((id) => id.replace(/-/g, ' ')).join(', ').toUpperCase() || 'NONE'}`}
                    </Text>
                    <Text style={[styles.stat, { color: theme.mutedColor, marginTop: 4 }]}>
                      {`REMAINING — COMBAT: ${runItemSummary.combatSlotted.map((id) => id.replace(/-/g, ' ')).join(', ').toUpperCase() || 'NONE'}`}
                    </Text>
                    <Text style={[styles.stat, { color: theme.mutedColor }]}>
                      {`REMAINING — FIELD: ${runItemSummary.fieldSlotted.map((id) => id.replace(/-/g, ' ')).join(', ').toUpperCase() || 'NONE'}`}
                    </Text>
                    <Text style={[styles.stat, { color: runItemSummary.triggered ? TERMINAL_ACCENT : theme.mutedColor }]}>
                      {runItemSummary.triggered
                        ? `TRIGGERED ${runItemSummary.triggerCount} TIME(S)`
                        : 'RUN ITEMS WERE NOT USED.'}
                    </Text>
                    {runItemSummary.riskLines.length > 0 ? (
                      <>
                        <Text style={[styles.stat, { color: theme.mutedColor, marginTop: 4 }]}>
                          RISKS ADDED
                        </Text>
                        {runItemSummary.riskLines.map((line) => (
                          <Text key={`run-item-risk-${line}`} style={[styles.stat, { color: PENDING_ACCENT }]}>
                            {line.toUpperCase()}
                          </Text>
                        ))}
                      </>
                    ) : null}
                    {runItemSummary.statLines.map((line) => (
                      <Text key={`run-item-stat-${line}`} style={[styles.stat, { color: theme.textColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                    {runItemSummary.messages.length > 0 ? (
                      <>
                        <Text style={[styles.stat, { color: theme.mutedColor, marginTop: 4 }]}>
                          TRIGGER LOG
                        </Text>
                        {runItemSummary.messages.map((message) => (
                          <Text key={`run-item-msg-${message}`} style={[styles.stat, { color: theme.mutedColor }]}>
                            {message.toUpperCase()}
                          </Text>
                        ))}
                      </>
                    ) : null}
                    {runItemSummary.note ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {runItemSummary.note.toUpperCase()}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {cargoRoutingSummary ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CARGO ROUTING</Text>
                    <Text style={[styles.stat, { color: PENDING_ACCENT }]}>
                      {`${cargoRoutingSummary.pendingStackCount} SPECIAL STACK(S) AWAIT ROUTING`}
                    </Text>
                    <Text style={[styles.stat, { color: theme.mutedColor }]}>
                      {`AUTO-STASHED: ${cargoRoutingSummary.autoStashedSummary.toUpperCase()}`}
                    </Text>
                    {cargoRoutingSummary.contractAwaitingDelivery ? (
                      <Text style={[styles.stat, { color: PENDING_ACCENT }]}>
                        CONTRACT AWAITING SPONSOR DELIVERY
                      </Text>
                    ) : null}
                    {cargoRoutingSummary.specialCargoStacksAcquired > 0 ? (
                      <Text style={[styles.stat, { color: theme.textColor }]}>
                        {`SPECIAL ACQUIRED THIS RUN: ${cargoRoutingSummary.specialCargoStacksAcquired}`}
                      </Text>
                    ) : null}
                    {cargoRoutingSummary.specialCargoStacksBanked > 0 ? (
                      <Text style={[styles.stat, { color: theme.textColor }]}>
                        {`SPECIAL BANKED AT SAFEHOUSE: ${cargoRoutingSummary.specialCargoStacksBanked}`}
                      </Text>
                    ) : null}
                    {cargoRoutingRunState && cargoRoutingRunState.pendingRoutingStacksAtExtract > 0 ? (
                      <Text style={[styles.stat, { color: PENDING_ACCENT }]}>
                        {`PENDING AT EXTRACT: ${cargoRoutingRunState.pendingRoutingStacksAtExtract} STACK(S)`}
                      </Text>
                    ) : null}
                    {cargoRoutingSummary.pendingItemLines.map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                  </>
                ) : null}
                {isCompactFlow ? (
                  <>
                    <View style={styles.sectionGap} />
                    {renderContractBlock()}
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>OPERATION CONTRIBUTION</Text>
                    <Text style={[styles.statAccent, { color: showNoProgressGenerated ? theme.mutedColor : accentColor }]}>
                      {progressThisRunLine.toUpperCase()}
                    </Text>
                    {hasExtractContribution ? contribution.breakdown.map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>{line}</Text>
                    )) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {currentStep === 'CONTRACT' ? renderContractBlock() : null}

            {currentStep === 'OPERATION' ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>OPERATION CONTRIBUTION</Text>
                <Text style={[styles.statAccent, { color: showNoProgressGenerated ? theme.mutedColor : accentColor }]}>
                  {progressThisRunLine.toUpperCase()}
                </Text>
                {hasExtractContribution ? contribution.breakdown.map((line) => (
                  <Text key={line} style={[styles.stat, { color: theme.textColor }]}>{line}</Text>
                )) : (
                  <Text style={[styles.stat, { color: theme.mutedColor }]}>
                    No qualifying run events credited toward this operation.
                  </Text>
                )}
                {operationBonusLines && operationBonusLines.length > 0 ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>BONUS OBJECTIVES</Text>
                    {operationBonusLines.map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>{line.toUpperCase()}</Text>
                    ))}
                  </>
                ) : null}
                {completionEffectSummary ? (
                  <Text style={[styles.stat, { color: theme.mutedColor }]}>
                    {`COMPLETION EFFECT: ${completionEffectSummary.toUpperCase()}`}
                  </Text>
                ) : null}
                {cargoRoutingSummary && cargoRoutingSummary.deferredContributionLines.length > 0 ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>PENDING CARGO CONTRIBUTION</Text>
                    {cargoRoutingSummary.deferredContributionLines.map((line) => (
                      <Text
                        key={line.label}
                        style={[styles.stat, { color: PENDING_ACCENT }]}
                      >
                        {formatCargoRoutingDebriefContributionLine(line).toUpperCase()}
                      </Text>
                    ))}
                  </>
                ) : null}
                <Text style={[styles.stat, { color: theme.textColor }]}>
                  {communityProgressLine.toUpperCase()}
                </Text>
              </>
            ) : null}

            {currentStep === 'ROUTING' && routingState ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CARGO ROUTING</Text>
                <CargoRoutingPanel
                  items={pendingRoutingItems}
                  decisions={decisions}
                  autoStashedSummary={formatAutoStashedSummary(routingState.autoStashed)}
                  cabalCredits={account.cabalCredits}
                  validationIssues={
                    routingValidationIssues.length > 0
                      ? routingValidationIssues
                      : (routingPreview?.valid === false ? routingPreview.issues : [])
                  }
                  previewContractStatus={
                    routingPreview?.contractStatus
                      ? contractStatusLabel(routingPreview.contractStatus)
                      : null
                  }
                  previewContractProgress={routingPreview?.contractProgressText ?? null}
                  previewOperationProgress={routingPreview?.operationProgressFromCargo ?? 0}
                  previewFenceCredits={routingPreview?.creditsFromFence ?? 0}
                  previewRivalCredits={routingPreview?.creditsFromRivalDelivery ?? 0}
                  previewCasketCredits={routingPreview?.creditsFromCasketOpen ?? 0}
                  previewBetrayalSummary={routingPreview?.betrayalSummary ?? null}
                  onAppraise={handleAppraiseSealed}
                  onDecisionChange={handleDecisionChange}
                  onQuantityChange={handleQuantityChange}
                  textColor={theme.textColor}
                  mutedColor={theme.mutedColor}
                  borderColor={theme.borderColor}
                />
                {routingError ? (
                  <Text style={[styles.stat, { color: FAILURE_ACCENT }]}>{routingError.toUpperCase()}</Text>
                ) : null}
              </>
            ) : null}

            {currentStep === 'REWARDS' ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>FINAL REWARDS</Text>
                <Text style={[styles.stat, { color: theme.mutedColor, fontSize: 9 }]}>
                  PROGRESSION NEVER BLOCKS EXIT — RETURN ANYTIME
                </Text>
                {progressionTheater ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>
                      {`PROGRESSION THEATER // PINS ${livePinSlots.used}/${livePinSlots.max}`}
                    </Text>
                    {progressionTheater.sections.map((section) => (
                      <View key={section.id} style={{ marginTop: 8 }}>
                        <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>
                          {section.label.toUpperCase()}
                        </Text>
                        {section.cards.map((card) => {
                          if (
                            card.kind === 'PIN_GOAL'
                            && card.goalDefId
                            && (livePinSlots.pinnedIds.has(card.goalDefId)
                              || pinnedThisDebrief.includes(card.goalDefId))
                          ) {
                            return null;
                          }
                          const slotsFull = livePinSlots.used >= livePinSlots.max;
                          return (
                            <View key={card.id} style={{ marginBottom: 8 }}>
                              <Text style={[styles.statAccent, { color: theaterCardColor(card) }]}>
                                {`${card.kind === 'CELEBRATE' ? '★ ' : ''}${card.title.toUpperCase()}`}
                              </Text>
                              {card.lines.map((line, lineIndex) => (
                                <Text
                                  key={`${card.id}-line-${lineIndex}`}
                                  style={[styles.stat, { color: theme.mutedColor }]}
                                >
                                  {line.toUpperCase()}
                                </Text>
                              ))}
                              {card.kind === 'PIN_GOAL' && card.goalDefId ? (
                                <HapticPressable
                                  disabled={slotsFull}
                                  onPress={() => handlePinGoalFromDebrief(card.goalDefId!)}
                                  style={({ pressed }) => [
                                    styles.pinButton,
                                    {
                                      borderColor: SELECT_ACCENT,
                                      opacity: slotsFull ? 0.45 : pressed ? 0.7 : 1,
                                    },
                                  ]}
                                >
                                  <Text style={[styles.pinButtonLabel, { color: SELECT_ACCENT }]}>
                                    {slotsFull
                                      ? '[ SLOTS FULL — UNPIN IN VEIL FRONT ]'
                                      : '[ PIN THIS GOAL ]'}
                                  </Text>
                                </HapticPressable>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </>
                ) : null}
                <View style={styles.sectionGap} />
                {routingState ? (
                  <Text style={[styles.stat, { color: theme.textColor }]}>
                    {`AUTO-STASHED: ${formatAutoStashedSummary(routingState.autoStashed).toUpperCase()}`}
                  </Text>
                ) : null}
                {routingResult ? (
                  <>
                    {routingResult.outcomeLines.map((line) => (
                      <Text key={line.label} style={[styles.stat, { color: theme.mutedColor }]}>
                        {line.label.toUpperCase()}
                      </Text>
                    ))}
                    {routingResult.creditsFromFence > 0 ? (
                      <Text style={[styles.statAccent, { color: TERMINAL_ACCENT }]}>
                        {`FENCE PAYOUT: +${routingResult.creditsFromFence} CR`}
                      </Text>
                    ) : null}
                    {Object.keys(routingResult.opened).length > 0 ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {`CASKET REWARDS: ${formatCasketOpenRewardsSummary(routingResult).toUpperCase()}`}
                      </Text>
                    ) : null}
                    {routingResult.creditsFromCasketOpen > 0 ? (
                      <Text style={[styles.statAccent, { color: TERMINAL_ACCENT }]}>
                        {`CASKET OPEN PAYOUT: +${routingResult.creditsFromCasketOpen} CR`}
                      </Text>
                    ) : null}
                    {routingResult.operationProgressFromCargo > 0 ? (
                      <Text style={[styles.statAccent, { color: TERMINAL_ACCENT }]}>
                        {`OPERATION PROGRESS FROM CARGO: +${routingResult.operationProgressFromCargo}`}
                      </Text>
                    ) : null}
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>THIS RUN ROUTING</Text>
                    {formatSessionCargoRoutingDebriefLines(routingResult, cargoRoutingRunState).map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CAREER ROUTING</Text>
                    <Text style={[styles.stat, { color: theme.mutedColor }]}>
                      {formatCareerCargoRoutingSummary(account.careerCargoRouting).toUpperCase()}
                    </Text>
                  </>
                ) : isFailure && deathCargoSummary ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CARGO RESOLUTION</Text>
                    <Text style={[styles.stat, { color: deathCargoSummary.bankedTotal > 0 ? TERMINAL_ACCENT : theme.mutedColor }]}>
                      {`BANKED AT SAFEHOUSE: ${deathCargoSummary.bankedSummary.toUpperCase()}`}
                    </Text>
                    <Text style={[styles.stat, { color: deathCargoSummary.lostTotal > 0 ? FAILURE_ACCENT : theme.mutedColor }]}>
                      {`LOST IN THE VEIL: ${deathCargoSummary.lostSummary.toUpperCase()}`}
                    </Text>
                    {formatSessionCargoRoutingDebriefLines(null, cargoRoutingRunState).map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.textColor }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                    {deathCargoSummary.extractRoutingNote ? (
                      <Text style={[styles.stat, { color: theme.mutedColor }]}>
                        {deathCargoSummary.extractRoutingNote.toUpperCase()}
                      </Text>
                    ) : null}
                  </>
                ) : !isFailure ? (
                  <Text style={[styles.stat, { color: theme.mutedColor }]}>
                    All cargo routed automatically to hub stash.
                  </Text>
                ) : null}
                {isCompactFlow && unstableCargoSummary ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>CARGO PRESSURE</Text>
                    {unstableCargoSummary.resolution.lost.map((line) => (
                      <Text key={`l-${line.resourceId}`} style={[styles.stat, { color: FAILURE_ACCENT }]}>
                        {`LOST: ${formatUnstableCargoDebriefLine(line).toUpperCase()}`}
                      </Text>
                    ))}
                    {unstableCargoSummary.resolution.extracted.map((line) => (
                      <Text key={`u-${line.resourceId}`} style={[styles.stat, { color: theme.mutedColor }]}>
                        {formatUnstableCargoDebriefLine(line).toUpperCase()}
                      </Text>
                    ))}
                  </>
                ) : null}
                {isCompactFlow && echoSummary && echoSummary.echoGlassRecovered > 0 ? (
                  <Text style={[styles.stat, { color: theme.statusColor }]}>
                    {`ECHO-GLASS RECOVERED: ${echoSummary.echoGlassRecovered}`}
                  </Text>
                ) : null}
                <View style={styles.sectionGap} />
                {renderContractBlock()}
                {resourceSections.length > 0 ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RESOURCE RESOLUTION</Text>
                    {resourceSections.map((section) => (
                      <View key={section.group} style={styles.resourceBlock}>
                        <Text style={[styles.stat, { color: theme.textColor, fontWeight: '700' }]}>
                          {section.title.toUpperCase()} ({section.totalItems})
                        </Text>
                        {section.lines.map((line) => (
                          <Text key={`${section.group}-${line.resourceId}`} style={[styles.stat, { color: theme.mutedColor }]}>
                            {formatDebriefResourceLine(line)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </>
                ) : null}
                {sourceHintLines.length > 0 ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>SOURCE INTEL</Text>
                    {sourceHintLines.map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.mutedColor }]}>
                        {line}
                      </Text>
                    ))}
                  </>
                ) : null}
                {typeof __DEV__ !== 'undefined' && __DEV__ ? (
                  <>
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RUN TELEMETRY</Text>
                    {formatRunBalanceTelemetryReport(balanceTelemetry).split('\n').slice(1).map((line) => (
                      <Text key={line} style={[styles.stat, { color: theme.mutedColor, fontSize: 9 }]}>
                        {line.toUpperCase()}
                      </Text>
                    ))}
                    <View style={styles.sectionGap} />
                    <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>BALANCE DASHBOARD</Text>
                    {formatBalanceDashboard(account.careerBalanceHistory).split('\n').slice(1).map((line) => (
                      <Text
                        key={`dash-${line}`}
                        style={[styles.stat, { color: theme.mutedColor, fontSize: 9 }]}
                      >
                        {line.toUpperCase()}
                      </Text>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        )}
        footer={(
          <HapticPressable
            disabled={footerDisabled}
            onPress={() => { void handleAdvance(); }}
            style={({ pressed }) => [
              styles.button,
              {
                borderColor: accentColor,
                backgroundColor: pressed ? '#0d1a12' : '#0e1624',
                opacity: footerDisabled ? 0.45 : 1,
              },
            ]}
          >
            <Text style={[styles.buttonLabel, { color: accentColor }]}>{footerLabel}</Text>
          </HapticPressable>
        )}
      />
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  stepBanner: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 12,
  },
  completeBanner: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 16,
  },
  statsBox: {
    borderWidth: 1,
    padding: 16,
    gap: 4,
    backgroundColor: 'rgba(10, 11, 15, 0.88)',
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 2,
  },
  sectionGap: {
    height: 10,
  },
  resourceBlock: {
    gap: 2,
    marginTop: 4,
  },
  stat: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  statAccent: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  pinButton: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  pinButtonLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  button: {
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
