import type { CargoRunState } from '../types/cargoGrid';
import { createDefaultCargoRunState } from '../types/cargoGrid';
import type { ActiveIncursionState } from '../types/game';
import { createDefaultActiveIncursionState } from '../types/game';
import type { RunItemValidationIssue } from './runItemValidation';
import {
  buildRunItemDebriefSummary,
  simulateRunItemDebriefReport,
} from './runDebriefRunItemEngine';
import {
  buildRunItemLiveCounters,
  buildRunItemRiskLines,
  buildRunItemRunStatusEntries,
  formatRunItemTriggerToast,
} from './runItemRunUiEngine';
import {
  createDefaultRunItemRuntime,
  createDefaultRunItemsSlotState,
  RUN_ITEM_COMBAT_IDS,
} from '../types/runItem';
import type { RunItemId, RunItemsSlotState } from '../types/runItem';
import { ALL_RUN_ITEM_IDS, FORBIDDEN_RUN_ITEM_IDS } from '../types/runItem';
import { RUN_ITEM_REGISTRY } from './runItemRegistry';
import { rollBlackMarketStock } from './blackMarket';
import { simulateRunItemMarketStock } from './runItemMarketEngine';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';
import {
  consumeGraveDustStaminaCrash,
  resolveRunItemCombatUse,
  type RunItemCombatResolveContext,
} from './runItemCombatEngine';
import {
  mergeRunItemRuntime,
  resetRunItemCombatCounters,
  resetRunItemTurnCounters,
} from './runItemRunState';
import {
  setRunItemInSlot,
  tryAutoPlaceRunItem,
} from './runItemInventoryEngine';
import {
  useContainmentFoamFieldTool,
  useDeadDropTokenFieldTool,
  useRelaySpikeFieldTool,
} from './runItemFieldEngine';

function issue(
  severity: RunItemValidationIssue['severity'],
  message: string,
  itemId?: RunItemValidationIssue['itemId'],
): RunItemValidationIssue {
  return { severity, message, itemId };
}

function createCombatCtx(
  runtime = createDefaultRunItemRuntime(),
): RunItemCombatResolveContext {
  return {
    maxSoulAnchor: 100,
    currentSoulAnchor: 40,
    currentStamina: 50,
    maxStamina: 100,
    runtime,
    livingEnemyCount: +2,
  };
}

function createAcceptanceIncursion(
  slots?: RunItemsSlotState,
  cargo?: CargoRunState,
): ActiveIncursionState {
  return {
    ...createDefaultActiveIncursionState(),
    isRunActive: true,
    runItems: slots ?? createDefaultRunItemsSlotState(),
    itemRuntime: createDefaultRunItemRuntime(),
    cargo: cargo ?? createDefaultCargoRunState(),
  };
}

function fillAllRunItemSlots(): RunItemsSlotState {
  let slots = createDefaultRunItemsSlotState();
  slots = setRunItemInSlot(slots, 'COMBAT', 0, 'standard-coagulant');
  slots = setRunItemInSlot(slots, 'COMBAT', 1, 'trauma-patch');
  slots = setRunItemInSlot(slots, 'FIELD', 0, 'sonar-ping');
  slots = setRunItemInSlot(slots, 'FIELD', 1, 'dead-drop-token');
  return slots;
}

/** Only one combat consumable may resolve per player turn. */
export function validateCombatItemPerTurnGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const first = resolveRunItemCombatUse('standard-coagulant', createCombatCtx());
  if (first.rejected) {
    issues.push(issue('error', `First combat item rejected unexpectedly: ${first.rejected}.`));
    return issues;
  }
  const second = resolveRunItemCombatUse('trauma-patch', {
    ...createCombatCtx(),
    runtime: first.runtime,
  });
  if (!second.rejected) {
    issues.push(issue('error', 'Second combat item in the same turn resolved — per-turn guard broken.'));
  }
  return issues;
}

