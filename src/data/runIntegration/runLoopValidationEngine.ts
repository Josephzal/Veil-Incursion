import { validateWorldState, formatWorldStateValidationReport } from '../worldStateValidation';
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
import type { SectorState, WorldStatePersistedState } from '../../types/worldState';

export interface IntegrationValidationIssue {
  domain: string;
  severity: 'warn' | 'error';
  message: string;
}

export function validateAllIntegrationSystems(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): IntegrationValidationIssue[] {
  const issues: IntegrationValidationIssue[] = [];
  const push = (domain: string, severity: 'warn' | 'error', message: string) => {
    issues.push({ domain, severity, message });
  };

  validateWorldState(persisted, sectors).forEach((issue) => {
    push('world', issue.severity, issue.message);
  });

  validateResourceRegistry().forEach((issue) => {
    push('resource', issue.severity, issue.message);
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

  return issues;
}

export function formatFullIntegrationValidationReport(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): string {
  const integrationIssues = validateAllIntegrationSystems(persisted, sectors);
  const integrationLines = integrationIssues.map(
    (i) => `[${i.severity.toUpperCase()}] ${i.domain}: ${i.message}`,
  );

  const sections = [
    formatWorldStateValidationReport(
      validateWorldState(persisted, sectors),
    ),
    formatContractValidationReport(validateContractTemplates()),
    formatEchoValidationReport(),
    formatPostRunRoutingDebugValidation(),
    auditReportPostRunCargoRouting(),
    formatKeepsakeDebugValidation(),
    formatRunItemDebugValidation(),
    formatRunItemAcceptanceReport(validateRunItemAcceptance()),
    formatWeaponValidationReport(validateWeaponRegistry()),
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
