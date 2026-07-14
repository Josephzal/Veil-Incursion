import type { ContractExtractionKind } from '../../types/contract';
import type { ActiveIncursionState } from '../../types/game';
import type { ResourceItemId, ResourceQuantity } from '../../types/resourceItem';
import type { RunResourceLedger } from '../../types/runResourceLedger';
import { depthIndexFromNodesCleared } from '../worldStateHelpers';
import { resolveContractExtractionKind } from '../contractExtractionKind';
import { sumLedgerCategoryTotals } from './runIntegrationHelpers';
import { getResourceSellValue, RESOURCE_REGISTRY } from '../resourceRegistry';
import {
  averageTurnsForKind,
  type BalanceRunStats,
} from '../balance/balanceRunStats';

export interface RunBalanceTelemetry {
  // Loadout / context
  classId: string | null;
  weaponFamilyId: string | null;
  weaponTier: number | null;
  keepsakeId: string | null;
  sectorId: string | null;
  sectorName: string | null;
  contractKind: string | null;
  operationKind: string | null;
  veilBiome: string | null;

  // Structure
  nodesCleared: number;
  maxDepthReached: number;
  districtLayer: 1 | 2 | 3;
  combatsCompleted: number;
  eliteCombats: number;
  bossCombats: number;
  elitesDefeated: number;
  bossesDefeated: number;

  // Resources
  resourcesCollected: number;
  resourcesExtracted: number;
  resourcesBanked: number;
  resourcesLost: number;
  cargoBankedStacks: number;
  cargoValueExtracted: number;
  cargoValueLost: number;
  cargoValueBanked: number;
  unstableEffectsSeen: number;

  // Combat pacing (from balanceRunStats when instrumented)
  avgCombatTurns: number | null;
  avgStandardTurns: number | null;
  avgEliteTurns: number | null;
  avgBossTurns: number | null;
  totalDamageTaken: number;
  totalHealingReceived: number;
  totalDamageDealt: number;
  totalPlayerTurns: number;

  // Outcomes
  contractCompleted: boolean;
  contractFailed: boolean;
  operationProgressGained: number;
  keepsakeTriggerCount: number;
  runItemTriggerCount: number;
  echoSignalsDiscovered: number;
  echoSignalsResolved: number;
  extractionKind: ContractExtractionKind;
  extractionType: 'EXTRACT' | 'DEATH';
  deathCause: string | null;
  deathDistrict: 1 | 2 | 3 | null;
  timeAliveMs: number | null;
  anchorSignalsCleared: number;
  operationTargetsCleared: number;
  sanctuaryVisits: number;
  marketVisits: number;
  runCreditsEarned: number;
}

function sumLedgerValues(ledger: Partial<RunResourceLedger>, key: keyof RunResourceLedger): number {
  const bucket = ledger[key];
  if (!bucket || typeof bucket !== 'object') return 0;
  return Object.values(bucket).reduce((sum, qty) => sum + (qty ?? 0), 0);
}

function sumCargoFenceValue(qty: ResourceQuantity | undefined): number {
  if (!qty) return 0;
  return (Object.entries(qty) as Array<[ResourceItemId, number | undefined]>).reduce((sum, [id, n]) => {
    if (!n || n <= 0 || !RESOURCE_REGISTRY[id]) return sum;
    return sum + getResourceSellValue(id) * n;
  }, 0);
}

