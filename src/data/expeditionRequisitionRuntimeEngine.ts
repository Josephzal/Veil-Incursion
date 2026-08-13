import type {
  RequisitionEncounterDescriptor,
  RequisitionRuntime,
} from '../types/expeditionRequisition';
import {
  createKeepsakeRuntime,
  patchKeepsakeStats,
  recordKeepsakeTrigger,
} from './keepsakeRunState';
import { EXPEDITION_REQUISITION_REGISTRY } from './expeditionRequisitionRegistry';

export function initializeRequisitionRuntime(
  requisitionId: RequisitionRuntime['requisitionId'] | null,
  deployment: RequisitionRuntime['deployment'] | null,
): RequisitionRuntime | null {
  return requisitionId ? createKeepsakeRuntime(requisitionId, deployment) : null;
}

export function isEligiblePreparationEncounter(
  encounter: RequisitionEncounterDescriptor,
): boolean {
  return encounter.kind === 'STANDARD' || encounter.kind === 'ELITE';
}

export function applyRequisitionOnNewRun(
  runtime: RequisitionRuntime | null,
  runCredits: number,
): { runtime: RequisitionRuntime | null; runCredits: number; creditsGranted: number } {
  if (
    !runtime ||
    runtime.requisitionId !== 'hazard_pay' ||
    runtime.triggersUsed.hazard_pay_run_start
  ) {
    return { runtime, runCredits, creditsGranted: 0 };
  }
  const granted = 50;
  let next = recordKeepsakeTrigger(
    runtime,
    'hazard_pay_run_start',
    EXPEDITION_REQUISITION_REGISTRY.hazard_pay.triggerMessage,
  );
  next = patchKeepsakeStats(next, {
    startingCreditsGranted: next.stats.startingCreditsGranted + granted,
  });
  return {
    runtime: next,
    runCredits: runCredits + granted,
    creditsGranted: granted,
  };
}

export function beginRequisitionCombatEncounter(
  runtime: RequisitionRuntime | null,
  encounter: RequisitionEncounterDescriptor,
  depth: number,
): RequisitionRuntime | null {
  if (!runtime) return null;
  const combat = runtime.combatPreparation;
  if (!combat) return runtime;

  if (combat.kind === 'hollow_point_requisition') {
    if (depth <= 1 || combat.depthOneExpired) return runtime;
    return {
      ...runtime,
      combatPreparation: { ...combat, depthOneExpired: true },
    };
  }

  if (!isEligiblePreparationEncounter(encounter)) return runtime;

  if (combat.kind === 'reinforced_trench_coat') {
    if (
      encounter.kind !== 'ELITE' ||
      combat.protectedEncounterId != null ||
      combat.protectionSpent
    ) {
      return runtime;
    }
    return patchKeepsakeStats(
      {
        ...runtime,
        combatPreparation: {
          ...combat,
          protectedEncounterId: encounter.encounterId,
        },
      },
      {
        eligibleCombatEncountersConsumed:
          runtime.stats.eligibleCombatEncountersConsumed + 1,
      },
    );
  }

  if (combat.kind === 'chalk_line_ward') {
    if (
      combat.protectedEncounterIds.includes(encounter.encounterId) ||
      combat.protectedEncounterIds.length >= 3
    ) {
      return {
        ...runtime,
        combatPreparation: {
          ...combat,
          currentEncounterId: encounter.encounterId,
          currentWardAvailable:
            combat.currentEncounterId === encounter.encounterId
              ? combat.currentWardAvailable
              : false,
        },
      };
    }
    return patchKeepsakeStats(
      {
        ...runtime,
        combatPreparation: {
          ...combat,
          protectedEncounterIds: [
            ...combat.protectedEncounterIds,
            encounter.encounterId,
          ],
          currentEncounterId: encounter.encounterId,
          currentWardAvailable: true,
        },
      },
      {
        eligibleCombatEncountersConsumed:
          runtime.stats.eligibleCombatEncountersConsumed + 1,
      },
    );
  }

  return runtime;
}

