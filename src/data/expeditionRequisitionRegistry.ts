import {
  EXPEDITION_KEEPSAKE_REGISTRY,
} from './expeditionKeepsakeRegistry';
import type {
  ExpeditionKeepsakeDefinition,
  KeepsakeId,
} from '../types/expeditionKeepsake';
import {
  ENABLED_REQUISITION_IDS,
  type RequisitionDefinition,
  type RequisitionDeploymentChoiceSpec,
  type RequisitionFamily,
  type RequisitionHook,
} from '../types/expeditionRequisition';

type RetainedKeepsakeId =
  | 'signal_compass'
  | 'ashen_cartograph'
  | 'dead_drop_receiver'
  | 'cargo_seal'
  | 'smugglers_wrap'
  | 'black_market_mark'
  | 'null_ledger'
  | 'extraction_token'
  | 'contract_seal';

const RETAINED_FAMILIES: Record<RetainedKeepsakeId, RequisitionFamily> = {
  signal_compass: 'Reconnaissance',
  ashen_cartograph: 'Reconnaissance',
  dead_drop_receiver: 'Logistics',
  cargo_seal: 'Logistics',
  smugglers_wrap: 'Logistics',
  black_market_mark: 'Bargain',
  null_ledger: 'Bargain',
  extraction_token: 'Extraction',
  contract_seal: 'Preparation',
};

function retainExpeditionDefinition(id: RetainedKeepsakeId): RequisitionDefinition {
  const donor = EXPEDITION_KEEPSAKE_REGISTRY[id] as ExpeditionKeepsakeDefinition & {
    id: RetainedKeepsakeId;
  };
  const deploymentChoice: RequisitionDeploymentChoiceSpec | undefined =
    donor.deploymentChoice?.kind === 'attunement' ||
    donor.deploymentChoice?.kind === 'route_doctrine'
      ? {
          kind: donor.deploymentChoice.kind,
          prompt: donor.deploymentChoice.prompt,
          options: donor.deploymentChoice.options,
        }
      : undefined;

  return {
    id,
    name: donor.name,
    shortName: donor.shortName,
    family: RETAINED_FAMILIES[id],
    subtype: 'Expedition',
    enabled: true,
    description: donor.description,
    flavorText: donor.flavorText,
    effectSummary: donor.effectSummary,
    runStyle: donor.runStyle,
    riskSummary: donor.riskSummary,
    tags: donor.tags,
    displayPriority: donor.displayPriority,
    hooks: donor.hooks as readonly RequisitionHook[],
    triggerMessage: donor.triggerMessage,
    deploymentChoice,
    deploymentWarning: donor.deploymentWarning?.replace(
      /\b(relic)\b/gi,
      'Requisition',
    ),
    primaryTriggerKey: donor.primaryTriggerKey,
    primaryRuntimeGuard: donor.primaryRuntimeGuard,
  };
}

function combatPreparation(
  definition: Omit<RequisitionDefinition, 'family' | 'subtype' | 'enabled' | 'tags'>,
): RequisitionDefinition {
  return {
    ...definition,
    family: 'Preparation',
    subtype: 'Combat Preparation',
    enabled: true,
    tags: ['PREPARATION', 'COMBAT', 'FINITE'],
  };
}

export const EXPEDITION_REQUISITION_REGISTRY: Readonly<
  Record<(typeof ENABLED_REQUISITION_IDS)[number], RequisitionDefinition>
