import type {
  CompositionRoleSlot,
  EncounterCompositionTemplate,
  EncounterCompositionTemplateId,
} from '../types/encounterComposition';

const bruiserOrAssassin: CompositionRoleSlot = {
  roles: ['BRUISER', 'ASSASSIN'],
  required: true,
};
const swarmOptional: CompositionRoleSlot = {
  roles: ['SWARM', 'ASSASSIN'],
  required: false,
};
const bruiserRequired: CompositionRoleSlot = {
  roles: ['BRUISER'],
  required: true,
};
const disruptorOrAssassin: CompositionRoleSlot = {
  roles: ['DISRUPTOR', 'ASSASSIN'],
  required: true,
};
const disruptorRequired: CompositionRoleSlot = {
  roles: ['DISRUPTOR'],
  required: true,
};
const supportOptional: CompositionRoleSlot = {
  roles: ['SUPPORT'],
  required: false,
};
const artilleryRequired: CompositionRoleSlot = {
  roles: ['ARTILLERY'],
  required: true,
};
const anchorLinkedRequired: CompositionRoleSlot = {
  roles: ['ANCHOR_LINKED'],
  required: true,
};

export const ENCOUNTER_COMPOSITION_TEMPLATES: Record<
  EncounterCompositionTemplateId,
  EncounterCompositionTemplate
