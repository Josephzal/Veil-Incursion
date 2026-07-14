/**
 * Full Run Balance Phase D — structural balance validation warnings.
 * Guide-only: never hard-gate gameplay. Surfaces tuning problems in DevTest / loop audit.
 */

import type { CareerBalanceHistory } from './balanceDashboardEngine';
import {
  BALANCE_TARGET_EARLY,
  OPERATION_COMPLETION_RUN_TARGET,
} from './balanceTargets';
import { COMBAT_DEPTH_SCALING, COMBAT_ELITE_MODIFIER } from './combatBalanceConfig';
import {
  REWARD_CREDIT_RANGES,
  REWARD_COMPOSITION_CREDIT_MULTIPLIER,
  REWARD_DEPTH_CREDIT_MULTIPLIER,
} from './rewardBalanceConfig';
import {
  ECONOMY_BLACK_MARKET_SELL_MULTIPLIER,
  ECONOMY_CRAFTING_COST_MULTIPLIER,
} from './economyBalanceConfig';
import {
  OPERATION_BALANCE_CONTRIBUTION,
  OPERATION_BALANCE_PROGRESS_REQUIRED,
  OPERATION_BALANCE_RELIC_PROGRESS_BONUS_CAP_PCT,
} from './operationBalanceConfig';
import {
  TRINKET_BALANCE_MAX_MARKET_DISCOUNT_PCT,
  TRINKET_BALANCE_MAX_OPERATION_PROGRESS_BONUS_PCT,
} from './trinketBalanceConfig';
import {
  WEAPON_BALANCE_CUMULATIVE_STRIKE_DAMAGE_PCT_SOFT_CAP,
  WEAPON_BALANCE_TIER_STRIKE_DAMAGE_PCT_SOFT_CAP,
} from './weaponBalanceConfig';
import {
  estimateOperationRunContribution,
  simulateRunTreeGenerations,
} from './balanceSimulationEngine';
import { listAllCraftingRecipesForBalance } from './balanceCraftingAffordabilityEngine';
import { validateEncounterCompositionPhaseD } from '../encounterCompositionValidationEngine';
import { validateContractTemplates } from '../runIntegration/contractValidationEngine';
import { validateContractResourceTarget } from '../resourceValidation';
import { RECOMMENDED_SECTORS_BY_RESOURCE } from '../contractTemplates';
import {
  canResourceSpawnInSector,
  getResourceSellValue,
  RESOURCE_REGISTRY,
} from '../resourceRegistry';
import { WEAPON_REGISTRY, ALL_WEAPON_FAMILY_IDS } from '../weaponRegistry';
import { CARGO_ITEM_CATALOG } from '../../types/cargoGrid';
import type { CargoItemId } from '../../types/cargoGrid';
import { MARKED_SHELF_DISCOUNT_PCT } from '../expeditionKeepsakeEconomyEngine';
import { validatePostRunCargoRoutingPipeline } from '../postRunCargoRoutingValidation';

export type BalanceValidationSeverity = 'warn' | 'error' | 'info';

export interface BalanceValidationIssue {
  domain:
    | 'combat'
    | 'reward'
    | 'composition'
    | 'economy'
    | 'contract'
    | 'operation'
    | 'weapon'
    | 'trinket'
    | 'run_structure'
    | 'extraction'
    | 'telemetry';
  severity: BalanceValidationSeverity;
  code: string;
  message: string;
}

export interface BalanceValidationOptions {
  /** When present and length ≥ 5, compare last-N rates to early target bands. */
  careerBalanceHistory?: CareerBalanceHistory | null;
  /** Skip heavier sims (trees / ops) when false. Default true. */
  runSims?: boolean;
}

function push(
  issues: BalanceValidationIssue[],
  issue: BalanceValidationIssue,
): void {
  issues.push(issue);
}

/** Comment/intent bands for depth HP & damage multipliers (not hard rules). */
const DEPTH_HP_INTENT = {
  2: { min: 1.5, max: 1.9 },
  3: { min: 2.2, max: 2.8 },
} as const;
const DEPTH_DMG_INTENT = {
  2: { min: 1.6, max: 2.0 },
  3: { min: 2.3, max: 2.9 },
} as const;