export function grantAdrenalinePrimerFirstTurnAp(
  runtime: RequisitionRuntime | null,
  encounter: RequisitionEncounterDescriptor,
): { runtime: RequisitionRuntime | null; bonusAp: number } {
  const combat = runtime?.combatPreparation;
  if (
    !runtime ||
    combat?.kind !== 'adrenaline_primer' ||
    !isEligiblePreparationEncounter(encounter) ||
    combat.consumedEncounterIds.includes(encounter.encounterId) ||
    combat.consumedEncounterIds.length >= 3
  ) {
    return { runtime, bonusAp: 0 };
  }

  let next: RequisitionRuntime = {
    ...runtime,
    combatPreparation: {
      ...combat,
      consumedEncounterIds: [...combat.consumedEncounterIds, encounter.encounterId],
      grantedEncounterIds: [...combat.grantedEncounterIds, encounter.encounterId],
      apGranted: combat.apGranted + 1,
    },
  };
  next = patchKeepsakeStats(next, {
    eligibleCombatEncountersConsumed:
      next.stats.eligibleCombatEncountersConsumed + 1,
    temporaryApGranted: next.stats.temporaryApGranted + 1,
  });
  next = recordKeepsakeTrigger(
    next,
    `adrenaline_primer:${encounter.encounterId}`,
    EXPEDITION_REQUISITION_REGISTRY.adrenaline_primer.triggerMessage,
  );
  return { runtime: next, bonusAp: 1 };
}

export function reduceReinforcedTrenchCoatDamage(
  runtime: RequisitionRuntime | null,
  encounter: RequisitionEncounterDescriptor,
  finalDirectDamage: number,
  eligibleDirectHostileAttack: boolean,
): {
  runtime: RequisitionRuntime | null;
  damage: number;
  prevented: number;
} {
  const combat = runtime?.combatPreparation;
  if (
    !runtime ||
    combat?.kind !== 'reinforced_trench_coat' ||
    combat.protectedEncounterId !== encounter.encounterId ||
    combat.protectionSpent ||
    !eligibleDirectHostileAttack ||
    finalDirectDamage <= 0
  ) {
    return { runtime, damage: finalDirectDamage, prevented: 0 };
  }
  const damage = Math.max(0, Math.floor(finalDirectDamage * 0.5));
  const prevented = finalDirectDamage - damage;
  let next: RequisitionRuntime = {
    ...runtime,
    combatPreparation: {
      ...combat,
      protectionSpent: true,
      damagePrevented: combat.damagePrevented + prevented,
    },
  };
  next = patchKeepsakeStats(next, {
    directHostileDamagePrevented:
      next.stats.directHostileDamagePrevented + prevented,
  });
  next = recordKeepsakeTrigger(
    next,
    `reinforced_trench_coat:${encounter.encounterId}:${next.stats.triggerCount}`,
    EXPEDITION_REQUISITION_REGISTRY.reinforced_trench_coat.triggerMessage,
  );
  return { runtime: next, damage, prevented };
}

export function resolveHollowPointCritChanceBonus(
  runtime: RequisitionRuntime | null,
  depth: number,
  eligibleDirectActionDamage: boolean,
): number {
  const combat = runtime?.combatPreparation;
  return combat?.kind === 'hollow_point_requisition' &&
    !combat.depthOneExpired &&
    depth === 1 &&
    eligibleDirectActionDamage
    ? 0.1
    : 0;
}

