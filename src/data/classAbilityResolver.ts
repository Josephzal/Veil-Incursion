import type { ClassType } from '../types/game';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import { getAbilityDefinition, getAbilityTags } from './aegisAbilities';
import { getEnvoyAbilityDefinition, getEnvoyAbilityTags } from './envoyAbilities';
import { getHexShotAbilityDefinition, getHexShotAbilityTags } from './hexShotAbilities';
import { resolveHexShotResourceCosts } from './hexShotResourceEngine';
import {
  aegisWeaponActionApCost,
  aegisWeaponActionTags,
  formatAegisWeaponActionLabel,
  getAegisWeaponActionDefinition,
  isAegisWeaponActionCatalogId,
} from './aegisWeaponActionCatalog';
import { getAegisTechniqueDefinition, isAegisTechniqueId } from './aegisTechniqueCatalog';
import {
  getHexWeaponActionDefinition,
  hexWeaponActionTags,
} from './hexWeaponActionCatalog';
import type { HexWeaponActionId } from '../types/hexWeaponAction';
import { isDefinedHexWeaponActionId } from './hexWeaponActionCatalog';
import {
  formatEnvoyWeaponActionLabel,
  getEnvoyWeaponActionDefinition,
} from './envoyWeaponActionCatalog';
import { isEnvoyWeaponActionId } from './envoyWeaponActionRegistry';

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
  opts?: { doomfallReleaseAvailable?: boolean },
): ClassAbilityCostSummary {
  if (classId === 'HEX_SHOT') {
    const waDef = getHexWeaponActionDefinition(abilityId as HexWeaponActionId);
    if (waDef) {
      return {
        apCost: waDef.apCost,
        ammoCost: waDef.ammoCost,
        fluxRegen: 0,
        fluxCost: 0,
        staminaCost: waDef.staminaCost,
        staminaCostPct: 0,
        reserveCost: 0,
        reserveCostPct: 0,
        minReservePct: 0,
        requiresFullMag: false,
        label: waDef.label,
        description: waDef.description,
        tags: waDef.tags,
        isUltimate: false,
        consumesFlux: false,
        restoresFlux: false,
      };
    }
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
    const waDef = getEnvoyWeaponActionDefinition(abilityId);
    if (waDef) {
      return {
        apCost: waDef.apCost,
        ammoCost: 0,
        fluxRegen: waDef.fluxGain,
        fluxCost: waDef.fluxCost,
        staminaCost: waDef.staminaCost,
        staminaCostPct: 0,
        reserveCost: 0,
        reserveCostPct: 0,
        minReservePct: 0,
        requiresFullMag: false,
        label: formatEnvoyWeaponActionLabel(abilityId),
        description: waDef.description,
        tags: waDef.boonTags,
        isUltimate: false,
        consumesFlux: waDef.fluxCost > 0,
        restoresFlux: waDef.fluxGain > 0,
      };
    }
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
  if (isAegisWeaponActionCatalogId(abilityId)) {
    const def = getAegisWeaponActionDefinition(abilityId);
    const tags = aegisWeaponActionTags(abilityId, opts);
    return {
      apCost: aegisWeaponActionApCost(abilityId, opts),
      ammoCost: 0,
      fluxRegen: 0,
      fluxCost: 0,
      // Aegis weapon actions — AP only. Never spend Stamina.
      staminaCost: 0,
      staminaCostPct: 0,
      reserveCost: 0,
      reserveCostPct: 0,
      minReservePct: 0,
      requiresFullMag: false,
      label: formatAegisWeaponActionLabel(abilityId, opts),
      description: def.description,
      tags: [...tags],
      isUltimate: false,
      consumesFlux: false,
      restoresFlux: false,
    };
  }
  if (isAegisTechniqueId(abilityId)) {
    const tech = getAegisTechniqueDefinition(abilityId);
    const def = getAbilityDefinition(abilityId as AegisAbilityId);
    const tags = getAbilityTags(abilityId as AegisAbilityId);
    return {
      apCost: def.apCost,
      ammoCost: 0,
      fluxRegen: 0,
      fluxCost: 0,
      staminaCost: 0,
      staminaCostPct: 0,
      reserveCost: 0,
      reserveCostPct: 0,
      minReservePct: 0,
      requiresFullMag: false,
      label: tech.label,
      description: tech.description,
      tags,
      isUltimate: tags.includes('ULTIMATE'),
      consumesFlux: false,
      restoresFlux: false,
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

export function formatClassAbilityCostLine(
  classId: ClassType,
  abilityId: string,
  overrides?: { staminaCost?: number; fluxCost?: number; hpCostPct?: number },
): string {
  const cost = resolveClassAbilityCost(classId, abilityId);
  const staminaCost = overrides?.staminaCost ?? cost.staminaCost;
  const fluxCost = overrides?.fluxCost ?? cost.fluxCost;
  const parts: string[] = [`${cost.apCost} AP`];
  if (classId === 'HEX_SHOT' && cost.ammoCost > 0) {
    parts.push(`${cost.ammoCost} AMMO`);
  }
  if (classId === 'ENVOY') {
    if (staminaCost > 0) parts.push(`${staminaCost} STAM`);
    if (fluxCost > 0) parts.push(`−${fluxCost}% FLUX`);
    else if (cost.fluxRegen > 0) parts.push(`+${cost.fluxRegen}% FLUX`);
    if (isEnvoyWeaponActionId(abilityId)) {
      const wa = getEnvoyWeaponActionDefinition(abilityId);
      if (wa?.hasHpSacrifice) parts.push('HP SAC');
    }
  }
  if (classId === 'AEGIS') {
    if (isAegisWeaponActionCatalogId(abilityId)) {
      // Weapon actions: AP only — no stamina / reserve spend lines.
      return parts.join(' // ');
    }
    if (isAegisTechniqueId(abilityId)) {
      const def = getAbilityDefinition(abilityId as AegisAbilityId);
      if (def.requiredBrands && def.requiredBrands > 0) {
        if (def.brandsConsumed === 'ALL') {
          parts.push(`≥${def.requiredBrands} BRAND · −ALL`);
        } else if (typeof def.brandsConsumed === 'number') {
          parts.push(`−${def.brandsConsumed} BRAND`);
        } else {
          parts.push(`≥${def.requiredBrands} BRAND`);
        }
      } else if (def.brandsConsumed != null) {
        if (def.brandsConsumed === 'ALL') parts.push('−ALL BRANDS');
        else parts.push(`−${def.brandsConsumed} BRAND`);
      }
      const hpCostPct = overrides?.hpCostPct ?? def.hpCostPct;
      if (hpCostPct && hpCostPct > 0) {
        parts.push(`−${hpCostPct}% HP`);
      }
      return parts.join(' // ');
    }
    const def = getAbilityDefinition(abilityId as AegisAbilityId);
    if (cost.reserveCost > 0) parts.push(`−${cost.reserveCost}% AR`);
    else if (cost.reserveCostPct > 0) parts.push(`−${cost.reserveCostPct}% AR`);
    if (cost.minReservePct > 0) parts.push(`≥${cost.minReservePct}% AR`);
  } else {
    if (staminaCost > 0) parts.push(`${staminaCost} STAM`);
    else if (cost.staminaCostPct > 0) parts.push(`${cost.staminaCostPct}% STAM`);
  }
  return parts.join(' // ');
}