> = {
  signal_compass: retainExpeditionDefinition('signal_compass'),
  ashen_cartograph: retainExpeditionDefinition('ashen_cartograph'),
  dead_drop_receiver: retainExpeditionDefinition('dead_drop_receiver'),
  cargo_seal: retainExpeditionDefinition('cargo_seal'),
  smugglers_wrap: retainExpeditionDefinition('smugglers_wrap'),
  black_market_mark: retainExpeditionDefinition('black_market_mark'),
  null_ledger: retainExpeditionDefinition('null_ledger'),
  extraction_token: retainExpeditionDefinition('extraction_token'),
  contract_seal: retainExpeditionDefinition('contract_seal'),
  hazard_pay: {
    id: 'hazard_pay',
    name: 'Hazard Pay',
    shortName: 'Hazard Pay',
    family: 'Preparation',
    subtype: 'Expedition',
    enabled: true,
    description: 'Begin a newly initialized run with 50 additional run Credits.',
    flavorText: 'Half up front. The other half is surviving long enough to spend it.',
    effectSummary: 'New run initialization: gain exactly 50 run Credits once.',
    runStyle: 'I want a larger opening logistics budget.',
    riskSummary: 'No effect after its one-time starting grant.',
    tags: ['PREPARATION', 'ECONOMY', 'FINITE'],
    displayPriority: 10,
    hooks: ['onRunStart', 'onDebriefBuild'],
    triggerMessage: 'HAZARD PAY // 50 starting Credits authorized.',
    primaryTriggerKey: 'hazard_pay_run_start',
    primaryRuntimeGuard: 'run',
  },
  adrenaline_primer: combatPreparation({
    id: 'adrenaline_primer',
    name: 'Adrenaline Primer',
    shortName: 'Primer',
    description:
      'Gain 1 temporary AP on the first player turn of each of the first three eligible Standard or Elite combats.',
    flavorText: 'A measured dose for the first seconds that decide the fight.',
    effectSummary: 'First turn of first 3 eligible combats: +1 temporary AP.',
    runStyle: 'I want bounded opening tempo.',
    riskSummary: 'Bosses, Dirty Extraction, and non-standard encounters are excluded.',
    displayPriority: 11,
    hooks: ['onCombatEncounterStart', 'onFirstPlayerTurn', 'onCombatEncounterEnd', 'onDebriefBuild'],
    triggerMessage: 'ADRENALINE PRIMER // +1 temporary AP.',
    primaryTriggerKey: 'adrenaline_primer_first_turn',
    primaryRuntimeGuard: 'encounter',
    combatEffect: {
      kind: 'FIRST_TURN_AP',
      amount: 1,
      eligibleEncounterLimit: 3,
      totalTriggerLimit: 3,
    },
  }),
  reinforced_trench_coat: combatPreparation({
    id: 'reinforced_trench_coat',
    name: 'Reinforced Trench-Coat',
    shortName: 'Trench-Coat',
    description:
      'Halve final direct hostile HP damage throughout the first eligible Elite encounter.',
    flavorText: 'Layered plates for one fight worth surviving.',
    effectSummary: 'First eligible Elite: 50% less final direct hostile HP damage.',
    runStyle: 'I am preparing for one dangerous Elite engagement.',
    riskSummary: 'Does not affect status, environmental, objective, self, or cost damage.',
    displayPriority: 12,
    hooks: [
      'onCombatEncounterStart',
      'onDirectHostileDamage',
      'onCombatEncounterEnd',
      'onDebriefBuild',
    ],
    triggerMessage: 'REINFORCED TRENCH-COAT // Direct hostile damage halved.',
    primaryTriggerKey: 'reinforced_trench_coat_first_elite',
    primaryRuntimeGuard: 'run',
    combatEffect: {
      kind: 'FIRST_ELITE_DIRECT_DAMAGE_REDUCTION',
      reductionPct: 50,
      eligibleEncounterLimit: 1,
    },
  }),
  hollow_point_requisition: combatPreparation({
    id: 'hollow_point_requisition',
    name: 'Hollow-Point Kit',
    shortName: 'Hollow-Point',
    description:
      'Add 10 percentage points to crit chance for eligible direct action damage during Depth 1.',
    flavorText: 'One depth of tuned ammunition. No resupply.',
    effectSummary: 'Depth 1 direct action damage: +10 percentage points crit chance.',
    runStyle: 'I want early precision without permanent growth.',
    riskSummary: 'Expires permanently when the run leaves Depth 1.',
    displayPriority: 13,
    hooks: ['onPlayerCritChance', 'onDebriefBuild'],
    triggerMessage: 'HOLLOW-POINT KIT // Depth 1 crit chance increased by 10 points.',
    primaryTriggerKey: 'hollow_point_depth_one',
    primaryRuntimeGuard: 'run',
    combatEffect: {
      kind: 'DEPTH_ONE_CRIT_CHANCE_POINTS',
      percentagePoints: 10,
      maximumDepth: 1,
    },
  }),
  kinetic_battery: combatPreparation({
    id: 'kinetic_battery',
    name: 'Kinetic Battery',
    shortName: 'Battery',
    description:
      'In the first three qualifying layered-defense encounters, the first eligible damaging action gains Armor and Ward Pierce 1.',
    flavorText: 'Three stored discharges, each tuned to breach the first layer.',
    effectSummary: 'First protected-target action in 3 encounters: Armor Pierce 1, Ward Pierce 1.',
    runStyle: 'I want three bounded openings against layered defenses.',
    riskSummary: 'Pierces one applicable layer for the action; never strips or breaks it.',
    displayPriority: 14,
    hooks: ['onPlayerDamagingAction', 'onCombatEncounterEnd', 'onDebriefBuild'],
    triggerMessage: 'KINETIC BATTERY // Protected target action gains Pierce 1.',
    primaryTriggerKey: 'kinetic_battery_protected_action',
    primaryRuntimeGuard: 'encounter',
    combatEffect: {
      kind: 'FIRST_PROTECTED_TARGET_ACTION_PIERCE',
      armorPierceLayers: 1,
      wardPierceLayers: 1,
      eligibleEncounterLimit: 3,
      empoweredActionLimit: 3,
    },
  }),
  chalk_line_ward: combatPreparation({
    id: 'chalk_line_ward',
    name: 'Chalk-Line Ward',
    shortName: 'Ward',
    description:
      'Negate the first eligible hostile non-damage debuff or control effect in each of the first three eligible combats.',
    flavorText: 'Three circles. Step outside one and it is gone.',
    effectSummary: 'First 3 eligible combats: prevent the first hostile debuff or control effect.',
    runStyle: 'I want finite protection from hostile control.',
    riskSummary: 'Each encounter is consumed at start even when no eligible effect occurs.',
    displayPriority: 15,
    hooks: [
      'onCombatEncounterStart',
      'onHostileEffectApply',
      'onCombatEncounterEnd',
      'onDebriefBuild',
    ],
    triggerMessage: 'CHALK-LINE WARD // Hostile effect negated.',
    primaryTriggerKey: 'chalk_line_ward_hostile_effect',
    primaryRuntimeGuard: 'encounter',
    combatEffect: {
      kind: 'FIRST_HOSTILE_CONTROL_PREVENTION',
      eligibleEncounterLimit: 3,
      preventionPerEncounter: 1,
      totalPreventionLimit: 3,
    },
  }),
};

export const EXPEDITION_REQUISITION_DEFINITIONS: readonly RequisitionDefinition[] =
  ENABLED_REQUISITION_IDS.map((id) => EXPEDITION_REQUISITION_REGISTRY[id]);

export function isRequisitionId(value: unknown): value is (typeof ENABLED_REQUISITION_IDS)[number] {
  return typeof value === 'string' && ENABLED_REQUISITION_IDS.includes(value as never);
}

export function isRetainedKeepsakeRequisition(
  id: (typeof ENABLED_REQUISITION_IDS)[number],
): id is RetainedKeepsakeId {
  return id in RETAINED_FAMILIES;
}

export function toRetainedKeepsakeId(id: string): KeepsakeId | null {
  return id in RETAINED_FAMILIES ? (id as KeepsakeId) : null;
}
