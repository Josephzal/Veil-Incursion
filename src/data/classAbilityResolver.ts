import type { ClassType } from '../types/game';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import { getAbilityDefinition, getAbilityTags } from './aegisAbilities';
import { getEnvoyAbilityDefinition, getEnvoyAbilityTags } from './envoyAbilities';
import { getHexShotAbilityDefinition, getHexShotAbilityTags } from './hexShotAbilities';

export interface ClassAbilityCostSummary {
  apCost: number;
  ammoCost: number;
  fluxGen: number;
  fluxCost: number;
  minFluxRequired: number;
  staminaCost: number;
  staminaCostPct: number;
  requiresFullMag: boolean;
  label: string;
  description: string;
  tags: readonly string[];
  isUltimate: boolean;
  isFluxGen: boolean;
  isFluxDump: boolean;
}

export function resolveClassAbilityCost(
  classId: ClassType,
  abilityId: string,
): ClassAbilityCostSummary {
  if (classId === 'HEX_SHOT') {
    const def = getHexShotAbilityDefinition(abilityId as HexShotAbilityId);
    const tags = getHexShotAbilityTags(abilityId as HexShotAbilityId);
    return {
      apCost: def.apCost,
      ammoCost: def.ammoCost,
      fluxGen: 0,
      fluxCost: 0,
      minFluxRequired: 0,
      staminaCost: def.staminaCost,
      staminaCostPct: def.staminaCostPct ?? 0,
      requiresFullMag: def.requiresFullMag ?? false,
      label: def.label,
      description: def.description,
      tags,
      isUltimate: tags.includes('ULTIMATE'),
      isFluxGen: false,
      isFluxDump: false,
    };
  }
  if (classId === 'ENVOY') {
    const def = getEnvoyAbilityDefinition(abilityId as EnvoyAbilityId);
    const tags = getEnvoyAbilityTags(abilityId as EnvoyAbilityId);
    return {
      apCost: def.apCost,
      ammoCost: 0,
      fluxGen: def.fluxGen,
      fluxCost: def.fluxCost,
      minFluxRequired: def.minFluxRequired ?? 0,
      staminaCost: def.staminaCost,
      staminaCostPct: 0,
      requiresFullMag: false,
      label: def.label,
      description: def.description,
      tags,
      isUltimate: tags.includes('ULTIMATE'),
      isFluxGen: tags.includes('FLUX_GEN'),
      isFluxDump: tags.includes('FLUX_DUMP'),
    };
  }
  const def = getAbilityDefinition(abilityId as AegisAbilityId);
  const tags = getAbilityTags(abilityId as AegisAbilityId);
  return {
    apCost: def.apCost,
    ammoCost: 0,
    fluxGen: 0,
    fluxCost: 0,
    minFluxRequired: 0,
    staminaCost: def.staminaCost,
    staminaCostPct: def.staminaCostPct ?? 0,
    requiresFullMag: def.requiresFullAbyssal ?? false,
    label: def.label,
    description: def.description,
    tags,
    isUltimate: tags.includes('ULTIMATE'),
    isFluxGen: false,
    isFluxDump: false,
  };
}

export function formatClassAbilityCostLine(classId: ClassType, abilityId: string): string {
  const cost = resolveClassAbilityCost(classId, abilityId);
  const parts: string[] = [`${cost.apCost} AP`];
  if (classId === 'HEX_SHOT' && cost.ammoCost > 0) {
    parts.push(`${cost.ammoCost} AMMO`);
  }
  if (classId === 'ENVOY') {
    if (cost.fluxCost > 0) parts.push(`−${cost.fluxCost} FLUX`);
    else if (cost.fluxGen > 0) parts.push(`+${cost.fluxGen} FLUX`);
  }
  if (cost.staminaCost > 0) parts.push(`${cost.staminaCost} STAM`);
  else if (cost.staminaCostPct > 0) parts.push(`${cost.staminaCostPct}% STAM`);
  return parts.join(' // ');
}