/** Bloodwire Tourniquet — once per combat even after turn counters reset. */
export function validateBloodwireOncePerCombatGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const first = resolveRunItemCombatUse('bloodwire-tourniquet', createCombatCtx());
  if (first.rejected) {
    issues.push(issue('error', 'Bloodwire first use rejected.', 'bloodwire-tourniquet'));
    return issues;
  }
  const resetTurn = resetRunItemTurnCounters(first.runtime);
  const second = resolveRunItemCombatUse('bloodwire-tourniquet', {
    ...createCombatCtx(),
    runtime: resetTurn,
  });
  if (!second.rejected) {
    issues.push(issue('error', 'Bloodwire fired twice in one combat — guard broken.', 'bloodwire-tourniquet'));
  }
  return issues;
}

/** Mirror-Salt Vial — cannot echo twice in the same turn. */
export function validateMirrorSaltOncePerTurnGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const runtime = mergeRunItemRuntime(createDefaultRunItemRuntime(), {
    mirrorSaltUsedThisTurn: true,
  });
  const outcome = resolveRunItemCombatUse('mirror-salt-vial', createCombatCtx(runtime));
  if (!outcome.rejected?.includes('Mirror-Salt')) {
    issues.push(issue('error', 'Mirror-Salt guard did not reject duplicate turn use.', 'mirror-salt-vial'));
  }
  return issues;
}

/** Grave-Dust uses turn-scoped AP and schedules a one-shot stamina crash — no persistent AP effect. */
export function validateGraveDustApAndCrashGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const outcome = resolveRunItemCombatUse('grave-dust-ampoule', createCombatCtx());
  if (outcome.rejected) {
    issues.push(issue('error', 'Grave-Dust ampoule rejected on first use.', 'grave-dust-ampoule'));
    return issues;
  }
  if (outcome.result.grantBonusAp !== 1) {
    issues.push(issue('error', 'Grave-Dust must grant +1 AP for the current turn only.', 'grave-dust-ampoule'));
  }
  const hasCrash = outcome.runtime.pendingEffects.some((effect) => effect.kind === 'grave_dust_stamina_crash');
  if (!hasCrash) {
    issues.push(issue('error', 'Grave-Dust must schedule next-turn stamina crash.', 'grave-dust-ampoule'));
  }
  const hasPersistentAp = outcome.runtime.pendingEffects.some((effect) => (
    effect.kind === 'grave_dust_bonus_ap_persistent'
    || effect.kind === 'grave_dust_bonus_ap_duplicate_path'
  ));
  if (hasPersistentAp) {
    issues.push(issue('error', 'Grave-Dust created forbidden persistent AP pending effect.', 'grave-dust-ampoule'));
  }
  return issues;
}

/** Grave-Dust crash pending effect clears after one turn-start consumption. */
export function validateGraveDustCrashSingleFireGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const outcome = resolveRunItemCombatUse('grave-dust-ampoule', createCombatCtx());
  const firstCrash = consumeGraveDustStaminaCrash(outcome.runtime);
  if (firstCrash.staminaLoss <= 0) {
    issues.push(issue('error', 'Grave-Dust crash did not apply stamina loss on first turn start.', 'grave-dust-ampoule'));
  }
  const secondCrash = consumeGraveDustStaminaCrash(firstCrash.runtime);
  if (secondCrash.staminaLoss > 0) {
    issues.push(issue('error', 'Grave-Dust crash fired twice — pending effect guard broken.', 'grave-dust-ampoule'));
  }
  return issues;
}

/** All combat consumables resolve a wired behavior (no default reject path). */
export function validateCombatBehaviorWiringGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  RUN_ITEM_COMBAT_IDS.forEach((itemId) => {
    const outcome = resolveRunItemCombatUse(itemId, createCombatCtx());
    if (outcome.rejected?.includes('not wired')) {
      issues.push(issue('error', `Combat useBehavior not wired for ${itemId}.`, itemId));
    }
  });
  return issues;
}

/** Dead-Drop Token cannot bank Apex cargo. */
export function validateDeadDropApexGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const cargo: CargoRunState = {
    ...createDefaultCargoRunState(),
    containment: [{
      instanceId: 'apex-1',
      itemId: 'anomalous-core',
      currentValue: 500,
    }],
  };
  const slots = setRunItemInSlot(createDefaultRunItemsSlotState(), 'FIELD', 0, 'dead-drop-token');
  const inc = createAcceptanceIncursion(slots, cargo);
  const outcome = useDeadDropTokenFieldTool(inc);
  if (outcome.success) {
    issues.push(issue('error', 'Dead-Drop Token banked Apex cargo.', 'dead-drop-token'));
  }
  if (!outcome.logLine.includes('Apex')) {
    issues.push(issue('warn', 'Dead-Drop Apex rejection message missing Apex keyword.', 'dead-drop-token'));
  }
  return issues;
}

