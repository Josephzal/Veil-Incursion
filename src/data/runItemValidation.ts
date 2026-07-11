import type { CargoRunState } from '../types/cargoGrid';
import type { ActiveIncursionState } from '../types/game';
import {
  ALL_RUN_ITEM_IDS,
  FORBIDDEN_RUN_ITEM_IDS,
  RUN_ITEM_COMBAT_IDS,
  RUN_ITEM_FIELD_IDS,
  type RunItemId,
  type RunItemsSlotState,
} from '../types/runItem';
import { RUN_ITEM_REGISTRY } from './runItemRegistry';
import { isRunItemId, RUN_ITEM_ID_ALIASES } from './runItemIdAliases';

export interface RunItemValidationIssue {
  severity: 'error' | 'warn';
  itemId?: RunItemId | string;
  message: string;
}

const FORBIDDEN_RECIPE_RESOURCES = [
  'smugglers-ledger',
  'tarnished-dog-tags',
  'sealed-containment-casket',
  'anomalous-core',
] as const;

const SNAKE_CASE_ID_PATTERN = /_/;

function recipeMatches(
  recipe: readonly { resourceId: string; quantity: number }[],
  expected: readonly { resourceId: string; quantity: number }[],
): boolean {
  if (recipe.length !== expected.length) return false;
  const sortedA = [...recipe].sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  const sortedB = [...expected].sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  return sortedA.every((entry, index) => (
    entry.resourceId === sortedB[index]?.resourceId
    && entry.quantity === sortedB[index]?.quantity
  ));
}

export function validateRunItemRegistry(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];

  if (ALL_RUN_ITEM_IDS.length !== 24) {
    issues.push({
      severity: 'error',
      message: `Expected 24 Run Items, found ${ALL_RUN_ITEM_IDS.length}.`,
    });
  }

  if (RUN_ITEM_COMBAT_IDS.length !== 14) {
    issues.push({
      severity: 'error',
      message: `Expected 14 combat consumables, found ${RUN_ITEM_COMBAT_IDS.length}.`,
    });
  }

  if (RUN_ITEM_FIELD_IDS.length !== 10) {
    issues.push({
      severity: 'error',
      message: `Expected 10 field tools, found ${RUN_ITEM_FIELD_IDS.length}.`,
    });
  }

  const seenIds = new Set<string>();
  const seenBehaviors = new Map<string, RunItemId>();

  ALL_RUN_ITEM_IDS.forEach((id) => {
    const def = RUN_ITEM_REGISTRY[id];
    if (!def) {
      issues.push({ severity: 'error', itemId: id, message: 'Missing registry entry.' });
      return;
    }

    if (def.id !== id) {
      issues.push({ severity: 'error', itemId: id, message: 'Registry key/id mismatch.' });
    }

    if (seenIds.has(id)) {
      issues.push({ severity: 'error', itemId: id, message: 'Duplicate Run Item id in roster.' });
    }
    seenIds.add(id);

    if (SNAKE_CASE_ID_PATTERN.test(def.id)) {
      issues.push({
        severity: 'warn',
        itemId: id,
        message: 'Canonical Run Item id uses snake_case instead of kebab-case.',
      });
    }

    if (def.family === 'STARTING_REQUISITION' as never) {
      issues.push({
        severity: 'error',
        itemId: id,
        message: 'Run Item uses forbidden family STARTING_REQUISITION.',
      });
    }

    if (def.slotType === 'REQUISITION' as never) {
      issues.push({
        severity: 'error',
        itemId: id,
        message: 'Run Item uses forbidden slotType REQUISITION.',
      });
    }

    if (FORBIDDEN_RUN_ITEM_IDS.includes(def.id as typeof FORBIDDEN_RUN_ITEM_IDS[number])) {
      issues.push({
        severity: 'error',
        itemId: id,
        message: 'Bound Requisition item accidentally registered as Run Item.',
      });
    }

    if (!def.name?.trim() || !def.effectSummary?.trim() || !def.triggerText?.trim()) {
      issues.push({ severity: 'error', itemId: id, message: 'Missing required display fields.' });
    }

    if (def.family === 'COMBAT_CONSUMABLE' && def.slotType !== 'COMBAT') {
      issues.push({
        severity: 'error',
        itemId: id,
        message: 'Combat consumable must use COMBAT slotType.',
      });
    }

    if (def.family === 'FIELD_TOOL' && def.slotType !== 'FIELD') {
      issues.push({
        severity: 'error',
        itemId: id,
        message: 'Field tool must use FIELD slotType.',
      });
    }

    if (def.stackLimit !== 1) {
      issues.push({
        severity: 'warn',
        itemId: id,
        message: `Unexpected stackLimit ${def.stackLimit} (v2 expects 1 per slot).`,
      });
    }

    def.recipe.forEach((req) => {
      if (FORBIDDEN_RECIPE_RESOURCES.includes(req.resourceId as typeof FORBIDDEN_RECIPE_RESOURCES[number])) {
        issues.push({
          severity: 'error',
          itemId: id,
          message: `Recipe uses forbidden material '${req.resourceId}'.`,
        });
      }
    });

    const behaviorOwner = seenBehaviors.get(def.useBehavior);
    if (behaviorOwner && behaviorOwner !== id) {
      issues.push({
        severity: 'warn',
        itemId: id,
        message: `Duplicate useBehavior '${def.useBehavior}' (shared with ${behaviorOwner}).`,
      });
    }
    seenBehaviors.set(def.useBehavior, id);

    if (def.validation?.includes('veil_ash_recipe_canister_cylinder')) {
      const ok = recipeMatches(def.recipe, [
        { resourceId: 'veil-ash-canister', quantity: 1 },
        { resourceId: 'combustion-cylinder', quantity: 1 },
      ]);
      if (!ok) {
        issues.push({
          severity: 'error',
          itemId: id,
          message: 'Veil-Ash Grenade must use Veil-Ash Canister + Combustion Cylinder recipe.',
        });
      }
    }

    def.legacyIds?.forEach((legacyId) => {
      if (SNAKE_CASE_ID_PATTERN.test(legacyId) && !RUN_ITEM_ID_ALIASES[legacyId]) {
        issues.push({
          severity: 'warn',
          itemId: id,
          message: `Legacy alias '${legacyId}' missing from RUN_ITEM_ID_ALIASES map.`,
        });
      }
    });
  });

  Object.entries(RUN_ITEM_ID_ALIASES).forEach(([alias, canonicalId]) => {
    if (!isRunItemId(canonicalId)) {
      issues.push({
        severity: 'error',
        itemId: alias,
        message: `Alias '${alias}' maps to unknown Run Item '${canonicalId}'.`,
      });
    }
  });

  FORBIDDEN_RUN_ITEM_IDS.forEach((forbiddenId) => {
    if (isRunItemId(forbiddenId)) {
      issues.push({
        severity: 'error',
        itemId: forbiddenId,
        message: `${forbiddenId} must not be a Run Item id.`,
      });
    }
  });

  return issues;
}

