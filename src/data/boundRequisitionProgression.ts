import type { PlayerAccount } from '../types/game';
import type { BoundRequisitionTier } from '../types/boundRequisition';

/** Stub until dedicated bound-requisition level progression ships. */
export function getBoundRequisitionLevel(account: PlayerAccount): BoundRequisitionTier {
  const level = Math.min(5, Math.max(1, account.operativeRank));
  return level as BoundRequisitionTier;
}
