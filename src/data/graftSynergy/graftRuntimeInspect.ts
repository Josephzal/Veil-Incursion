/** Read-only inspection helpers for universal single-axis action upgrades. */
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import {
  getUniversalGraftDefinition,
  universalGraftMatchesTarget,
} from '../universalGraftRegistry';
import { getGraftSocketAccessForRunDepth } from './graftCapacityEngine';

export function inspectEquippedGraftBuild(args: {
  classId: ClassType;
  weaponFamilyId: WeaponFamilyId;
  equippedAbilityIds: readonly string[];
  abilityGrafts: Readonly<Record<string, string>>;
  runDepthBand?: number;
  /** @deprecated Class Rank does not affect action upgrades. */
  classRank?: number;
}): string {
  const depth = args.runDepthBand ?? 1;
  const access = getGraftSocketAccessForRunDepth(depth);
  const lines = [
    `weapon=${args.weaponFamilyId}`,
    `depth=${depth} capacity=${access.capacity} used=${Object.keys(args.abilityGrafts).length}`,
  ];
  for (const [actionId, graftId] of Object.entries(args.abilityGrafts)) {
    const definition = getUniversalGraftDefinition(graftId);
    const matches = universalGraftMatchesTarget(args.classId, actionId, graftId);
    lines.push(definition
      ? `assign ${actionId}←${definition.name} ok=${matches} axis=${definition.upgradeAxis} ${definition.baseValue}→${definition.upgradedValue}`
      : `assign ${actionId}←unknown ok=false`);
  }
  return lines.join('\n');
}

/** Inspect the universal overlay associated with an action assignment. */
export function inspectGraftCastPlanTransform(
  classId: ClassType,
  abilityId: string,
  graftId: string,
): string {
  const definition = getUniversalGraftDefinition(graftId);
  if (!definition || !universalGraftMatchesTarget(classId, abilityId, graftId)) {
    return `${classId}:${abilityId} no universal upgrade`;
  }
  return `${definition.name} axis=${definition.upgradeAxis} ${definition.baseValue}→${definition.upgradedValue}; tags/events unchanged`;
}
