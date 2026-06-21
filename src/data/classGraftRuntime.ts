import type { ClassGraftCastPlan } from '../types/classGraft';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import { stackDoomedTag } from './combatFractureEngine';
import { isUnitAlive } from './combatSquadEngine';

export function resolveClassGraftStrikeTargetIds(
  plan: ClassGraftCastPlan | null,
  squad: EnemyCombatProfile[],
  preferredTargetId?: string | null,
): string[] {
  if (plan?.convertToAoE) {
    return squad
      .filter((unit) => unit.unitId && isUnitAlive(unit))
      .map((unit) => unit.unitId as string);
  }
  if (preferredTargetId) return [preferredTargetId];
  return [];
}

export interface ClassGraftCastSideEffects {
  grantGhostCamoTurns?: number;
  playerBleedDamage?: number;
  playerConcussed?: boolean;
  playerExposed?: boolean;
  targetPatches: Array<{ unitId: string; patch: Partial<EnemyCombatProfile> }>;
  enemyApDrainNextTurn: Array<{ unitId: string; amount: number }>;
  dropLootOnKill?: string;
}

export function collectClassGraftCastSideEffects(
  graftPlan: ClassGraftCastPlan,
  targetId: string | null | undefined,
): ClassGraftCastSideEffects {
  const effects: ClassGraftCastSideEffects = {
    targetPatches: [],
    enemyApDrainNextTurn: [],
  };

  if (graftPlan.untargetableBuff) {
    effects.grantGhostCamoTurns = 1;
  }

  if (targetId && graftPlan.targetDebuff) {
    switch (graftPlan.targetDebuff) {
      case 'BLEED_2':
        effects.targetPatches.push({
          unitId: targetId,
          patch: { combatTags: ['DOOMED'] },
        });
        break;
      case 'AP_MINUS_1':
        effects.enemyApDrainNextTurn.push({ unitId: targetId, amount: 1 });
        break;
      case 'ROOTED':
        effects.targetPatches.push({
          unitId: targetId,
          patch: { evadeChance: 0, evadeActive: false, enemyActionPoints: 0 },
        });
        break;
      default:
        break;
    }
  }

  if (graftPlan.selfDebuff === 'BLEED_1') {
    effects.playerBleedDamage = 1;
  }

  return effects;
}

export function applyClassGraftTargetPatch(
  unit: EnemyCombatProfile,
  patch: Partial<EnemyCombatProfile>,
): Partial<EnemyCombatProfile> {
  if (patch.combatTags?.includes('DOOMED')) {
    let stacked = stackDoomedTag(unit);
    stacked = stackDoomedTag(stacked);
    return { combatTags: stacked.combatTags, doomedStacks: stacked.doomedStacks };
  }
  return patch;
}

export function resolveClassGraftFailDebuff(failDebuff: string): {
  playerConcussed?: boolean;
  playerExposed?: boolean;
} {
  switch (failDebuff) {
    case 'EXPOSED':
      return { playerExposed: true };
    case 'CONCUSSED':
      return { playerConcussed: true };
    default:
      return {};
  }
}

export function resolveClassGraftSurviveDebuff(debuff: string): {
  playerConcussed?: boolean;
  playerExposed?: boolean;
} {
  return resolveClassGraftFailDebuff(debuff);
}

export function applyClassGraftEnemyApDrains(
  classState: ClassCombatEncounterState,
  drains: Array<{ unitId: string; amount: number }>,
): void {
  for (const { unitId, amount } of drains) {
    classState.enemyApDrainNextTurn[unitId] =
      (classState.enemyApDrainNextTurn[unitId] ?? 0) + amount;
  }
}

export function anyHostileKilledSince(
  squadBefore: Array<{ id: string | undefined; hp: number }>,
  squad: EnemyCombatProfile[],
): boolean {
  return squadBefore.some((before) => {
    if (!before.id) return false;
    const after = squad.find((u) => u.unitId === before.id);
    return before.hp > 0 && (!after || after.currentHp <= 0);
  });
}

export function finalizeClassGraftAfterAbility(
  graftPlan: ClassGraftCastPlan,
  squadBefore: Array<{ id: string | undefined; hp: number }>,
  squad: EnemyCombatProfile[],
  log: (msg: string) => void,
  callbacks: {
    applyFailDebuff: (debuff: string) => void;
    refundAmmo?: () => void;
    refundAp?: () => void;
    dropLoot?: (kind: string) => void;
  },
): void {
  const anyKill = anyHostileKilledSince(squadBefore, squad);

  if (graftPlan.failDebuff && !anyKill) {
    callbacks.applyFailDebuff(graftPlan.failDebuff);
    log(`>> [${graftPlan.graftName.toUpperCase()}] — non-lethal cast applies ${graftPlan.failDebuff}.`);
  }

  if (anyKill && graftPlan.refundAmmoOnKill) {
    callbacks.refundAmmo?.();
    log(`>> [${graftPlan.graftName.toUpperCase()}] — kill refunds 1 Ammo.`);
  }

  if (anyKill && graftPlan.refundApOnKill) {
    callbacks.refundAp?.();
    log(`>> [${graftPlan.graftName.toUpperCase()}] — kill refunds 1 AP.`);
  }

  if (anyKill && graftPlan.dropLootOnKill) {
    callbacks.dropLoot?.(graftPlan.dropLootOnKill);
    log(`>> [${graftPlan.graftName.toUpperCase()}] — kill drops ${graftPlan.dropLootOnKill.toLowerCase()}.`);
  }
}
