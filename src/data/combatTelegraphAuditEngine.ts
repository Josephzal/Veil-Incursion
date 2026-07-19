/**
 * Combat Telegraph Language — verify / acceptance for Phase 1–2 + polish.
 */

import { ENEMY_INTENT_CATALOG, getIntentType } from './enemyIntentCatalog';
import type { EnemyIntentType } from '../types/enemyIntentMeta';
import {
  DEFENSE_TELEGRAPH_PROFILES,
  formatKineticArmorChipDescription,
  formatOccultWardChipDescription,
  resolveArenaDefenseState,
} from './combatArenaDefenseTelegraphEngine';
import {
  resolveArenaIntentGlyph,
  type ArenaIntentGlyphKind,
} from './combatArenaTelegraphEngine';
import type { EnemyIntent } from '../types/run';

export interface CombatTelegraphVerifyIssue {
  severity: 'error' | 'warn';
  area: string;
  message: string;
}

const INTENT_TYPE_TO_KIND: Record<EnemyIntentType, ArenaIntentGlyphKind> = {
  BASIC_ATTACK: 'ATTACK',
  HEAVY_ATTACK: 'HEAVY',
  CONSUME: 'HEAVY',
  LOCK_ON: 'LOCK_ON',
  MARK: 'LOCK_ON',
  CHANNEL: 'CHANNEL',
  RITUAL: 'CHANNEL',
  GUARD: 'GUARD',
  BUFF: 'SUPPORT',
  SUPPORT_LINK: 'SUPPORT',
  DEBUFF: 'DEBUFF',
  SUMMON: 'SUMMON',
  DETONATE: 'DETONATE',
  REPOSITION: 'REPOSITION',
  CARGO_THREAT: 'CARGO',
};

/** Catalog intents must resolve to a stable arena glyph family. */
export function validateCombatTelegraphLanguage(): CombatTelegraphVerifyIssue[] {
  const issues: CombatTelegraphVerifyIssue[] = [];

  for (const intent of Object.keys(ENEMY_INTENT_CATALOG) as EnemyIntent[]) {
    const type = getIntentType(intent);
    const glyph = resolveArenaIntentGlyph({ intent, turnsRemaining: 0 });
    const expected = INTENT_TYPE_TO_KIND[type];
    if (glyph.kind !== expected) {
      issues.push({
        severity: 'error',
        area: 'INTENT_GLYPH',
        message: `${intent} (${type}) → glyph ${glyph.kind}, expected ${expected}`,
      });
    }
    if (!glyph.symbol || glyph.symbol.length > 2) {
      issues.push({
        severity: 'warn',
        area: 'INTENT_GLYPH',
        message: `${intent}: symbol "${glyph.symbol}" should stay 1–2 ASCII chars for terminal clarity`,
      });
    }
    if (glyph.label.length < 2 || glyph.label.length > 4) {
      issues.push({
        severity: 'warn',
        area: 'INTENT_GLYPH',
        message: `${intent}: label "${glyph.label}" should be 2–4 chars`,
      });
    }
  }

  const jam = resolveArenaIntentGlyph({ intent: 'STRIKE', jammed: true });
  if (jam.kind !== 'JAMMED' || jam.label !== 'JAM') {
    issues.push({
      severity: 'error',
      area: 'SENSORY_JAM',
      message: 'Jammed readout must resolve to JAMMED / JAM',
    });
  }

  const charge = resolveArenaIntentGlyph({ intent: 'CHARGE', turnsRemaining: 2 });
  if (charge.countdownLabel !== 'CH-2') {
    issues.push({
      severity: 'error',
      area: 'COUNTDOWN',
      message: `CHARGE telegraph should show CH-2, got "${charge.countdownLabel}"`,
    });
  }

  const lock = resolveArenaIntentGlyph({ intent: 'TARGET_LOCK', turnsRemaining: 1 });
  if (lock.countdownLabel !== 'T-1') {
    issues.push({
      severity: 'error',
      area: 'COUNTDOWN',
      message: `LOCK_ON should show T-1, got "${lock.countdownLabel}"`,
    });
  }

  const ka = DEFENSE_TELEGRAPH_PROFILES.KINETIC_ARMOR;
  const ow = DEFENSE_TELEGRAPH_PROFILES.OCCULT_WARD;
  if (ka.silhouette === ow.silhouette || ka.pipStyle === ow.pipStyle) {
    issues.push({
      severity: 'error',
      area: 'DEFENSE_SHAPE',
      message: 'KA and OW must use opposite silhouette + pip styles',
    });
  }
  if (ka.colors.primary === ow.colors.primary) {
    issues.push({
      severity: 'error',
      area: 'DEFENSE_COLOR',
      message: 'KA and OW primary colors must differ',
    });
  }

  const empty = resolveArenaDefenseState({});
  if (empty.armorProfile || empty.wardProfile || empty.fracturedProfile) {
    issues.push({
      severity: 'error',
      area: 'DEFENSE_STATE',
      message: 'Empty stacks must not emit defense profiles',
    });
  }
  const armed = resolveArenaDefenseState({ kineticArmor: 2, occultWards: 1, isFractured: true });
  if (!armed.armorProfile || !armed.wardProfile || !armed.fracturedProfile) {
    issues.push({
      severity: 'error',
      area: 'DEFENSE_STATE',
      message: 'KA+OW+Fractured must emit all three profiles',
    });
  }

  const kaCopy = formatKineticArmorChipDescription(2);
  const owCopy = formatOccultWardChipDescription(1);
  if (/absorb/i.test(kaCopy) || /absorb/i.test(owCopy)) {
    issues.push({
      severity: 'error',
      area: 'CHIP_COPY',
      message: 'KA/OW intel chips must not teach flat absorb',
    });
  }
  if (!/%/.test(kaCopy) || !/%/.test(owCopy)) {
    issues.push({
      severity: 'error',
      area: 'CHIP_COPY',
      message: 'KA/OW intel chips must mention % mitigation',
    });
  }

  return issues;
}

export function formatCombatTelegraphAuditReport(): string {
  const issues = validateCombatTelegraphLanguage();
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');
  const lines = [
    '=== COMBAT TELEGRAPH LANGUAGE // AUDIT ===',
    `Intent catalog entries: ${Object.keys(ENEMY_INTENT_CATALOG).length}`,
    `Defense profiles: ${Object.keys(DEFENSE_TELEGRAPH_PROFILES).join(', ')}`,
    `Issues: ${errors.length} FAIL / ${warns.length} WARN`,
    '',
  ];
  if (issues.length === 0) {
    lines.push('PASS — arena intent glyphs + defense silhouettes consistent.');
  } else {
    for (const issue of issues) {
      lines.push(`[${issue.severity.toUpperCase()}] ${issue.area}: ${issue.message}`);
    }
  }
  lines.push('');
  lines.push('=== ACCEPTANCE ===');
  lines.push(errors.length === 0
    ? 'ACCEPT — Phase 1–2 telegraph language closed for polish.'
    : 'REJECT — fix FAIL items before closing polish.');
  return lines.join('\n');
}