function validateCombatScaling(issues: BalanceValidationIssue[]): void {
  ([2, 3] as const).forEach((depth) => {
    const scaling = COMBAT_DEPTH_SCALING[depth];
    const hpBand = DEPTH_HP_INTENT[depth];
    const dmgBand = DEPTH_DMG_INTENT[depth];
    if (scaling.hpMult < hpBand.min || scaling.hpMult > hpBand.max) {
      push(issues, {
        domain: 'combat',
        severity: 'warn',
        code: 'DEPTH_HP_OUTSIDE_INTENT',
        message: `Depth ${depth} hpMult ${scaling.hpMult} outside intent ${hpBand.min}–${hpBand.max}.`,
      });
    }
    if (scaling.dmgMult < dmgBand.min || scaling.dmgMult > dmgBand.max) {
      push(issues, {
        domain: 'combat',
        severity: 'warn',
        code: 'DEPTH_DMG_OUTSIDE_INTENT',
        message: `Depth ${depth} dmgMult ${scaling.dmgMult} outside intent ${dmgBand.min}–${dmgBand.max}.`,
      });
    }
  });

  if (COMBAT_ELITE_MODIFIER.hpMult < 1.1 || COMBAT_ELITE_MODIFIER.hpMult > 1.6) {
    push(issues, {
      domain: 'combat',
      severity: 'warn',
      code: 'ELITE_HP_MULT_ODD',
      message: `Elite hpMult ${COMBAT_ELITE_MODIFIER.hpMult} looks outside soft 1.1–1.6 band.`,
    });
  }
}

function validateRewardTables(issues: BalanceValidationIssue[]): void {
  const c = REWARD_CREDIT_RANGES;
  if (c.standardKill.max >= c.eliteKill.min) {
    push(issues, {
      domain: 'reward',
      severity: 'warn',
      code: 'ELITE_CREDIT_OVERLAP',
      message: `Standard kill max (${c.standardKill.max}) overlaps elite min (${c.eliteKill.min}).`,
    });
  }
  if (c.eliteKill.max > c.districtBoss.max) {
    push(issues, {
      domain: 'reward',
      severity: 'warn',
      code: 'ELITE_ABOVE_BOSS_CREDITS',
      message: `Elite credit max (${c.eliteKill.max}) exceeds district boss max (${c.districtBoss.max}).`,
    });
  }
  if (c.districtBoss.max > c.primeBoss.max) {
    push(issues, {
      domain: 'reward',
      severity: 'warn',
      code: 'DISTRICT_ABOVE_PRIME_CREDITS',
      message: `District boss max (${c.districtBoss.max}) exceeds prime boss max (${c.primeBoss.max}).`,
    });
  }
  if (!(REWARD_DEPTH_CREDIT_MULTIPLIER[1] < REWARD_DEPTH_CREDIT_MULTIPLIER[2]
    && REWARD_DEPTH_CREDIT_MULTIPLIER[2] < REWARD_DEPTH_CREDIT_MULTIPLIER[3])) {
    push(issues, {
      domain: 'reward',
      severity: 'warn',
      code: 'DEPTH_CREDIT_NOT_INCREASING',
      message: 'Depth credit multipliers should strictly increase D1 < D2 < D3.',
    });
  }
  const baseline = REWARD_COMPOSITION_CREDIT_MULTIPLIER.BASELINE;
  const high = REWARD_COMPOSITION_CREDIT_MULTIPLIER.HIGH_VALUE;
  if (high <= baseline) {
    push(issues, {
      domain: 'reward',
      severity: 'error',
      code: 'HIGH_VALUE_NO_CREDIT_BUMP',
      message: 'Composition HIGH_VALUE credit multiplier must exceed BASELINE.',
    });
  }
}

function validateComposition(issues: BalanceValidationIssue[]): void {
  validateEncounterCompositionPhaseD().forEach((issue) => {
    push(issues, {
      domain: 'composition',
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
    });
  });
}

function validateEconomyExploits(issues: BalanceValidationIssue[]): void {
  const recipes = listAllCraftingRecipesForBalance();
  recipes.forEach((recipe) => {
    if (recipe.kind !== 'CONSUMABLE') return;
    const outputId = recipe.outputId as CargoItemId;
    const catalog = CARGO_ITEM_CATALOG[outputId];
    if (!catalog) return;
    const craftCost = recipe.requirements.reduce((sum, req) => {
      return sum + getResourceSellValue(req.resourceId) * req.quantity * ECONOMY_CRAFTING_COST_MULTIPLIER;
    }, 0);
    const sellValue = catalog.baseValue * ECONOMY_BLACK_MARKET_SELL_MULTIPLIER;
    if (craftCost > 0 && sellValue > craftCost * 1.15) {
      push(issues, {
        domain: 'economy',
        severity: 'warn',
        code: 'CRAFT_SELL_EXPLOIT',
        message: `${recipe.label}: sell ${sellValue} CR > craft cost ~${Math.round(craftCost)} CR (possible fence loop).`,
      });
    }
  });
}