export function validateRunItemSlotState(
  slots: RunItemsSlotState | null | undefined,
): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  if (!slots) return issues;

  const allSlotted = [...slots.combatSlots, ...slots.fieldSlots].filter(Boolean) as RunItemId[];
  allSlotted.forEach((itemId) => {
    if (!RUN_ITEM_REGISTRY[itemId]) {
      issues.push({
        severity: 'error',
        itemId,
        message: 'Unknown item stored in Run Item slot.',
      });
    }
  });

  slots.combatSlots.forEach((itemId, index) => {
    if (!itemId) return;
    const def = RUN_ITEM_REGISTRY[itemId];
    if (def?.slotType !== 'COMBAT') {
      issues.push({
        severity: 'error',
        itemId,
        message: `Non-combat item in combat slot ${index}.`,
      });
    }
  });

  slots.fieldSlots.forEach((itemId, index) => {
    if (!itemId) return;
    const def = RUN_ITEM_REGISTRY[itemId];
    if (def?.slotType !== 'FIELD') {
      issues.push({
        severity: 'error',
        itemId,
        message: `Non-field item in field slot ${index}.`,
      });
    }
  });

  return issues;
}

/** Warn when run items appear in cargo grid or cargo resources appear in run item slots. */
export function validateRunItemStorageSeparation(
  incursion: Pick<ActiveIncursionState, 'runItems' | 'cargo'>,
): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  issues.push(...validateRunItemSlotState(incursion.runItems));

  const cargoItemIds = new Set(
    incursion.cargo.grid.placed.map((item) => item.itemId),
  );
  ALL_RUN_ITEM_IDS.forEach((runItemId) => {
    if (cargoItemIds.has(runItemId)) {
      issues.push({
        severity: 'warn',
        itemId: runItemId,
        message: 'Run Item is stored in cargo grid (should use runItems slots).',
      });
    }
  });

  return issues;
}

export function validateRunItemRuntimeGuards(
  runtime: ActiveIncursionState['itemRuntime'] | null | undefined,
): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  if (!runtime) return issues;

  runtime.pendingEffects.forEach((effect) => {
    if (effect.kind === 'grave_dust_bonus_ap_persistent') {
      issues.push({
        severity: 'error',
        message: 'Grave-Dust creates persistent AP (forbidden).',
      });
    }
    if (effect.kind === 'grave_dust_bonus_ap_duplicate_path') {
      issues.push({
        severity: 'error',
        message: 'Grave-Dust creates a duplicate AP modifier path.',
      });
    }
  });

  return issues;
}

export function validateRunItemPipeline(
  incursion?: Pick<ActiveIncursionState, 'runItems' | 'cargo' | 'itemRuntime'> | null,
): RunItemValidationIssue[] {
  return [
    ...validateRunItemRegistry(),
    ...(incursion ? validateRunItemStorageSeparation(incursion) : []),
    ...(incursion ? validateRunItemRuntimeGuards(incursion.itemRuntime) : []),
  ];
}

export function formatRunItemValidationReport(issues: RunItemValidationIssue[]): string {
  if (issues.length === 0) return 'RUN ITEM VALIDATION — OK (0 issues).';
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warns = issues.filter((issue) => issue.severity === 'warn');
  return [
    'RUN ITEM VALIDATION',
    `errors: ${errors.length}`,
    `warnings: ${warns.length}`,
    ...issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.itemId ?? 'global'} — ${issue.message}`),
  ].join('\n');
}

export function verifyRunItemRegistry(): void {
  const errors = validateRunItemRegistry().filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `verifyRunItemRegistry: ${errors.map((issue) => issue.message).join('; ')}`,
    );
  }
}

/** Detect run items incorrectly placed in a cargo grid snapshot. */
export function findRunItemsInCargoGrid(cargo: CargoRunState): RunItemId[] {
  const found: RunItemId[] = [];
  cargo.grid.placed.forEach((placed) => {
    if (isRunItemId(placed.itemId)) {
      found.push(placed.itemId);
    }
  });
  return found;
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    verifyRunItemRegistry();
  } catch (error) {
    console.warn(
      error instanceof Error ? error.message : 'verifyRunItemRegistry failed.',
    );
  }
}
