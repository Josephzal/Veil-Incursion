import { CONTRACT_TEMPLATE_SPECS } from '../contractTemplates';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from '../resourceRegistry';
import type { GeneratedContract, SelectedContractState } from '../../types/contract';
import type { SectorId } from '../../types/worldState';
import { validateContractResourceTarget } from '../resourceValidation';

export interface ContractValidationIssue {
  severity: 'warn' | 'error';
  contractId?: string;
  templateKind?: string;
  message: string;
}

function pushIssue(issues: ContractValidationIssue[], issue: ContractValidationIssue): void {
  issues.push(issue);
}

export function validateContractTemplates(): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];

  CONTRACT_TEMPLATE_SPECS.forEach((spec) => {
    if (spec.weight <= 0) {
      pushIssue(issues, {
        severity: 'error',
        templateKind: spec.kind,
        message: 'Template weight must be positive.',
      });
    }
    if (spec.sponsors.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        templateKind: spec.kind,
        message: 'Template has no sponsors.',
      });
    }
  });

  return issues;
}

export function validateGeneratedContract(
  contract: GeneratedContract,
  sectorId: SectorId,
): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];

  if (contract.validSectorIds.length === 0) {
    pushIssue(issues, {
      severity: 'error',
      contractId: contract.id,
      message: 'Contract has no valid sectors.',
    });
  }

  if (!contract.validSectorIds.includes(sectorId)) {
    pushIssue(issues, {
      severity: 'warn',
      contractId: contract.id,
      message: `Contract not valid for sector ${sectorId}.`,
    });
  }

  const targetId = contract.targetResourceId;
  if (targetId) {
    if (!ALL_RESOURCE_ITEM_IDS.includes(targetId)) {
      pushIssue(issues, {
        severity: 'error',
        contractId: contract.id,
        message: `Target resource ${targetId} not in registry.`,
      });
    } else {
      const check = validateContractResourceTarget(targetId, sectorId);
      if (!check.valid) {
        pushIssue(issues, {
          severity: 'warn',
          contractId: contract.id,
          message: check.reason ?? 'Invalid contract resource target.',
        });
      }
    }
  }

  if (contract.targetCategory) {
    const categoryResources = ALL_RESOURCE_ITEM_IDS.filter(
      (id) => RESOURCE_REGISTRY[id].category === contract.targetCategory,
    );
    if (categoryResources.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        contractId: contract.id,
        message: `Category ${contract.targetCategory} has no resources.`,
      });
    }
  }

  if (!contract.reward || contract.reward.credits < 0) {
    pushIssue(issues, {
      severity: 'error',
      contractId: contract.id,
      message: 'Contract reward missing or invalid.',
    });
  }

  return issues;
}

export function validateSelectedContractForDescent(
  selected: SelectedContractState,
  sectorId: SectorId,
): ContractValidationIssue[] {
  if (selected.kind === 'INDEPENDENT') return [];
  return validateGeneratedContract(selected.contract, sectorId);
}

export function formatContractValidationReport(issues: ContractValidationIssue[]): string {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  const lines = issues.map((issue) => {
    const scope = issue.contractId ?? issue.templateKind ?? 'template';
    return `[${issue.severity.toUpperCase()}] ${scope}: ${issue.message}`;
  });
  return `Contract validation: ${errors} error(s), ${warns} warn(s).\n${lines.join('\n') || 'No issues.'}`;
}
