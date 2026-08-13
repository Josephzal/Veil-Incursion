/**
 * Settled run result + idempotent settlement tests.
 * Run: npx --yes tsx src/data/settledRunResultEngine.test.ts
 */
import assert from 'node:assert/strict';
import {
  claimRunSettlement,
  finalizeRunResultsOnce,
  hasSettledRunResults,
  resetRunSettlementRegistryForTests,
} from './finalizeRunResults';
import {
  buildSettledCargoLines,
  buildSettledContractResult,
  buildSettledRunResult,
  formatCauseOfDeathLine,
  formatRunDuration,
  partitionCargoForDisplay,
  SETTLED_CARGO_VISIBLE_BUDGET,
  sumQuantity,
} from './settledRunResultEngine';
import type { OperationDebriefPayload } from './runDebriefEngine';
import type { ContractResult } from '../types/contract';
import type { RunBalanceTelemetry } from './runIntegration/runBalanceTelemetryEngine';
import { createEmptyRunResourceLedger } from '../types/runResourceLedger';
import { createDefaultEconomyRunTelemetry } from '../types/economyRunTelemetry';
import type { ResourceItemId } from '../types/resourceItem';

function emptyContract(overrides: Partial<ContractResult> = {}): ContractResult {
  return {
    status: 'NONE',
    title: '',
    sponsorId: null,
    objectiveText: '',
    progressText: '',
    reward: null,
    reputationAwarded: 0,
    creditsAwarded: 0,
    resourceBonusIds: [],
    bonusObjectiveMet: false,
    bonusCreditsAwarded: 0,
    bonusReputationAwarded: 0,
    ...overrides,
  };
}

function stubTelemetry(overrides: Partial<RunBalanceTelemetry> = {}): RunBalanceTelemetry {
  return {
    classId: null,
    weaponFamilyId: null,
    requisitionId: null,
    sectorId: null,
    sectorName: 'Null Zone',
    contractKind: null,
    operationKind: null,
    veilBiome: null,
    nodesCleared: 4,
    maxDepthReached: 2,
    districtLayer: 1,
    combatsCompleted: 0,
    eliteCombats: 0,
    bossCombats: 0,
    elitesDefeated: 0,
    bossesDefeated: 0,
    resourcesCollected: 0,
    resourcesExtracted: 0,
    resourcesBanked: 0,
    resourcesLost: 0,
    cargoBankedStacks: 0,
    cargoValueExtracted: 0,
    cargoValueLost: 0,
    cargoValueBanked: 0,
    unstableEffectsSeen: 0,
    avgCombatTurns: null,
    avgStandardTurns: null,
    avgEliteTurns: null,
    avgBossTurns: null,
    totalDamageTaken: 0,
    totalHealingReceived: 0,
    totalDamageDealt: 0,
    totalPlayerTurns: 0,
    contractCompleted: false,
    contractFailed: false,
    operationProgressGained: 0,
    requisitionTriggerCount: 0,
    supplyTriggerCount: 0,
    suppliesPacked: 0,
    suppliesFound: 0,
    suppliesPurchased: 0,
    suppliesUsed: 0,
    suppliesExtracted: 0,
    suppliesBanked: 0,
    suppliesLost: 0,
    suppliesJettisoned: 0,
    supplyCargoCellsOccupied: 0,
    resourcesDisplacedForSupply: 0,
    runsStartedWithoutRecoveryAccess: 0,
    echoSignalsDiscovered: 0,
    echoSignalsResolved: 0,
    extractionKind: 'STANDARD',
    extractionType: 'EXTRACT',
    deathCause: null,
    deathDistrict: null,
    timeAliveMs: 18 * 60_000 + 42_000,
    anchorSignalsCleared: 0,
    operationTargetsCleared: 0,
    sanctuaryVisits: 0,
    marketVisits: 0,
    runCreditsEarned: 0,
    ...overrides,
  };
}

