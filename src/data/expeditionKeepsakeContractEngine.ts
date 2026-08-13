import type {
  ActiveRunContract,
  ContractExtractionKind,
  ContractRunProgress,
  KeepsakeSealedClause,
} from '../types/contract';
import type { RequisitionRuntime as KeepsakeRuntime } from '../types/expeditionRequisition';
import type { CargoRunState } from '../types/cargoGrid';
import type { RunResourceLedger } from '../types/runResourceLedger';
import type { ResourceItemId } from '../types/resourceItem';
import { prepareKeepsakeContractSealChoice } from './expeditionKeepsakeChoiceEngine';
import { mergeResourceQuantities } from './runResourceLedgerEngine';

const SEALED_CLAUSE_CREDIT_BONUS = 25;
const SEALED_REP_BONUS_PCT = 50;

/** Contract Seal — queue a 3-clause picker instead of auto-binding one clause. */
export function applyKeepsakeContractSealOnRunStart(
  runtime: KeepsakeRuntime | null,
  contract: ActiveRunContract | null,
): { runtime: KeepsakeRuntime | null; contract: ActiveRunContract | null; logLines: string[] } {
  return prepareKeepsakeContractSealChoice(runtime, contract);
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
