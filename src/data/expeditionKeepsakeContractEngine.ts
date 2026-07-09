import type {
  ActiveRunContract,
  ContractExtractionKind,
  ContractRunProgress,
  KeepsakeSealedClause,
  KeepsakeSealedClauseKind,
} from '../types/contract';
import type { KeepsakeRuntime } from '../types/expeditionKeepsake';
import type { CargoRunState } from '../types/cargoGrid';
import type { RunResourceLedger } from '../types/runResourceLedger';
import type { ResourceItemId } from '../types/resourceItem';
import {
  formatKeepsakeLogLine,
  tryKeepsakeTrigger,
} from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
import { patchKeepsakeStats } from './keepsakeRunState';
import { mergeResourceQuantities } from './runResourceLedgerEngine';
import { isOptionBClassResolver } from '../types/narrativeAssembly';
import type { OptionBResolver } from '../types/narrativeAssembly';

const SEALED_CLAUSE_CREDIT_BONUS = 25;
const SEALED_REP_BONUS_PCT = 50;
const COUNTERFEIT_REWARD_PENALTY_PCT = 25;

const CLAUSE_TEXT: Record<KeepsakeSealedClauseKind, string> = {
  OPERATION_TARGET: 'Clear 1 operation target before extract.',
  EXTRACT_TWO_CARGO: 'Extract with at least 2 cargo items secured.',
  DEFEAT_ELITE: 'Defeat 1 Elite hostile.',
  CLEAR_ANCHOR: 'Clear 1 Anchor Signal.',
  COMPLETE_DEPTH_2: 'Reach Depth 2 before extract.',
  NO_DIRTY_EXTRACTION: 'Extract without using Dirty Extraction.',
};

const CLAUSE_POOL: readonly KeepsakeSealedClauseKind[] = [
  'OPERATION_TARGET',
  'EXTRACT_TWO_CARGO',
  'DEFEAT_ELITE',
  'CLEAR_ANCHOR',
  'COMPLETE_DEPTH_2',
  'NO_DIRTY_EXTRACTION',
];

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickSealedClause(contractId: string): KeepsakeSealedClause {
  const kind = CLAUSE_POOL[hashSeed(contractId) % CLAUSE_POOL.length] ?? 'DEFEAT_ELITE';
  return { kind, text: CLAUSE_TEXT[kind] };
}

export function applyKeepsakeContractSealOnRunStart(
  runtime: KeepsakeRuntime | null,
  contract: ActiveRunContract | null,
): { runtime: KeepsakeRuntime | null; contract: ActiveRunContract | null; logLines: string[] } {
  if (!runtime || runtime.keepsakeId !== 'contract_seal' || !contract?.contractId) {
    return { runtime, contract, logLines: [] };
  }

  const def = getKeepsakeDefinition('contract_seal');
  const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, contract, logLines: [] };
  }

  const clause = pickSealedClause(contract.contractId);
  return {
    runtime: trigger.runtime,
    contract: { ...contract, keepsakeSealedClause: clause },
    logLines: [
      formatKeepsakeLogLine('Seal', def.triggerMessage),
      `>> SEALED CLAUSE — ${clause.text}`,
    ],
  };
}

export interface SealedClauseEvaluation {
  met: boolean;
  progressText: string;
  creditsBonus: number;
  reputationBonus: number;
}

function countCargoItems(cargo: CargoRunState): number {
  return cargo.containment.length + cargo.grid.placed.length;
}

function countResolvedBankedResources(
  ledger: RunResourceLedger,
  bankedMultiplier: number,
): number {
  const banked = ledger.bankedAtSafehouse;
  return Object.values(banked).reduce((sum, qty) => sum + Math.floor((qty ?? 0) * bankedMultiplier), 0);
}

