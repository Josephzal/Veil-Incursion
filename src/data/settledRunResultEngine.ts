import { CARGO_GRID_CELL_COUNT } from '../types/cargoGrid';
import type { ContractResult } from '../types/contract';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type {
  SettledCargoLine,
  SettledContractResult,
  SettledRunResult,
} from '../types/settledRunResult';
import type { OperationDebriefPayload } from './runDebriefEngine';
import { getResourceDisplayName, getResourcePrimaryRole, RESOURCE_REGISTRY } from './resourceRegistry';

/** Max cargo lines shown before summarizing overflow (~6 rows × 2 cols). */
export const SETTLED_CARGO_VISIBLE_BUDGET = 12;

export function buildRunDebriefKey(payload: OperationDebriefPayload): string {
  const time =
    payload.balanceTelemetry?.timeAliveMs
    ?? payload.deathStats?.timeAliveMs
    ?? 0;
  const ledger = payload.runResourceLedger;
  const extracted = ledger ? sumQuantity(ledger.extracted) : 0;
  const lost = ledger ? sumQuantity(ledger.lostOnDeath) : 0;
  const banked = ledger ? sumQuantity(ledger.bankedAtSafehouse) : 0;
  return [
    payload.runOutcome,
    payload.sectorName,
    payload.extractionKind,
    time,
    payload.credits,
    payload.contractResult.status,
    payload.contractResult.title,
    extracted,
    lost,
    banked,
    payload.balanceTelemetry?.nodesCleared ?? 0,
    payload.balanceTelemetry?.maxDepthReached ?? 0,
  ].join('|');
}

