import type { ContractExtractionKind, GeneratedContract, SelectedContractState } from '../types/contract';
import type { ContractSourceKind } from '../types/contractProcedural';
import type { SectorId } from '../types/worldState';
import { SOURCE_REASON_LABELS } from '../data/contractTemplateVariants';
import { canResourceSpawnInSector } from '../data/resourceRegistry';

export type ContractSectorCompatibility = 'RECOMMENDED' | 'VALID' | 'UNAVAILABLE' | 'NONE';

export function getContractSectorCompatibility(
  contract: GeneratedContract | null,
  sectorId: SectorId,
): ContractSectorCompatibility {
  if (!contract) return 'NONE';

  if (contract.objectiveKind === 'COMPLETE_EMERGENCY_RECALL'
    || contract.objectiveKind === 'DEFEAT_ELITE'
    || contract.objectiveKind === 'DEFEAT_DEPTH_BOSS'
    || contract.objectiveKind === 'REACH_DEPTH_AND_EXTRACT'
    || contract.objectiveKind === 'CLEAR_OPERATION_TARGET') {
    return contract.recommendedSectorIds.includes(sectorId) ? 'RECOMMENDED' : 'VALID';
  }

  const resourceIds = contract.targetResourceOptions?.length
    ? contract.targetResourceOptions
    : contract.targetResourceId
      ? [contract.targetResourceId]
      : [];

  if (resourceIds.length === 0) return 'VALID';

  const canComplete = resourceIds.some((resourceId) => canResourceSpawnInSector(resourceId, sectorId));
  if (!canComplete) return 'UNAVAILABLE';

  if (contract.recommendedSectorIds.includes(sectorId)) return 'RECOMMENDED';
  if (contract.validSectorIds.includes(sectorId)) return 'VALID';
  return 'UNAVAILABLE';
}

export function getSelectedContractForCompatibility(
  selected: SelectedContractState,
): GeneratedContract | null {
  return selected.kind === 'SPONSOR' ? selected.contract : null;
}

export function contractSectorWarning(
  compatibility: ContractSectorCompatibility,
): string | null {
  switch (compatibility) {
    case 'UNAVAILABLE':
      return 'This sector cannot complete the selected contract. You may still deploy, but the contract will fail unless abandoned.';
    case 'VALID':
      return 'Valid but not ideal for the selected contract.';
    default:
      return null;
  }
}

export function formatContractRewardSummary(contract: GeneratedContract): string {
  const parts = [`+${contract.reward.credits} CR`, `+${contract.reward.reputation} REP`];
  if (contract.reward.rareLootBonusPct) {
    parts.push(`+${contract.reward.rareLootBonusPct}% rare loot`);
  }
  return parts.join(' // ');
}

export function formatExtractionKindLabel(kind: ContractExtractionKind): string {
  switch (kind) {
    case 'SAFE_ANCHOR':
      return 'Safe Anchor Extraction';
    case 'EMERGENCY_RECALL':
      return 'Emergency Recall';
    case 'MASTER_LINK':
      return 'Master Extraction Link';
    default:
      return 'Standard Extraction';
  }
}

export function sponsorDisplayName(sponsorId: string): string {
  switch (sponsorId) {
    case 'TERRAN_GRID':
      return 'Terran Grid';
    case 'LEGION':
      return 'Legion';
    case 'SOLARIS':
      return 'Solaris';
    default:
      return sponsorId.replace(/_/g, ' ');
  }
}

export function formatContractContextTag(contract: GeneratedContract): string | null {
  const reason = contract.boundContext?.reason;
  if (!reason) return null;
  if (reason === 'OPERATION_ALIGNED') return 'Supports Active Operation';
  if (reason === 'ANCHOR_ALIGNED' && contract.boundContext?.anchorDisplayName) {
    return `Linked to ${contract.boundContext.anchorDisplayName}`;
  }
  return SOURCE_REASON_LABELS[reason] ?? null;
}

export function formatContractSourceReasonLabel(reason: ContractSourceKind | undefined): string | null {
  if (!reason) return null;
  return SOURCE_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ');
}
