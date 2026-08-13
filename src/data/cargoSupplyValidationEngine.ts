import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import {
  ALL_RUN_ITEM_IDS,
  RUN_ITEM_COMBAT_IDS,
  RUN_ITEM_FIELD_IDS,
  createDefaultRunItemRuntime,
  type RunItemId,
} from '../types/runItem';
import { resolveRunItemCombatUse } from './runItemCombatEngine';
import { RUN_ITEM_REGISTRY } from './runItemRegistry';

export interface CargoSupplyValidationIssue {
  severity: 'error' | 'warn';
  itemId?: RunItemId;
  message: string;
}

const FIELD_BEHAVIORS = new Set([
  'broker_flashcard',
  'relay_spike',
  'sonar_ping',
  'null_lens_filter',
  'dead_drop_token',
  'ash_seal_canister',
  'containment_foam',
  'ley_slag_splitter',
  'echo_tuning_fork',
  'anchor_needle',
]);

export function validateCargoSupplyCatalog(): CargoSupplyValidationIssue[] {
  const issues: CargoSupplyValidationIssue[] = [];
  const names = new Set<string>();
  const behaviors = new Set<string>();

  if (ALL_RUN_ITEM_IDS.length !== 24) {
    issues.push({
      severity: 'error',
      message: `Expected exactly 24 canonical Supplies; found ${ALL_RUN_ITEM_IDS.length}.`,
    });
  }

  ALL_RUN_ITEM_IDS.forEach((itemId) => {
    const definition = RUN_ITEM_REGISTRY[itemId];
    const cargo = CARGO_ITEM_CATALOG[itemId];
    if (!definition || definition.id !== itemId || !definition.name.trim()) {
      issues.push({ severity: 'error', itemId, message: 'Canonical id or player-facing name is invalid.' });
      return;
    }
    if (names.has(definition.name)) {
      issues.push({ severity: 'error', itemId, message: `Duplicate live name: ${definition.name}.` });
    }
    names.add(definition.name);
    if (behaviors.has(definition.useBehavior)) {
      issues.push({
        severity: 'error',
        itemId,
        message: `Exact tactical-purpose duplicate: ${definition.useBehavior}.`,
      });
    }
    behaviors.add(definition.useBehavior);

    const familyTag = definition.family === 'COMBAT_CONSUMABLE'
      ? 'COMBAT_SUPPLY'
      : 'FIELD_TOOL';
    if (
      !cargo ||
      cargo.subtype !== 'SUPPLY' ||
      cargo.width !== 1 ||
      cargo.height !== 1 ||
      definition.stackLimit !== 1 ||
      !cargo.tags.includes('SUPPLY') ||
      !cargo.tags.includes(familyTag)
    ) {
      issues.push({
        severity: 'error',
        itemId,
        message: `Supply must be non-stacking 1×1 cargo tagged SUPPLY + ${familyTag}.`,
      });
    }
    if (definition.usableContexts.length === 0) {
      issues.push({ severity: 'error', itemId, message: 'Supply has no valid use context.' });
    }
    if (definition.canCraft && definition.recipe.length === 0) {
      issues.push({ severity: 'error', itemId, message: 'Craftable Supply has no recipe.' });
    }
    if (definition.canBuy && definition.marketPrice <= 0) {
      issues.push({ severity: 'error', itemId, message: 'Buyable Supply has no valid market price.' });
    }

    if (definition.family === 'FIELD_TOOL' && !FIELD_BEHAVIORS.has(definition.useBehavior)) {
      issues.push({ severity: 'error', itemId, message: `Field behavior is not dispatched: ${definition.useBehavior}.` });
    }
  });

  RUN_ITEM_COMBAT_IDS.forEach((itemId) => {
    const outcome = resolveRunItemCombatUse(itemId, {
      maxSoulAnchor: 100,
      currentSoulAnchor: 40,
      currentStamina: 50,
      maxStamina: 100,
      runtime: createDefaultRunItemRuntime(),
      livingEnemyCount: 2,
    });
    if (outcome.rejected?.includes('not wired')) {
      issues.push({ severity: 'error', itemId, message: outcome.rejected });
    }
  });

  if (RUN_ITEM_COMBAT_IDS.length + RUN_ITEM_FIELD_IDS.length !== 24) {
    issues.push({ severity: 'error', message: 'Combat Supply and Field Tool rosters do not cover all 24 ids.' });
  }

  return issues;
}

export function assertCargoSupplyCatalogValid(): void {
  const errors = validateCargoSupplyCatalog().filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((issue) => `${issue.itemId ?? 'catalog'}: ${issue.message}`).join('\n'));
  }
}