/** Containment Foam cannot protect Apex cargo. */
export function validateContainmentFoamApexGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const cargo: CargoRunState = {
    ...createDefaultCargoRunState(),
    containment: [{
      instanceId: 'apex-foam',
      itemId: 'sealed-containment-casket',
      currentValue: 400,
    }],
  };
  const slots = setRunItemInSlot(createDefaultRunItemsSlotState(), 'FIELD', 0, 'containment-foam');
  const inc = createAcceptanceIncursion(slots, cargo);
  const outcome = useContainmentFoamFieldTool(inc, 'apex-foam');
  if (outcome.success) {
    issues.push(issue('error', 'Containment Foam protected Apex cargo.', 'containment-foam'));
  }
  return issues;
}

/** Relay Spike cannot modify boss nodes. */
export function validateRelaySpikeBossGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const slots = setRunItemInSlot(createDefaultRunItemsSlotState(), 'FIELD', 0, 'relay-spike');
  const inc = createAcceptanceIncursion(slots);
  const outcome = useRelaySpikeFieldTool(inc, 'boss-node', true);
  if (outcome.success) {
    issues.push(issue('error', 'Relay Spike planted on boss node.', 'relay-spike'));
  }
  return issues;
}

/** Full slot buckets reject silent auto-overwrite. */
export function validateRunItemSlotFullGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const full = fillAllRunItemSlots();
  const placement = tryAutoPlaceRunItem(full, 'broker-flashcard');
  if (placement.placed) {
    issues.push(issue('error', 'Auto-place overwrote a full run item loadout.'));
  }
  if (placement.placed !== false || placement.slotType !== 'FIELD') {
    issues.push(issue('error', 'Full slot auto-place did not report FIELD bucket saturation.'));
  }
  return issues;
}

/** Turn/combat counter resets restore combat item budget without reviving Bloodwire. */
export function validateRunItemCounterResetGuard(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  let runtime = createDefaultRunItemRuntime();
  runtime = mergeRunItemRuntime(runtime, {
    combatItemsUsedThisTurn: 1,
    bloodwireUsedThisCombat: true,
    mirrorSaltUsedThisTurn: true,
  });
  const afterTurn = resetRunItemTurnCounters(runtime);
  if (afterTurn.combatItemsUsedThisTurn !== 0) {
    issues.push(issue('error', 'Turn reset did not clear combatItemsUsedThisTurn.'));
  }
  if (afterTurn.mirrorSaltUsedThisTurn) {
    issues.push(issue('error', 'Turn reset did not clear mirrorSaltUsedThisTurn.'));
  }
  if (!afterTurn.bloodwireUsedThisCombat) {
    issues.push(issue('error', 'Turn reset cleared bloodwireUsedThisCombat (must persist until combat end).'));
  }
  const afterCombat = resetRunItemCombatCounters(afterTurn);
  if (afterCombat.bloodwireUsedThisCombat) {
    issues.push(issue('error', 'Combat reset did not clear bloodwireUsedThisCombat.'));
  }
  return issues;
}

