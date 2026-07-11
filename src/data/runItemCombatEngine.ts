import type { IncursionConsumableUseResult } from '../types/incursionInventory';
import type {
  RunItemId,
  RunItemPendingEffect,
  RunItemRuntime,
  RunItemRuntimeStats,
} from '../types/runItem';
import { getRunItemDefinition } from './runItemRegistry';
import { mergeRunItemRuntime, recordRunItemTrigger } from './runItemRunState';

export interface RunItemCombatResolveContext {
  maxSoulAnchor: number;
  currentSoulAnchor: number;
  currentStamina: number;
  maxStamina: number;
  runtime: RunItemRuntime;
  /** Living enemy count — used for AoE/root fallbacks. */
  livingEnemyCount: number;
}

export interface RunItemCombatResolveOutcome {
  result: IncursionConsumableUseResult;
  runtime: RunItemRuntime;
  rejected?: string;
}

function patchStats(
  runtime: RunItemRuntime,
  patch: Partial<RunItemRuntimeStats>,
): RunItemRuntime {
  return mergeRunItemRuntime(runtime, {
    stats: { ...runtime.stats, ...patch },
  });
}

function appendPending(
  runtime: RunItemRuntime,
  effect: RunItemPendingEffect,
): RunItemRuntime {
  return mergeRunItemRuntime(runtime, {
    pendingEffects: [...runtime.pendingEffects, effect],
  });
}

/**
 * Resolve a combat Run Item useBehavior into an IncursionConsumableUseResult.
 * Does not consume the slot — caller handles inventory mutation.
 */
