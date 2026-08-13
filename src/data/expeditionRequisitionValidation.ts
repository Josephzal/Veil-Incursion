import {
  COMBAT_PREPARATION_REQUISITION_IDS,
  DEFERRED_REQUISITION_IDS,
  ENABLED_REQUISITION_IDS,
  type RequisitionCombatEffectSignature,
} from '../types/expeditionRequisition';
import {
  EXPEDITION_REQUISITION_DEFINITIONS,
  EXPEDITION_REQUISITION_REGISTRY,
} from './expeditionRequisitionRegistry';
import { REQUISITION_DONOR_DISPOSITIONS } from './requisitionDonorDisposition';

export interface RequisitionValidationIssue {
  severity: 'error' | 'warn';
  requisitionId?: string;
  message: string;
}

const APPROVED_COMBAT_SIGNATURES: Readonly<
  Record<(typeof COMBAT_PREPARATION_REQUISITION_IDS)[number], RequisitionCombatEffectSignature>
> = {
  adrenaline_primer: {
    kind: 'FIRST_TURN_AP',
    amount: 1,
    eligibleEncounterLimit: 3,
    totalTriggerLimit: 3,
  },
  reinforced_trench_coat: {
    kind: 'FIRST_ELITE_DIRECT_DAMAGE_REDUCTION',
    reductionPct: 50,
    eligibleEncounterLimit: 1,
  },
  hollow_point_requisition: {
    kind: 'DEPTH_ONE_CRIT_CHANCE_POINTS',
    percentagePoints: 10,
    maximumDepth: 1,
  },
  kinetic_battery: {
    kind: 'FIRST_PROTECTED_TARGET_ACTION_PIERCE',
    armorPierceLayers: 1,
    wardPierceLayers: 1,
    eligibleEncounterLimit: 3,
    empoweredActionLimit: 3,
  },
  chalk_line_ward: {
    kind: 'FIRST_HOSTILE_CONTROL_PREVENTION',
    eligibleEncounterLimit: 3,
    preventionPerEncounter: 1,
    totalPreventionLimit: 3,
  },
};
const APPROVED_REQUISITION_HOOKS = new Set([
  'onRunStart',
  'onScannerGenerate',
  'onNodeReveal',
  'onNodeSelected',
  'onNodeCompleted',
  'onCargoAdded',
  'onCargoBanked',
  'onMarketOpen',
  'onMarketPurchase',
  'onExtractionNodeReveal',
  'onExtractionStart',
  'onDirtyExtractionStart',
  'onContractAccepted',
  'onContractResolve',
  'onDebriefBuild',
  'onCombatEncounterStart',
  'onFirstPlayerTurn',
  'onDirectHostileDamage',
  'onPlayerCritChance',
  'onPlayerDamagingAction',
  'onHostileEffectApply',
  'onCombatEncounterEnd',
]);

