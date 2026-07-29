import type { CombatTurnPhase } from '../context/CombatTurnContext';
import type { CombatGridSlotId } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import type { ClassType } from '../types/game';
import { aliveUnits } from '../data/combatSquadEngine';
import { formatHostileDisplayName } from './hostileDisplayName';
import { formatIntentReadout } from './combatTelemetryFormat';

export type CombatTurnOrderEntryState = 'active' | 'queued' | 'waiting' | 'defeated';

export interface CombatTurnOrderEntry {
  id: string;
  kind: 'operative' | 'hostile';
  label: string;
  state: CombatTurnOrderEntryState;
  intentLabel?: string;
}

export interface CombatTurnOrderSnapshot {
  phase: CombatTurnPhase;
  entries: CombatTurnOrderEntry[];
}

const SLOT_ORDER: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0', 'BL_1'];

const OPERATIVE_LABEL: Record<ClassType, string> = {
  AEGIS: 'AEGIS',
  HEX_SHOT: 'HEX',
  ENVOY: 'ENVOY',
};

function slotRank(slot: CombatGridSlotId | undefined): number {
  const index = SLOT_ORDER.indexOf(slot ?? 'FL_0');
  return index >= 0 ? index : SLOT_ORDER.length;
}

function sortByGridSlot(units: EnemyCombatProfile[]): EnemyCombatProfile[] {
  return [...units].sort(
    (a, b) => slotRank(a.gridSlot) - slotRank(b.gridSlot),
  );
}

function hostileLabel(unit: EnemyCombatProfile): string {
  const full = formatHostileDisplayName(unit.designation);
  // Prefer complete concise names; only abbreviate past ~14 chars at word boundaries.
  if (full.length <= 14) return full;
  const words = full.split(' ');
  if (words.length >= 2) {
    const short = words.map((w) => (w.length <= 4 ? w : `${w.slice(0, 3)}.`)).join(' ');
    if (short.length <= 16) return short;
  }
  return full.slice(0, 13).trimEnd();
}

function operativeIsActive(phase: CombatTurnPhase): boolean {
  return phase === 'PLAYER_COMMAND'
    || phase === 'PARRY_WINDOW'
    || phase === 'SLICE';
}

function hostileStateForPhase(
  unitId: string,
  operativeActive: boolean,
  enemyQueue: readonly string[],
): CombatTurnOrderEntryState {
  if (operativeActive) return 'queued';

  const currentId = enemyQueue[0] ?? null;
  if (unitId === currentId) return 'active';

  if (enemyQueue.slice(1).includes(unitId)) return 'queued';

  return 'waiting';
}

export function buildCombatTurnOrder(input: {
  squad: readonly EnemyCombatProfile[];
  operativeClass: ClassType;
  phase: CombatTurnPhase;
  enemyQueue: readonly string[];
}): CombatTurnOrderSnapshot {
  const { squad, operativeClass, phase, enemyQueue } = input;
  const squadList = [...squad];
  const alive = sortByGridSlot(aliveUnits(squadList));
  const operativeActive = operativeIsActive(phase);

  const operativeEntry: CombatTurnOrderEntry = {
    id: 'operative',
    kind: 'operative',
    label: OPERATIVE_LABEL[operativeClass] ?? 'OPS',
    state: operativeActive ? 'active' : 'waiting',
  };

  if (phase === 'RESOLUTION' || alive.length === 0) {
    return { phase, entries: [operativeEntry] };
  }

  const entries: CombatTurnOrderEntry[] = [
    operativeEntry,
    ...alive.map((unit) => {
      const unitId = unit.unitId ?? unit.designation;
      return {
        id: unitId,
        kind: 'hostile' as const,
        label: hostileLabel(unit),
        state: hostileStateForPhase(unitId, operativeActive, enemyQueue),
        intentLabel: formatIntentReadout(unit.intent),
      };
    }),
  ];

  return { phase, entries };
}
