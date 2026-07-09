import type { CargoRunState } from '../../types/cargoGrid';
import type { CheckStatus, EnvironmentalModifiers, NarrativeChoiceKey } from '../../types/game';
import type { RunState } from '../../types/run';
import type { ProceduralNarrativeAssembly } from '../../types/narrativeProcedural';
import type { NarrativePenalty } from '../../types/narrativeAssembly';
import {
  isOptionABruteForce,
  isOptionBClassResolver,
  isOptionDRetreat,
  jsonItemToCargoItemId,
} from '../../types/narrativeAssembly';
import type { IncursionProgressState } from '../../types/game';
import { consumeCargoItem } from '../cargoGridEngine';
import { resolveNarrativeCreditPayout } from '../combatCredits';
import type { NarrativeResolutionResult, OperativeResourceSnapshot } from '../narrativeEncounterMatrix';
import type { ProceduralEligibilityContext } from './narrativeProceduralEngine';
import {
  evaluateItemResolverEligibility,
  evaluateOptionBEligibility,
  lookupAssemblyEncounterParts,
} from './narrativeAssemblyBridge';
import { creditsFromReward } from './narrativeDynamicAssembly';
import type { NarrativeBonusReward } from '../../types/narrativeBonusReward';
import {
  bonusRewardCredits,
  formatNarrativeBonusLogLine,
} from './narrativeBonusLoot';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyResonanceSpike(
  env: EnvironmentalModifiers,
  spike: number,
): EnvironmentalModifiers {
  if (spike <= 0) return env;
  return {
    ...env,
    resonancePercent: clamp((env.resonancePercent ?? 0) + spike, 0, 100),
  };
}

function parseCredits(text: string): number {
  const match = text.match(/(\d+)\s*Credits?/i);
  return match ? Number.parseInt(match[1] ?? '0', 10) : 0;
}

function parseHpDelta(text: string): number {
  const parenMatch = text.match(/\(([-+]?\d+)\s*HP\)/i);
  if (parenMatch) return Math.abs(Number.parseInt(parenMatch[1] ?? '0', 10));
  const directMatch = text.match(/([-+]?\d+)\s*HP/i);
  if (directMatch) return Math.abs(Number.parseInt(directMatch[1] ?? '0', 10));
  const damageMatch = text.match(/(\d+)\s*(?:Kinetic|Occult|Caustic)\s*Damage/i);
  return damageMatch ? Number.parseInt(damageMatch[1] ?? '0', 10) : 0;
}

function parseResonanceDelta(text: string): number {
  const match = text.match(/([-+]?\d+)\s*Resonance/i);
  return match ? Number.parseInt(match[1] ?? '0', 10) : 0;
}

function triggersAmbush(text: string): boolean {
  return /ambush|combat encounter|start combat/i.test(text);
}

function applyPenalty(
  penalty: NarrativePenalty,
  snapshot: OperativeResourceSnapshot,
  runPatch: Partial<RunState>,
  env: EnvironmentalModifiers,
): { runPatch: Partial<RunState>; env: EnvironmentalModifiers; resonanceDelta: number } {
  let resonanceDelta = 0;
  let nextRunPatch = { ...runPatch };
  let nextEnv = env;

  if (penalty.type === 'HP') {
    nextRunPatch.soulAnchorIntegrity = clamp(
      snapshot.soulAnchorIntegrity - penalty.amount,
      1,
      snapshot.maxSoulAnchor,
    );
  } else {
    resonanceDelta += penalty.amount;
    nextEnv = applyResonanceSpike(nextEnv, penalty.amount);
  }

  return { runPatch: nextRunPatch, env: nextEnv, resonanceDelta };
}

function blockedResult(
  progress: IncursionProgressState,
  env: EnvironmentalModifiers,
  outcome: string,
): NarrativeResolutionResult {
  return {
    logLines: [outcome],
    flagsAdded: [],
    progress,
    runPatch: {},
    status: 'FAILURE',
    outcomeText: outcome,
    environmentalModifiers: env,
    cryptoGlimmerGrantPct: 0,
    triggerCombatAmbush: false,
  };
}

