import { CRAFTING_REGISTRY } from './craftingRegistry';
import {
  ALL_RESOURCE_ITEM_IDS,
  CONTRACT_TARGET_RESOURCE_IDS,
  RESOURCE_REGISTRY,
  RESOURCES_BY_CATEGORY,
  canResourceSpawnInSector,
} from './resourceRegistry';
import {
  UNSTABLE_CARRIED_EFFECTS,
} from './unstableCargoEffectsEngine';
import { UNSTABLE_CARRIED_EFFECT_IDS } from '../types/unstableCargoEffects';
import type { UnstableCargoEffectId } from '../types/unstableCargoEffects';
import type { ResourceItemId } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';

export interface ResourceValidationIssue {
  severity: 'warn' | 'error';
  resourceId?: ResourceItemId;
  recipeId?: string;
  message: string;
}

const CRAFTING_RELATED_TAGS = new Set([
  'CRAFTING_MATERIAL',
  'WEAPON_BLUEPRINT_MATERIAL',
  'STARTING_REQUISITION_MATERIAL',
  'SCANNER_INTEL',
  'EXPLOSIVE_MATERIAL',
  'OCCULT_MATERIAL',
  'CONSUMABLE_MATERIAL',
  'SECTOR_MATERIAL',
  'DEFENSIVE_MATERIAL',
  'SURVIVAL_MATERIAL',
  'EXTRACTION_MATERIAL',
  'TECH_MATERIAL',
  'INDUSTRIAL_MATERIAL',
  'WEAPON_MATERIAL',
  'CONTAINMENT_MATERIAL',
  'APPRAISAL_MATERIAL',
  'ECHO_MATERIAL',
  'RESONANCE_MATERIAL',
  'ANCHOR_MATERIAL',
  'DEPTH_MATERIAL',
  'BREACH_MATERIAL',
  'SCANNER_MATERIAL',
  'MASTERWORK_MATERIAL',
]);

function pushIssue(
  issues: ResourceValidationIssue[],
  issue: ResourceValidationIssue,
): void {
  issues.push(issue);
}

/** Validates resource definitions and crafting recipe compatibility. */
export function validateResourceRegistry(): ResourceValidationIssue[] {
  const issues: ResourceValidationIssue[] = [];

  ALL_RESOURCE_ITEM_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];

    if (!def.category) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing category.',
      });
    }

    if (def.usageTags.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing usage tags.',
      });
    }

    if (def.canBeCraftingIngredient && !def.usageTags.some((tag) => CRAFTING_RELATED_TAGS.has(tag))) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Resource marked craftable but has no crafting-related usage tag.',
      });
    }

    if (def.usageTags.includes('FENCE_VALUE') && !def.canBeSoldToFence) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Resource tagged FENCE_VALUE but cannot be sold to fence.',
      });
    }

    if (def.canBeSoldToFence && def.sellValue <= 0) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Fence-eligible resource has zero sell value.',
      });
    }

    if (def.canStack && def.maxStack <= 1) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Stackable resource has maxStack <= 1.',
      });
    }

    if (!def.canStack && def.maxStack > 1) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Non-stackable resource has maxStack > 1.',
      });
    }

    if (def.gridWidth < 1 || def.gridHeight < 1) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource has invalid grid dimensions.',
      });
    }

    if (def.canBeContractTarget && def.validSectorIds.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Contract target resource has no valid sector spawn info.',
      });
    }

    if (!def.sourceHint?.trim()) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing sourceHint.',
      });
    }

    if (!def.rarity) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing rarity.',
      });
    }

    if (!def.intendedUses || def.intendedUses.length < 2) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource must declare at least 2 intendedUses.',
      });
    }

    if (
      def.category === 'CONTRABAND'
      && def.usageTags.includes('UNIDENTIFIED_CONTAINER')
      && def.canOpenInRun
    ) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Sealed contraband container must not be openable in-run.',
      });
    }

    if (
      def.category === 'CONTRABAND'
      && def.usageTags.includes('APPRAISABLE')
      && !def.canOpenAtHub
      && !def.canBeSoldToFence
    ) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Appraisable contraband has neither hub open nor fence sell path.',
      });
    }

    const hasEconomyUse = def.canBeCraftingIngredient
      || def.canBeSoldToFence
      || def.canBeContractTarget
      || def.canBeOperationTarget
      || def.canOpenAtHub;
    if (!hasEconomyUse) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Resource has no craft/fence/contract/operation/open use.',
      });
    }
  });

  CRAFTING_REGISTRY.forEach((recipe) => {
    recipe.requirements.forEach((req) => {
      const def = RESOURCE_REGISTRY[req.resourceId];
      if (!def.canBeCraftingIngredient) {
        pushIssue(issues, {
          severity: 'error',
          resourceId: req.resourceId,
          recipeId: recipe.id,
          message: `Recipe "${recipe.label}" uses non-crafting resource as ingredient.`,
        });
      }
    });
  });

  CONTRACT_TARGET_RESOURCE_IDS.forEach((resourceId) => {
    if (RESOURCE_REGISTRY[resourceId].validSectorIds.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Contract target cannot spawn in any sector.',
      });
    }
  });

  validateUnstableCarriedEffects(issues);

  return issues;
}

