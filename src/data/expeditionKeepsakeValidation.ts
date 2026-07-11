import type { KeepsakeHook, KeepsakeId } from '../types/expeditionKeepsake';
import type { KeepsakeDeployment } from '../types/expeditionKeepsake';
import {
  ALL_KEEPSAKE_IDS,
  EXPEDITION_KEEPSAKE_REGISTRY,
  SUPPORTED_KEEPSAKE_HOOKS,
} from './expeditionKeepsakeRegistry';
import { isKeepsakeDeploymentConfigured } from './expeditionKeepsakeDeploymentEngine';

export interface KeepsakeValidationIssue {
  severity: 'error' | 'warn';
  keepsakeId?: KeepsakeId;
  message: string;
}

const DEPLOYMENT_CHOICE_KIND_OPTION_COUNT: Record<string, number> = {
  attunement: 5,
  route_doctrine: 3,
  mirror_category: 4,
};

export function validateExpeditionKeepsakeRegistry(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];

  if (ALL_KEEPSAKE_IDS.length !== 20) {
    issues.push({
      severity: 'error',
      message: `Expected 20 Expedition Relics, found ${ALL_KEEPSAKE_IDS.length}.`,
    });
  }

  const seenIds = new Set<string>();
  const seenTriggerKeys = new Map<string, KeepsakeId>();
  const seenDisplayPriority = new Map<number, KeepsakeId>();

  ALL_KEEPSAKE_IDS.forEach((id) => {
    const def = EXPEDITION_KEEPSAKE_REGISTRY[id];
    if (!def) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing registry entry.' });
      return;
    }
    if (def.id !== id) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Registry key/id mismatch.' });
    }
    if (seenIds.has(id)) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Duplicate relic id in roster.' });
    }
    seenIds.add(id);
    if (!def.name?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing name.' });
    }
    if (!def.effectSummary?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing effect summary.' });
    }
    if (!def.runStyle?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing run-style description.' });
    }
    if (!def.riskSummary?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing risk summary.' });
    }
    if (!def.tags.length) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing tags.' });
    }
    if (!def.triggerMessage?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing trigger message.' });
    }
    if (!def.primaryTriggerKey?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing primary trigger key.' });
    } else {
      const existing = seenTriggerKeys.get(def.primaryTriggerKey);
      if (existing) {
        issues.push({
          severity: 'error',
          keepsakeId: id,
          message: `Duplicate primary trigger key '${def.primaryTriggerKey}' (shared with ${existing}).`,
        });
      }
      seenTriggerKeys.set(def.primaryTriggerKey, id);
    }
    if (def.primaryRuntimeGuard !== 'none' && !def.primaryTriggerKey) {
      issues.push({
        severity: 'error',
        keepsakeId: id,
        message: 'Once-per-run/depth relic missing runtime guard key.',
      });
    }
    const priorityOwner = seenDisplayPriority.get(def.displayPriority);
    if (priorityOwner) {
      issues.push({
        severity: 'warn',
        keepsakeId: id,
        message: `Duplicate displayPriority ${def.displayPriority} (shared with ${priorityOwner}).`,
      });
    }
    seenDisplayPriority.set(def.displayPriority, id);
    def.hooks.forEach((hook) => {
      if (!SUPPORTED_KEEPSAKE_HOOKS.includes(hook)) {
        issues.push({
          severity: 'error',
          keepsakeId: id,
          message: `Unsupported hook: ${hook}.`,
        });
      }
    });
    if (!def.hooks.includes('onDebriefBuild')) {
      issues.push({
        severity: 'warn',
        keepsakeId: id,
        message: 'Relic missing onDebriefBuild hook for summary parity.',
      });
    }
    if (def.deploymentChoice) {
      const expected = DEPLOYMENT_CHOICE_KIND_OPTION_COUNT[def.deploymentChoice.kind];
      if (!def.deploymentChoice.options.length) {
        issues.push({
          severity: 'error',
          keepsakeId: id,
          message: 'Deployment choice has no options.',
        });
      } else if (expected != null && def.deploymentChoice.options.length !== expected) {
        issues.push({
          severity: 'warn',
          keepsakeId: id,
          message: `Deployment choice '${def.deploymentChoice.kind}' expected ${expected} options, found ${def.deploymentChoice.options.length}.`,
        });
      }
      if (!def.deploymentChoice.prompt?.trim()) {
        issues.push({
          severity: 'error',
          keepsakeId: id,
          message: 'Deployment choice missing prompt.',
        });
      }
    }
  });

  return issues;
}

export function validateEquippedKeepsake(
  equippedKeepsakeId: KeepsakeId | null | undefined,
  unlockedKeepsakeIds: readonly KeepsakeId[],
  deployment?: KeepsakeDeployment | null,
): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  if (!equippedKeepsakeId) return issues;
  if (!EXPEDITION_KEEPSAKE_REGISTRY[equippedKeepsakeId]) {
    issues.push({
      severity: 'error',
      keepsakeId: equippedKeepsakeId,
      message: 'Equipped relic missing from registry.',
    });
  }
  if (!unlockedKeepsakeIds.includes(equippedKeepsakeId)) {
    issues.push({
      severity: 'error',
      keepsakeId: equippedKeepsakeId,
      message: 'Equipped relic is not unlocked.',
    });
  }
  if (deployment && !isKeepsakeDeploymentConfigured(equippedKeepsakeId, deployment)) {
    issues.push({
      severity: 'warn',
      keepsakeId: equippedKeepsakeId,
      message: 'Equipped relic requires pre-run deployment configuration.',
    });
  }
  return issues;
}

export function validateExpeditionKeepsakePipeline(
  equippedKeepsakeId?: KeepsakeId | null,
  unlockedKeepsakeIds?: readonly KeepsakeId[],
  deployment?: KeepsakeDeployment | null,
): KeepsakeValidationIssue[] {
  return [
    ...validateExpeditionKeepsakeRegistry(),
    ...validateEquippedKeepsake(
      equippedKeepsakeId ?? null,
      unlockedKeepsakeIds ?? ALL_KEEPSAKE_IDS,
      deployment ?? null,
    ),
  ];
}

export function formatKeepsakeValidationReport(issues: KeepsakeValidationIssue[]): string {
  if (issues.length === 0) return 'EXPEDITION RELIC VALIDATION — OK (0 issues).';
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warns = issues.filter((issue) => issue.severity === 'warn');
  const lines = [
    'EXPEDITION RELIC VALIDATION',
    `errors: ${errors.length}`,
    `warnings: ${warns.length}`,
    ...issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.keepsakeId ?? 'global'} — ${issue.message}`),
  ];
  return lines.join('\n');
}

/** Throw on registry errors — mirrors cargo routing audit boot verify. */
export function verifyExpeditionKeepsakeRegistry(): void {
  const errors = validateExpeditionKeepsakeRegistry().filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `verifyExpeditionKeepsakeRegistry: ${errors.map((issue) => issue.message).join('; ')}`,
    );
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    verifyExpeditionKeepsakeRegistry();
  } catch (error) {
    console.warn(
      error instanceof Error ? error.message : 'verifyExpeditionKeepsakeRegistry failed.',
    );
  }
}
