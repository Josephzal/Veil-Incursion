import type { CargoItemId } from '../types/cargoGrid';
import type { CombatSessionExtras } from '../types/combatHooks';
import type { EnemyCombatProfile } from '../types/run';
import { applyFrontlineBlinded } from './combatHookRunner';

export interface ConsumableUseContext {
  maxSoulAnchor: number;
  currentSoulAnchor: number;
  squad: EnemyCombatProfile[];
  sessionExtras: CombatSessionExtras;
}

export interface ConsumableUseOutcome {
  healAmount: number;
  logLines: string[];
  clearDebuffIds?: Array<'BLEEDING' | 'FRACTURED'>;
  hookResult?: ReturnType<typeof applyFrontlineBlinded>;
}

export type ConsumableHandler = (ctx: ConsumableUseContext) => ConsumableUseOutcome;

export const CONSUMABLE_HANDLERS: Partial<Record<CargoItemId, ConsumableHandler>> = {
  'sanguine-coagulant': (ctx) => {
    const healAmount = Math.floor(ctx.maxSoulAnchor * 0.5);
    const removed = ctx.sessionExtras.playerDebuffs.filter(
      (id) => id === 'BLEEDING' || id === 'FRACTURED',
    );
    ctx.sessionExtras.playerDebuffs = ctx.sessionExtras.playerDebuffs.filter(
      (id) => id !== 'BLEEDING' && id !== 'FRACTURED',
    );
    return {
      healAmount,
      clearDebuffIds: removed,
      logLines: [
        `[SANGUINE COAGULANT] >> +${healAmount} Soul Anchor.`,
        removed.length > 0
          ? `[SANGUINE COAGULANT] >> Purged ${removed.join(', ')}.`
          : '[SANGUINE COAGULANT] >> No matching debuffs to purge.',
      ],
    };
  },
  'veil-ash-grenade': (ctx) => {
    const hookResult = applyFrontlineBlinded(ctx.squad, ctx.sessionExtras, 2);
    return {
      healAmount: 0,
      hookResult,
      logLines: hookResult.logLines,
    };
  },
};

export function resolveConsumableHandler(itemId: CargoItemId): ConsumableHandler | null {
  return CONSUMABLE_HANDLERS[itemId] ?? null;
}
