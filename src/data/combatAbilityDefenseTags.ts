import type { ClassType } from '../types/game';
import { getAbilityDefinition } from './aegisAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';

export interface AbilityDefenseTags {
  armorBreak: number;
  wardBreak: number;
  armorPierce: boolean;
  wardPierce: boolean;
  appliesFracture: boolean;
}

export function resolveAbilityDefenseTags(
  classId: ClassType,
  abilityId: string,
): AbilityDefenseTags {
  const tags = readAbilityTags(classId, abilityId);
  return {
    armorBreak: tags.includes('ARMOR_BREAK') ? 1 : 0,
    wardBreak: tags.includes('WARD_BREAK') ? 1 : 0,
    armorPierce: tags.includes('ARMOR_PIERCE'),
    wardPierce: tags.includes('WARD_PIERCE'),
    appliesFracture: tags.includes('FRACTURE'),
  };
}

function readAbilityTags(classId: ClassType, abilityId: string): readonly string[] {
  if (classId === 'AEGIS') {
    try {
      return getAbilityDefinition(abilityId as AegisAbilityId)?.tags ?? [];
    } catch {
      return [];
    }
  }
  if (classId === 'HEX_SHOT') {
    return HEX_SHOT_ABILITY_CATALOG[abilityId as HexShotAbilityId]?.tags ?? [];
  }
  if (classId === 'ENVOY') {
    return ENVOY_ABILITY_CATALOG[abilityId as EnvoyAbilityId]?.tags ?? [];
  }
  return [];
}