function avgAllVictories(stats: BalanceRunStats | null | undefined): number | null {
  const wins = (stats?.combats ?? []).filter((c) => c.victory && c.playerTurns > 0);
  if (wins.length === 0) return null;
  const sum = wins.reduce((a, c) => a + c.playerTurns, 0);
  return Math.round((sum / wins.length) * 10) / 10;
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
  const balance = incursion.balanceRunStats ?? null;
  const context = incursion.runGenerationContext;
  const samples = balance?.combats ?? [];

  const eliteCombats = samples.filter((c) => c.kind === 'ELITE').length;
  const bossCombats = samples.filter((c) => c.kind === 'BOSS').length;

  return {
    classId: incursion.activeClass ?? null,
    weaponFamilyId: incursion.activeWeaponFamilyId ?? null,
    weaponTier: incursion.activeWeaponTier ?? null,
    keepsakeId: incursion.keepsakeRuntime?.keepsakeId ?? null,
    sectorId: context?.sectorState.id ?? null,
    sectorName: context?.sectorState.displayName ?? null,
    contractKind: incursion.activeContract?.objectiveKind ?? null,
    operationKind: context?.activeOperation.objectiveKind ?? null,
    veilBiome: incursion.runVeilBiome ?? null,

    nodesCleared: incursion.nodesCleared,
    maxDepthReached: progress.highestDepthReached,
    districtLayer: depthIndexFromNodesCleared(incursion.nodesCleared),
    combatsCompleted: samples.length > 0
      ? samples.length
      : Math.max(0, incursion.nodesCleared - progress.anomaliesCleared),
    eliteCombats,
    bossCombats: bossCombats || (progress.depthBossDefeated ? 1 : 0),
    elitesDefeated: progress.eliteKills,
    bossesDefeated: progress.depthBossDefeated ? 1 : 0,

    resourcesCollected: sumLedgerValues(ledger, 'collected'),
    resourcesExtracted: sumLedgerValues(ledger, 'extracted'),
    resourcesBanked: sumLedgerValues(ledger, 'bankedAtSafehouse'),
    resourcesLost: sumLedgerValues(ledger, 'lostOnDeath'),
    cargoBankedStacks: sumLedgerCategoryTotals(ledger.bankedAtSafehouse),
    cargoValueExtracted: sumCargoFenceValue(ledger.extracted),
    cargoValueLost: sumCargoFenceValue(ledger.lostOnDeath),
    cargoValueBanked: sumCargoFenceValue(ledger.bankedAtSafehouse),
    unstableEffectsSeen: incursion.unstableCargoEffectsSeen?.length ?? 0,

    avgCombatTurns: avgAllVictories(balance),
    avgStandardTurns: averageTurnsForKind(samples, 'STANDARD'),
    avgEliteTurns: averageTurnsForKind(samples, 'ELITE'),
    avgBossTurns: averageTurnsForKind(samples, 'BOSS'),
    totalDamageTaken: balance?.totalDamageTaken ?? 0,
    totalHealingReceived: balance?.totalHealingReceived ?? 0,
    totalDamageDealt: balance?.totalDamageDealt ?? 0,
    totalPlayerTurns: balance?.totalPlayerTurns ?? 0,

    contractCompleted: false,
    contractFailed: false,
    operationProgressGained: opts?.operationProgressGained ?? 0,
    keepsakeTriggerCount: incursion.keepsakeRuntime?.stats.triggerCount ?? 0,
    runItemTriggerCount: incursion.itemRuntime?.stats.triggerCount ?? 0,
    echoSignalsDiscovered: echo?.echoSignalsDiscovered ?? 0,
    echoSignalsResolved: echo?.echoSignalsResolved ?? 0,
    extractionKind: resolveContractExtractionKind(incursion),
    extractionType: extracted ? 'EXTRACT' : 'DEATH',
    deathCause: balance?.deathCause ?? null,
    deathDistrict: balance?.deathDistrict ?? null,
    timeAliveMs: opts?.timeAliveMs ?? null,
    anchorSignalsCleared: progress.anchorSignalsCleared,
    operationTargetsCleared: progress.operationTargetsCleared,
    sanctuaryVisits: balance?.sanctuaryVisits ?? 0,
    marketVisits: balance?.marketVisits ?? 0,
    runCreditsEarned: incursion.runCredits ?? 0,
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
    `loadout: ${telemetry.classId ?? '—'} // ${telemetry.weaponFamilyId ?? '—'} T${telemetry.weaponTier ?? '?'} // relic ${telemetry.keepsakeId ?? 'none'}`,
    `sector: ${telemetry.sectorName ?? telemetry.sectorId ?? '—'} // biome ${telemetry.veilBiome ?? '—'}`,
    `contract: ${telemetry.contractKind ?? 'none'} // op: ${telemetry.operationKind ?? '—'}`,
    `nodes cleared: ${telemetry.nodesCleared} (depth ${telemetry.maxDepthReached}, district ${telemetry.districtLayer})`,
    `combats ${telemetry.combatsCompleted} (std~${telemetry.combatsCompleted - telemetry.eliteCombats - telemetry.bossCombats} / elite ${telemetry.eliteCombats} / boss ${telemetry.bossCombats})`,
    `elites ${telemetry.elitesDefeated} | bosses ${telemetry.bossesDefeated}`,
    `resources — collected ${telemetry.resourcesCollected} | extracted ${telemetry.resourcesExtracted} | banked ${telemetry.resourcesBanked} | lost ${telemetry.resourcesLost}`,
    `cargo value — extracted ${telemetry.cargoValueExtracted} CR | banked ${telemetry.cargoValueBanked} CR | lost ${telemetry.cargoValueLost} CR`,
    `combat pacing — avg turns ${telemetry.avgCombatTurns ?? '—'} (std ${telemetry.avgStandardTurns ?? '—'} / elite ${telemetry.avgEliteTurns ?? '—'} / boss ${telemetry.avgBossTurns ?? '—'})`,
    `damage taken ${telemetry.totalDamageTaken} | healing ${telemetry.totalHealingReceived} | damage dealt ${telemetry.totalDamageDealt}`,
    `unstable effects: ${telemetry.unstableEffectsSeen} // sanctuary ${telemetry.sanctuaryVisits} // market ${telemetry.marketVisits}`,
    `anchor signals: ${telemetry.anchorSignalsCleared} | operation targets: ${telemetry.operationTargetsCleared}`,
    `echo signals: ${telemetry.echoSignalsDiscovered} discovered / ${telemetry.echoSignalsResolved} resolved`,
    `keepsake triggers: ${telemetry.keepsakeTriggerCount} | run item triggers: ${telemetry.runItemTriggerCount}`,
    `extraction: ${telemetry.extractionType} (${telemetry.extractionKind})`,
    `operation progress gained: ${telemetry.operationProgressGained}`,
    `contract: ${telemetry.contractCompleted ? 'complete/pending' : telemetry.contractFailed ? 'failed' : 'none'}`,
    `run credits earned: ${telemetry.runCreditsEarned}`,
  ];
  if (telemetry.extractionType === 'DEATH') {
    lines.push(`death: ${telemetry.deathCause ?? 'unknown'} @ district ${telemetry.deathDistrict ?? '?'}`);
  }
  if (telemetry.timeAliveMs != null) {
    lines.push(`time alive: ${Math.round(telemetry.timeAliveMs / 1000)}s`);
  }
  return lines.join('\n');
}
