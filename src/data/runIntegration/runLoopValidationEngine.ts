import { validateWorldState, formatWorldStateValidationReport } from '../worldStateValidation';
import { validateActiveOperations, formatOperationValidationReport } from '../operationValidationEngine';
import {
  validateAllAnchorPools,
  formatAnchorValidationReport,
} from '../anchorProceduralValidationEngine';
import {
  validateContractBoard,
  formatContractProceduralValidationReport,
} from '../contractProceduralValidationEngine';
import { buildContractGenerationContext } from '../contractProceduralEngine';
import {
  buildPreliminaryRunWorldContext,
  buildRunWorldBrief,
} from '../runWorldBriefEngine';
import { getActiveAnchorInstance } from '../anchorLifecycleEngine';
import {
  validateRunWorldBrief,
  formatRunWorldBriefValidationReport,
} from '../runWorldBriefValidationEngine';
import { validateResourceRegistry } from '../resourceValidation';
import { formatEchoValidationReport } from '../echoDebugEngine';
import { formatPostRunRoutingDebugValidation } from '../postRunCargoRoutingDebugEngine';
import { auditReportPostRunCargoRouting } from '../postRunCargoRoutingAuditEngine';
import { formatKeepsakeDebugValidation } from '../expeditionKeepsakeDebugEngine';
import { formatRunItemDebugValidation } from '../runItemDebugEngine';
import { formatRunItemAcceptanceReport, validateRunItemAcceptance } from '../runItemAcceptanceEngine';
import { validateContractTemplates, formatContractValidationReport } from './contractValidationEngine';
import { validateWeaponRegistry, formatWeaponValidationReport } from '../weaponValidationEngine';
import { formatContentMatrixReport } from './contentMatrixEngine';
import {
  formatBalanceValidationReport,
  validateBalance,
} from '../balance/balanceValidationEngine';
import type { CareerBalanceHistory } from '../balance/balanceDashboardEngine';
import type { SectorState, WorldStatePersistedState } from '../../types/worldState';

function buildSelectedSectorContractContext(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
) {
  const sector = sectors.find((s) => s.id === persisted.selectedSectorId);
  if (!sector) return null;
  const anchor = getActiveAnchorInstance(persisted, sector.id);
  const preliminary = buildPreliminaryRunWorldContext({
    persisted,
    sectorState: sector,
    operation: sector.activeOperation,
    anchor,
  });
  return {
    sector,
    ctx: buildContractGenerationContext({
      deployRunIndex: persisted.deployRunIndex,
      sectorId: sector.id,
      activeOperation: sector.activeOperation,
      activeAnchor: sector.activeAnchor,
      sectorResourceFocus: sector.resourceFocus,
      hazardLevel: sector.hazardLevel,
      rewardLevel: sector.rewardLevel,
      echoActivity: sector.echoActivity,
      recentContractMemory: persisted.contractProceduralMemory,
      crisisTheme: preliminary.crisisTheme,
      resourceStress: preliminary.resourceStress,
      threatProfile: preliminary.threatProfile,
      contractBias: preliminary.contractBias,
      sponsorInterest: preliminary.sponsorInterest,
    }),
    brief: buildRunWorldBrief({
      persisted,
      sectorState: sector,
      contractBoard: persisted.contractBoard.contracts,
      selectedContractId: persisted.contractBoard.selectedContract.kind === 'SPONSOR'
        ? persisted.contractBoard.selectedContract.contract?.id ?? null
        : null,
      preliminary,
    }),
  };
}

export interface IntegrationValidationIssue {
  domain: string;
  severity: 'warn' | 'error';
  message: string;
}

