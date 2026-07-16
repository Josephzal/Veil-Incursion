/**
 * Combat Refactor Phase 2 — intent telegraph depth gates & damage caps.
 */

export const COMBAT_INTENT_BALANCE = {
  depth1EarlyNodeIndexCap: 3,
  /** Max simultaneous HIGH+ telegraphs in early Depth 1. */
  depth1EarlyMaxHighTelegraphs: 1,
  /** CRITICAL intents forbidden in early Depth 1. */
  depth1EarlyAllowCritical: false,
  /** Late Depth 1: up to two HIGH telegraphs. */
  depth1LateMaxHighTelegraphs: 2,
  depth1LateAllowCritical: false,
  depth2MaxHighTelegraphs: 4,
  depth2AllowCritical: true,
  depth3AllowCritical: true,
  /** Unresolved HIGH intent damage vs player max HP (early D1). */
  depth1EarlyHighDamageCapPercent: 0.30,
  depth1LateHighDamageCapPercent: 0.40,
  depth2HighDamageCapPercent: 0.55,
  depth3CriticalDamageCapPercent: 0.70,
} as const;

export function formatCombatIntentBalanceSummary(): string {
  const c = COMBAT_INTENT_BALANCE;
  return [
    'COMBAT INTENT BALANCE (Phase 2)',
    `  D1 early (≤node ${c.depth1EarlyNodeIndexCap}): max ${c.depth1EarlyMaxHighTelegraphs} HIGH telegraph, CRITICAL=${c.depth1EarlyAllowCritical}`,
    `  D1 late: max ${c.depth1LateMaxHighTelegraphs} HIGH, CRITICAL=${c.depth1LateAllowCritical}`,
    `  D1 early HIGH dmg cap: ${Math.round(c.depth1EarlyHighDamageCapPercent * 100)}% max HP`,
    `  Telegraphs replace immediate punishment — do not stack extra damage on wind-up.`,
  ].join('\n');
}
