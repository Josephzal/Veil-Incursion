/**
 * Expedition relic (trinket) soft caps — actual effects stay in keepsake engines/registry.
 * Caps exist so Phase D validation can warn when bonuses erase extraction risk.
 */

/** Max Black Market Mark style discount (percent). */
export const TRINKET_BALANCE_MAX_MARKET_DISCOUNT_PCT = 25;

/** Max cargo / unstable penalty reduction from Cargo Seal style relics (percent). */
export const TRINKET_BALANCE_MAX_CARGO_PENALTY_REDUCTION_PCT = 40;

/** Max Operation progress bonus from Anchor Charm style relics (percent of base). */
export const TRINKET_BALANCE_MAX_OPERATION_PROGRESS_BONUS_PCT = 50;

/** Max Contract Seal reputation bonus (absolute rep points per event). */
export const TRINKET_BALANCE_MAX_CONTRACT_REP_BONUS = 2;

/** Field Rations / heal-style relic soft max heal percent of max HP. */
export const TRINKET_BALANCE_MAX_HEAL_PCT_OF_MAX_HP = 25;

export const TRINKET_BALANCE_INTENT = {
  triggerAtLeastSometimes: true,
  noneShouldBeMandatory: true,
  noBypassExtractionRisk: true,
  noCompleteOpsInOneOrdinaryRun: true,
} as const;

export function formatTrinketBalanceConfigSummary(): string {
  return [
    'TRINKET / RELIC BALANCE CONFIG',
    `  market discount cap: ${TRINKET_BALANCE_MAX_MARKET_DISCOUNT_PCT}%`,
    `  cargo penalty reduction cap: ${TRINKET_BALANCE_MAX_CARGO_PENALTY_REDUCTION_PCT}%`,
    `  op progress bonus cap: ${TRINKET_BALANCE_MAX_OPERATION_PROGRESS_BONUS_PCT}%`,
    `  contract rep bonus cap: +${TRINKET_BALANCE_MAX_CONTRACT_REP_BONUS}`,
    `  heal soft cap: ${TRINKET_BALANCE_MAX_HEAL_PCT_OF_MAX_HP}% max HP`,
    '  effect numbers: expeditionKeepsake* engines (do not duplicate here)',
  ].join('\n');
}
