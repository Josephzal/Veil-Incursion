import type { ResourceItemId } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import { RESOURCE_REGISTRY, canResourceSpawnInSector, getResourceDisplayName } from './resourceRegistry';
import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';
import { SECTOR_RESOURCE_IDS } from './contractSponsorPreferences';
import { ALL_SECTOR_IDS } from './sectorBiomeBridge';
import {
  getSectorResourceTable,
  sectorPrimaryResourcePool,
  sectorResourcesByBand,
} from './sectorResourceTableEngine';
import { validateResourceRegistry } from './resourceValidation';
import { validateSealedCargoPipeline } from './sealedCargoValidationEngine';
import { CRAFTING_REGISTRY } from './craftingRegistry';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';
import { WEAPON_REGISTRY } from './weaponRegistry';
import {
  ECONOMY_VALUE_LANE_BASE_SELL_BANDS,
  formatValueLanePolicyBrief,
  resolveFenceUnitValue,
} from './economyValueLaneEngine';
import { CONTRACT_TARGET_RESOURCE_IDS } from './resourceRegistry';

/**
 * Phase 2J — contract / operation / market / appraisal integration checks.
 */

export interface EconomyIntegrationIssue {
  severity: 'error' | 'warn';
  area: 'CONTRACT' | 'OPERATION' | 'FENCE' | 'APPRAISAL' | 'RECIPE' | 'SECTOR_BIAS' | 'VALUE_LANE';
  message: string;
}

/** Contract bias pool for a sector: PRIMARY + RARE from 2D tables (+ legacy map). */
export function contractBiasResourcesForSector(sectorId: SectorId): ResourceItemId[] {
  const fromTable = [
    ...sectorPrimaryResourcePool(sectorId),
    ...sectorResourcesByBand(sectorId, 'RARE'),
  ];
  const fromLegacy = SECTOR_RESOURCE_IDS[sectorId] ?? [];
  return [...new Set([...fromTable, ...fromLegacy])];
}

export function validateSectorContractBiasSync(): EconomyIntegrationIssue[] {
  const issues: EconomyIntegrationIssue[] = [];
  ALL_SECTOR_IDS.forEach((sectorId) => {
    const tableIds = new Set(getSectorResourceTable(sectorId).resources.map((e) => e.resourceId));
    const legacy = SECTOR_RESOURCE_IDS[sectorId] ?? [];
    legacy.forEach((id) => {
      if (!tableIds.has(id)) {
        issues.push({
          severity: 'warn',
          area: 'SECTOR_BIAS',
          message: `${sectorId} SECTOR_RESOURCE_IDS includes ${id} not in sector farming table.`,
        });
      }
      if (!canResourceSpawnInSector(id, sectorId)) {
        issues.push({
          severity: 'error',
          area: 'SECTOR_BIAS',
          message: `${sectorId} bias resource ${id} cannot spawn in sector.`,
        });
      }
    });
  });
  return issues;
}

export function validateContractTargetFlags(): EconomyIntegrationIssue[] {
  const issues: EconomyIntegrationIssue[] = [];
  CONTRACT_TARGET_RESOURCE_IDS.forEach((id) => {
    const def = RESOURCE_REGISTRY[id];
    if (!def.canBeContractTarget) {
      issues.push({
        severity: 'error',
        area: 'CONTRACT',
        message: `${id} listed as contract target but canBeContractTarget=false.`,
      });
    }
    if (def.validSectorIds.length === 0) {
      issues.push({
        severity: 'error',
        area: 'CONTRACT',
        message: `${id} is contract target with no validSectorIds.`,
      });
    }
  });
  return issues;
}

export function validateOperationTargetFlags(): EconomyIntegrationIssue[] {
  const issues: EconomyIntegrationIssue[] = [];
  ECONOMY_V1_RESOURCE_IDS.forEach((id) => {
    const def = RESOURCE_REGISTRY[id];
    if (!def.canBeOperationTarget) return;
    if (def.validSectorIds.length === 0) {
      issues.push({
        severity: 'error',
        area: 'OPERATION',
        message: `${id} is operation target with no validSectorIds.`,
      });
    }
  });
  return issues;
}

export function validateContrabandNotCrafted(): EconomyIntegrationIssue[] {
  const issues: EconomyIntegrationIssue[] = [];
  const bump = (recipeLabel: string, resourceId: ResourceItemId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    if (def.category === 'CONTRABAND' || !def.canBeCraftingIngredient) {
      if (def.category === 'CONTRABAND' || def.primaryRole === 'UNIDENTIFIED_CONTAINER') {
        issues.push({
          severity: 'error',
          area: 'RECIPE',
          message: `Recipe "${recipeLabel}" uses contraband/sealed ${resourceId} as craft input.`,
        });
      }
    }
  };

  CRAFTING_REGISTRY.forEach((recipe) => {
    recipe.requirements.forEach((req) => bump(recipe.label, req.resourceId));
  });
  buildRunItemCraftingRecipes().forEach((recipe) => {
    recipe.requirements.forEach((req) => bump(recipe.label, req.resourceId));
  });
  Object.values(WEAPON_REGISTRY).forEach((family) => {
    family.unlockRequirement.forEach((req) => bump(family.name, req.resourceId));
  });
  return issues;
}