function validateContracts(issues: BalanceValidationIssue[]): void {
  validateContractTemplates().forEach((issue) => {
    push(issues, {
      domain: 'contract',
      severity: issue.severity,
      code: 'CONTRACT_TEMPLATE',
      message: `${issue.templateKind ?? '?'}: ${issue.message}`,
    });
  });

  Object.entries(RECOMMENDED_SECTORS_BY_RESOURCE).forEach(([resourceId, sectors]) => {
    if (!sectors || sectors.length === 0) return;
    const id = resourceId as import('../../types/resourceItem').ResourceItemId;
    if (!RESOURCE_REGISTRY[id]) {
      push(issues, {
        domain: 'contract',
        severity: 'error',
        code: 'RECOMMENDED_MISSING_RESOURCE',
        message: `RECOMMENDED_SECTORS_BY_RESOURCE key missing from registry: ${resourceId}`,
      });
      return;
    }
    const spawnable = sectors.some((sectorId) => canResourceSpawnInSector(id, sectorId));
    if (!spawnable) {
      push(issues, {
        domain: 'contract',
        severity: 'error',
        code: 'CONTRACT_TARGET_CANNOT_SPAWN',
        message: `${resourceId} recommended sectors cannot spawn that resource.`,
      });
    }
    sectors.forEach((sectorId) => {
      const check = validateContractResourceTarget(id, sectorId);
      if (!check.valid) {
        push(issues, {
          domain: 'contract',
          severity: 'warn',
          code: 'CONTRACT_TARGET_FLAGS',
          message: `${resourceId} @ ${sectorId}: ${check.reason ?? 'invalid contract target'}`,
        });
      }
    });
  });
}

function validateOperations(issues: BalanceValidationIssue[], runSims: boolean): void {
  Object.entries(OPERATION_BALANCE_CONTRIBUTION).forEach(([key, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      push(issues, {
        domain: 'operation',
        severity: 'error',
        code: 'OP_CONTRIBUTION_INVALID',
        message: `Contribution ${key} is missing/invalid (${String(value)}).`,
      });
    }
    if (typeof value === 'number' && value > OPERATION_BALANCE_PROGRESS_REQUIRED) {
      push(issues, {
        domain: 'operation',
        severity: 'warn',
        code: 'OP_CONTRIBUTION_ABSURD',
        message: `Contribution ${key}=${value} alone exceeds progress goal ${OPERATION_BALANCE_PROGRESS_REQUIRED}.`,
      });
    }
  });

  if (OPERATION_BALANCE_RELIC_PROGRESS_BONUS_CAP_PCT !== TRINKET_BALANCE_MAX_OPERATION_PROGRESS_BONUS_PCT) {
    push(issues, {
      domain: 'operation',
      severity: 'warn',
      code: 'OP_RELIC_CAP_MISMATCH',
      message: `Op relic bonus cap ${OPERATION_BALANCE_RELIC_PROGRESS_BONUS_CAP_PCT}% ≠ trinket cap ${TRINKET_BALANCE_MAX_OPERATION_PROGRESS_BONUS_PCT}%.`,
    });
  }

  if (!runSims) return;

  const kinds = [
    'ANCHOR_ASSAULT',
    'ECHO_RECOVERY',
    'EXTRACTION_SURGE',
    'RESOURCE_SURVEY',
    'BOSS_SUPPRESSION',
  ] as const;
  kinds.forEach((kind) => {
    const est = estimateOperationRunContribution(kind);
    if (est.ordinaryRunsToComplete <= 1) {
      push(issues, {
        domain: 'operation',
        severity: 'warn',
        code: 'OP_ONE_SHOT_ORDINARY',
        message: `${kind}: ordinary run (~${est.ordinary}) completes op in ${est.ordinaryRunsToComplete} run(s).`,
      });
    }
    if (est.focusedRunsToComplete < OPERATION_COMPLETION_RUN_TARGET.min) {
      push(issues, {
        domain: 'operation',
        severity: 'warn',
        code: 'OP_TOO_FAST_FOCUSED',
        message: `${kind}: focused clears in ~${est.focusedRunsToComplete} runs (target ${OPERATION_COMPLETION_RUN_TARGET.min}–${OPERATION_COMPLETION_RUN_TARGET.max}).`,
      });
    }
    if (est.focusedRunsToComplete > OPERATION_COMPLETION_RUN_TARGET.max + 2) {
      push(issues, {
        domain: 'operation',
        severity: 'warn',
        code: 'OP_TOO_SLOW_FOCUSED',
        message: `${kind}: focused clears in ~${est.focusedRunsToComplete} runs (target ${OPERATION_COMPLETION_RUN_TARGET.min}–${OPERATION_COMPLETION_RUN_TARGET.max}).`,
      });
    }
  });
}