export function validateAllIntegrationSystems(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
  opts?: { careerBalanceHistory?: CareerBalanceHistory | null },
): IntegrationValidationIssue[] {
  const issues: IntegrationValidationIssue[] = [];
  const push = (domain: string, severity: 'warn' | 'error', message: string) => {
    issues.push({ domain, severity, message });
  };

  validateWorldState(persisted, sectors).forEach((issue) => {
    push('world', issue.severity, issue.message);
  });

  validateActiveOperations(persisted, sectors).forEach((issue) => {
    push('operation', issue.severity, issue.message);
  });

  const selectedContract = buildSelectedSectorContractContext(persisted, sectors);
  if (selectedContract) {
    validateContractBoard(
      persisted.contractBoard.contracts,
      selectedContract.ctx,
      selectedContract.sector.id,
    ).forEach((issue) => {
      push('contract', issue.severity, issue.message);
    });

    if (selectedContract.brief) {
      validateRunWorldBrief(selectedContract.brief)
        .filter((issue) => issue.level === 'error')
        .forEach((issue) => {
          push('runWorldBrief', 'error', `[${issue.code}] ${issue.message}`);
        });
    }
  }

  validateResourceRegistry().forEach((issue) => {
    push('resource', issue.severity, issue.message);
  });

  validateAllAnchorPools().forEach((issue) => {
    push('anchor', issue.level === 'error' ? 'error' : 'warn', `[${issue.code}] ${issue.message}`);
  });

  validateContractTemplates().forEach((issue) => {
    push('contract', issue.severity, issue.message);
  });

  validateRunItemAcceptance().filter((r) => r.severity === 'error').forEach((result) => {
    push('runItem', 'error', result.message);
  });

  validateWeaponRegistry().forEach((issue) => {
    push('weapon', issue.severity, issue.message);
  });

  validateBalance({
    careerBalanceHistory: opts?.careerBalanceHistory,
    runSims: true,
  }).forEach((issue) => {
    if (issue.severity === 'info') return;
    push(`balance:${issue.domain}`, issue.severity, `[${issue.code}] ${issue.message}`);
  });

  return issues;
}

export function formatFullIntegrationValidationReport(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
  opts?: { careerBalanceHistory?: CareerBalanceHistory | null },
): string {
  const integrationIssues = validateAllIntegrationSystems(persisted, sectors, opts);
  const integrationLines = integrationIssues.map(
    (i) => `[${i.severity.toUpperCase()}] ${i.domain}: ${i.message}`,
  );

  const selectedContract = buildSelectedSectorContractContext(persisted, sectors);

  const sections = [
    formatWorldStateValidationReport(
      validateWorldState(persisted, sectors),
    ),
    formatOperationValidationReport(
      validateActiveOperations(persisted, sectors),
    ),
    formatAnchorValidationReport(validateAllAnchorPools()),
    selectedContract
      ? formatContractProceduralValidationReport(
        validateContractBoard(
          persisted.contractBoard.contracts,
          selectedContract.ctx,
          selectedContract.sector.id,
        ),
      )
      : 'CONTRACT PROCEDURAL VALIDATION — no sector.',
    formatContractValidationReport(validateContractTemplates()),
    formatEchoValidationReport(),
    formatPostRunRoutingDebugValidation(),
    auditReportPostRunCargoRouting(),
    formatKeepsakeDebugValidation(),
    formatRunItemDebugValidation(),
    formatRunItemAcceptanceReport(validateRunItemAcceptance()),
    formatWeaponValidationReport(validateWeaponRegistry()),
    formatBalanceValidationReport({
      careerBalanceHistory: opts?.careerBalanceHistory,
      runSims: true,
    }),
    selectedContract?.brief
      ? formatRunWorldBriefValidationReport(validateRunWorldBrief(selectedContract.brief))
      : 'RUN WORLD BRIEF VALIDATION — no sector brief.',
    '',
    'INTEGRATION CROSS-CHECK',
    integrationLines.length > 0 ? integrationLines.join('\n') : 'No cross-check issues.',
    '',
    formatContentMatrixReport(sectors, persisted),
  ];

  return sections.join('\n\n');
}

export function verifyRunIntegrationEngine(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): void {
  const errors = validateAllIntegrationSystems(persisted, sectors)
    .filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `verifyRunIntegrationEngine: ${errors.map((e) => `${e.domain}: ${e.message}`).join('; ')}`,
    );
  }
}

export function logRunIntegrationValidationWarnings(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const issues = validateAllIntegrationSystems(persisted, sectors);
  issues.forEach((issue) => {
    const prefix = issue.severity === 'error' ? '[INTEGRATION ERROR]' : '[INTEGRATION WARN]';
    console.warn(`${prefix} ${issue.domain}: ${issue.message}`);
  });
}