export function resolveAssemblyNarrativeChoice(
  assembly: ProceduralNarrativeAssembly,
  choice: NarrativeChoiceKey,
  status: CheckStatus,
  progress: IncursionProgressState,
  env: EnvironmentalModifiers,
  snapshot: OperativeResourceSnapshot,
  eligibility: ProceduralEligibilityContext,
  options?: { counterfeitMandate?: boolean },
): NarrativeResolutionResult {
  const encounter = lookupAssemblyEncounterParts(assembly);
  if (!encounter) {
    return blockedResult(progress, env, '>> ASSEMBLY RESOLVER MISSING FROM CATALOG.');
  }

  const { context, complication, resolverSet } = encounter;
  const usedIds = [...progress.usedNarrativeEventIds, assembly.assemblyId];
  const defaultPenalty = complication.defaultPenalty;
  const encounterBonusReward = assembly.bonusReward ?? encounter.bonusReward;

  if (choice === 'D') {
    if (isOptionDRetreat(resolverSet.optionD)) {
      return {
        logLines: ['>> ABORT PROTOCOL — EXPEDITION RESOLVER DISENGAGED.', '>> RETURNING TO SCANNER HUB.'],
        flagsAdded: [],
        progress,
        runPatch: {},
        status: 'NOT_TESTED' as CheckStatus,
        outcomeText: '>> ABORT CONFIRMED — ROUTING TERMINAL BACK TO LEY-LINE GRID.',
        environmentalModifiers: env,
        cryptoGlimmerGrantPct: 0,
        triggerCombatAmbush: false,
        abortToScanner: true,
      };
    }

    let runPatch: Partial<RunState> = {};
    let nextEnv = env;
    let resonanceDelta = parseResonanceDelta(resolverSet.optionD.onSuccess);
    const hpCost = parseHpDelta(resolverSet.optionD.onSuccess);
    if (hpCost > 0) {
      runPatch.soulAnchorIntegrity = clamp(
        snapshot.soulAnchorIntegrity - hpCost,
        1,
        snapshot.maxSoulAnchor,
      );
    }
    if (resonanceDelta !== 0) {
      nextEnv = applyResonanceSpike(nextEnv, Math.abs(resonanceDelta));
    }
    const triggerCombatAmbush = triggersAmbush(resolverSet.optionD.onSuccess);
    const pendingRunCredits = resolveNarrativeCreditPayout(
      parseCredits(resolverSet.optionD.onSuccess),
      'SUCCESS',
    );

    return {
      logLines: [
        `>> BRUTE FORCE — ${resolverSet.optionD.text}`,
        `>> ${resolverSet.optionD.onSuccess}`,
      ],
      flagsAdded: [],
      progress: {
        ...progress,
        usedNarrativeEventIds: usedIds,
        pendingCombatAmbush: triggerCombatAmbush || progress.pendingCombatAmbush,
      },
      runPatch,
      status: 'SUCCESS',
      outcomeText: `>> BRUTE FORCE — ${resolverSet.optionD.onSuccess}`,
      environmentalModifiers: nextEnv,
      cryptoGlimmerGrantPct: 0,
      triggerCombatAmbush,
      pendingRunCredits,
      resonanceDelta,
    };
  }

  let runPatch: Partial<RunState> = {};
  let cargoPatch: CargoRunState | undefined;
  let nextEnv = env;
  let resonanceDelta = 0;
  let triggerCombatAmbush = false;
  let pendingRunCredits = 0;
  let bonusCreditAddon = 0;
  let bonusReward: NarrativeBonusReward | undefined;
  const logLines: string[] = [`>> ASSEMBLY RESOLVER // ${context.id}`];
  let outcome = '';
  let resolveStatus: CheckStatus = 'SUCCESS';

  const grantBonusLoot = () => {
    if (!encounterBonusReward) return;
    bonusReward = encounterBonusReward;
    bonusCreditAddon += bonusRewardCredits(bonusReward);
    logLines.push(formatNarrativeBonusLogLine(bonusReward));
  };

  if (choice === 'A') {
    if (isOptionABruteForce(resolverSet.optionA)) {
      const penaltyResult = applyPenalty(defaultPenalty, snapshot, runPatch, nextEnv);
      runPatch = penaltyResult.runPatch;
      nextEnv = penaltyResult.env;
      resonanceDelta += penaltyResult.resonanceDelta;
      pendingRunCredits = creditsFromReward(complication.defaultReward);
      logLines.push(`>> BRUTE FORCE — ${resolverSet.optionA.onSuccess}`);
      outcome = `>> BRUTE FORCE — ${resolverSet.optionA.onSuccess}`;
      grantBonusLoot();
    } else if (status === 'FAILURE') {
      const penaltyResult = applyPenalty(defaultPenalty, snapshot, runPatch, nextEnv);
      runPatch = penaltyResult.runPatch;
      nextEnv = penaltyResult.env;
      resonanceDelta += penaltyResult.resonanceDelta;
      triggerCombatAmbush = triggersAmbush(resolverSet.optionA.onFailure);
      resolveStatus = 'FAILURE';
      logLines.push(`>> MECHANIC FAILURE — ${resolverSet.optionA.onFailure}`);
      outcome = `>> MECHANIC FAILURE — ${resolverSet.optionA.onFailure}`;
    } else {
      pendingRunCredits = parseCredits(resolverSet.optionA.onSuccess);
      resonanceDelta += parseResonanceDelta(resolverSet.optionA.onSuccess);
      if (resonanceDelta !== 0) {
        nextEnv = applyResonanceSpike(nextEnv, Math.abs(resonanceDelta));
      }
      logLines.push(`>> MECHANIC SUCCESS — ${resolverSet.optionA.onSuccess}`);
      outcome = `>> MECHANIC SUCCESS — ${resolverSet.optionA.onSuccess}`;
      grantBonusLoot();
    }
  }

  if (choice === 'B') {
    const gate = evaluateOptionBEligibility(resolverSet.optionB, eligibility);
    const counterfeitBypass = options?.counterfeitMandate === true && gate.locked;
    if (gate.locked && !counterfeitBypass) {
      return blockedResult(progress, env, `>> ${gate.lockReason ?? 'REQUIREMENTS NOT MET'}.`);
    }
    if (counterfeitBypass && isOptionBClassResolver(resolverSet.optionB)) {
      return blockedResult(progress, env, '>> COUNTERFEIT MANDATE — class authorization cannot be spoofed.');
    }
    pendingRunCredits = parseCredits(resolverSet.optionB.onSuccess)
      || creditsFromReward(complication.defaultReward);
    resonanceDelta += parseResonanceDelta(resolverSet.optionB.onSuccess);
    if (resonanceDelta !== 0) {
      nextEnv = applyResonanceSpike(nextEnv, resonanceDelta);
    }
    logLines.push(`>> BYPASS — ${resolverSet.optionB.onSuccess}`);
    outcome = `>> BYPASS — ${resolverSet.optionB.onSuccess}`;
    grantBonusLoot();
  }

  if (choice === 'C') {
    const gate = evaluateItemResolverEligibility(resolverSet.optionC, eligibility.cargo);
    if (gate.locked) {
      return blockedResult(progress, env, `>> ${gate.lockReason ?? 'REQUIREMENTS NOT MET'}.`);
    }
    const cargoItemId = jsonItemToCargoItemId(resolverSet.optionC.requirementValue);
    if (!cargoItemId) {
      return blockedResult(progress, env, '>> ITEM NOT MAPPED IN CARGO CATALOG.');
    }
    const consumed = consumeCargoItem(eligibility.cargo, cargoItemId);
    if (!consumed) {
      return blockedResult(progress, env, '>> ITEM NOT FOUND IN CARGO GRID.');
    }
    cargoPatch = consumed;
    pendingRunCredits = parseCredits(resolverSet.optionC.onSuccess)
      || creditsFromReward(complication.defaultReward);
    logLines.push(`>> ITEM BYPASS — ${resolverSet.optionC.onSuccess}`);
    outcome = `>> ITEM BYPASS — ${resolverSet.optionC.onSuccess}`;
    grantBonusLoot();
  }

  pendingRunCredits = resolveNarrativeCreditPayout(pendingRunCredits, resolveStatus) + bonusCreditAddon;
  if (pendingRunCredits > 0) {
    logLines.push(`>> RUN CREDITS PENDING — +${pendingRunCredits} on node clear.`);
  }

  return {
    logLines,
    flagsAdded: [],
    progress: {
      ...progress,
      usedNarrativeEventIds: usedIds,
      pendingCombatAmbush: triggerCombatAmbush || progress.pendingCombatAmbush,
    },
    runPatch,
    cargoPatch,
    status: resolveStatus,
    outcomeText: outcome,
    environmentalModifiers: nextEnv,
    cryptoGlimmerGrantPct: 0,
    triggerCombatAmbush,
    pendingRunCredits,
    resonanceDelta,
    bonusReward,
  };
}
