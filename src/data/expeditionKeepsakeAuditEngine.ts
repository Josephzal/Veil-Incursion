import {
  ALL_KEEPSAKE_IDS,
  EXPEDITION_KEEPSAKE_REGISTRY,
  SUPPORTED_KEEPSAKE_HOOKS,
} from './expeditionKeepsakeRegistry';
import {
  formatKeepsakeAcceptanceReport,
  validateExpeditionKeepsakeAcceptance,
} from './expeditionKeepsakeAcceptanceEngine';
import type { KeepsakeValidationIssue } from './expeditionKeepsakeValidation';
import {
  formatKeepsakeValidationReport,
  validateExpeditionKeepsakePipeline,
  validateExpeditionKeepsakeRegistry,
} from './expeditionKeepsakeValidation';

const FORBIDDEN_COMBAT_STAT_HOOKS: readonly string[] = ['onCombatStart'];
const FORBIDDEN_COMBAT_STAT_TAGS: readonly string[] = ['COMBAT_STAT', 'COMBAT_BOOST'];

/** Registry audit — relics must not attach combat-stat hooks or tags. */
export function validateKeepsakeCombatStatAudit(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];

  ALL_KEEPSAKE_IDS.forEach((keepsakeId) => {
    const def = EXPEDITION_KEEPSAKE_REGISTRY[keepsakeId];
    def.hooks.forEach((hook) => {
      if (FORBIDDEN_COMBAT_STAT_HOOKS.includes(hook)) {
        issues.push({
          severity: 'error',
          keepsakeId,
          message: `Forbidden combat-stat hook '${hook}' assigned to relic.`,
        });
      }
    });
    def.tags.forEach((tag) => {
      if (FORBIDDEN_COMBAT_STAT_TAGS.includes(tag)) {
        issues.push({
          severity: 'error',
          keepsakeId,
          message: `Forbidden combat-stat tag '${tag}' assigned to relic.`,
        });
      }
    });
  });

  const supportedCombatHooks = SUPPORTED_KEEPSAKE_HOOKS.filter((hook) => hook.toLowerCase().includes('combat'));
  if (supportedCombatHooks.length > 0) {
    const assigned = ALL_KEEPSAKE_IDS.filter((keepsakeId) => (
      EXPEDITION_KEEPSAKE_REGISTRY[keepsakeId].hooks.some((hook) => supportedCombatHooks.includes(hook))
    ));
    if (assigned.length > 0) {
      issues.push({
        severity: 'warn',
        message: `Combat-adjacent hooks remain registered on relics: ${assigned.join(', ')}.`,
      });
    }
  }

  return issues;
}

export function validateExpeditionKeepsakeEngine(): KeepsakeValidationIssue[] {
  return [
    ...validateExpeditionKeepsakeRegistry(),
    ...validateKeepsakeCombatStatAudit(),
    ...validateExpeditionKeepsakeAcceptance(),
  ];
}

export function auditReportExpeditionKeepsake(): string {
  const registry = validateExpeditionKeepsakeRegistry();
  const combat = validateKeepsakeCombatStatAudit();
  const acceptance = validateExpeditionKeepsakeAcceptance();
  const errors = [...registry, ...combat, ...acceptance].filter((issue) => issue.severity === 'error').length;
  const warnings = [...registry, ...combat, ...acceptance].filter((issue) => issue.severity === 'warn').length;

  return [
    'EXPEDITION RELIC AUDIT',
    `roster size: ${ALL_KEEPSAKE_IDS.length}`,
    `registry errors: ${registry.filter((issue) => issue.severity === 'error').length}`,
    `combat-stat errors: ${combat.filter((issue) => issue.severity === 'error').length}`,
    `acceptance errors: ${acceptance.filter((issue) => issue.severity === 'error').length}`,
    `total errors: ${errors}`,
    `total warnings: ${warnings}`,
  ].join('\n');
}

export function formatExpeditionKeepsakeEngineReport(
  equippedKeepsakeId?: import('../types/expeditionKeepsake').KeepsakeId | null,
  unlockedKeepsakeIds?: readonly import('../types/expeditionKeepsake').KeepsakeId[],
  deployment?: import('../types/expeditionKeepsake').KeepsakeDeployment | null,
): string {
  const pipeline = validateExpeditionKeepsakePipeline(equippedKeepsakeId, unlockedKeepsakeIds, deployment);
  const acceptance = validateExpeditionKeepsakeAcceptance();
  const combat = validateKeepsakeCombatStatAudit();
  return [
    formatKeepsakeValidationReport(pipeline),
    '',
    formatKeepsakeAcceptanceReport([...combat, ...acceptance]),
  ].join('\n');
}

/** Throw on registry/acceptance/combat-stat errors — boot verify for Trinkets v2. */
export function verifyExpeditionKeepsakeEngine(): void {
  const errors = validateExpeditionKeepsakeEngine().filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `verifyExpeditionKeepsakeEngine: ${errors.map((issue) => issue.message).join('; ')}`,
    );
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    verifyExpeditionKeepsakeEngine();
  } catch (error) {
    console.warn(
      error instanceof Error ? error.message : 'verifyExpeditionKeepsakeEngine failed.',
    );
  }
}