export function evaluateKeepsakeSealedClause(
  clause: KeepsakeSealedClause,
  progress: ContractRunProgress,
  extractionKind: ContractExtractionKind,
  ledger: RunResourceLedger,
  cargo: CargoRunState,
  bankedMultiplier = 1,
): SealedClauseEvaluation {
  const empty: SealedClauseEvaluation = {
    met: false,
    progressText: 'Clause incomplete.',
    creditsBonus: 0,
    reputationBonus: 0,
  };

  switch (clause.kind) {
    case 'OPERATION_TARGET': {
      const met = progress.operationTargetsCleared >= 1;
      return {
        met,
        progressText: `Operation targets: ${progress.operationTargetsCleared}/1`,
        creditsBonus: met ? SEALED_CLAUSE_CREDIT_BONUS : 0,
        reputationBonus: met ? SEALED_REP_BONUS_PCT : 0,
      };
    }
    case 'EXTRACT_TWO_CARGO': {
      const carried = countCargoItems(cargo);
      const bankedStacks = countResolvedBankedResources(ledger, bankedMultiplier);
      const total = carried + bankedStacks;
      const met = total >= 2;
      return {
        met,
        progressText: `Cargo secured: ${total}/2 (carried + banked)`,
        creditsBonus: met ? SEALED_CLAUSE_CREDIT_BONUS : 0,
        reputationBonus: met ? SEALED_REP_BONUS_PCT : 0,
      };
    }
    case 'DEFEAT_ELITE': {
      const met = progress.eliteKills >= 1;
      return {
        met,
        progressText: `Elite kills: ${progress.eliteKills}/1`,
        creditsBonus: met ? SEALED_CLAUSE_CREDIT_BONUS : 0,
        reputationBonus: met ? SEALED_REP_BONUS_PCT : 0,
      };
    }
    case 'CLEAR_ANCHOR': {
      const met = progress.anchorSignalsCleared >= 1;
      return {
        met,
        progressText: `Anchor signals: ${progress.anchorSignalsCleared}/1`,
        creditsBonus: met ? SEALED_CLAUSE_CREDIT_BONUS : 0,
        reputationBonus: met ? SEALED_REP_BONUS_PCT : 0,
      };
    }
    case 'COMPLETE_DEPTH_2': {
      const met = progress.highestDepthReached >= 2;
      return {
        met,
        progressText: `Depth reached: ${progress.highestDepthReached}/2`,
        creditsBonus: met ? SEALED_CLAUSE_CREDIT_BONUS : 0,
        reputationBonus: met ? SEALED_REP_BONUS_PCT : 0,
      };
    }
    case 'NO_DIRTY_EXTRACTION': {
      const met = extractionKind !== 'EMERGENCY_RECALL';
      return {
        met,
        progressText: met ? 'Clean extraction confirmed' : 'Dirty extraction used — clause failed',
        creditsBonus: met ? SEALED_CLAUSE_CREDIT_BONUS : 0,
        reputationBonus: met ? SEALED_REP_BONUS_PCT : 0,
      };
    }
    default:
      return empty;
  }
}

export function applyKeepsakeSealedClauseBonuses(
  baseReputation: number,
  clauseEval: SealedClauseEvaluation | null,
): { reputation: number; creditsBonus: number } {
  if (!clauseEval?.met) {
    return { reputation: baseReputation, creditsBonus: 0 };
  }
  return {
    reputation: baseReputation + Math.floor(baseReputation * (clauseEval.reputationBonus / 100)),
    creditsBonus: clauseEval.creditsBonus,
  };
}

export function canUseKeepsakeCounterfeitMandate(
  runtime: KeepsakeRuntime | null | undefined,
): boolean {
  if (!runtime || runtime.keepsakeId !== 'counterfeit_mandate') return false;
  return !runtime.triggersUsed.counterfeit_mandate_spoof;
}

export function isKeepsakeCounterfeitEligibleResolver(
  optionB: OptionBResolver,
  locked: boolean,
  lockReason?: string,
): boolean {
  if (!locked) return false;
  if (isOptionBClassResolver(optionB)) return false;
  return (lockReason ?? '').toUpperCase().includes('CABAL');
}

export function applyKeepsakeCounterfeitMandateOnResolver(
  runtime: KeepsakeRuntime | null,
): { runtime: KeepsakeRuntime | null; logLines: string[] } {
  if (!canUseKeepsakeCounterfeitMandate(runtime)) {
    return { runtime, logLines: [] };
  }

  const def = getKeepsakeDefinition('counterfeit_mandate');
  const trigger = tryKeepsakeTrigger(runtime!, def.primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  return {
    runtime: patchKeepsakeStats(trigger.runtime, {
      narrativeResolversSpoofed: trigger.runtime.stats.narrativeResolversSpoofed + 1,
    }),
    logLines: [
      formatKeepsakeLogLine('Mandate', def.triggerMessage),
      `>> COUNTERFEIT MANDATE — authorization spoofed (−${COUNTERFEIT_REWARD_PENALTY_PCT}% reward, no sponsor rep).`,
    ],
  };
}

export function applyKeepsakeCounterfeitRewardPenalty(credits: number): number {
  return Math.max(0, Math.floor(credits * (1 - COUNTERFEIT_REWARD_PENALTY_PCT / 100)));
}

export function adjustKeepsakeResolvedResourcesForBankBonus(
  ledger: RunResourceLedger,
  bankedMultiplier: number,
): Record<ResourceItemId, number> {
  if (bankedMultiplier <= 1) {
    return mergeResourceQuantities(ledger.extracted, ledger.bankedAtSafehouse) as Record<ResourceItemId, number>;
  }
  const merged = { ...ledger.extracted } as Record<ResourceItemId, number>;
  (Object.entries(ledger.bankedAtSafehouse) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      const boosted = Math.floor(quantity * bankedMultiplier);
      merged[resourceId] = Math.max(merged[resourceId] ?? 0, boosted);
    },
  );
  return merged;
}
