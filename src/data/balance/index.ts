/**
 * Central balance registry — format + inspect all Phase A configs from one place.
 */

import { BALANCE_TARGET_EARLY, BALANCE_TARGET_LATE, COMBAT_PACING_TARGETS } from './balanceTargets';
import { formatCombatBalanceConfigSummary } from './combatBalanceConfig';
import { formatCombatDefenseBalanceSummary } from './combatDefenseBalanceConfig';
import { formatCombatIntentBalanceSummary } from './combatIntentBalanceConfig';
import { formatCombatDirectorBalanceSummary } from './combatDirectorBalanceConfig';
import { formatContractBalanceConfigSummary } from './contractBalanceConfig';
import { formatEconomyBalanceConfigSummary } from './economyBalanceConfig';
import { formatOperationBalanceConfigSummary } from './operationBalanceConfig';
import { formatRewardBalanceConfigSummary } from './rewardBalanceConfig';
import { formatRunBalanceConfigSummary } from './runBalanceConfig';
import { formatScannerBalanceConfigSummary } from './scannerBalanceConfig';
import { formatTrinketBalanceConfigSummary } from './trinketBalanceConfig';
import { formatWeaponBalanceConfigSummary } from './weaponBalanceConfig';

export function formatBalanceConfigSummary(): string {
  const early = BALANCE_TARGET_EARLY;
  return [
    '══════════════════════════════════════',
    'BALANCE CONFIG REGISTRY — Phase A',
    '══════════════════════════════════════',
    '',
    'TARGET BANDS (early player — not enforced)',
    `  D1 boss clear: ${early.depth1BossClear.min * 100}–${early.depth1BossClear.max * 100}%`,
    `  reach D2: ${early.reachDepth2.min * 100}–${early.reachDepth2.max * 100}%`,
    `  reach D3: ${early.reachDepth3.min * 100}–${early.reachDepth3.max * 100}%`,
    `  full clear: ${early.fullClear.min * 100}–${early.fullClear.max * 100}%`,
    `  any extract: ${early.anyExtraction.min * 100}–${early.anyExtraction.max * 100}%`,
    `  late D3 reach: ${BALANCE_TARGET_LATE.reachDepth3.min * 100}–${BALANCE_TARGET_LATE.reachDepth3.max * 100}%`,
    '',
    'COMBAT PACING TARGETS (turns)',
    `  normal D1 ${COMBAT_PACING_TARGETS.normal[1].join('–')} / D2 ${COMBAT_PACING_TARGETS.normal[2].join('–')} / D3 ${COMBAT_PACING_TARGETS.normal[3].join('–')}`,
    `  elite  D1 ${COMBAT_PACING_TARGETS.elite[1].join('–')} / D2 ${COMBAT_PACING_TARGETS.elite[2].join('–')} / D3 ${COMBAT_PACING_TARGETS.elite[3].join('–')}`,
    `  boss   D1 ${COMBAT_PACING_TARGETS.boss[1].join('–')} / D2 ${COMBAT_PACING_TARGETS.boss[2].join('–')} / D3 ${COMBAT_PACING_TARGETS.boss[3].join('–')}`,
    '',
    formatRunBalanceConfigSummary(),
    '',
    formatCombatBalanceConfigSummary(),
    '',
    formatCombatDefenseBalanceSummary(),
    '',
    formatCombatIntentBalanceSummary(),
    '',
    formatCombatDirectorBalanceSummary(),
    '',
    formatRewardBalanceConfigSummary(),
    '',
    formatEconomyBalanceConfigSummary(),
    '',
    formatContractBalanceConfigSummary(),
    '',
    formatOperationBalanceConfigSummary(),
    '',
    formatScannerBalanceConfigSummary(),
    '',
    formatWeaponBalanceConfigSummary(),
    '',
    formatTrinketBalanceConfigSummary(),
    '',
    'Tune values in src/data/balance/* — avoid scattering magic numbers.',
  ].join('\n');
}

export * from './balanceTargets';
export * from './runBalanceConfig';
export * from './combatBalanceConfig';
export * from './combatDefenseBalanceConfig';
export * from './combatIntentBalanceConfig';
export * from './combatTelemetryEngine';
export * from './combatIntentTelemetryEngine';
export * from './combatBalanceReportEngine';
export * from './combatIntentReportEngine';
export * from './combatDefenseValidationEngine';
export * from './combatIntentValidationEngine';
export * from './classLoopTelemetryEngine';
export * from './classCombatIdentityEngine';
export * from './encounterObjectiveTelemetryEngine';
export * from './encounterObjectiveReportEngine';
export * from './encounterObjectiveValidationEngine';
export * from './combatDirectorBalanceConfig';
export * from './combatDirectorReportEngine';
export * from './combatDirectorValidationEngine';
export * from './rewardBalanceConfig';
export * from './economyBalanceConfig';
export * from './contractBalanceConfig';
export * from './operationBalanceConfig';
export * from './scannerBalanceConfig';
export * from './weaponBalanceConfig';
export * from './trinketBalanceConfig';
export * from './balanceRunStats';
export * from './balanceDashboardEngine';
export * from './balanceSimulationEngine';
export * from './balanceCraftingAffordabilityEngine';
export * from './balanceValidationEngine';
