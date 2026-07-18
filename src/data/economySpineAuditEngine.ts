import { validateResourceRegistry } from './resourceValidation';
import { formatEconomyRosterV1FreezeReport } from './economyRosterDebugEngine';
import { formatSectorResourceTablesReport } from './sectorResourceTableDebugEngine';
import { formatDepthResourceRulesReport } from './depthResourceRulesDebugEngine';
import { formatRewardPacketsReport } from './resourceRewardPacketDebugEngine';
import { formatResourceSourceHintsReport } from './resourceSourceHintDebugEngine';
import { buildEconomyIntegrationIssues } from './economyIntegrationEngine';
import { formatEconomySaveMigrationFixtureReport } from './economySaveMigrationEngine';
import { buildEconomyTuningReport } from './economyTuningEngine';
import { formatCargoStackMergeSmokeTest } from './cargoStackDebugEngine';
import { formatCargoOwnershipRulesReport } from './cargoOwnershipDebugEngine';
import { formatResourceDiscoveryReport } from './resourceDiscoveryDebugEngine';

/**
 * Economy Spine polish — central verify + acceptance aggregator (2A–2M).
 */

export interface EconomySpineVerifyIssue {
  severity: 'error' | 'warn';
  area: string;
  message: string;
}

function reportFailed(report: string): boolean {
  if (/zero FAIL|0 FAIL|no FAIL/i.test(report)) return false;
  return /\bFAIL\b/.test(report);
}

function firstFailLine(report: string): string {
  const line = report.split('\n').find((l) => /\bFAIL\b/.test(l));
  return line?.trim() ?? 'Report failed.';
}

function checkReport(area: string, report: string): EconomySpineVerifyIssue[] {
  if (!reportFailed(report)) return [];
  return [{ severity: 'error', area, message: firstFailLine(report) }];
}

export function validateEconomySpine(): EconomySpineVerifyIssue[] {
  const issues: EconomySpineVerifyIssue[] = [];

  validateResourceRegistry().forEach((issue) => {
    issues.push({
      severity: issue.severity === 'error' ? 'error' : 'warn',
      area: 'REGISTRY',
      message: `${issue.resourceId ?? '?'}: ${issue.message}`,
    });
  });

  buildEconomyIntegrationIssues().forEach((issue) => {
    issues.push({
      severity: issue.severity,
      area: `INTEGRATION/${issue.area}`,
      message: issue.message,
    });
  });

  issues.push(...checkReport('2A_STACKS', formatCargoStackMergeSmokeTest('ley-slag')));
  issues.push(...checkReport('2B_OWNERSHIP', formatCargoOwnershipRulesReport()));
  issues.push(...checkReport('2C_ROSTER', formatEconomyRosterV1FreezeReport()));
  issues.push(...checkReport('2D_SECTORS', formatSectorResourceTablesReport()));
  issues.push(...checkReport('2E_DEPTH', formatDepthResourceRulesReport()));
  issues.push(...checkReport('2F_PACKETS', formatRewardPacketsReport()));
  issues.push(...checkReport('2G_HINTS', formatResourceSourceHintsReport()));
  issues.push(...checkReport('2I_DISCOVERY', formatResourceDiscoveryReport()));
  issues.push(...checkReport('2L_MIGRATION', formatEconomySaveMigrationFixtureReport()));

  const tuning = buildEconomyTuningReport();
  if (tuning.failCount > 0) {
    tuning.checks.filter((c) => c.verdict === 'FAIL').forEach((c) => {
      issues.push({
        severity: 'error',
        area: '2M_TUNING',
        message: `${c.id}: ${c.detail}`,
      });
    });
  }

  return issues;
}

export function formatEconomySpineVerifyReport(): string {
  const issues = validateEconomySpine();
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');
  const lines = [
    '=== ECONOMY SPINE // VERIFY ALL (2A–2M) ===',
    '',
    `Issues: ${issues.length} (${errors.length} errors / ${warns.length} warns)`,
    ...errors.slice(0, 24).map((i) => `  [error/${i.area}] ${i.message}`),
    ...warns.slice(0, 16).map((i) => `  [warn/${i.area}] ${i.message}`),
    '',
    errors.length === 0
      ? 'PASS — Economy Spine verify clear (soft warns allowed).'
      : 'FAIL — fix Economy Spine verify errors.',
  ];
  return lines.join('\n');
}

/** Ship-facing acceptance snapshot for DevTest / docs. */
export function formatEconomySpineAcceptanceReport(): string {
  const tuning = buildEconomyTuningReport();
  const migration = formatEconomySaveMigrationFixtureReport();
  const lines = [
    '=== ECONOMY SPINE // ACCEPTANCE (POLISH) ===',
    '',
    formatEconomySpineVerifyReport(),
    '',
    '--- TUNING ---',
    `${tuning.passCount} PASS / ${tuning.warnCount} WARN / ${tuning.failCount} FAIL`,
    '',
    '--- MIGRATION FIXTURE ---',
    migration.includes('PASS — ley_slag remapped') || migration.includes('PASS — saves migrate')
      ? 'PASS — save migration fixture.'
      : 'FAIL — save migration fixture.',
    '',
    'Player surfaces (polish): fence lane labels · discovery fog on forge costs · debrief first-find DISCOVERED · REPLACE stack qty',
    '',
    tuning.failCount === 0
      ? 'PASS — Economy Spine Phase 2 closed with polish.'
      : 'FAIL — tuning still has FAIL checks.',
  ];
  return lines.join('\n');
}

export function verifyEconomySpineEngine(): void {
  const errors = validateEconomySpine().filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `verifyEconomySpineEngine: ${errors.map((issue) => `[${issue.area}] ${issue.message}`).join('; ')}`,
    );
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    verifyEconomySpineEngine();
  } catch (error) {
    console.warn(
      error instanceof Error ? error.message : 'verifyEconomySpineEngine failed.',
    );
  }
}
