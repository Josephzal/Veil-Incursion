import type { ClassType } from '../types/game';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import { getAbilityDefinition, getAbilityTags } from './aegisAbilities';
import { getEnvoyAbilityDefinition, getEnvoyAbilityTags } from './envoyAbilities';
import { getHexShotAbilityDefinition, getHexShotAbilityTags } from './hexShotAbilities';
import { resolveHexShotResourceCosts } from './hexShotResourceEngine';

export interface ClassAbilityCostSummary {
  apCost: number;
  ammoCost: number;
  fluxRegen: number;
  fluxCost: number;
  staminaCost: number;
  staminaCostPct: number;
  reserveCost: number;
  reserveCostPct: number;
  minReservePct: number;
  requiresFullMag: boolean;
  label: string;
  description: string;
  tags: readonly string[];
  isUltimate: boolean;
  consumesFlux: boolean;
  restoresFlux: boolean;
}

export function resolveClassAbilityCost(
  classId: ClassType,
  abilityId: string,
): ClassAbilityCostSummary {
  if (classId === 'HEX_SHOT') {
    const def = getHexShotAbilityDefinition(abilityId as HexShotAbilityId);
    const tags = getHexShotAbilityTags(abilityId as HexShotAbilityId);
    const resolved = resolveHexShotResourceCosts(def);
    return {
      apCost: resolved.apCost,
      ammoCost: resolved.ammoCost,
      fluxRegen: 0,
      fluxCost: 0,
      staminaCost: resolved.staminaCost,
      staminaCostPct: resolved.staminaCostPct,
      reserveCost: 0,
      reserveCostPct: 0,
      minReservePct: 0,
      requiresFullMag: def.requiresFullMag ?? false,
      label: def.label,
      description: def.description,
      tags,
      isUltimate: tags.includes('ULTIMATE'),
      consumesFlux: false,
      restoresFlux: false,
    };
  }
  if (classId === 'ENVOY') {
    const def = getEnvoyAbilityDefinition(abilityId as EnvoyAbilityId);
    const tags = getEnvoyAbilityTags(abilityId as EnvoyAbilityId);
    return {
      apCost: def.apCost,
      ammoCost: 0,
      fluxRegen: def.fluxRegen,
      fluxCost: def.fluxCost,
      staminaCost: def.staminaCost,
      staminaCostPct: 0,
      reserveCost: 0,
      reserveCostPct: 0,
      minReservePct: 0,
      requiresFullMag: false,
      label: def.label,
      description: def.description,
      tags,
      isUltimate: tags.includes('ULTIMATE'),
      consumesFlux: def.fluxCost > 0,
      restoresFlux: def.fluxRegen > 0,
    };
  }
  const def = getAbilityDefinition(abilityId as AegisAbilityId);
  const tags = getAbilityTags(abilityId as AegisAbilityId);
  return {
    apCost: def.apCost,
    ammoCost: 0,
    fluxRegen: 0,
    fluxCost: 0,
    staminaCost: def.staminaCost ?? 0,
    staminaCostPct: def.staminaCostPct ?? 0,
    reserveCost: def.reserveCost ?? 0,
    reserveCostPct: def.reserveCostPct ?? 0,
    minReservePct: def.minReservePct ?? 0,
    requiresFullMag: false,
    label: def.label,
    description: def.description,
    tags,
    isUltimate: tags.includes('ULTIMATE'),
    consumesFlux: false,
    restoresFlux: false,
  };
}

export function formatClassAbilityCostLine(classId: ClassType, abilityId: string): string {
  const cost = resolveClassAbilityCost(classId, abilityId);
  const parts: string[] = [`${cost.apCost} AP`];
  if (classId === 'HEX_SHOT' && cost.ammoCost > 0) {
    parts.push(`${cost.ammoCost} AMMO`);
  }
  if (classId === 'ENVOY') {
    if (cost.fluxCost > 0) parts.push(`−${cost.fluxCost}% FLUX`);
    else if (cost.fluxRegen > 0) parts.push(`+${cost.fluxRegen}% FLUX`);
  }
  if (classId === 'AEGIS') {
    const def = getAbilityDefinition(abilityId as AegisAbilityId);
    if (cost.reserveCost > 0) parts.push(`−${cost.reserveCost}% AR`);
    else if (cost.reserveCostPct > 0) parts.push(`−${cost.reserveCostPct}% AR`);
    if (cost.minReservePct > 0) parts.push(`≥${cost.minReservePct}% AR`);
    if (def.brandsImprinted && def.brandsImprinted > 0) {
      parts.push(`+${def.brandsImprinted} BRAND`);
    }
    if (def.requiredBrands && def.requiredBrands > 0) {
      parts.push(`≥${def.requiredBrands} BRAND`);
    }
    if (def.brandsConsumed != null) {
      if (def.brandsConsumed === 'ALL') {
        parts.push('−ALL BRANDS');
      } else {
        parts.push(`−${def.brandsConsumed} BRAND`);
      }
    }
  } else {
    if (cost.staminaCost > 0) parts.push(`${cost.staminaCost} STAM`);
    else if (cost.staminaCostPct > 0) parts.push(`${cost.staminaCostPct}% STAM`);
  }
  return parts.join(' // ');
}
