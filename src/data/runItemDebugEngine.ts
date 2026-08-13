import type { ActiveIncursionState } from '../types/game';
import type { RunItemId } from '../types/runItem';
import { ALL_RUN_ITEM_IDS } from '../types/runItem';
import {
  auditReportRunItems,
  formatRunItemEngineReport,
} from './runItemAuditEngine';
import {
  formatRunItemAcceptanceReport,
  validateRunItemAcceptance,
} from './runItemAcceptanceEngine';
import { formatRunItemDebriefPreview } from './runDebriefRunItemEngine';
import { formatRunItemRuntimeDebugSnapshot } from './runItemRunState';
import { getRunItemDefinition } from './runItemRegistry';
import { canAffordRunItemRecipe } from './runItemCraftingBridge';
import { simulateRunItemMarketStock } from './runItemMarketEngine';

export function formatRunItemDebugValidation(
  incursion?: ActiveIncursionState | null,
): string {
  return formatRunItemEngineReport(incursion ?? undefined);
}

export function formatRunItemAcceptanceDebugReport(): string {
  return [
    auditReportRunItems(),
    '',
    formatRunItemAcceptanceReport(validateRunItemAcceptance()),
  ].join('\n');
}

export function formatRunItemIncursionDebugSnapshot(incursion: ActiveIncursionState): string {
  return [
    formatRunItemRuntimeDebugSnapshot(incursion.supplyRuntime),
    '',
    formatRunItemDebriefPreview(
      incursion.supplyRuntime,
      incursion.cargo,
    ),
  ].join('\n');
}

export function listRunItemDebugIds(): string {
  return ALL_RUN_ITEM_IDS.join(', ');
}

export function previewRunItemDebriefFromIncursion(incursion: ActiveIncursionState): string {
  return formatRunItemDebriefPreview(
    incursion.supplyRuntime,
    incursion.cargo,
  );
}

export function formatRunItemMarketSimulationReport(depth = 1): string {
  const stock = simulateRunItemMarketStock(depth);
  const lines = [
    'CARGO SUPPLY MARKET SIMULATION',
    `depth: ${depth}`,
    `listings: ${stock.length}`,
    ...stock.map((itemId) => {
      const def = getRunItemDefinition(itemId);
      return `- ${def.name} (${def.family === 'COMBAT_CONSUMABLE' ? 'COMBAT SUPPLY' : 'FIELD TOOL'}) — ${def.marketPrice} CR`;
    }),
  ];
  return lines.join('\n');
}

export function formatRunItemRecipeGapReport(stash: import('../types/resourceItem').ResourceQuantity): string {
  const lines = ['CARGO SUPPLY RECIPE GAPS'];
  ALL_RUN_ITEM_IDS.forEach((itemId) => {
    const def = getRunItemDefinition(itemId);
    if (!def.canCraft) return;
    const afford = canAffordRunItemRecipe(stash, itemId);
    if (afford.missing.length === 0) {
      lines.push(`- ${def.shortName}: craftable now`);
      return;
    }
    lines.push(`- ${def.shortName}: need ${afford.missing.map((entry) => `${entry.quantity - entry.owned}× ${entry.resourceId}`).join(', ')}`);
  });
  return lines.join('\n');
}
