import type { ClassType } from '../types/game';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { WeaponFamilyId } from '../types/weapon';
import { getAbilityDefinition } from './aegisAbilities';
import { resolveClassAbilityCost } from './classAbilityResolver';
import {
  resolveWeaponAnchorForAbility,
} from './weaponAnchorAttackRegistry';

const PRIORITY_EFFECT_TAGS = [
  'BUFF',
  'DEBUFF',
  'AOE',
  'TRUE_DAMAGE',
  'FRACTURE',
  'ARMOR_BREAK',
  'ARMOR_PIERCE',
  'WARD_BREAK',
  'WARD_PIERCE',
  'RESTORE',
  'PARRY',
  'CONTROL',
  'SACRIFICE',
  'GUARD_BREAK',
  'INTERRUPT',
] as const;

function formatTagChip(tag: string): string {
  return tag.replace(/_/g, ' ');
}

function parseLeadingDamageChip(description: string): string | null {
  const match = description.match(
    /^(\d+)\s+(kinetic|occult|true)(?:\s+damage)?/i,
  );
  if (!match) return null;
  return `${match[1]} ${match[2].toUpperCase()}`;
}

/** Short damage / buff / debuff chips for ability cards (idle + selected). */
export function resolveAbilityCardEffectChips(
  classId: ClassType,
  abilityId: string,
  options?: {
    equippedWeaponFamilyId?: WeaponFamilyId | null;
    weaponEffectLine?: string | null;
  },
): string[] {
  const anchor = resolveWeaponAnchorForAbility(
    abilityId,
    options?.equippedWeaponFamilyId,
    classId,
  );
  if (anchor && options?.weaponEffectLine) {
    return options.weaponEffectLine.split(' // ').filter(Boolean).slice(0, 4);
  }
  if (anchor) {
    return [
      ...anchor.definingEffects.slice(0, 2),
      anchor.targetPattern,
    ];
  }

  const cost = resolveClassAbilityCost(classId, abilityId);
  const chips: string[] = [];

  if (classId === 'AEGIS') {
    try {
      const def = getAbilityDefinition(abilityId as AegisAbilityId);
      if (def.baseKineticDamage != null && def.baseKineticDamage > 0) {
        chips.push(`${def.baseKineticDamage} KINETIC`);
      }
    } catch {
      // Unknown id — fall through to description parse.
    }
  }

  if (chips.length === 0) {
    const fromDesc = parseLeadingDamageChip(cost.description);
    if (fromDesc) chips.push(fromDesc);
  }

  const tagSet = new Set(cost.tags.map((t) => t.toUpperCase()));
  for (const tag of PRIORITY_EFFECT_TAGS) {
    if (chips.length >= 3) break;
    if (!tagSet.has(tag)) continue;
    const chip = formatTagChip(tag);
    if (chips.includes(chip)) continue;
    chips.push(chip);
  }

  return chips;
}

export function formatAbilityCardEffectLine(
  classId: ClassType,
  abilityId: string,
  options?: {
    equippedWeaponFamilyId?: WeaponFamilyId | null;
    weaponEffectLine?: string | null;
  },
): string {
  return resolveAbilityCardEffectChips(classId, abilityId, options).join(' // ');
}
