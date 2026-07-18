import type { GeneratedContract } from '../types/contract';
import type { ContractGenerationContext } from '../types/contractProcedural';
import { hasUnresolvedPlaceholders } from './contractTemplateVariants';
import { validateProceduralContract } from './contractProceduralEngine';
import { canResourceSpawnInSector, RESOURCE_REGISTRY } from './resourceRegistry';
import type { SectorId } from '../types/worldState';

export interface ContractProceduralValidationIssue {
  severity: 'warn' | 'error';
  contractId?: string;
  message: string;
}

export function validateContractBoard(
  contracts: GeneratedContract[],
  ctx: ContractGenerationContext,
  sectorId: SectorId,
): ContractProceduralValidationIssue[] {
  const issues: ContractProceduralValidationIssue[] = [];

  contracts.forEach((contract) => {
    if (hasUnresolvedPlaceholders(contract.title) || hasUnresolvedPlaceholders(contract.objectiveText)) {
      issues.push({
        severity: 'error',
        contractId: contract.id,
        message: 'Unresolved placeholders in contract text.',
      });
    }
    if (!validateProceduralContract(contract, ctx)) {
      issues.push({
        severity: 'error',
        contractId: contract.id,
        message: 'Contract failed procedural validation.',
      });
    }
    if (contract.reward.credits <= 0) {
      issues.push({
        severity: 'error',
        contractId: contract.id,
        message: 'Contract has no credit reward.',
      });
    }
    const resourceIds = contract.targetResourceOptions?.length
      ? contract.targetResourceOptions
      : contract.targetResourceId
        ? [contract.targetResourceId]
        : [];
    if (resourceIds.length > 0 && !resourceIds.some((id) => canResourceSpawnInSector(id, sectorId))) {
      issues.push({
        severity: 'warn',
        contractId: contract.id,
        message: `Target resource not spawnable in selected sector ${sectorId}.`,
      });
    }
    if (resourceIds.some((id) => !RESOURCE_REGISTRY[id]?.canBeContractTarget)) {
      issues.push({
        severity: 'error',
        contractId: contract.id,
        message: 'Target resource is not canBeContractTarget.',
      });
    }
  });

  const kindCounts = new Map<string, number>();
  contracts.forEach((c) => {
    const key = `${c.sponsorId}:${c.objectiveKind}`;
    kindCounts.set(key, (kindCounts.get(key) ?? 0) + 1);
  });
  kindCounts.forEach((count, key) => {
    if (count > 1) {
      issues.push({
        severity: 'warn',
        message: `Duplicate objective on board: ${key} (${count}x).`,
      });
    }
  });

  return issues;
}

export function formatContractProceduralValidationReport(
  issues: ContractProceduralValidationIssue[],
): string {
  if (issues.length === 0) return 'CONTRACT PROCEDURAL VALIDATION — no issues found.';
  const lines = ['CONTRACT PROCEDURAL VALIDATION', ''];
  issues.forEach((issue) => {
    lines.push(`[${issue.severity.toUpperCase()}] ${issue.contractId ? `${issue.contractId}: ` : ''}${issue.message}`);
  });
  return lines.join('\n');
}