function minimalPayload(
  overrides: Partial<OperationDebriefPayload> = {},
): OperationDebriefPayload {
  return {
    runOutcome: 'EXTRACTED',
    sectorName: 'Null Zone',
    operationTitle: 'Op',
    contribution: { operationId: null, total: 0, breakdown: [] },
    progressBefore: 0,
    progressAfter: 0,
    progressRequired: 100,
    progressBeforePct: 0,
    progressAfterPct: 0,
    progressDelta: 0,
    totalContributionThisRun: 0,
    completed: false,
    completionLogLines: [],
    credits: 0,
    riftIron: 0,
    residueVaulted: 0,
    contractResult: emptyContract(),
    activeContract: null,
    resourceSections: [],
    unstableCargoSummary: null,
    echoSummary: null,
    cargoRoutingSummary: null,
    extractionKind: 'STANDARD',
    requisitionSummary: null,
    requisitionRuntime: null,
    supplySummary: null,
    runOutcomeDetail: 'EXTRACTED',
    anchorSummary: null,
    depthIdentitySummary: null,
    encounterCompositionSummary: null,
    balanceTelemetry: stubTelemetry(),
    craftingOpportunities: {
      newlyCraftable: [],
      nearlyCraftable: [],
      highlightResources: [],
      discoveryHints: [],
      note: null,
    },
    economyRunTelemetry: createDefaultEconomyRunTelemetry(),
    worldBriefSummary: null,
    aftermathInput: null,
    breachGrade: 'I',
    runResourceLedger: createEmptyRunResourceLedger(),
    ...overrides,
  } as OperationDebriefPayload;
}

