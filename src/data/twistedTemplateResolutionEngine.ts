import type { DepthIdentityState, TwistedTemplateId } from '../types/depthIdentity';
import type { CargoRunState } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';
import {
  addLootToContainment,
  consumeCargoItem,
} from './cargoGridEngine';
import { recordTwistedTemplateCleared } from './twistedTemplateEngine';
import { getTwistedTemplateDefinition } from './twistedTemplateCatalog';
import { recordTwistedResolutionTelemetry } from './depthIdentityTelemetryEngine';
import { isResourceItemId } from './resourceRegistry';
import { getResourceCategory } from './resourceRegistry';

export type TwistedResolveRoute =
  | 'COMPLETE_NODE'
  | 'CONTINUE_SCREEN'
  | 'START_EMERGENCY_RECALL'
  | 'ABORT_EXTRACTION_REVIEW'
  | 'PROCEED_SAFE_EXTRACT'
  | 'NONE';

export interface TwistedResolutionResult {
  depthIdentity: DepthIdentityState;
  cargo?: CargoRunState;
  logLines: string[];
  healPct?: number;
  damageHp?: number;
  spendCredits?: number;
  operationProgress?: number;
  grantResourceIds?: ResourceItemId[];
  route: TwistedResolveRoute;
  falseExtractBonusCredits?: number;
}

function purgeUnstablePressureCost(
  cargo: CargoRunState,
): { cargo: CargoRunState; purged: boolean; log: string } {
  const unstableIds: ResourceItemId[] = [
    'veil-ash-canister',
    'ossified-ley-knot',
    'anomalous-core',
  ];
  for (const itemId of unstableIds) {
    if (!isResourceItemId(itemId)) continue;
    const next = consumeCargoItem(cargo, itemId);
    if (next) {
      return {
        cargo: next,
        purged: true,
        log: `>> CORRUPTED PURGE — vented ${itemId} pressure from containment.`,
      };
    }
  }
  return {
    cargo,
    purged: false,
    log: '>> CORRUPTED PURGE — no unstable cargo to vent; pressure flagged cleared anyway.',
  };
}

function grantMany(
  cargo: CargoRunState,
  ids: readonly ResourceItemId[],
): CargoRunState {
  let next = cargo;
  for (const id of ids) {
    next = addLootToContainment(next, id, 1);
  }
  return next;
}

function consumeStablePayment(
  cargo: CargoRunState,
): { cargo: CargoRunState; paid: boolean; log: string } {
  for (const itemId of ['ley-slag', 'echo-glass-shard'] as ResourceItemId[]) {
    const next = consumeCargoItem(cargo, itemId);
    if (next) {
      return {
        cargo: next,
        paid: true,
        log: `>> REALITY TAX — paid with ${itemId}.`,
      };
    }
  }
  return {
    cargo,
    paid: false,
    log: '>> REALITY TAX — no stable resource available; pressure uncleared.',
  };
}

function rollVeilCacheGrant(rngSeed: number): ResourceItemId[] {
  const grants: ResourceItemId[] = ['veil-ash-canister'];
  // Deterministic-ish rarity without importing rng — use seed parity.
  if (rngSeed % 7 === 0) {
    grants.push('anomalous-core');
  } else if (rngSeed % 5 === 0) {
    grants.push('sealed-containment-casket');
  } else {
    grants.push('ossified-ley-knot');
  }
  return grants;
}

