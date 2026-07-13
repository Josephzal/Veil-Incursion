import type { ContractExtractionKind } from '../../types/contract';
import type { ActiveIncursionState } from '../../types/game';
import type { RunResourceLedger } from '../../types/runResourceLedger';
import { depthIndexFromNodesCleared } from '../worldStateHelpers';
import { depthFromNodesCleared } from '../districtPacing';
import { resolveContractExtractionKind } from '../contractExtractionKind';
import { sumLedgerCategoryTotals } from './runIntegrationHelpers';

export interface RunBalanceTelemetry {
  nodesCleared: number;
  maxDepthReached: number;
  districtLayer: 1 | 2 | 3;
  combatsCompleted: number;
  elitesDefeated: number;
  bossesDefeated: number;
  resourcesCollected: number;
  resourcesExtracted: number;
  resourcesBanked: number;
  resourcesLost: number;
  cargoBankedStacks: number;
  unstableEffectsSeen: number;
  contractCompleted: boolean;
  contractFailed: boolean;
  operationProgressGained: number;
  keepsakeTriggerCount: number;
  runItemTriggerCount: number;
  echoSignalsDiscovered: number;
  echoSignalsResolved: number;
  extractionKind: ContractExtractionKind;
  extractionType: 'EXTRACT' | 'DEATH';
  timeAliveMs: number | null;
  anchorSignalsCleared: number;
  operationTargetsCleared: number;
}

function sumLedgerValues(ledger: Partial<RunResourceLedger>, key: keyof RunResourceLedger): number {
  const bucket = ledger[key];
  if (!bucket || typeof bucket !== 'object') return 0;
  return Object.values(bucket).reduce((sum, qty) => sum + (qty ?? 0), 0);
}

export function buildRunBalanceTelemetry(
  incursion: ActiveIncursionState,
  opts?: {
    extractedSuccessfully?: boolean;
    operationProgressGained?: number;
    timeAliveMs?: number | null;
  },
): RunBalanceTelemetry {
  const ledger = incursion.runResourceLedger;
  const extracted = opts?.extractedSuccessfully ?? false;
  const progress = incursion.contractRunProgress;
  const echo = incursion.echoRunState;

  return {
    nodesCleared: incursion.nodesCleared,
    maxDepthReached: progress.highestDepthReached,
    districtLayer: depthIndexFromNodesCleared(incursion.nodesCleared),
    combatsCompleted: Math.max(0, incursion.nodesCleared - progress.anomaliesCleared),
    elitesDefeated: progress.eliteKills,
    bossesDefeated: progress.depthBossDefeated ? 1 : 0,
    resourcesCollected: sumLedgerValues(ledger, 'collected'),
    resourcesExtracted: sumLedgerValues(ledger, 'extracted'),
    resourcesBanked: sumLedgerValues(ledger, 'bankedAtSafehouse'),
    resourcesLost: sumLedgerValues(ledger, 'lostOnDeath'),
    cargoBankedStacks: sumLedgerCategoryTotals(ledger.bankedAtSafehouse),
    unstableEffectsSeen: incursion.unstableCargoEffectsSeen?.length ?? 0,
    contractCompleted: false,
    contractFailed: false,
    operationProgressGained: opts?.operationProgressGained ?? 0,
    keepsakeTriggerCount: incursion.keepsakeRuntime?.stats.triggerCount ?? 0,
    runItemTriggerCount: incursion.itemRuntime?.stats.triggerCount ?? 0,
    echoSignalsDiscovered: echo?.echoSignalsDiscovered ?? 0,
    echoSignalsResolved: echo?.echoSignalsResolved ?? 0,
    extractionKind: resolveContractExtractionKind(incursion),
    extractionType: extracted ? 'EXTRACT' : 'DEATH',
    timeAliveMs: opts?.timeAliveMs ?? null,
    anchorSignalsCleared: progress.anchorSignalsCleared,
    operationTargetsCleared: progress.operationTargetsCleared,
  };
}

export function applyTelemetryContractOutcome(
  telemetry: RunBalanceTelemetry,
  contractStatus: 'NONE' | 'SUCCESS' | 'FAILED' | 'PENDING_DELIVERY',
): RunBalanceTelemetry {
  return {
    ...telemetry,
    contractCompleted: contractStatus === 'SUCCESS' || contractStatus === 'PENDING_DELIVERY',
    contractFailed: contractStatus === 'FAILED',
  };
}

export function formatRunBalanceTelemetryReport(telemetry: RunBalanceTelemetry): string {
  const lines = [
    'RUN BALANCE TELEMETRY',
    `nodes cleared: ${telemetry.nodesCleared} (depth ${telemetry.maxDepthReached}, district ${telemetry.districtLayer})`,
    `combats ~${telemetry.combatsCompleted} | elites ${telemetry.elitesDefeated} | bosses ${telemetry.bossesDefeated}`,
    `resources — collected ${telemetry.resourcesCollected} | extracted ${telemetry.resourcesExtracted} | banked ${telemetry.resourcesBanked} | lost ${telemetry.resourcesLost}`,
    `cargo banked stacks: ${telemetry.cargoBankedStacks}`,
    `unstable effects seen: ${telemetry.unstableEffectsSeen}`,
    `anchor signals: ${telemetry.anchorSignalsCleared} | operation targets: ${telemetry.operationTargetsCleared}`,
    `echo signals: ${telemetry.echoSignalsDiscovered} discovered / ${telemetry.echoSignalsResolved} resolved`,
    `keepsake triggers: ${telemetry.keepsakeTriggerCount} | run item triggers: ${telemetry.runItemTriggerCount}`,
    `extraction: ${telemetry.extractionType} (${telemetry.extractionKind})`,
    `operation progress gained: ${telemetry.operationProgressGained}`,
    `contract: ${telemetry.contractCompleted ? 'complete/pending' : telemetry.contractFailed ? 'failed' : 'none'}`,
  ];
  if (telemetry.timeAliveMs != null) {
    lines.push(`time alive: ${Math.round(telemetry.timeAliveMs / 1000)}s`);
  }
  return lines.join('\n');
}
