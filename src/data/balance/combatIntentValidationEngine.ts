/**
 * Combat Refactor Phase 2 — encounter / catalog / class intent validation.
 */

import type { ClassType } from '../../types/game';
import type { EnemyCombatProfile, EnemyIntent } from '../../types/run';
import { ENEMY_INTENT_CATALOG, getIntentCatalogEntry, isHighOrCriticalIntent } from '../enemyIntentCatalog';
import { COMBAT_INTENT_BALANCE } from './combatIntentBalanceConfig';
import { AEGIS_ABILITY_CATALOG } from '../aegisAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from '../hexShotAbilities';
import { ENVOY_ABILITY_CATALOG } from '../envoyAbilities';
import { collectPlayerCounterTags } from '../enemyIntentCounterplayEngine';
import type { IntentCounterTag } from '../../types/enemyIntentMeta';

export interface IntentValidationIssue {
  id: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

function classHasCounter(
  classId: ClassType,
  needed: readonly IntentCounterTag[],
): boolean {
  const catalogs =
    classId === 'AEGIS'
      ? Object.values(AEGIS_ABILITY_CATALOG)
      : classId === 'HEX_SHOT'
        ? Object.values(HEX_SHOT_ABILITY_CATALOG)
        : Object.values(ENVOY_ABILITY_CATALOG);
  for (const ability of catalogs) {
    const tags = collectPlayerCounterTags(ability.tags as readonly string[], {
      classId,
      abilityId: ability.id,
    });
    if (tags.some((t) => needed.includes(t))) return true;
  }
  // Universal kill-source always available via any damage ability.
  if (needed.includes('KILL_SOURCE')) return true;
  return false;
}

export function validateIntentCatalog(): IntentValidationIssue[] {
  const issues: IntentValidationIssue[] = [];
  (Object.keys(ENEMY_INTENT_CATALOG) as EnemyIntent[]).forEach((intent) => {
    const meta = ENEMY_INTENT_CATALOG[intent];
    if (!meta.displayName?.trim()) {
      issues.push({
        id: 'MISSING_DISPLAY_NAME',
        severity: 'ERROR',
        message: `${intent} missing displayName`,
      });
    }
    if (!meta.description?.trim()) {
      issues.push({
        id: 'MISSING_DESCRIPTION',
        severity: 'ERROR',
        message: `${intent} missing description`,
      });
    }
    if (!meta.effectPreview?.summary?.trim()) {
      issues.push({
        id: 'MISSING_EFFECT_PREVIEW',
        severity: 'ERROR',
        message: `${intent} missing effectPreview`,
      });
    }
    if (
      (meta.severity === 'HIGH' || meta.severity === 'CRITICAL')
      && meta.counterTags.length === 0
    ) {
      issues.push({
        id: 'HIGH_NO_COUNTERS',
        severity: 'ERROR',
        message: `${intent} HIGH/CRITICAL without counterTags`,
      });
    }
    if (
      (meta.severity === 'HIGH' || meta.severity === 'CRITICAL')
      && meta.telegraphTurns <= 0
      && !meta.isTelegraph
      && meta.resolvesAt === 'IMMEDIATE'
      && meta.type !== 'HEAVY_ATTACK'
      && meta.type !== 'BASIC_ATTACK'
    ) {
      issues.push({
        id: 'HIGH_IMMEDIATE',
        severity: 'WARNING',
        message: `${intent} HIGH/CRITICAL resolves immediately without telegraph flag`,
      });
    }
  });
  return issues;
}

export function validateEncounterIntents(
  enemies: readonly EnemyCombatProfile[],
  opts: { depth: 1 | 2 | 3; nodeIndex?: number; playerMaxHp?: number },
): IntentValidationIssue[] {
  const issues: IntentValidationIssue[] = [];
  const early = opts.depth === 1
    && (opts.nodeIndex == null || opts.nodeIndex <= COMBAT_INTENT_BALANCE.depth1EarlyNodeIndexCap);

  const highTelegraphs = enemies.filter((e) => {
    const meta = getIntentCatalogEntry(e.intent);
    return meta.isTelegraph && isHighOrCriticalIntent(e.intent);
  });
  const criticals = enemies.filter((e) => getIntentCatalogEntry(e.intent).severity === 'CRITICAL');

  const maxHigh = early
    ? COMBAT_INTENT_BALANCE.depth1EarlyMaxHighTelegraphs
    : opts.depth === 1
      ? COMBAT_INTENT_BALANCE.depth1LateMaxHighTelegraphs
      : COMBAT_INTENT_BALANCE.depth2MaxHighTelegraphs;

  if (highTelegraphs.length > maxHigh) {
    issues.push({
      id: 'TOO_MANY_HIGH_TELEGRAPHS',
      severity: early ? 'ERROR' : 'WARNING',
      message: `Encounter has ${highTelegraphs.length} HIGH telegraphs (max ${maxHigh} at this depth)`,
    });
  }

  const allowCritical = early
    ? COMBAT_INTENT_BALANCE.depth1EarlyAllowCritical
    : opts.depth === 1
      ? COMBAT_INTENT_BALANCE.depth1LateAllowCritical
      : opts.depth === 2
        ? COMBAT_INTENT_BALANCE.depth2AllowCritical
        : COMBAT_INTENT_BALANCE.depth3AllowCritical;

  if (!allowCritical && criticals.length > 0) {
    issues.push({
      id: 'CRITICAL_TOO_EARLY',
      severity: 'ERROR',
      message: `CRITICAL intent present at depth ${opts.depth}${early ? ' early' : ''}: ${criticals.map((e) => e.intent).join(', ')}`,
    });
  }

  // Detect Lock-On + Channel + Guard stack early
  if (early) {
    const types = new Set(enemies.map((e) => getIntentCatalogEntry(e.intent).type));
    const stack = (types.has('LOCK_ON') ? 1 : 0)
      + (types.has('CHANNEL') ? 1 : 0)
      + (types.has('GUARD') ? 1 : 0);
    if (stack >= 3) {
      issues.push({
        id: 'EARLY_INTENT_STACK',
        severity: 'ERROR',
        message: 'Early Depth 1 stacks Lock-On + Channel + Guard',
      });
    }
  }

  if (opts.playerMaxHp != null && early) {
    const cap = COMBAT_INTENT_BALANCE.depth1EarlyHighDamageCapPercent * opts.playerMaxHp;
    enemies.forEach((e) => {
      if (!isHighOrCriticalIntent(e.intent)) return;
      if (e.baseDamage > cap) {
        issues.push({
          id: 'HIGH_DMG_OVER_CAP',
          severity: 'WARNING',
          message: `${e.designation} baseDamage ${e.baseDamage} exceeds early HIGH cap ~${Math.round(cap)}`,
        });
      }
    });
  }

  return issues;
}

export function validateClassIntentCounters(): IntentValidationIssue[] {
  const issues: IntentValidationIssue[] = [];
  const checks: { classId: ClassType; needed: IntentCounterTag[]; label: string }[] = [
    { classId: 'AEGIS', needed: ['PARRY', 'ARMOR_BREAK', 'FRACTURE'], label: 'Heavy Attack / Lock-On' },
    { classId: 'HEX_SHOT', needed: ['INTERRUPT', 'ARMOR_BREAK', 'WARD_BREAK'], label: 'Lock-On / Channel' },
    { classId: 'ENVOY', needed: ['WARD_BREAK', 'INTERRUPT', 'BLOCK'], label: 'Channel / Ritual / defense' },
  ];
  for (const check of checks) {
    if (!classHasCounter(check.classId, check.needed)) {
      issues.push({
        id: 'CLASS_MISSING_COUNTER',
        severity: 'ERROR',
        message: `${check.classId} lacks answer tags for ${check.label}`,
      });
    }
  }
  return issues;
}

export function formatIntentValidationReport(
  issues: IntentValidationIssue[],
): string {
  if (!issues.length) return 'INTENT VALIDATION: OK';
  return [
    'INTENT VALIDATION',
    ...issues.map((i) => `  [${i.severity}] ${i.id}: ${i.message}`),
  ].join('\n');
}

export function formatFullIntentValidationReport(): string {
  const catalog = validateIntentCatalog();
  const classes = validateClassIntentCounters();
  return [
    'ENEMY INTENT VALIDATION REPORT (Phase 2)',
    '',
    formatIntentValidationReport(catalog),
    '',
    'CLASS COUNTER VALIDATION',
    formatIntentValidationReport(classes),
  ].join('\n');
}