async function run(): Promise<void> {
  resetRunSettlementRegistryForTests();

  assert.equal(formatRunDuration(0), '00:00');
  assert.equal(formatRunDuration(18 * 60_000 + 42_000), '18:42');
  assert.equal(formatRunDuration(3661000), '1:01:01');

  assert.equal(formatCauseOfDeathLine('Thrall'), 'Defeated by Thrall');
  assert.equal(formatCauseOfDeathLine('Defeated by Thrall'), 'Defeated by Thrall');
  assert.equal(formatCauseOfDeathLine('DMG_SRC_INTERNAL_99'), null);
  assert.equal(formatCauseOfDeathLine(''), null);
  assert.equal(formatCauseOfDeathLine(null), null);

  const successLedger = createEmptyRunResourceLedger();
  successLedger.extracted = {
    'nullcrete-shard': 3,
    'echo-glass-shard': 6,
    'ley-slag': 4,
  };
  const success = buildSettledRunResult(minimalPayload({
    runOutcome: 'EXTRACTED',
    credits: 200,
    contractResult: emptyContract({
      status: 'SUCCESS',
      title: 'Recover Nullcrete Under Fire',
      progressText: '3 / 3 delivered',
      creditsAwarded: 216,
    }),
    runResourceLedger: successLedger,
  }));
  assert.equal(success.survived, true);
  assert.equal(success.outcomeTitle, 'EXTRACTION SECURED');
  assert.equal(success.causeOfDeathLine, null);
  assert.equal(success.contractTitle, 'Recover Nullcrete Under Fire');
  assert.equal(success.deepestReachLabel, 'DEPTH 2 · NODE 4');
  assert.equal(success.runDurationLabel, '18:42');
  assert.match(success.cargoResultLabel, /SECURED/);
  assert.equal(success.cargoMode, 'RECOVERED');
  assert.ok(success.recoveredCargo.length >= 1);
  assert.equal(success.contract?.status, 'COMPLETE');
  assert.equal(success.creditsEarned, 416);
  assert.equal(success.extractionTypeLabel, null);

  const deathLedger = createEmptyRunResourceLedger();
  deathLedger.bankedAtSafehouse = { 'echo-glass-shard': 2 };
  deathLedger.lostOnDeath = { 'nullcrete-shard': 3, 'ley-slag': 2 };
  const failed = buildSettledRunResult(minimalPayload({
    runOutcome: 'FAILED',
    credits: 0,
    deathStats: {
      timeAliveMs: 115_000,
      causeOfDeath: 'Thrall',
      sectorLevel: 2,
      depthLayer: 1,
    },
    balanceTelemetry: stubTelemetry({
      maxDepthReached: 1,
      nodesCleared: 2,
      timeAliveMs: 115_000,
      extractionType: 'DEATH',
    }),
    contractResult: emptyContract({
      status: 'FAILED',
      title: 'Recover Nullcrete Under Fire',
      progressText: '0 / 3 delivered',
    }),
    runResourceLedger: deathLedger,
  }));
  assert.equal(failed.outcomeTitle, 'RUNNER LOST');
  assert.equal(failed.causeOfDeathLine, 'Defeated by Thrall');
  assert.equal(failed.cargoMode, 'SECURED_AND_LOST');
  assert.equal(sumQuantity(deathLedger.bankedAtSafehouse), 2);
  assert.equal(sumQuantity(deathLedger.lostOnDeath), 5);
  assert.match(failed.cargoResultLabel, /2 SECURED/);
  assert.match(failed.cargoResultLabel, /5 LOST/);
  assert.equal(failed.creditsEarned, null);
  assert.ok(failed.securedCargo.length > 0);
  assert.ok(failed.lostCargo.length > 0);
  assert.equal(failed.contract?.status, 'FAILED');

  const emptyDeath = buildSettledRunResult(minimalPayload({
    runOutcome: 'FAILED',
    deathStats: {
      timeAliveMs: 115_000,
      causeOfDeath: 'Thrall',
      sectorLevel: 2,
      depthLayer: 1,
    },
    contractResult: emptyContract(),
    runResourceLedger: createEmptyRunResourceLedger(),
  }));
  assert.equal(emptyDeath.cargoMode, 'NONE');
  assert.equal(emptyDeath.contract, null);
  assert.equal(emptyDeath.contractTitle, null);
  assert.equal(emptyDeath.creditsEarned, null);

  const keys = Object.keys(success);
  assert.ok(!keys.includes('reputation'));
  assert.ok(!keys.includes('unlocks'));
  assert.ok(!keys.includes('operationProgress'));
  assert.ok(!keys.includes('classSummary'));

  const manyIds: ResourceItemId[] = [
    'nullcrete-shard',
    'echo-glass-shard',
    'ley-slag',
    'cinder-wire',
    'rail-capacitor',
    'mycelial-ichor',
    'legion-blood-iron',
    'resonant-filament',
    'combustion-cylinder',
    'containment-seal',
    'tarnished-dog-tags',
    'smugglers-ledger',
    'veil-ash-canister',
    'sanguine-ampoule',
  ];
  const manyQty = Object.fromEntries(manyIds.map((id) => [id, 1])) as Record<ResourceItemId, number>;
  const many = buildSettledCargoLines(manyQty);
  const partitioned = partitionCargoForDisplay(many, SETTLED_CARGO_VISIBLE_BUDGET);
  assert.ok(partitioned.visible.length <= SETTLED_CARGO_VISIBLE_BUDGET);
  assert.ok(partitioned.overflowCount >= 1);

  assert.equal(
    buildSettledContractResult(emptyContract({
      status: 'SUCCESS',
      title: 'A',
      progressText: '1 / 1 delivered',
    }))?.status,
    'COMPLETE',
  );
  assert.equal(
    buildSettledContractResult(emptyContract({
      status: 'FAILED',
      title: 'A',
      progressText: '1 / 3 retained',
    }))?.status,
    'INCOMPLETE',
  );

  resetRunSettlementRegistryForTests();
  const key = 'run-test-key';
  assert.equal(claimRunSettlement(key), true);
  assert.equal(claimRunSettlement(key), false);
  assert.equal(hasSettledRunResults(key), true);

  resetRunSettlementRegistryForTests();
  let settleCount = 0;
  const first = await finalizeRunResultsOnce('dup-key', () => {
    settleCount += 1;
    return 'ok';
  });
  const second = await finalizeRunResultsOnce('dup-key', () => {
    settleCount += 1;
    return 'again';
  });
  assert.equal(first.didSettle, true);
  assert.equal(first.value, 'ok');
  assert.equal(second.didSettle, false);
  assert.equal(second.value, null);
  assert.equal(settleCount, 1);

  console.log('settledRunResultEngine.test.ts — all assertions passed');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
