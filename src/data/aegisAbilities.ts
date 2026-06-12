import type { AegisAbilityId } from '../types/aegisCombat';

export interface AegisAbilityDefinition {
  id: AegisAbilityId;
  label: string;
  apCost: number;
  staminaCost: number;
  staminaCostPct?: number;
  hpCostPct?: number;
  cooldownTurns?: number;
  requiresFullAbyssal?: boolean;
  description: string;
}

export const AEGIS_ABILITY_CATALOG: Record<AegisAbilityId, AegisAbilityDefinition> = {
  STRIKE: {
    id: 'STRIKE',
    label: '[ STRIKE ]',
    apCost: 1,
    staminaCost: 12,
    description: '10 kinetic damage. +15% Abyssal Reserve. +25 fracture. Concussed if fracture >50%.',
  },
  RUIN: {
    id: 'RUIN',
    label: '[ RUIN ]',
    apCost: 2,
    staminaCost: 20,
    description: 'AoE fracture shockwave. Instant fracture if target is Concussed.',
  },
  WRAITH_PARRY: {
    id: 'WRAITH_PARRY',
    label: '[ WRAITH PARRY ]',
    apCost: 1,
    staminaCost: 0,
    staminaCostPct: 18,
    description: 'Defensive stance — reflect 100% fracture on next physical hit.',
  },
  GRAVE_BIND: {
    id: 'GRAVE_BIND',
    label: '[ GRAVE BIND ]',
    apCost: 1,
    staminaCost: 10,
    description: 'Pull backline target to melee. Exposed — defense halved.',
  },
  SHADOW_STEP: {
    id: 'SHADOW_STEP',
    label: '[ SHADOW STEP ]',
    apCost: 0,
    staminaCost: 0,
    staminaCostPct: 30,
    description: 'Teleport shoulder-check. Massive fracture. Win next initiative.',
  },
  VEIL_PIERCER: {
    id: 'VEIL_PIERCER',
    label: '[ VEIL-PIERCER ]',
    apCost: 1,
    staminaCost: 10,
    description: 'Occult damage bypasses kinetic armor. +20% Reserve. +15 fracture.',
  },
  ASHEN_MANTLE: {
    id: 'ASHEN_MANTLE',
    label: '[ ASHEN MANTLE ]',
    apCost: 2,
    staminaCost: 8,
    description: 'Block 50% incoming damage. Attackers gain Doomed.',
  },
  NAIL_TO_GRID: {
    id: 'NAIL_TO_GRID',
    label: '[ NAIL TO GRID ]',
    apCost: 1,
    staminaCost: 8,
    description: 'Pin target shadow — enemy loses 1 AP. Doomed spreads to adjacents.',
  },
  BLOOD_TITHE: {
    id: 'BLOOD_TITHE',
    label: '[ BLOOD-TITHE ]',
    apCost: 2,
    staminaCost: 8,
    description: 'Consume Reserve to heal 2% HP per 10 Reserve and deal occult damage.',
  },
  DEMONS_LUNG: {
    id: 'DEMONS_LUNG',
    label: "[ DEMON'S LUNG ]",
    apCost: 0,
    staminaCost: 0,
    cooldownTurns: 3,
    description: 'Restore 40% stamina and gain +1 AP this turn.',
  },
  CRIMSON_PACT: {
    id: 'CRIMSON_PACT',
    label: '[ CRIMSON PACT ]',
    apCost: 1,
    staminaCost: 0,
    hpCostPct: 12,
    description: 'Sacrifice HP — next two attacks are guaranteed Critical Hits.',
  },
  EVISCERATE: {
    id: 'EVISCERATE',
    label: '[ EVISCERATE ]',
    apCost: 0,
    staminaCost: 0,
    requiresFullAbyssal: true,
    description: 'Ultimate — 3-slice execution. True damage. Sunder armor on survivors.',
  },
};

export function getAbilityDefinition(id: AegisAbilityId): AegisAbilityDefinition {
  return AEGIS_ABILITY_CATALOG[id];
}
