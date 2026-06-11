import type { ActiveIncursionState } from '../types/game';
import type { RunState } from '../types/run';
import type {
  BoundRequisitionId,
  BoundRequisitionRuntime,
} from '../types/boundRequisition';
import { createDefaultBoundRequisitionRuntime } from '../types/boundRequisition';
import { getBoundRequisitionDefinition } from './boundRequisitions';
import { placeCargoAtFirstOpenSlot } from './cargoGridEngine';
import { pickRandomLeyLineMutations } from './leyLineMutations';
import type { LeyLineMutationId } from '../types/leyLineMutation';

const POWERFUL_MUTATION_IDS: LeyLineMutationId[] = [
  'EVENT_HORIZON',
  'ABYSSAL_OVERFLOW',
  'EXECUTIONERS_GRIP',
  'NULL_ZONE',
  'FINAL_STAND',
  'UNSTOPPABLE_FORCE',
];

export interface BoundRequisitionApplyResult {
  runPatch: Partial<RunState>;
  incursionPatch: Partial<ActiveIncursionState>;
  logLines: string[];
}

function scaleHp(run: RunState, multiplier: number): Partial<RunState> {
  const maxSoulAnchor = Math.max(1, Math.floor(run.maxSoulAnchor * multiplier));
  const soulAnchorIntegrity = Math.max(1, Math.floor(run.soulAnchorIntegrity * multiplier));
  return { maxSoulAnchor, soulAnchorIntegrity };
}

function pickPowerfulMutation(owned: readonly LeyLineMutationId[]): LeyLineMutationId {
  const pool = POWERFUL_MUTATION_IDS.filter((id) => !owned.includes(id));
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const fallback = pickRandomLeyLineMutations(1, owned);
  return fallback[0]?.id ?? 'ABYSSAL_RESONANCE';
}

export function buildBoundRequisitionRuntime(id: BoundRequisitionId): BoundRequisitionRuntime {
  const runtime = createDefaultBoundRequisitionRuntime(id);
  switch (id) {
    case 'ADRENALINE_PRIMER':
      runtime.adrenalinePrimerCombatsRemaining = 3;
      break;
    case 'SMUGGLERS_POCKETS':
      runtime.smugglersPocketsActive = true;
      runtime.extraCargoSlots = 2;
      break;
    case 'CHALK_LINE_WARD':
      runtime.chalkLineWardDepthsRemaining = 3;
      break;
    case 'SCAVENGERS_MARK':
      runtime.scavengerMarkBlackMarketPending = true;
      runtime.blackMarketDiscountPct = 50;
      break;
    case 'WIRETAP_OVERRIDE':
      runtime.wiretapDepthsRemaining = 5;
      break;
    case 'BRIBE_THE_FERRYMAN':
      runtime.bribeFerrymanActive = true;
      runtime.guaranteedEvacDepth = 5;
      runtime.eliteIncomingDamageBonusPct = 10;
      break;
    case 'DEAD_DROP_TRACKER':
      runtime.deadDropTrackerActive = true;
      break;
    case 'HOLLOW_POINT_REQUISITION':
      runtime.hollowPointActive = true;
      break;
    case 'VOID_TOUCHED_ARTIFACT':
      runtime.voidTouchedArtifactActive = true;
      runtime.lockedCargoSlots = 2;
      break;
    case 'APEX_BAIT':
      runtime.apexBaitActive = true;
      runtime.eliteLootMultiplier = 2;
      break;
    case 'MARTYRS_BARGAIN':
      runtime.martyrsBargainActive = true;
      break;
    case 'IRONCLAD_LOGISTICS':
      runtime.ironcladLogisticsActive = true;
      runtime.leyScarsBlocked = true;
      runtime.extraCargoSlots = 4;
      runtime.guaranteedEvacDepth = 10;
      break;
    case 'SUNKEN_RITE':
      runtime.sunkenRiteActive = true;
      runtime.resonanceImmuneDepthsRemaining = 5;
      runtime.leyScarsBlocked = false;
      break;
    case 'ENDLESS_MARCH':
      runtime.endlessMarchActive = true;
      runtime.evacBlocked = true;
      break;
    default:
      break;
  }
  return runtime;
}