export function validateFenceValueLanes(): EconomyIntegrationIssue[] {
  const issues: EconomyIntegrationIssue[] = [];
  ECONOMY_V1_RESOURCE_IDS.forEach((id) => {
    const def = RESOURCE_REGISTRY[id];
    if (def.primaryRole === 'ROUTE_INTEL') {
      if (def.canBeSoldToFence) {
        issues.push({
          severity: 'error',
          area: 'FENCE',
          message: `Route intel ${id} must not be fenceable.`,
        });
      }
      return;
    }
    if (!def.canBeSoldToFence) return;
    const band = ECONOMY_VALUE_LANE_BASE_SELL_BANDS[def.category];
    if (def.sellValue < band.min || def.sellValue > band.max) {
      issues.push({
        severity: 'warn',
        area: 'VALUE_LANE',
        message: `${getResourceDisplayName(id)} (${def.category}) sellValue ${def.sellValue} outside lane band ${band.min}–${band.max}.`,
      });
    }
    const unit = resolveFenceUnitValue(id);
    if (unit <= 0) {
      issues.push({
        severity: 'error',
        area: 'FENCE',
        message: `${id} fenceable but resolveFenceUnitValue=${unit}.`,
      });
    }
  });
  return issues;
}

export function buildEconomyIntegrationIssues(): EconomyIntegrationIssue[] {
  return [
    ...validateSectorContractBiasSync(),
    ...validateContractTargetFlags(),
    ...validateOperationTargetFlags(),
    ...validateContrabandNotCrafted(),
    ...validateFenceValueLanes(),
    ...validateResourceRegistry()
      .filter((i) => i.severity === 'error')
      .map((i) => ({
        severity: 'error' as const,
        area: 'RECIPE' as const,
        message: i.message,
      })),
    ...validateSealedCargoPipeline()
      .filter((i) => i.severity === 'error')
      .map((i) => ({
        severity: 'error' as const,
        area: 'APPRAISAL' as const,
        message: i.message,
      })),
  ];
}

export function formatFenceEligibilityMatrix(): string {
  const lines = ['=== FENCE ELIGIBILITY MATRIX ===', ''];
  (['STABLE', 'INTEL', 'UNSTABLE', 'CONTRABAND'] as const).forEach((category) => {
    const ids = ECONOMY_V1_RESOURCE_IDS.filter((id) => RESOURCE_REGISTRY[id].category === category);
    lines.push(`${category}:`);
    ids.forEach((id) => {
      const def = RESOURCE_REGISTRY[id];
      const fence = def.canBeSoldToFence
        ? `fence ${resolveFenceUnitValue(id)} CR (base ${def.sellValue})`
        : 'not fenceable';
      const craft = def.canBeCraftingIngredient ? 'craft' : 'no-craft';
      const contract = def.canBeContractTarget ? 'contract' : '—';
      const op = def.canBeOperationTarget ? 'op' : '—';
      lines.push(`  ${getResourceDisplayName(id).padEnd(22)} ${fence} // ${craft} // ${contract} // ${op}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

export function formatEconomyIntegrationReport(): string {
  const issues = buildEconomyIntegrationIssues();
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');

  const contractTargets = CONTRACT_TARGET_RESOURCE_IDS.length;
  const opTargets = ECONOMY_V1_RESOURCE_IDS.filter((id) => RESOURCE_REGISTRY[id].canBeOperationTarget).length;
  const fenceable = ECONOMY_V1_RESOURCE_IDS.filter((id) => RESOURCE_REGISTRY[id].canBeSoldToFence).length;
  const sealed = ECONOMY_V1_RESOURCE_IDS.filter((id) => (
    RESOURCE_REGISTRY[id].usageTags.includes('APPRAISABLE')
    || RESOURCE_REGISTRY[id].primaryRole === 'UNIDENTIFIED_CONTAINER'
    || RESOURCE_REGISTRY[id].canOpenAtHub
  )).length;

  const lines = [
    '=== ECONOMY SPINE // PHASE 2J — INTEGRATION REPORT ===',
    '',
    formatValueLanePolicyBrief(),
    '',
    `Contract-target resources: ${contractTargets}`,
    `Operation-target resources: ${opTargets}`,
    `Fenceable resources: ${fenceable}`,
    `Appraisable / sealed: ${sealed}`,
    '',
    '-- SECTOR BIAS (PRIMARY+RARE) --',
    ...ALL_SECTOR_IDS.map((sectorId) => (
      `  ${sectorId}: ${contractBiasResourcesForSector(sectorId).map((id) => getResourceDisplayName(id, true)).join(', ')}`
    )),
    '',
    `Issues: ${issues.length} (${errors.length} errors / ${warns.length} warns)`,
    ...errors.slice(0, 16).map((i) => `  [error/${i.area}] ${i.message}`),
    ...warns.slice(0, 12).map((i) => `  [warn/${i.area}] ${i.message}`),
    '',
    errors.length === 0
      ? 'PASS — contracts/ops/fence/appraisal integration checks clean.'
      : 'FAIL — fix integration errors before tuning.',
    'Rule: no impossible targets; contraband is sell/deliver/appraise — not craft.',
  ];

  return lines.join('\n');
}