/** Empty loadout/runtime remains a no-op across debrief + HUD helpers. */
export function validateRunItemNoLoadoutRegression(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const slots = createDefaultRunItemsSlotState();
  const runtime = createDefaultRunItemRuntime();

  if (buildRunItemDebriefSummary(runtime, slots) !== null) {
    issues.push(issue('error', 'Empty debrief summary should return null when nothing slotted or triggered.'));
  }
  if (buildRunItemLiveCounters(runtime, slots).length > 0) {
    issues.push(issue('error', 'Live counters should be empty with no slotted items and neutral runtime.'));
  }
  if (buildRunItemRiskLines(runtime).length > 0) {
    issues.push(issue('error', 'Risk lines should be empty for default runtime.'));
  }
  if (buildRunItemRunStatusEntries(runtime, slots).length > 0) {
    issues.push(issue('error', 'Run status entries should be empty without slotted items.'));
  }

  const toast = formatRunItemTriggerToast(runtime, 'Test trigger.', slots);
  if (!toast.includes('RUN ITEM')) {
    issues.push(issue('error', 'Trigger toast should fall back to RUN ITEM label when no items slotted.'));
  }

  const debriefSim = simulateRunItemDebriefReport(null, slots);
  if (!debriefSim.includes('none slotted')) {
    issues.push(issue('error', 'Debrief simulation should report none slotted for empty loadout.'));
  }

  return issues;
}

/** Static roster / market / crafting acceptance checks. */
export function validateRunItemStaticAcceptance(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];

  if (ALL_RUN_ITEM_IDS.length !== 24) {
    issues.push(issue('error', `Expected 24 run items, found ${ALL_RUN_ITEM_IDS.length}.`));
  }

  FORBIDDEN_RUN_ITEM_IDS.forEach((forbiddenId) => {
    if (ALL_RUN_ITEM_IDS.includes(forbiddenId as RunItemId)) {
      issues.push(issue('error', `${forbiddenId} must not appear in the run item roster.`, forbiddenId));
    }
  });

  ALL_RUN_ITEM_IDS.forEach((itemId) => {
    const def = RUN_ITEM_REGISTRY[itemId];
    if (def.family === 'COMBAT_CONSUMABLE' && def.slotType !== 'COMBAT') {
      issues.push(issue('error', `${itemId} combat family must use COMBAT slot.`, itemId));
    }
    if (def.family === 'FIELD_TOOL' && def.slotType !== 'FIELD') {
      issues.push(issue('error', `${itemId} field family must use FIELD slot.`, itemId));
    }
  });

  const craftRecipes = buildRunItemCraftingRecipes();
  if (craftRecipes.length < 20) {
    issues.push(issue('warn', `Expected most run items craftable; only ${craftRecipes.length} craft recipes generated.`));
  }

  const marketStock = rollBlackMarketStock();
  if (marketStock.length < 3 || marketStock.length > 5) {
    issues.push(issue('warn', `Black market stock should be 3–5 listings; got ${marketStock.length}.`));
  }

  const runItemMarket = simulateRunItemMarketStock(1);
  const hasCombat = runItemMarket.some((itemId) => RUN_ITEM_REGISTRY[itemId].slotType === 'COMBAT');
  if (!hasCombat) {
    issues.push(issue('error', 'Run item market roll must include at least one combat consumable.'));
  }

  return issues;
}

/** Consolidated duplication-guard and regression acceptance scenarios. */
export function validateRunItemAcceptance(): RunItemValidationIssue[] {
  return [
    ...validateRunItemStaticAcceptance(),
    ...validateRunItemNoLoadoutRegression(),
    ...validateCombatItemPerTurnGuard(),
    ...validateBloodwireOncePerCombatGuard(),
    ...validateMirrorSaltOncePerTurnGuard(),
    ...validateGraveDustApAndCrashGuard(),
    ...validateGraveDustCrashSingleFireGuard(),
    ...validateCombatBehaviorWiringGuard(),
    ...validateDeadDropApexGuard(),
    ...validateContainmentFoamApexGuard(),
    ...validateRelaySpikeBossGuard(),
    ...validateRunItemSlotFullGuard(),
    ...validateRunItemCounterResetGuard(),
  ];
}

export function formatRunItemAcceptanceReport(issues: RunItemValidationIssue[]): string {
  if (issues.length === 0) {
    return 'RUN ITEM ACCEPTANCE — OK (0 issues).';
  }
  const errors = issues.filter((entry) => entry.severity === 'error').length;
  const warnings = issues.filter((entry) => entry.severity === 'warn').length;
  const lines = [
    `RUN ITEM ACCEPTANCE — ${errors} error(s), ${warnings} warning(s).`,
    ...issues.map((entry) => `- [${entry.severity.toUpperCase()}] ${entry.message}`),
  ];
  return lines.join('\n');
}