function validateWeapons(issues: BalanceValidationIssue[]): void {
  ALL_WEAPON_FAMILY_IDS.forEach((familyId) => {
    const family = WEAPON_REGISTRY[familyId];
    let cumulative = 0;
    family.tiers.forEach((tier) => {
      const pct = tier.statModifiers.strikeDamagePct ?? 0;
      if (pct > WEAPON_BALANCE_TIER_STRIKE_DAMAGE_PCT_SOFT_CAP) {
        push(issues, {
          domain: 'weapon',
          severity: 'warn',
          code: 'WEAPON_TIER_STRIKE_CAP',
          message: `${familyId} T${tier.tierNumber} strikeDamagePct ${pct}% > soft cap ${WEAPON_BALANCE_TIER_STRIKE_DAMAGE_PCT_SOFT_CAP}%.`,
        });
      }
      if (pct > 0) cumulative += pct;
    });
    if (cumulative > WEAPON_BALANCE_CUMULATIVE_STRIKE_DAMAGE_PCT_SOFT_CAP) {
      push(issues, {
        domain: 'weapon',
        severity: 'warn',
        code: 'WEAPON_CUMULATIVE_STRIKE_CAP',
        message: `${familyId} cumulative positive strikeDamagePct ${cumulative}% > soft cap ${WEAPON_BALANCE_CUMULATIVE_STRIKE_DAMAGE_PCT_SOFT_CAP}%.`,
      });
    }
    if (!family.tiers.some((t) => t.tierNumber === 1)) {
      push(issues, {
        domain: 'weapon',
        severity: 'error',
        code: 'WEAPON_MISSING_T1',
        message: `${familyId} missing tier 1 definition.`,
      });
    }
  });
}

function validateTrinkets(issues: BalanceValidationIssue[]): void {
  if (MARKED_SHELF_DISCOUNT_PCT > TRINKET_BALANCE_MAX_MARKET_DISCOUNT_PCT) {
    push(issues, {
      domain: 'trinket',
      severity: 'warn',
      code: 'TRINKET_DISCOUNT_OVER_CAP',
      message: `Marked Shelf discount ${MARKED_SHELF_DISCOUNT_PCT}% exceeds soft cap ${TRINKET_BALANCE_MAX_MARKET_DISCOUNT_PCT}%.`,
    });
  }
}

function validateRunStructure(issues: BalanceValidationIssue[], runSims: boolean): void {
  if (!runSims) return;
  const batch = simulateRunTreeGenerations(24, { depthIndex: 1, seedBase: 'balance-validate-trees' });
  if (batch.sanctuaryRate < 0.85) {
    push(issues, {
      domain: 'run_structure',
      severity: 'warn',
      code: 'SANCTUARY_RARE',
      message: `Only ${Math.round(batch.sanctuaryRate * 100)}% of chapter trees include a sanctuary (expected most).`,
    });
  }
  if (batch.extractionRate < 0.4) {
    push(issues, {
      domain: 'run_structure',
      severity: 'warn',
      code: 'EXTRACTION_RARE',
      message: `Only ${Math.round(batch.extractionRate * 100)}% of chapter trees include an extraction node.`,
    });
  }
  const combatShare = (batch.typeTotals.get('COMBAT') ?? 0) / Math.max(1, batch.totalNodes);
  if (combatShare > 0.75) {
    push(issues, {
      domain: 'run_structure',
      severity: 'info',
      code: 'COMBAT_HEAVY_TREE',
      message: `Combat nodes are ${Math.round(combatShare * 100)}% of aggregated tree nodes — verify reward density.`,
    });
  }
}

