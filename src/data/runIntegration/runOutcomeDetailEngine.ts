import type { ActiveIncursionState } from '../../types/game';
import type { ContractExtractionKind } from '../../types/contract';
import { resolveContractExtractionKind } from '../contractExtractionKind';
import { sumLedgerCategoryTotals } from './runIntegrationHelpers';

export type RunOutcomeDetail =
  | 'EXTRACTED'
  | 'EMERGENCY_RECALL'
  | 'RUNNER_LOST'
  | 'SAFEHOUSE_EXTRACT'
  | 'BANKED_THEN_DIED'
  | 'ABANDONED';

export function resolveRunOutcomeDetail(
  incursion: ActiveIncursionState,
  opts: {
    extractedSuccessfully: boolean;
    extractionKind?: ContractExtractionKind;
    bankedCargoStacks?: number;
    lostCargoStacks?: number;
  },
): RunOutcomeDetail {
  if (opts.extractedSuccessfully) {
    const kind = opts.extractionKind ?? resolveContractExtractionKind(incursion);
    if (kind === 'EMERGENCY_RECALL') return 'EMERGENCY_RECALL';
    if (kind === 'SAFE_ANCHOR' || kind === 'MASTER_LINK') return 'SAFEHOUSE_EXTRACT';
    return 'EXTRACTED';
  }

  const banked = opts.bankedCargoStacks ?? sumLedgerCategoryTotals(incursion.runResourceLedger.bankedAtSafehouse);
  const lost = opts.lostCargoStacks ?? sumLedgerCategoryTotals(incursion.runResourceLedger.lostOnDeath);
  if (banked > 0 && lost > 0) return 'BANKED_THEN_DIED';
  if (banked > 0 && lost === 0) return 'BANKED_THEN_DIED';
  return 'RUNNER_LOST';
}

export function formatRunOutcomeDetailLabel(detail: RunOutcomeDetail): string {
  switch (detail) {
    case 'EXTRACTED':
      return 'Extraction Secured';
    case 'EMERGENCY_RECALL':
      return 'Emergency Recall Extraction';
    case 'SAFEHOUSE_EXTRACT':
      return 'Extracted at Safehouse';
    case 'BANKED_THEN_DIED':
      return 'Banked Then Lost';
    case 'RUNNER_LOST':
      return 'Runner Lost';
    case 'ABANDONED':
      return 'Run Abandoned';
    default:
      return detail;
  }
}