function validateUnstableCarriedEffects(issues: ResourceValidationIssue[]): void {
  UNSTABLE_CARRIED_EFFECT_IDS.forEach((resourceId: UnstableCargoEffectId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    const carried = UNSTABLE_CARRIED_EFFECTS[resourceId];

    if (def.category !== 'UNSTABLE') {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Carried effect resource must be UNSTABLE category.',
      });
    }

    if (!carried.warningText.trim()) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Unstable carried effect missing warning text.',
      });
    }

    const hasUpside = carried.displayLines.some((line) => line.kind === 'upside');
    const hasDownside = carried.displayLines.some((line) => line.kind === 'downside');
    if (!hasUpside && !hasDownside) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Unstable carried effect must have at least one upside or downside display line.',
      });
    }
  });

  RESOURCES_BY_CATEGORY.UNSTABLE.forEach((resourceId) => {
    if (!(UNSTABLE_CARRIED_EFFECT_IDS as readonly string[]).includes(resourceId)) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Unstable resource has no v1 carried effect definition.',
      });
    }
  });
}

/** Logs validation issues in dev builds. */
export function logResourceValidationWarnings(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const issues = validateResourceRegistry();
  issues.forEach((issue) => {
    const prefix = issue.severity === 'error' ? '[RESOURCE ERROR]' : '[RESOURCE WARN]';
    const scope = issue.resourceId ?? issue.recipeId ?? 'unknown';
    console.warn(`${prefix} ${scope}: ${issue.message}`);
  });
}

export function validateContractResourceTarget(
  resourceId: ResourceItemId,
  sectorId: SectorId,
): { valid: boolean; reason?: string } {
  const def = RESOURCE_REGISTRY[resourceId];
  if (!def.canBeContractTarget) {
    return { valid: false, reason: 'Resource is not a contract target.' };
  }
  if (!canResourceSpawnInSector(resourceId, sectorId)) {
    return { valid: false, reason: 'Resource cannot appear in selected sector.' };
  }
  return { valid: true };
}

export function getEconomyIntelResourceIds(): ResourceItemId[] {
  return ALL_RESOURCE_ITEM_IDS.filter((id) =>
    RESOURCE_REGISTRY[id].usageTags.includes('ECONOMY_INTEL'),
  );
}

export function getScannerIntelResourceIds(): ResourceItemId[] {
  return ALL_RESOURCE_ITEM_IDS.filter((id) =>
    RESOURCE_REGISTRY[id].usageTags.includes('SCANNER_INTEL'),
  );
}

export function getCraftingIntelResourceIds(): ResourceItemId[] {
  return ALL_RESOURCE_ITEM_IDS.filter(
    (id) =>
      RESOURCE_REGISTRY[id].category === 'INTEL'
      && RESOURCE_REGISTRY[id].canBeCraftingIngredient,
  );
}