export function formatRunDuration(timeAliveMs: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((timeAliveMs ?? 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a readable death cause. Returns null for blank or internal-looking IDs.
 */
export function formatCauseOfDeathLine(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject internal damage-source / enum style IDs.
  if (/^(dmg|src|damage|source)[_:-]/i.test(trimmed)) return null;
  if (/^[A-Z][A-Z0-9]+(_[A-Z0-9]+)+$/.test(trimmed)) return null;
  if (/^[a-f0-9]{8,}$/i.test(trimmed)) return null;

  const withoutPrefix = trimmed.replace(/^defeated by\s+/i, '').trim();
  if (!withoutPrefix || withoutPrefix.length < 2) return null;

  // Prefer mixed-case readable names over raw kebab ids that look technical.
  if (/^[a-z0-9]+(-[a-z0-9]+){2,}$/.test(withoutPrefix) && !/[A-Z]/.test(withoutPrefix)) {
    return null;
  }

  return `Defeated by ${withoutPrefix}`;
}

export function sumQuantity(resources: ResourceQuantity | null | undefined): number {
  if (!resources) return 0;
  return Object.values(resources).reduce((sum, qty) => sum + (qty ?? 0), 0);
}

function isSupernaturalResource(resourceId: ResourceItemId): boolean {
  const entry = RESOURCE_REGISTRY[resourceId];
  if (!entry) return false;
  if (entry.rarity === 'APEX' || entry.rarity === 'RARE') return true;
  const role = getResourcePrimaryRole(resourceId);
  return role === 'OCCULT_CARGO' || role === 'APEX_CARGO' || role === 'VOLATILE_CARGO';
}

export function buildSettledCargoLines(
  resources: ResourceQuantity | null | undefined,
): SettledCargoLine[] {
  if (!resources) return [];
  return (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([resourceId, quantity]) => ({
      resourceId,
      name: getResourceDisplayName(resourceId, false),
      quantity: quantity ?? 0,
      supernatural: isSupernaturalResource(resourceId),
    }))
    .sort((a, b) => {
      if (a.supernatural !== b.supernatural) return a.supernatural ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Prefer rare / identifiable cargo in the visible budget; overflow common materials.
 */
export function partitionCargoForDisplay(
  lines: SettledCargoLine[],
  budget = SETTLED_CARGO_VISIBLE_BUDGET,
): { visible: SettledCargoLine[]; overflowCount: number } {
  if (lines.length <= budget) {
    return { visible: lines, overflowCount: 0 };
  }

  const priority = lines.filter((line) => line.supernatural);
  const common = lines.filter((line) => !line.supernatural);
  const visible: SettledCargoLine[] = [];
  const used = new Set<string>();

  for (const line of priority) {
    if (visible.length >= budget) break;
    visible.push(line);
    used.add(line.resourceId);
  }
  for (const line of common) {
    if (visible.length >= budget) break;
    visible.push(line);
    used.add(line.resourceId);
  }

  const overflowCount = lines.filter((line) => !used.has(line.resourceId)).length;
  return { visible, overflowCount };
}

export function buildSettledContractResult(
  contract: ContractResult,
): SettledContractResult | null {
  if (contract.status === 'NONE' || !contract.title?.trim()) {
    return null;
  }

  const detail = `${contract.title} · ${contract.progressText}`.replace(/\s+/g, ' ').trim();

  if (contract.status === 'SUCCESS') {
    return { status: 'COMPLETE', title: contract.title, detail };
  }

  if (contract.status === 'PENDING_DELIVERY') {
    return { status: 'INCOMPLETE', title: contract.title, detail };
  }

  // FAILED — prefer INCOMPLETE when progress shows retention or a non-zero count.
  const progress = contract.progressText.toLowerCase();
  const retained = /\bretained\b/.test(progress) || /\bpartial\b/.test(progress);
  const fraction = progress.match(/(\d+)\s*\/\s*(\d+)/);
  const nonzeroProgress = Boolean(fraction && Number(fraction[1]) > 0);

  return {
    status: retained || nonzeroProgress ? 'INCOMPLETE' : 'FAILED',
    title: contract.title,
    detail,
  };
}

function resolveDeepestReachLabel(payload: OperationDebriefPayload): string {
  const depth =
    payload.balanceTelemetry?.maxDepthReached
    ?? payload.deathStats?.depthLayer
    ?? payload.routingState?.contractProgress.highestDepthReached
    ?? null;
  const node =
    payload.balanceTelemetry?.nodesCleared != null
      && payload.balanceTelemetry.nodesCleared > 0
      ? payload.balanceTelemetry.nodesCleared
      : null;

  if (depth != null && node != null) {
    return `DEPTH ${depth} · NODE ${node}`;
  }
  if (depth != null) {
    return `DEPTH ${depth}`;
  }
  if (node != null) {
    return `NODE ${node}`;
  }
  return 'DEPTH —';
}

function resolveCargoResultLabel(input: {
  survived: boolean;
  secured: number;
  lost: number;
  capacity: number;
}): string {
  const { survived, secured, lost, capacity } = input;
  if (survived) {
    return `${secured} / ${capacity} SECURED`;
  }
  if (secured <= 0 && lost <= 0) {
    return 'NONE SECURED';
  }
  if (secured > 0 && lost > 0) {
    return `${secured} SECURED · ${lost} LOST`;
  }
  if (secured > 0) {
    return `${secured} SECURED`;
  }
  return `${lost} LOST`;
}

function resolveTotalCredits(
  payload: OperationDebriefPayload,
  contract: ContractResult,
): number {
  const base = Math.max(0, payload.credits);
  const contractCredits = contract.status === 'SUCCESS'
    ? Math.max(
      0,
      contract.creditsAwarded
        + contract.bonusCreditsAwarded
        + (contract.sealedClauseCreditsBonus ?? 0)
        + (contract.mirroredCreditsBonus ?? 0),
    )
    : 0;
  const routing = payload.cargoRoutingResult;
  const routingCredits = routing
    ? Math.max(
      0,
      routing.creditsFromFence
        + routing.creditsFromRivalDelivery
        + routing.creditsFromCasketOpen,
    )
    : 0;
  return base + contractCredits + routingCredits;
}

export interface BuildSettledRunResultOptions {
  /** Override contract after auto-routing settlement. */
  contractResult?: ContractResult;
}

/**
 * Build the presentation-only settled run result from a debrief payload.
 * Does not mutate game state.
 */
export function buildSettledRunResult(
  payload: OperationDebriefPayload,
  opts?: BuildSettledRunResultOptions,
): SettledRunResult {
  const survived = payload.runOutcome === 'EXTRACTED';
  const contractResult = opts?.contractResult ?? payload.contractResult;
  const ledger = payload.runResourceLedger;
  const capacity = CARGO_GRID_CELL_COUNT;

  const recovered = survived
    ? buildSettledCargoLines(ledger?.extracted)
    : [];
  const secured = !survived
    ? buildSettledCargoLines(ledger?.bankedAtSafehouse)
    : [];
  const lost = !survived
    ? buildSettledCargoLines(ledger?.lostOnDeath)
    : [];

  const securedCount = survived
    ? sumQuantity(ledger?.extracted)
    : sumQuantity(ledger?.bankedAtSafehouse);
  const lostCount = sumQuantity(ledger?.lostOnDeath);

  let cargoMode: SettledRunResult['cargoMode'];
  let displayLines: SettledCargoLine[];
  if (survived) {
    cargoMode = recovered.length > 0 ? 'RECOVERED' : 'NONE';
    displayLines = recovered;
  } else if (secured.length === 0 && lost.length === 0) {
    cargoMode = 'NONE';
    displayLines = [];
  } else if (secured.length > 0 && lost.length > 0) {
    cargoMode = 'SECURED_AND_LOST';
    displayLines = [...secured, ...lost];
  } else if (secured.length > 0) {
    cargoMode = 'SECURED_ONLY';
    displayLines = secured;
  } else {
    cargoMode = 'SECURED_AND_LOST';
    displayLines = lost;
  }

  const { overflowCount } = partitionCargoForDisplay(displayLines);
  const recoveredPartition = partitionCargoForDisplay(recovered);
  const securedPartition = partitionCargoForDisplay(secured);
  const lostPartition = partitionCargoForDisplay(lost);

  const contractTitle =
    contractResult.status !== 'NONE' && contractResult.title?.trim()
      ? contractResult.title.trim()
      : null;

  const timeMs =
    payload.balanceTelemetry?.timeAliveMs
    ?? payload.deathStats?.timeAliveMs
    ?? null;

  const totalCredits = resolveTotalCredits(payload, contractResult);

  return {
    runKey: buildRunDebriefKey(payload),
    survived,
    sectorName: payload.sectorName,
    outcomeTitle: survived ? 'EXTRACTION SECURED' : 'RUNNER LOST',
    causeOfDeathLine: survived
      ? null
      : formatCauseOfDeathLine(
        payload.deathStats?.causeOfDeath
          ?? payload.balanceTelemetry?.deathCause
          ?? null,
      ),
    contractTitle,
    deepestReachLabel: resolveDeepestReachLabel(payload),
    runDurationLabel: formatRunDuration(timeMs),
    cargoResultLabel: resolveCargoResultLabel({
      survived,
      secured: securedCount,
      lost: lostCount,
      capacity,
    }),
    cargoMode,
    recoveredCargo: recoveredPartition.visible,
    securedCargo: securedPartition.visible,
    lostCargo: lostPartition.visible,
    cargoOverflowCount: overflowCount,
    cargoSlotsSecured: securedCount,
    cargoSlotsCapacity: capacity,
    contract: buildSettledContractResult(contractResult),
    creditsEarned: totalCredits > 0 ? totalCredits : null,
    extractionTypeLabel: null,
  };
}