export function resolveTwistedTemplateChoice(
  state: DepthIdentityState,
  cargo: CargoRunState,
  selectedValue: string,
  runCredits: number,
): TwistedResolutionResult | null {
  const pending = state.pendingTwistedChoice;
  if (!pending) return null;
  const templateId = pending.templateId;
  const def = getTwistedTemplateDefinition(templateId);
  if (!def.options.some((option) => option.value === selectedValue)) {
    return null;
  }

  const cleared = recordTwistedTemplateCleared(state, templateId);
  const baseLog = `>> TWISTED CHOICE — ${def.displayName.toUpperCase()} // ${selectedValue}`;

  let result: TwistedResolutionResult;
  switch (templateId) {
    case 'CORRUPTED_SANCTUARY':
      result = resolveCorruptedSanctuary(cleared, cargo, selectedValue, baseLog, runCredits);
      break;
    case 'FALSE_EXTRACTION_SIGNAL':
      result = resolveFalseExtraction(cleared, cargo, selectedValue, baseLog, runCredits);
      break;
    case 'RESOURCE_BLOOM':
      result = resolveResourceBloom(cleared, cargo, selectedValue, baseLog);
      break;
    case 'ANCHOR_VEIN':
      result = resolveAnchorVein(cleared, cargo, selectedValue, baseLog, runCredits);
      break;
    case 'ANCHOR_CORE_BREACH':
      result = resolveAnchorCoreBreach(cleared, cargo, selectedValue, baseLog);
      break;
    case 'VEIL_PROPER_CACHE':
      result = resolveVeilProperCache(cleared, cargo, selectedValue, baseLog, runCredits);
      break;
    case 'NO_EXIT_SANCTUARY':
      result = resolveNoExitSanctuary(cleared, cargo, selectedValue, baseLog, runCredits);
      break;
    case 'FINAL_ROUTE_FRACTURE':
      result = resolveFinalRouteFracture(cleared, selectedValue, baseLog, runCredits);
      break;
    case 'REALITY_TAX':
      result = resolveRealityTax(cleared, cargo, selectedValue, baseLog, runCredits);
      break;
    default:
      result = {
        depthIdentity: cleared,
        logLines: [baseLog],
        route: 'NONE',
      };
  }

  return {
    ...result,
    depthIdentity: recordTwistedResolutionTelemetry(
      result.depthIdentity,
      templateId,
      selectedValue,
      result.operationProgress,
    ),
  };
}

