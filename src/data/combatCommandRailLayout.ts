/**
 * Presentation-only helpers for the all-class Combat Hub command rail.
 * Does not own combat resolution, persistence, or ability registries.
 */

export type CombatCommandRailGroup = 'weapon' | 'technique';

export type CombatCommandRailCard = {
  abilityId: string;
  group: CombatCommandRailGroup;
  order: number;
};

export type CombatCommandRailModel = {
  cards: readonly CombatCommandRailCard[];
  weaponActions: readonly string[];
  techniques: readonly string[];
  weaponActionCount: number;
  techniqueCount: number;
  /** Fixed class mechanic ids never appear in `cards`. */
  classMechanicSlot: 'PARRY' | 'RIFT_WARD' | 'RELOAD' | null;
};

export function buildCombatCommandRailModel(input: {
  loadout: readonly string[];
  weaponActionCount: number;
  techniqueCount: number;
  classMechanicSlot?: 'PARRY' | 'RIFT_WARD' | 'RELOAD' | null;
}): CombatCommandRailModel {
  const waCount = Math.max(0, input.weaponActionCount);
  const techCount = Math.max(0, input.techniqueCount);
  const weaponActions = input.loadout.slice(0, waCount);
  const techniques = input.loadout.slice(waCount, waCount + techCount);
  const cards: CombatCommandRailCard[] = [
    ...weaponActions.map((abilityId, i) => ({
      abilityId,
      group: 'weapon' as const,
      order: i + 1,
    })),
    ...techniques.map((abilityId, i) => ({
      abilityId,
      group: 'technique' as const,
      order: waCount + i + 1,
    })),
  ];
  return {
    cards,
    weaponActions,
    techniques,
    weaponActionCount: waCount,
    techniqueCount: techCount,
    classMechanicSlot: input.classMechanicSlot ?? null,
  };
}

export function assertMechanicOutsideRail(
  model: CombatCommandRailModel,
  mechanicIds: readonly string[],
): boolean {
  return mechanicIds.every((id) => !model.cards.some((card) => card.abilityId === id));
}