function sameSignature(
  actual: RequisitionCombatEffectSignature | undefined,
  expected: RequisitionCombatEffectSignature,
): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export function validateExpeditionRequisitionRegistry(): RequisitionValidationIssue[] {
  const issues: RequisitionValidationIssue[] = [];
  const ids = EXPEDITION_REQUISITION_DEFINITIONS.map((definition) => definition.id);
  const idSet = new Set(ids);

  if (ids.length !== 15) {
    issues.push({ severity: 'error', message: `Enabled roster has ${ids.length} entries; expected 15.` });
  }
  if (idSet.size !== ids.length) {
    issues.push({ severity: 'error', message: 'Enabled roster contains duplicate canonical IDs.' });
  }
  for (const id of ENABLED_REQUISITION_IDS) {
    if (!idSet.has(id)) {
      issues.push({ severity: 'error', requisitionId: id, message: 'Enabled definition is missing.' });
    }
  }
  for (const id of DEFERRED_REQUISITION_IDS) {
    if (id in EXPEDITION_REQUISITION_REGISTRY) {
      issues.push({
        severity: 'error',
        requisitionId: id,
        message: 'Deferred compatibility ID entered the enabled registry.',
      });
    }
  }

  const families = new Set(EXPEDITION_REQUISITION_DEFINITIONS.map((definition) => definition.family));
  for (const family of ['Logistics', 'Reconnaissance', 'Extraction', 'Preparation', 'Bargain']) {
    if (!families.has(family as never)) {
      issues.push({ severity: 'error', message: `Enabled roster is missing family '${family}'.` });
    }
  }

  const combatIds = EXPEDITION_REQUISITION_DEFINITIONS
    .filter((definition) => definition.subtype === 'Combat Preparation')
    .map((definition) => definition.id);
  if (combatIds.length !== 5) {
    issues.push({
      severity: 'error',
      message: `Combat Preparation roster has ${combatIds.length} entries; expected 5.`,
    });
  }

  for (const definition of EXPEDITION_REQUISITION_DEFINITIONS) {
    const approvedCombatId = COMBAT_PREPARATION_REQUISITION_IDS.includes(definition.id as never);
    const combatHooks = definition.hooks.filter((hook) =>
      [
        'onCombatEncounterStart',
        'onFirstPlayerTurn',
        'onDirectHostileDamage',
        'onPlayerCritChance',
        'onPlayerDamagingAction',
        'onHostileEffectApply',
        'onCombatEncounterEnd',
      ].includes(hook),
    );
    const unknownHooks = definition.hooks.filter(
      (hook) => !APPROVED_REQUISITION_HOOKS.has(hook),
    );
    if (unknownHooks.length > 0) {
      issues.push({
        severity: 'error',
        requisitionId: definition.id,
        message: `Requisition registers retired hooks: ${unknownHooks.join(', ')}.`,
      });
    }

    if (definition.subtype === 'Combat Preparation' && definition.family !== 'Preparation') {
      issues.push({
        severity: 'error',
        requisitionId: definition.id,
        message: 'Combat Preparation entry must belong to Preparation.',
      });
    }
    if (!approvedCombatId && (definition.combatEffect || combatHooks.length > 0)) {
      issues.push({
        severity: 'error',
        requisitionId: definition.id,
        message: 'Non-allowlisted Requisition registers combat behavior.',
      });
    }
    if (
      approvedCombatId &&
      !sameSignature(
        definition.combatEffect,
        APPROVED_COMBAT_SIGNATURES[
          definition.id as (typeof COMBAT_PREPARATION_REQUISITION_IDS)[number]
        ],
      )
    ) {
      issues.push({
        severity: 'error',
        requisitionId: definition.id,
        message: 'Combat Preparation signature differs from its finite approved contract.',
      });
    }
  }

  return issues;
}

export function validateRequisitionDonorDispositions(): RequisitionValidationIssue[] {
  const issues: RequisitionValidationIssue[] = [];
  const ids = REQUISITION_DONOR_DISPOSITIONS.map((entry) => entry.donorId);
  if (ids.length !== 39) {
    issues.push({ severity: 'error', message: `Disposition table has ${ids.length} rows; expected 39.` });
  }
  if (new Set(ids).size !== 39) {
    issues.push({ severity: 'error', message: 'Disposition table donor IDs are not unique.' });
  }

  const expectedCounts: Partial<Record<(typeof REQUISITION_DONOR_DISPOSITIONS)[number]['disposition'], number>> = {
    enabled_self: 9,
    map_to_enabled: 12,
    deferred_compat: 12,
    map_to_deferred: 1,
    strip: 5,
  };
  for (const [kind, expected] of Object.entries(expectedCounts)) {
    const actual = REQUISITION_DONOR_DISPOSITIONS.filter(
      (entry) => entry.disposition === kind,
    ).length;
    if (actual !== expected) {
      issues.push({
        severity: 'error',
        message: `Disposition '${kind}' has ${actual} rows; expected ${expected}.`,
      });
    }
  }

  return issues;
}

export function validateExpeditionRequisitionProof(): RequisitionValidationIssue[] {
  return [
    ...validateExpeditionRequisitionRegistry(),
    ...validateRequisitionDonorDispositions(),
  ];
}
