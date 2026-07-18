import type { RunGenerationContext, RunModifierSnapshot } from '../types/worldState';
import { runGenerationContextToModifiers } from './worldStateEngine';

export type { RunModifierSnapshot };

export { runGenerationContextToModifiers };

export function resolveRunModifiersFromContext(
  context: RunGenerationContext | null | undefined,
): RunModifierSnapshot {
  if (!context) {
    return {
      maxHpBonusPct: 0,
      kineticArmorBonus: 0,
      rareLootBonusPct: 0,
      blackMarketDiscountPct: 0,
      firstTurnApBonus: 0,
      creditBonusPct: 0,
    };
  }
  return runGenerationContextToModifiers(context);
}