export function consumeKineticBatteryAction(
  runtime: RequisitionRuntime | null,
  encounter: RequisitionEncounterDescriptor,
  actionId: string,
  targetLayers: { kineticArmor: number; occultWards: number },
  eligibleDamagingAction: boolean,
): {
  runtime: RequisitionRuntime | null;
  armorPierceLayers: 0 | 1;
  wardPierceLayers: 0 | 1;
} {
  const combat = runtime?.combatPreparation;
  const protectedTarget =
    targetLayers.kineticArmor > 0 || targetLayers.occultWards > 0;
  if (
    !runtime ||
    combat?.kind !== 'kinetic_battery' ||
    !isEligiblePreparationEncounter(encounter) ||
    !eligibleDamagingAction ||
    !protectedTarget ||
    combat.consumedEncounterIds.includes(encounter.encounterId) ||
    combat.consumedEncounterIds.length >= 3 ||
    combat.empoweredActionIds.includes(actionId)
  ) {
    return { runtime, armorPierceLayers: 0, wardPierceLayers: 0 };
  }
  const armorPierceLayers = targetLayers.kineticArmor > 0 ? 1 : 0;
  const wardPierceLayers = targetLayers.occultWards > 0 ? 1 : 0;
  let next: RequisitionRuntime = {
    ...runtime,
    combatPreparation: {
      ...combat,
      consumedEncounterIds: [...combat.consumedEncounterIds, encounter.encounterId],
      empoweredActionIds: [...combat.empoweredActionIds, actionId],
      bypassedArmorLayers: combat.bypassedArmorLayers + armorPierceLayers,
      bypassedWardLayers: combat.bypassedWardLayers + wardPierceLayers,
    },
  };
  next = patchKeepsakeStats(next, {
    eligibleCombatEncountersConsumed:
      next.stats.eligibleCombatEncountersConsumed + 1,
    empoweredPiercingActions: next.stats.empoweredPiercingActions + 1,
    armorLayersBypassed: next.stats.armorLayersBypassed + armorPierceLayers,
    wardLayersBypassed: next.stats.wardLayersBypassed + wardPierceLayers,
  });
  next = recordKeepsakeTrigger(
    next,
    `kinetic_battery:${encounter.encounterId}`,
    EXPEDITION_REQUISITION_REGISTRY.kinetic_battery.triggerMessage,
  );
  return { runtime: next, armorPierceLayers, wardPierceLayers };
}

export function interceptChalkLineHostileEffect(
  runtime: RequisitionRuntime | null,
  encounter: RequisitionEncounterDescriptor,
  effectId: string,
  eligibleHostileDebuffOrControl: boolean,
  unpreventable: boolean,
): { runtime: RequisitionRuntime | null; prevented: boolean } {
  const combat = runtime?.combatPreparation;
  if (
    !runtime ||
    combat?.kind !== 'chalk_line_ward' ||
    combat.currentEncounterId !== encounter.encounterId ||
    !combat.currentWardAvailable ||
    !eligibleHostileDebuffOrControl ||
    unpreventable
  ) {
    return { runtime, prevented: false };
  }
  let next: RequisitionRuntime = {
    ...runtime,
    combatPreparation: {
      ...combat,
      currentWardAvailable: false,
      preventedEffectIds: [...combat.preventedEffectIds, effectId],
    },
  };
  next = patchKeepsakeStats(next, {
    hostileEffectsPrevented: next.stats.hostileEffectsPrevented + 1,
  });
  next = recordKeepsakeTrigger(
    next,
    `chalk_line_ward:${encounter.encounterId}`,
    EXPEDITION_REQUISITION_REGISTRY.chalk_line_ward.triggerMessage,
  );
  return { runtime: next, prevented: true };
}

export function completeRequisitionCombatEncounter(
  runtime: RequisitionRuntime | null,
  encounter: RequisitionEncounterDescriptor,
): RequisitionRuntime | null {
  const combat = runtime?.combatPreparation;
  if (!runtime || !combat) return runtime;
  if (
    combat.kind === 'reinforced_trench_coat' &&
    combat.protectedEncounterId === encounter.encounterId
  ) {
    return {
      ...runtime,
      combatPreparation: { ...combat, protectionSpent: true },
    };
  }
  if (
    combat.kind === 'chalk_line_ward' &&
    combat.currentEncounterId === encounter.encounterId
  ) {
    return {
      ...runtime,
      combatPreparation: {
        ...combat,
        currentEncounterId: null,
        currentWardAvailable: false,
      },
    };
  }
  return runtime;
}