export function applyBoundRequisitionAtRunStart(
  id: BoundRequisitionId,
  run: RunState,
  incursion: ActiveIncursionState,
): BoundRequisitionApplyResult {
  const def = getBoundRequisitionDefinition(id);
  const runtime = buildBoundRequisitionRuntime(id);
  const logLines = [
    `>> BOUND REQUISITION LOCKED — ${def.name.toUpperCase()}.`,
    `>> ${def.effectSummary}`,
  ];
  if (def.tradeoffSummary) {
    logLines.push(`>> TRADE-OFF: ${def.tradeoffSummary}`);
  }

  let runPatch: Partial<RunState> = {};
  let incursionPatch: Partial<ActiveIncursionState> = {
    boundRequisition: runtime,
  };

  switch (id) {
    case 'HAZARD_PAY':
      incursionPatch = { ...incursionPatch, runCredits: incursion.runCredits + 50 };
      logLines.push('>> CRED-STICK PRE-LOADED — +50 CREDITS.');
      break;
    case 'STANDARD_ISSUE_COAGULANT': {
      const nextCargo = placeCargoAtFirstOpenSlot(incursion.cargo, 'coagulation-stitch');
      if (nextCargo) {
        incursionPatch = { ...incursionPatch, cargo: nextCargo };
        logLines.push('>> COAGULATION STITCH RACKED IN CARGO DECK.');
      } else {
        logLines.push('>> COAGULANT ISSUE FAILED — CARGO DECK FULL.');
      }
      break;
    }
    case 'ADRENALINE_PRIMER':
      logLines.push('>> ADRENALINE PRIMER ARMED — FIRST-TURN +1 AP × 3 COMBATS.');
      break;
    case 'REINFORCED_TRENCH_COAT':
      runPatch = scaleHp(run, 1.1);
      logLines.push('>> TRENCH-COAT WEAVE — MAX HEALTH +10%.');
      break;
    case 'SMUGGLERS_POCKETS':
      logLines.push('>> SMUGGLER POCKETS SEALED — SCAN RESONANCE PENALTY ACTIVE.');
      break;
    case 'CHALK_LINE_WARD':
      logLines.push('>> CHALK-LINE WARD ACTIVE — ZERO SCAN RESONANCE FOR 3 DEPTHS.');
      break;
    case 'BLOOD_PRICE': {
      const mutationId = pickPowerfulMutation(incursion.leyLineMutations);
      incursionPatch = {
        ...incursionPatch,
        leyLineMutations: [...incursion.leyLineMutations, mutationId],
      };
      runPatch = scaleHp(run, 0.75);
      logLines.push(`>> BLOOD PRICE PAID — LEY-SCAR: ${mutationId} // MAX HP -25%.`);
      break;
    }
    case 'SCAVENGERS_MARK':
      incursionPatch = {
        ...incursionPatch,
        resonance: { percent: 20 },
      };
      logLines.push('>> SCAVENGER MARK TAGGED — RESONANCE 20% // FIRST MARKET -50%.');
      break;
    case 'SUNKEN_RITE': {
      const first = pickPowerfulMutation(incursion.leyLineMutations);
      const second = pickPowerfulMutation([...incursion.leyLineMutations, first]);
      incursionPatch = {
        ...incursionPatch,
        leyLineMutations: [...incursion.leyLineMutations, first, second],
      };
      runPatch = scaleHp(run, 0.5);
      logLines.push(`>> SUNKEN RITE COMPLETE — ${first} + ${second} // MAX HP HALVED.`);
      break;
    }
    case 'APEX_BAIT':
      incursionPatch = {
        ...incursionPatch,
        resonance: { percent: 30 },
      };
      logLines.push('>> APEX BAIT LIT — RESONANCE 30% // ELITE LOOT DOUBLED.');
      break;
    case 'MARTYRS_BARGAIN':
      runPatch = scaleHp(run, 0.5);
      logLines.push(">> MARTYR'S BARGAIN SEALED — 50% MAX HP // DEATH KEEPS 1 CARGO ITEM.");
      break;
    case 'VOID_TOUCHED_ARTIFACT': {
      const nextCargo = placeCargoAtFirstOpenSlot(incursion.cargo, 'rift-iron-cache');
      if (nextCargo) {
        incursionPatch = { ...incursionPatch, cargo: nextCargo };
      }
      logLines.push('>> VOID-TOUCHED ARTIFACT STOWED — 2 CARGO SLOTS LOCKED.');
      break;
    }
    default:
      logLines.push('>> REQUISITION FLAGS REGISTERED — AWAITING DEPTH HOOKS.');
      break;
  }

  return { runPatch, incursionPatch, logLines };
}

export function modifyScanResonanceGain(
  incursion: ActiveIncursionState,
  baseGain: number,
): number {
  const req = incursion.boundRequisition;
  if (!req) return baseGain;

  if (req.chalkLineWardDepthsRemaining > 0 && incursion.currentDepth <= 3) {
    return 0;
  }

  if (req.smugglersPocketsActive) {
    return baseGain + 5;
  }

  return baseGain;
}

export function tickChalkLineWardAfterNodeClear(incursion: ActiveIncursionState): BoundRequisitionRuntime | null {
  const req = incursion.boundRequisition;
  if (!req || req.chalkLineWardDepthsRemaining <= 0) return null;
  if (incursion.nodesCleared >= 3) {
    return { ...req, chalkLineWardDepthsRemaining: 0 };
  }
  return { ...req, chalkLineWardDepthsRemaining: Math.max(0, 3 - incursion.nodesCleared) };
}

export function shouldGrantAdrenalinePrimerAp(incursion: ActiveIncursionState): boolean {
  return (incursion.boundRequisition?.adrenalinePrimerCombatsRemaining ?? 0) > 0;
}

export function consumeAdrenalinePrimerCombat(
  runtime: BoundRequisitionRuntime,
): BoundRequisitionRuntime {
  if (runtime.adrenalinePrimerCombatsRemaining <= 0) return runtime;
  return {
    ...runtime,
    adrenalinePrimerCombatsRemaining: runtime.adrenalinePrimerCombatsRemaining - 1,
  };
}

export function isLeyScarAcquisitionBlocked(incursion: ActiveIncursionState): boolean {
  return incursion.boundRequisition?.leyScarsBlocked === true;
}

export function getEffectiveBlackMarketPrice(basePrice: number, discountPct: number): number {
  if (discountPct <= 0) return basePrice;
  return Math.max(1, Math.floor(basePrice * (1 - discountPct / 100)));
}

export function getBlackMarketDiscountPct(incursion: ActiveIncursionState): number {
  const req = incursion.boundRequisition;
  if (!req?.scavengerMarkBlackMarketPending) return 0;
  return req.blackMarketDiscountPct;
}

export function consumeScavengerMarkDiscount(
  runtime: BoundRequisitionRuntime,
): BoundRequisitionRuntime {
  return { ...runtime, scavengerMarkBlackMarketPending: false };
}
