/**
 * Operation progress contribution values + caps.
 * Target: ordinary operations complete in ~3–6 focused runs (see OPERATION_COMPLETION_RUN_TARGET).
 */

export const OPERATION_BALANCE_PROGRESS_REQUIRED = 100;

export const OPERATION_BALANCE_CONTRIBUTION = {
  /** Safe / standard extraction — small. */
  successfulExtraction: 1,
  /** Emergency recall extraction — medium. */
  emergencyRecallExtraction: 2,
  bankAtSafehouse: 1,
  /** Depth boss — large. */
  defeatDepthBoss: 5,
  defeatElite: 3,
  defeatEcho: 3,
  defeatAnchorElite: 4,
  /** Anchor core — large. */
  clearAnchorCore: 10,
  clearOperationTarget: 2,
  extractTargetResourceStack: 1,
} as const;

/** Cap target-resource stacks credited toward op progress per run. */
export const OPERATION_BALANCE_MAX_TARGET_RESOURCE_STACKS_PER_RUN = 5;

/** Cap safehouse bank actions credited toward Extraction Surge per run. */
export const OPERATION_BALANCE_MAX_SAFEHOUSE_BANK_ACTIONS = 2;

export const OPERATION_BALANCE_DEFAULT_MAX_RUNS = 5;
export const OPERATION_BALANCE_DEFAULT_AFTERMATH_RUNS = 2;

/**
 * Soft caps for relic/trinket op bonuses — prevent double-progress exploits.
 * Engines should clamp additive op bonuses at or below this fraction of base contribution.
 */
export const OPERATION_BALANCE_RELIC_PROGRESS_BONUS_CAP_PCT = 50;

export function formatOperationBalanceConfigSummary(): string {
  const c = OPERATION_BALANCE_CONTRIBUTION;
  return [
    'OPERATION BALANCE CONFIG',
    `  progress goal: ${OPERATION_BALANCE_PROGRESS_REQUIRED}`,
    `  extract ${c.successfulExtraction} / emergency ${c.emergencyRecallExtraction} / bank ${c.bankAtSafehouse}`,
    `  elite ${c.defeatElite} / boss ${c.defeatDepthBoss} / anchor core ${c.clearAnchorCore}`,
    `  target resource stacks/run cap: ${OPERATION_BALANCE_MAX_TARGET_RESOURCE_STACKS_PER_RUN}`,
    `  bank actions/run cap: ${OPERATION_BALANCE_MAX_SAFEHOUSE_BANK_ACTIONS}`,
    `  relic progress bonus cap: ${OPERATION_BALANCE_RELIC_PROGRESS_BONUS_CAP_PCT}%`,
  ].join('\n');
}
