/**
 * Full Run Balance Phase C — crafting affordability estimates vs approx run income.
 */

import type { ResourceItemId, ResourceQuantity } from '../../types/resourceItem';
import { CRAFTING_REGISTRY, type CraftingRecipe } from '../craftingRegistry';
import { buildRunItemCraftingRecipes } from '../runItemCraftingBridge';
import { getResourceDisplayName } from '../resourceRegistry';
import { ECONOMY_CRAFTING_COST_MULTIPLIER } from './economyBalanceConfig';
import { simulateRunResourceIncome } from './balanceSimulationEngine';

export type RecipeAffordabilityClass =
  | 'COMMON_PREP'
  | 'STANDARD_TOOL'
  | 'RARE_TOOL'
  | 'APEX_FUTURE';

export interface RecipeAffordabilityEstimate {
  recipeId: string;
  label: string;
  kind: CraftingRecipe['kind'];
  classification: RecipeAffordabilityClass;
  estimatedRunsToAfford: number | null;
  bottleneckResourceId: ResourceItemId | null;
  bottleneckDetail: string | null;
  scaledRequirements: Array<{ resourceId: ResourceItemId; quantity: number }>;
}

function classifyByRuns(runs: number | null): RecipeAffordabilityClass {
  if (runs == null || !Number.isFinite(runs)) return 'APEX_FUTURE';
  if (runs <= 1) return 'COMMON_PREP';
  if (runs <= 2) return 'STANDARD_TOOL';
  if (runs <= 5) return 'RARE_TOOL';
  return 'APEX_FUTURE';
}

function scaleRequirements(recipe: CraftingRecipe): Array<{ resourceId: ResourceItemId; quantity: number }> {
  const mult = ECONOMY_CRAFTING_COST_MULTIPLIER;
  return recipe.requirements.map((req) => ({
    resourceId: req.resourceId,
    quantity: Math.max(1, Math.ceil(req.quantity * mult)),
  }));
}

export function listAllCraftingRecipesForBalance(): CraftingRecipe[] {
  return [...CRAFTING_REGISTRY, ...buildRunItemCraftingRecipes()];
}

export function estimateRecipeAffordability(
  recipe: CraftingRecipe,
  expectedPerRun: Map<ResourceItemId, number>,
): RecipeAffordabilityEstimate {
  const scaledRequirements = scaleRequirements(recipe);
  let runsNeeded = 0;
  let bottleneckResourceId: ResourceItemId | null = null;
  let bottleneckDetail: string | null = null;
  let impossible = false;

  scaledRequirements.forEach((req) => {
    const income = expectedPerRun.get(req.resourceId) ?? 0;
    if (income <= 0.01) {
      impossible = true;
      bottleneckResourceId = req.resourceId;
      bottleneckDetail = `${getResourceDisplayName(req.resourceId)} — ~0/run in income model`;
      return;
    }
    const runs = Math.ceil(req.quantity / income);
    if (runs > runsNeeded) {
      runsNeeded = runs;
      bottleneckResourceId = req.resourceId;
      bottleneckDetail = `${getResourceDisplayName(req.resourceId)} — need ${req.quantity}, ~${income}/run`;
    }
  });

  const estimatedRunsToAfford = impossible ? null : Math.max(1, runsNeeded);
  return {
    recipeId: recipe.id,
    label: recipe.label,
    kind: recipe.kind,
    classification: classifyByRuns(estimatedRunsToAfford),
    estimatedRunsToAfford,
    bottleneckResourceId,
    bottleneckDetail,
    scaledRequirements,
  };
}

export function buildCraftingAffordabilityReport(opts?: {
  incomeSamples?: number;
}): {
  estimatedIncome: Map<ResourceItemId, number>;
  estimates: RecipeAffordabilityEstimate[];
  byClass: Record<RecipeAffordabilityClass, number>;
} {
  const income = simulateRunResourceIncome({ samples: opts?.incomeSamples ?? 40 });
  const estimatedIncome = income.avgByResource;
  const estimates = listAllCraftingRecipesForBalance().map((recipe) =>
    estimateRecipeAffordability(recipe, estimatedIncome),
  );
  const byClass: Record<RecipeAffordabilityClass, number> = {
    COMMON_PREP: 0,
    STANDARD_TOOL: 0,
    RARE_TOOL: 0,
    APEX_FUTURE: 0,
  };
  estimates.forEach((e) => {
    byClass[e.classification] += 1;
  });
  return { estimatedIncome, estimates, byClass };
}

export function formatCraftingAffordabilityReport(): string {
  const report = buildCraftingAffordabilityReport();
  const lines = [
    'BALANCE SIM — CRAFTING AFFORDABILITY',
    `cost multiplier: ${ECONOMY_CRAFTING_COST_MULTIPLIER}`,
    'income model: 8 std + 1 elite + 1 boss (see RUN RESOURCE INCOME)',
    '',
    'CLASS COUNTS',
    `  COMMON_PREP (≤1 run): ${report.byClass.COMMON_PREP}`,
    `  STANDARD_TOOL (≤2 runs): ${report.byClass.STANDARD_TOOL}`,
    `  RARE_TOOL (≤5 runs): ${report.byClass.RARE_TOOL}`,
    `  APEX_FUTURE / never in model: ${report.byClass.APEX_FUTURE}`,
    '',
    'NEVER / APEX (bottleneck)',
  ];

  const apex = report.estimates.filter((e) => e.classification === 'APEX_FUTURE');
  if (apex.length === 0) {
    lines.push('  (none)');
  } else {
    apex.slice(0, 20).forEach((e) => {
      lines.push(
        `  ${e.label} [${e.kind}] — ${e.estimatedRunsToAfford ?? '∞'} runs // ${e.bottleneckDetail ?? '—'}`,
      );
    });
    if (apex.length > 20) lines.push(`  … +${apex.length - 20} more`);
  }

  lines.push('', 'ALWAYS EARLY (COMMON_PREP)');
  const cheap = report.estimates.filter((e) => e.classification === 'COMMON_PREP');
  if (cheap.length === 0) {
    lines.push('  (none)');
  } else {
    cheap.slice(0, 16).forEach((e) => {
      lines.push(`  ${e.label} — ~${e.estimatedRunsToAfford} run(s)`);
    });
  }

  lines.push('', 'SAMPLE STANDARD / RARE');
  report.estimates
    .filter((e) => e.classification === 'STANDARD_TOOL' || e.classification === 'RARE_TOOL')
    .slice(0, 16)
    .forEach((e) => {
      lines.push(
        `  [${e.classification}] ${e.label} — ~${e.estimatedRunsToAfford} runs // ${e.bottleneckDetail ?? '—'}`,
      );
    });

  return lines.join('\n');
}

/** Convert income map to ResourceQuantity for stash-style tools. */
export function expectedIncomeAsQuantity(income: Map<ResourceItemId, number>): ResourceQuantity {
  const qty: ResourceQuantity = {};
  income.forEach((n, id) => {
    if (n > 0) qty[id] = Math.max(1, Math.round(n));
  });
  return qty;
}
