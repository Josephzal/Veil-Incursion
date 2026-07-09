import type { KeepsakeHook, KeepsakeId } from '../types/expeditionKeepsake';
import {
  ALL_KEEPSAKE_IDS,
  EXPEDITION_KEEPSAKE_REGISTRY,
  SUPPORTED_KEEPSAKE_HOOKS,
} from './expeditionKeepsakeRegistry';

export interface KeepsakeValidationIssue {
  severity: 'error' | 'warn';
  keepsakeId?: KeepsakeId;
  message: string;
}

export function validateExpeditionKeepsakeRegistry(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];

  if (ALL_KEEPSAKE_IDS.length !== 20) {
    issues.push({
      severity: 'error',
      message: `Expected 20 keepsakes, found ${ALL_KEEPSAKE_IDS.length}.`,
    });
  }

  ALL_KEEPSAKE_IDS.forEach((id) => {
    const def = EXPEDITION_KEEPSAKE_REGISTRY[id];
    if (!def) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing registry entry.' });
      return;
    }
    if (def.id !== id) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Registry key/id mismatch.' });
    }
    if (!def.effectSummary?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing effect summary.' });
    }
    if (!def.tags.length) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing tags.' });
    }
    if (!def.triggerMessage?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing trigger message.' });
    }
    if (!def.primaryTriggerKey?.trim()) {
      issues.push({ severity: 'error', keepsakeId: id, message: 'Missing primary trigger key.' });
    }
    if (def.primaryRuntimeGuard !== 'none' && !def.primaryTriggerKey) {
      issues.push({
        severity: 'error',
        keepsakeId: id,
        message: 'Once-per-run/depth keepsake missing runtime guard key.',
      });
    }
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
        message: 'Keepsake missing onDebriefBuild hook for summary parity.',
      });
    }
  });

  return issues;
}

export function validateEquippedKeepsake(
  equippedKeepsakeId: KeepsakeId | null | undefined,
  unlockedKeepsakeIds: readonly KeepsakeId[],
): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  if (!equippedKeepsakeId) return issues;
  if (!EXPEDITION_KEEPSAKE_REGISTRY[equippedKeepsakeId]) {
    issues.push({
      severity: 'error',
      keepsakeId: equippedKeepsakeId,
      message: 'Equipped keepsake missing from registry.',
    });
  }
  if (!unlockedKeepsakeIds.includes(equippedKeepsakeId)) {
    issues.push({
      severity: 'error',
      keepsakeId: equippedKeepsakeId,
      message: 'Equipped keepsake is not unlocked.',
    });
  }
  return issues;
}

export function validateExpeditionKeepsakePipeline(
  equippedKeepsakeId?: KeepsakeId | null,
  unlockedKeepsakeIds?: readonly KeepsakeId[],
): KeepsakeValidationIssue[] {
  return [
    ...validateExpeditionKeepsakeRegistry(),
    ...validateEquippedKeepsake(
      equippedKeepsakeId ?? null,
      unlockedKeepsakeIds ?? ALL_KEEPSAKE_IDS,
    ),
  ];
}

export function formatKeepsakeValidationReport(issues: KeepsakeValidationIssue[]): string {
  if (issues.length === 0) return 'KEEPSAKE VALIDATION — OK (0 issues).';
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warns = issues.filter((issue) => issue.severity === 'warn');
  const lines = [
    'KEEPSAKE VALIDATION',
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