function resolveCorruptedSanctuary(
  state: DepthIdentityState,
  cargo: CargoRunState,
  selectedValue: string,
  baseLog: string,
  runCredits: number,
): TwistedResolutionResult {
  if (selectedValue === 'REST') {
    return {
      depthIdentity: { ...state, pendingUnstablePressure: true },
      logLines: [
        baseLog,
        '>> CORRUPTED REST — partial attune accepted; next combat may spike High-Risk.',
      ],
      healPct: 0.25,
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'PURGE') {
    const spend = Math.min(40, runCredits);
    const purged = purgeUnstablePressureCost(cargo);
    return {
      depthIdentity: { ...state, pendingUnstablePressure: false },
      cargo: purged.cargo,
      spendCredits: spend > 0 ? spend : undefined,
      logLines: [
        baseLog,
        spend > 0 ? `>> CORRUPTED PURGE — paid ${spend} CR.` : '>> CORRUPTED PURGE — no credits to bleed.',
        purged.log,
      ],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'LISTEN') {
    return {
      depthIdentity: state,
      logLines: [
        baseLog,
        '>> CORRUPTED LISTEN — operation intel siphoned from the conduit.',
      ],
      operationProgress: 8,
      route: 'COMPLETE_NODE',
    };
  }
  return {
    depthIdentity: state,
    logLines: [baseLog, '>> CORRUPTED SANCTUARY — operative withdrew.'],
    route: 'COMPLETE_NODE',
  };
}

function resolveFalseExtraction(
  state: DepthIdentityState,
  _cargo: CargoRunState,
  selectedValue: string,
  baseLog: string,
  runCredits: number,
): TwistedResolutionResult {
  if (selectedValue === 'ATTEMPT') {
    return {
      depthIdentity: {
        ...state,
        falseExtractBonusCreditsPending: 40,
      },
      logLines: [
        baseLog,
        '>> FALSE EXTRACTION — intercept combat forced. Survive to open dirty evac.',
      ],
      route: 'START_EMERGENCY_RECALL',
      falseExtractBonusCredits: 40,
    };
  }
  if (selectedValue === 'STABILIZE') {
    const spend = Math.min(60, runCredits);
    if (spend < 60 && runCredits < 60) {
      return {
        depthIdentity: state,
        logLines: [
          baseLog,
          '>> STABILIZE FAILED — insufficient credits. Aborting false lock.',
        ],
        route: 'ABORT_EXTRACTION_REVIEW',
      };
    }
    return {
      depthIdentity: state,
      spendCredits: spend,
      logLines: [
        baseLog,
        `>> SIGNAL STABILIZED — paid ${spend} CR. Clean safe-anchor review restored.`,
      ],
      route: 'PROCEED_SAFE_EXTRACT',
    };
  }
  return {
    depthIdentity: state,
    logLines: [baseLog, '>> FALSE EXTRACTION IGNORED — continuing descent.'],
    route: 'ABORT_EXTRACTION_REVIEW',
  };
}

function resolveResourceBloom(
  state: DepthIdentityState,
  cargo: CargoRunState,
  selectedValue: string,
  baseLog: string,
): TwistedResolutionResult {
  if (selectedValue === 'HARVEST_CAREFUL') {
    const grant: ResourceItemId[] = ['ley-slag', 'ley-slag'];
    return {
      depthIdentity: state,
      cargo: grantMany(cargo, grant),
      grantResourceIds: grant,
      logLines: [baseLog, '>> RESOURCE BLOOM — careful cut yields stable slag.'],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'OVERHARVEST') {
    const grant: ResourceItemId[] = ['veil-ash-canister', 'echo-glass-shard'];
    return {
      depthIdentity: { ...state, pendingUnstablePressure: true },
      cargo: grantMany(cargo, grant),
      grantResourceIds: grant,
      logLines: [
        baseLog,
        '>> RESOURCE BLOOM OVERHARVEST — unstable ash claimed. Next vector High-Risk elevated.',
      ],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'BURN_SEAL') {
    return {
      depthIdentity: state,
      logLines: [baseLog, '>> RESOURCE BLOOM SEALED — operation contribution transmitted.'],
      operationProgress: 12,
      route: 'COMPLETE_NODE',
    };
  }
  return {
    depthIdentity: state,
    logLines: [baseLog, '>> RESOURCE BLOOM — vein abandoned.'],
    route: 'COMPLETE_NODE',
  };
}

function resolveAnchorVein(
  state: DepthIdentityState,
  cargo: CargoRunState,
  selectedValue: string,
  baseLog: string,
  runCredits: number,
): TwistedResolutionResult {
  if (selectedValue === 'SEVER') {
    return {
      depthIdentity: state,
      damageHp: 12,
      operationProgress: 15,
      logLines: [
        baseLog,
        '>> ANCHOR VEIN SEVERED — Anchor Assault progress surged (−12 Soul Anchor).',
      ],
      route: 'CONTINUE_SCREEN',
    };
  }
  if (selectedValue === 'HARVEST') {
    const grant: ResourceItemId[] = ['echo-glass-shard', 'ley-slag'];
    return {
      depthIdentity: { ...state, pendingUnstablePressure: true },
      cargo: grantMany(cargo, grant),
      grantResourceIds: grant,
      logLines: [
        baseLog,
        '>> ANCHOR VEIN HARVEST — Anchor residue bagged. High-Risk pressure rising.',
      ],
      route: 'CONTINUE_SCREEN',
    };
  }
  if (selectedValue === 'STABILIZE') {
    const spend = Math.min(50, runCredits);
    if (runCredits < 50) {
      return {
        depthIdentity: state,
        logLines: [baseLog, '>> ANCHOR STABILIZE FAILED — insufficient credits.'],
        route: 'CONTINUE_SCREEN',
      };
    }
    return {
      depthIdentity: { ...state, pendingUnstablePressure: false },
      spendCredits: spend,
      logLines: [
        baseLog,
        `>> ANCHOR VEIN STABILIZED — paid ${spend} CR. Pending High-Risk pressure cleared.`,
      ],
      route: 'CONTINUE_SCREEN',
    };
  }
  return {
    depthIdentity: state,
    logLines: [baseLog, '>> ANCHOR VEIN — left untouched.'],
    route: 'CONTINUE_SCREEN',
  };
}

function resolveAnchorCoreBreach(
  state: DepthIdentityState,
  cargo: CargoRunState,
  selectedValue: string,
  baseLog: string,
): TwistedResolutionResult {
  if (selectedValue === 'BREACH') {
    return {
      depthIdentity: { ...state, pendingUnstablePressure: true },
      damageHp: 18,
      operationProgress: 22,
      logLines: [
        baseLog,
        '>> ANCHOR CORE BREACHED — ops surge (−18 Soul Anchor). Next fight High-Risk.',
      ],
      route: 'CONTINUE_SCREEN',
    };
  }
  if (selectedValue === 'SKIM') {
    const grant: ResourceItemId[] = ['veil-ash-canister', 'echo-glass-shard'];
    return {
      depthIdentity: { ...state, pendingUnstablePressure: true },
      cargo: grantMany(cargo, grant),
      grantResourceIds: grant,
      logLines: [baseLog, '>> ANCHOR CORE SKIM — residue claimed under pressure.'],
      route: 'CONTINUE_SCREEN',
    };
  }
  return {
    depthIdentity: state,
    logLines: [baseLog, '>> ANCHOR CORE — operative withdrew.'],
    route: 'CONTINUE_SCREEN',
  };
}

function resolveVeilProperCache(
  state: DepthIdentityState,
  cargo: CargoRunState,
  selectedValue: string,
  baseLog: string,
  runCredits: number,
): TwistedResolutionResult {
  if (selectedValue === 'TAKE') {
    const seed = (state.twistedTemplatesSeen.length * 13)
      + (state.twistedTemplatesCleared.length * 7)
      + runCredits;
    const grant = rollVeilCacheGrant(seed);
    return {
      depthIdentity: { ...state, pendingUnstablePressure: true },
      cargo: grantMany(cargo, grant),
      grantResourceIds: grant,
      logLines: [
        baseLog,
        `>> VEIL PROPER CACHE TAKEN — claimed ${grant.join(', ')}. Next vector danger elevates.`,
      ],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'STABILIZE') {
    if (runCredits < 80) {
      return {
        depthIdentity: state,
        logLines: [baseLog, '>> CACHE STABILIZE FAILED — insufficient credits.'],
        route: 'COMPLETE_NODE',
      };
    }
    const grant: ResourceItemId[] = ['ley-slag'];
    return {
      depthIdentity: state,
      spendCredits: 80,
      cargo: grantMany(cargo, grant),
      grantResourceIds: grant,
      logLines: [baseLog, '>> VEIL CACHE STABILIZED — paid 80 CR for safe slag.'],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'DESTROY') {
    return {
      depthIdentity: state,
      operationProgress: 16,
      logLines: [baseLog, '>> VEIL CACHE DESTROYED — operation contribution transmitted.'],
      route: 'COMPLETE_NODE',
    };
  }
  return {
    depthIdentity: state,
    logLines: [baseLog, '>> VEIL PROPER CACHE — abandoned.'],
    route: 'COMPLETE_NODE',
  };
}

function resolveNoExitSanctuary(
  state: DepthIdentityState,
  _cargo: CargoRunState,
  selectedValue: string,
  baseLog: string,
  runCredits: number,
): TwistedResolutionResult {
  if (selectedValue === 'REST') {
    return {
      depthIdentity: { ...state, pendingUnstablePressure: true },
      healPct: 0.35,
      logLines: [
        baseLog,
        '>> NO-EXIT REST — deep heal accepted; Deep Veil consequence attached.',
      ],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'BARGAIN') {
    if (runCredits < 70) {
      return {
        depthIdentity: state,
        logLines: [baseLog, '>> NO-EXIT BARGAIN FAILED — insufficient credits.'],
        route: 'COMPLETE_NODE',
      };
    }
    return {
      depthIdentity: { ...state, pendingUnstablePressure: false },
      damageHp: 20,
      spendCredits: 70,
      operationProgress: 12,
      logLines: [
        baseLog,
        '>> NO-EXIT BARGAIN — paid blood and credits for ops leverage.',
      ],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'CUT_POWER') {
    return {
      depthIdentity: { ...state, pendingUnstablePressure: false },
      operationProgress: 6,
      logLines: [
        baseLog,
        '>> NO-EXIT POWER CUT — High-Risk pressure vented. No heal.',
      ],
      route: 'COMPLETE_NODE',
    };
  }
  return {
    depthIdentity: state,
    logLines: [baseLog, '>> NO-EXIT SANCTUARY — operative left the wrong altar.'],
    route: 'COMPLETE_NODE',
  };
}

function resolveFinalRouteFracture(
  state: DepthIdentityState,
  selectedValue: string,
  baseLog: string,
  runCredits: number,
): TwistedResolutionResult {
  if (selectedValue === 'FORCE') {
    return {
      depthIdentity: {
        ...state,
        falseExtractBonusCreditsPending: 75,
      },
      logLines: [
        baseLog,
        '>> FINAL ROUTE FRACTURE — intercept forced. Survive for premium dirty extract.',
      ],
      route: 'START_EMERGENCY_RECALL',
      falseExtractBonusCredits: 75,
    };
  }
  if (selectedValue === 'HOLD') {
    if (runCredits < 90) {
      return {
        depthIdentity: state,
        logLines: [
          baseLog,
          '>> HOLD FAILED — insufficient credits. Aborting fractured exit.',
        ],
        route: 'ABORT_EXTRACTION_REVIEW',
      };
    }
    return {
      depthIdentity: state,
      spendCredits: 90,
      logLines: [
        baseLog,
        '>> ROUTE HELD — paid 90 CR. Clean safe-anchor review restored.',
      ],
      route: 'PROCEED_SAFE_EXTRACT',
    };
  }
  return {
    depthIdentity: state,
    logLines: [baseLog, '>> FINAL ROUTE ABORTED — continuing Deep Veil descent.'],
    route: 'ABORT_EXTRACTION_REVIEW',
  };
}

function resolveRealityTax(
  state: DepthIdentityState,
  cargo: CargoRunState,
  selectedValue: string,
  baseLog: string,
  runCredits: number,
): TwistedResolutionResult {
  if (selectedValue === 'PAY_HEALTH') {
    return {
      depthIdentity: { ...state, pendingUnstablePressure: false },
      damageHp: 15,
      operationProgress: 5,
      logLines: [baseLog, '>> REALITY TAX PAID IN BLOOD — High-Risk pressure cleared.'],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'PAY_CREDITS') {
    if (runCredits < 75) {
      return {
        depthIdentity: { ...state, pendingUnstablePressure: true },
        logLines: [baseLog, '>> CREDIT TAX FAILED — insufficient funds. Danger spikes.'],
        route: 'COMPLETE_NODE',
      };
    }
    return {
      depthIdentity: { ...state, pendingUnstablePressure: false },
      spendCredits: 75,
      logLines: [baseLog, '>> REALITY TAX PAID — 75 CR. Path softens.'],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'PAY_STABLE') {
    const paid = consumeStablePayment(cargo);
    return {
      depthIdentity: {
        ...state,
        pendingUnstablePressure: paid.paid ? false : state.pendingUnstablePressure,
      },
      cargo: paid.cargo,
      logLines: [baseLog, paid.log],
      route: 'COMPLETE_NODE',
    };
  }
  if (selectedValue === 'PAY_UNSTABLE') {
    const purged = purgeUnstablePressureCost(cargo);
    return {
      depthIdentity: {
        ...state,
        pendingUnstablePressure: purged.purged ? false : true,
      },
      cargo: purged.cargo,
      operationProgress: purged.purged ? 10 : 0,
      logLines: [
        baseLog,
        purged.purged
          ? '>> REALITY TAX — unstable offering accepted.'
          : '>> REALITY TAX — no unstable cargo; refuse pressure applied.',
      ],
      route: 'COMPLETE_NODE',
    };
  }
  return {
    depthIdentity: { ...state, pendingUnstablePressure: true },
    logLines: [baseLog, '>> REALITY TAX REFUSED — next engagement High-Risk elevated.'],
    route: 'COMPLETE_NODE',
  };
}

/** Touch getResourceCategory so unstable/stable checks stay imported for future validation. */
export function twistedTemplateUsesStableCargoCheck(itemId: string): boolean {
  if (!isResourceItemId(itemId)) return false;
  return getResourceCategory(itemId) === 'STABLE';
}

export type { TwistedTemplateId };