> = {
  SIMPLE_PATROL: {
    id: 'SIMPLE_PATROL',
    name: 'Simple Patrol',
    description: 'Basic readable fight.',
    allowedDepths: [1, 2],
    roleSlotsByDepth: {
      1: [bruiserOrAssassin, swarmOptional],
      2: [bruiserOrAssassin, swarmOptional],
    },
    maxEnemiesByDepth: { 1: 2, 2: 2 },
    defaultRewardTier: 'BASELINE',
    warningSummary: 'Simple Patrol: standard hostile contact.',
    requiresWarningCard: false,
    weight: 28,
  },
  RESOURCE_GUARD: {
    id: 'RESOURCE_GUARD',
    name: 'Resource Guard',
    description: 'Enemies guarding a cache, vein, or bloom.',
    allowedDepths: [1, 2, 3],
    requiresHighValue: true,
    compatibleOperations: ['RESOURCE_SURVEY', 'EXTRACTION_SURGE'],
    roleSlotsByDepth: {
      1: [bruiserRequired, swarmOptional],
      2: [bruiserRequired, disruptorOrAssassin],
      3: [bruiserRequired, disruptorRequired, { roles: ['ARTILLERY', 'SUPPORT'], required: false }],
    },
    maxEnemiesByDepth: { 1: 2, 2: 2, 3: 3 },
    defaultRewardTier: 'IMPROVED',
    warningSummary: 'Resource Guard: valuable cargo protected by hostile entities.',
    requiresWarningCard: true,
    weight: 14,
  },
  ANCHOR_PATROL: {
    id: 'ANCHOR_PATROL',
    name: 'Anchor Patrol',
    description: 'Defending Anchor Signal / Vein / Core trace.',
    allowedDepths: [2, 3],
    requiresAnchorSignal: true,
    compatibleOperations: ['ANCHOR_ASSAULT', 'BOSS_SUPPRESSION'],
    roleSlotsByDepth: {
      2: [anchorLinkedRequired, { roles: ['BRUISER', 'DISRUPTOR'], required: true }, supportOptional],
      3: [anchorLinkedRequired, { roles: ['BRUISER', 'DISRUPTOR'], required: true }, supportOptional],
    },
    maxEnemiesByDepth: { 2: 3, 3: 3 },
    defaultRewardTier: 'HIGH_VALUE',
    warningSummary: 'Anchor Patrol: clearing this fight weakens sector Anchor pressure.',
    requiresWarningCard: true,
    weight: 12,
  },
  ECHO_CONTAMINATED: {
    id: 'ECHO_CONTAMINATED',
    name: 'Echo-Contaminated Fight',
    description: 'Combat infected by Echo residue — not a full Hostile Echo spawn.',
    allowedDepths: [2, 3],
    requiresEchoSignal: true,
    compatibleOperations: ['ECHO_RECOVERY'],
    roleSlotsByDepth: {
      2: [
        { roles: ['BRUISER', 'ASSASSIN', 'DISRUPTOR'], required: true },
        { roles: ['BRUISER', 'ASSASSIN', 'DISRUPTOR', 'SWARM'], required: true },
      ],
      3: [
        { roles: ['BRUISER', 'ASSASSIN', 'DISRUPTOR'], required: true },
        { roles: ['BRUISER', 'ASSASSIN', 'DISRUPTOR'], required: true },
      ],
    },
    maxEnemiesByDepth: { 2: 2, 3: 3 },
    defaultRewardTier: 'IMPROVED',
    warningSummary: 'Echo-Contaminated: the fight may repeat dead actions.',
    requiresWarningCard: true,
    weight: 10,
  },
  ELITE_NEST: {
    id: 'ELITE_NEST',
    name: 'Elite Nest',
    description: 'Harder fight with stronger rewards.',
    allowedDepths: [1, 2, 3],
    elitePreferred: true,
    roleSlotsByDepth: {
      1: [
        { roles: ['BRUISER', 'ASSASSIN'], required: true, elite: true },
        supportOptional,
      ],
      2: [
        { roles: ['BRUISER', 'ASSASSIN'], required: true, elite: true },
        { roles: ['DISRUPTOR', 'SUPPORT'], required: true },
        { roles: ['SWARM'], required: false },
      ],
      3: [
        { roles: ['BRUISER'], required: true, elite: true },
        { roles: ['DISRUPTOR', 'ARTILLERY'], required: true },
        supportOptional,
      ],
    },
    maxEnemiesByDepth: { 1: 2, 2: 3, 3: 3 },
    defaultRewardTier: 'HIGH_VALUE',
    warningSummary: 'Elite Nest: stronger enemy synergy, higher reward.',
    requiresWarningCard: true,
    weight: 10,
  },
  ARTILLERY_KILLBOX: {
    id: 'ARTILLERY_KILLBOX',
    name: 'Artillery Killbox',
    description: 'Delayed high-damage threat behind a screen.',
    allowedDepths: [2, 3],
    roleSlotsByDepth: {
      2: [
        artilleryRequired,
        { roles: ['BRUISER', 'SWARM'], required: true },
      ],
      3: [
        artilleryRequired,
        { roles: ['BRUISER', 'SWARM'], required: true },
        { roles: ['DISRUPTOR'], required: false },
      ],
    },
    maxEnemiesByDepth: { 2: 2, 3: 3 },
    defaultRewardTier: 'HIGH_VALUE',
    warningSummary: 'Artillery Killbox: delayed high-damage attack detected.',
    requiresWarningCard: true,
    weight: 8,
  },
  SUPPORT_CORE: {
    id: 'SUPPORT_CORE',
    name: 'Support Core',
    description: 'Eliminate or disrupt a backline enabler.',
    allowedDepths: [2, 3],
    roleSlotsByDepth: {
      2: [
        { roles: ['SUPPORT'], required: true },
        { roles: ['BRUISER', 'SWARM'], required: true },
        { roles: ['ASSASSIN'], required: false },
      ],
      3: [
        { roles: ['SUPPORT'], required: true },
        { roles: ['BRUISER', 'SWARM'], required: true },
        { roles: ['ASSASSIN'], required: false },
      ],
    },
    maxEnemiesByDepth: { 2: 3, 3: 3 },
    defaultRewardTier: 'IMPROVED',
    warningSummary: 'Support Core: backline entity is empowering the board.',
    requiresWarningCard: true,
    weight: 8,
  },
  SWARM_PRESSURE: {
    id: 'SWARM_PRESSURE',
    name: 'Swarm Pressure',
    description: 'Low-HP tempo and stamina pressure.',
    allowedDepths: [1, 2, 3],
    roleSlotsByDepth: {
      1: [{ roles: ['SWARM'], required: true, count: 2 }],
      2: [
        { roles: ['SWARM'], required: true, count: 2 },
        { roles: ['DISRUPTOR'], required: false },
      ],
      3: [
        { roles: ['SWARM'], required: true, count: 3 },
        { roles: ['DISRUPTOR'], required: false },
      ],
    },
    maxEnemiesByDepth: { 1: 2, 2: 3, 3: 4 },
    defaultRewardTier: 'BASELINE',
    warningSummary: 'Swarm Pressure: many weak enemies, tempo threat.',
    requiresWarningCard: false,
    weight: 12,
  },
  BOSS_FORESHADOWING: {
    id: 'BOSS_FORESHADOWING',
    name: 'Boss Foreshadowing',
    description: 'Mechanics resemble upcoming Gatekeeper pressure.',
    allowedDepths: [1, 2, 3],
    compatibleOperations: ['BOSS_SUPPRESSION', 'ANCHOR_ASSAULT'],
    roleSlotsByDepth: {
      1: [
        { roles: ['BRUISER', 'DISRUPTOR', 'ARTILLERY'], required: true },
        { roles: ['SUPPORT', 'SWARM'], required: false },
      ],
      2: [
        { roles: ['BRUISER', 'DISRUPTOR', 'ARTILLERY', 'ANCHOR_LINKED'], required: true },
        { roles: ['SUPPORT', 'SWARM'], required: true },
      ],
      3: [
        { roles: ['BRUISER', 'DISRUPTOR', 'ARTILLERY', 'ANCHOR_LINKED'], required: true },
        { roles: ['SUPPORT', 'DISRUPTOR'], required: true },
      ],
    },
    maxEnemiesByDepth: { 1: 2, 2: 2, 3: 2 },
    defaultRewardTier: 'IMPROVED',
    warningSummary: 'Boss Foreshadowing: mechanics resemble upcoming Gatekeeper pressure.',
    requiresWarningCard: true,
    weight: 6,
  },
  HIGH_RISK_CARGO_GUARD: {
    id: 'HIGH_RISK_CARGO_GUARD',
    name: 'High-Risk Cargo Guard',
    description: 'Dangerous optional fight protecting unstable/contraband cargo.',
    allowedDepths: [2, 3],
    requiresHighRisk: true,
    requiresHighValue: true,
    roleSlotsByDepth: {
      2: [bruiserRequired, disruptorOrAssassin],
      3: [
        { roles: ['BRUISER', 'ANCHOR_LINKED'], required: true },
        disruptorRequired,
        { roles: ['ARTILLERY'], required: false },
      ],
    },
    maxEnemiesByDepth: { 2: 2, 3: 3 },
    defaultRewardTier: 'RARE',
    warningSummary: 'High-Risk Cargo Guard: valuable cargo detected, extraction risk elevated.',
    requiresWarningCard: true,
    weight: 7,
  },
};

export const ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS = Object.keys(
  ENCOUNTER_COMPOSITION_TEMPLATES,
) as EncounterCompositionTemplateId[];

export function getEncounterCompositionTemplate(
  id: EncounterCompositionTemplateId,
): EncounterCompositionTemplate {
  return ENCOUNTER_COMPOSITION_TEMPLATES[id];
}