export function resolveRunItemCombatUse(
  itemId: RunItemId,
  ctx: RunItemCombatResolveContext,
): RunItemCombatResolveOutcome {
  const def = getRunItemDefinition(itemId);
  if (def.family !== 'COMBAT_CONSUMABLE' || def.slotType !== 'COMBAT') {
    return {
      result: {
        itemId,
        healAmount: 0,
        stunsEnemy: false,
        logLine: '[REJECTED] >> Not a combat Run Item.',
      },
      runtime: ctx.runtime,
      rejected: 'Not a combat Run Item.',
    };
  }

  if (ctx.runtime.combatItemsUsedThisTurn >= 1) {
    return {
      result: {
        itemId,
        healAmount: 0,
        stunsEnemy: false,
        logLine: '[REJECTED] >> Only one combat item may be used per turn.',
      },
      runtime: ctx.runtime,
      rejected: 'Only one combat item may be used per turn.',
    };
  }

  let runtime = mergeRunItemRuntime(ctx.runtime, {
    combatItemsUsedThisTurn: ctx.runtime.combatItemsUsedThisTurn + 1,
  });
  runtime = recordRunItemTrigger(runtime, def.triggerText);

  const base: IncursionConsumableUseResult = {
    itemId,
    healAmount: 0,
    stunsEnemy: false,
    apCost: 0,
    logLine: `>> ${def.triggerText}`,
  };

  switch (def.useBehavior) {
    case 'heal_percent': {
      const healAmount = Math.floor(ctx.maxSoulAnchor * 0.25);
      const belowClutch = ctx.currentSoulAnchor / Math.max(1, ctx.maxSoulAnchor) < 0.3;
      runtime = patchStats(runtime, {
        hpRestoredByItems: runtime.stats.hpRestoredByItems + healAmount,
      });
      return {
        result: {
          ...base,
          healAmount,
          grantTemporaryShield: belowClutch ? 1 : undefined,
          logLine: belowClutch
            ? `>> ${def.triggerText} Clutch shield armed.`
            : base.logLine,
        },
        runtime,
      };
    }
    case 'trauma_cleanse': {
      // Combat hub counts cleared debuffs; engine grants fallback heal + cleanse flag.
      const fallbackHeal = Math.floor(ctx.maxSoulAnchor * 0.15);
      return {
        result: {
          ...base,
          healAmount: fallbackHeal,
          clearSupportedPlayerDebuffs: true,
          // Hub recalculates heal as 5% per cleared debuff when any are purged.
        },
        runtime,
      };
    }
    case 'grave_dust_surge': {
      runtime = appendPending(runtime, {
        kind: 'grave_dust_stamina_crash',
        itemId,
        expiresAt: 'start_of_next_player_turn',
        payload: { staminaLoss: 30 },
      });
      runtime = patchStats(runtime, {
        staminaRestoredByItems: runtime.stats.staminaRestoredByItems + ctx.maxStamina,
        apGrantedByItems: runtime.stats.apGrantedByItems + 1,
      });
      return {
        result: {
          ...base,
          restoreStaminaPct: 100,
          grantBonusAp: 1,
          staminaLossNextTurn: 30,
          secondaryLogLine: 'GRAVE-DUST AMPOULE // Crash response armed for next turn.',
        },
        runtime,
      };
    }
    case 'spall_weave_shield': {
      return {
        result: {
          ...base,
          absorbNextHit: true,
          spallShrapnelDamage: 8,
        },
        runtime,
      };
    }
    case 'grid_cracker_armor_break': {
      return {
        result: {
          ...base,
          shatterKineticArmor: 3,
          applyExposed: true,
          exposedRequiresArmorStripped: 2,
          misfireStaminaLoss: 15,
        },
        runtime: patchStats(runtime, {
          armorStrippedByItems: runtime.stats.armorStrippedByItems + 3,
        }),
      };
    }
    case 'eclipse_flare_ward_break': {
      return {
        result: {
          ...base,
          stripOccultWards: 3,
          frontlineBlindTurns: 1,
        },
        runtime: patchStats(runtime, {
          wardsStrippedByItems: runtime.stats.wardsStrippedByItems + 3,
        }),
      };
    }
    case 'veil_ash_grenade': {
      return {
        result: {
          ...base,
          frontlineBlindTurns: 2,
          // Moderate AoE pressure via existing blind + small fracture on primary.
          applyFracture: true,
        },
        runtime,
      };
    }
    case 'rigged_combustion_delayed': {
      runtime = appendPending(runtime, {
        kind: 'rigged_combustion_armed',
        itemId,
        expiresAt: 'next_enemy_action',
        payload: { damage: 18 },
      });
      return {
        result: {
          ...base,
          delayedCylinder: true,
        },
        runtime,
      };
    }
    case 'mirror_salt_echo': {
      if (runtime.mirrorSaltUsedThisTurn) {
        return {
          result: {
            ...base,
            logLine: '[REJECTED] >> Mirror-Salt already used this turn.',
          },
          runtime: ctx.runtime,
          rejected: 'Mirror-Salt already used this turn.',
        };
      }
      runtime = mergeRunItemRuntime(runtime, { mirrorSaltUsedThisTurn: true });
      return {
        result: {
          ...base,
          mirrorSaltEcho: true,
          misfireStaminaLoss: 10,
        },
        runtime,
      };
    }
    case 'bloodwire_tourniquet': {
      if (runtime.bloodwireUsedThisCombat) {
        return {
          result: {
            ...base,
            logLine: '[REJECTED] >> Bloodwire already used this combat.',
          },
          runtime: ctx.runtime,
          rejected: 'Bloodwire already used this combat.',
        };
      }
      runtime = mergeRunItemRuntime(runtime, { bloodwireUsedThisCombat: true });
      return {
        result: {
          ...base,
          bloodwireLethalPrevention: true,
        },
        runtime,
      };
    }
    case 'null_space_injector': {
      return {
        result: {
          ...base,
          nullSpaceUntargetable: true,
        },
        runtime,
      };
    }
    case 'black_iron_wedge': {
      return {
        result: {
          ...base,
          interruptChargingTarget: true,
          applyFracture: true,
        },
        runtime: patchStats(runtime, {
          enemyActionsInterrupted: runtime.stats.enemyActionsInterrupted + 1,
        }),
      };
    }
    case 'razorwire_spool': {
      return {
        result: {
          ...base,
          // Hub clamps to living hostiles (max 2).
          applyRootedToUpTo: 2,
        },
        runtime,
      };
    }
    case 'voidglass_decoy': {
      return {
        result: {
          ...base,
          voidglassDecoy: true,
          grantTemporaryShield: 1,
        },
        runtime,
      };
    }
    default:
      return {
        result: {
          ...base,
          logLine: `[REJECTED] >> Combat behavior '${def.useBehavior}' not wired.`,
        },
        runtime: ctx.runtime,
        rejected: `Combat behavior '${def.useBehavior}' not wired.`,
      };
  }
}

/** Drain pending grave-dust crash effects at player turn start. */
export function consumeGraveDustStaminaCrash(
  runtime: RunItemRuntime,
): { runtime: RunItemRuntime; staminaLoss: number; message: string | null } {
  const pending = runtime.pendingEffects.filter((e) => e.kind === 'grave_dust_stamina_crash');
  if (pending.length === 0) {
    return { runtime, staminaLoss: 0, message: null };
  }
  const staminaLoss = pending.reduce(
    (sum, effect) => sum + (Number(effect.payload?.staminaLoss) || 30),
    0,
  );
  return {
    runtime: mergeRunItemRuntime(runtime, {
      pendingEffects: runtime.pendingEffects.filter((e) => e.kind !== 'grave_dust_stamina_crash'),
    }),
    staminaLoss,
    message: 'GRAVE-DUST AMPOULE // Crash response detected.',
  };
}