function validateExtractionInvariants(issues: BalanceValidationIssue[]): void {
  try {
    const routingIssues = validatePostRunCargoRoutingPipeline(null);
    routingIssues.forEach((issue) => {
      push(issues, {
        domain: 'extraction',
        severity: issue.severity,
        code: issue.resourceId ? `ROUTING_${issue.resourceId}` : 'ROUTING_PIPELINE',
        message: issue.message,
      });
    });
  } catch (error) {
    push(issues, {
      domain: 'extraction',
      severity: 'error',
      code: 'ROUTING_PIPELINE_THROW',
      message: `Post-run routing pipeline threw during validation: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}

function rateOutsideBand(rate: number, band: { min: number; max: number }, slack = 0.15): boolean {
  return rate < band.min - slack || rate > band.max + slack;
}

function validateCareerTargets(
  issues: BalanceValidationIssue[],
  history: CareerBalanceHistory | null | undefined,
): void {
  const runs = history?.runs ?? [];
  if (runs.length < 5) {
    push(issues, {
      domain: 'telemetry',
      severity: 'info',
      code: 'CAREER_SAMPLE_SMALL',
      message: `Career history has ${runs.length} run(s) — need ≥5 to compare early target bands.`,
    });
    return;
  }

  const n = runs.length;
  const extractRate = runs.filter((r) => r.extractionType === 'EXTRACT').length / n;
  const reachD2 = runs.filter((r) => r.districtLayer >= 2 || r.nodesCleared >= 10).length / n;
  const reachD3 = runs.filter((r) => r.districtLayer >= 3).length / n;
  const fullClear = runs.filter((r) => r.bossesDefeated >= 3 || (r.districtLayer >= 3 && r.bossesDefeated > 0 && r.nodesCleared >= 40)).length / n;
  const early = BALANCE_TARGET_EARLY;

  if (rateOutsideBand(extractRate, early.anyExtraction)) {
    push(issues, {
      domain: 'telemetry',
      severity: 'warn',
      code: 'TARGET_EXTRACT_RATE',
      message: `Last-${n} extract rate ${Math.round(extractRate * 100)}% vs early target ${early.anyExtraction.min * 100}–${early.anyExtraction.max * 100}%.`,
    });
  }
  if (rateOutsideBand(reachD2, early.reachDepth2)) {
    push(issues, {
      domain: 'telemetry',
      severity: 'warn',
      code: 'TARGET_REACH_D2',
      message: `Last-${n} reach D2+ ${Math.round(reachD2 * 100)}% vs early target ${early.reachDepth2.min * 100}–${early.reachDepth2.max * 100}%.`,
    });
  }
  if (rateOutsideBand(reachD3, early.reachDepth3)) {
    push(issues, {
      domain: 'telemetry',
      severity: 'warn',
      code: 'TARGET_REACH_D3',
      message: `Last-${n} reach D3 ${Math.round(reachD3 * 100)}% vs early target ${early.reachDepth3.min * 100}–${early.reachDepth3.max * 100}%.`,
    });
  }
  if (rateOutsideBand(fullClear, early.fullClear)) {
    push(issues, {
      domain: 'telemetry',
      severity: 'info',
      code: 'TARGET_FULL_CLEAR',
      message: `Last-${n} full-clear proxy ${Math.round(fullClear * 100)}% vs early target ${early.fullClear.min * 100}–${early.fullClear.max * 100}%.`,
    });
  }
}

export function validateBalance(
  opts?: BalanceValidationOptions,
): BalanceValidationIssue[] {
  const issues: BalanceValidationIssue[] = [];
  const runSims = opts?.runSims !== false;

  validateCombatScaling(issues);
  validateRewardTables(issues);
  validateComposition(issues);
  validateEconomyExploits(issues);
  validateContracts(issues);
  validateOperations(issues, runSims);
  validateWeapons(issues);
  validateTrinkets(issues);
  validateRunStructure(issues, runSims);
  validateExtractionInvariants(issues);
  validateCareerTargets(issues, opts?.careerBalanceHistory);

  return issues;
}

export function formatBalanceValidationReport(opts?: BalanceValidationOptions): string {
  const issues = validateBalance(opts);
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');
  const infos = issues.filter((i) => i.severity === 'info');

  const lines = [
    '══════════════════════════════════════',
    'BALANCE VALIDATION — Phase D',
    '══════════════════════════════════════',
    `issues: ${issues.length} (errors ${errors.length} / warns ${warns.length} / info ${infos.length})`,
    'Guide-only — does not hard-gate gameplay.',
    '',
  ];

  if (issues.length === 0) {
    lines.push('No balance warnings. Configs look coherent vs Phase A–C targets.');
    return lines.join('\n');
  }

  const order: BalanceValidationSeverity[] = ['error', 'warn', 'info'];
  order.forEach((severity) => {
    const subset = issues.filter((i) => i.severity === severity);
    if (subset.length === 0) return;
    lines.push(severity.toUpperCase());
    subset.forEach((i) => {
      lines.push(`  [${i.domain}/${i.code}] ${i.message}`);
    });
    lines.push('');
  });

  lines.push('Tune in src/data/balance/* — re-run after edits.');
  return lines.join('\n');
}
