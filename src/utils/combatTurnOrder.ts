import type { CombatTurnPhase } from '../context/CombatTurnContext';
import type { CombatGridSlotId } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import type { ClassType } from '../types/game';
import { aliveUnits, getUnitById, isUnitAlive } from '../data/combatSquadEngine';
import { formatHostileId, formatIntentReadout } from './combatTelemetryFormat';

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
  const slug = formatHostileId(unit.designation);
  return slug.length > 10 ? slug.slice(0, 10) : slug;
}

function operativeIsActive(phase: CombatTurnPhase): boolean {
  return phase === 'PLAYER_COMMAND'
    || phase === 'PARRY_WINDOW'
    || phase === 'SLICE';
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
  const operativeEntry: CombatTurnOrderEntry = {
    id: 'operative',
    kind: 'operative',
    label: OPERATIVE_LABEL[operativeClass] ?? 'OPS',
    state: operativeIsActive(phase) ? 'active' : 'waiting',
  };

  if (phase === 'RESOLUTION' || alive.length === 0) {
    return { phase, entries: [operativeEntry] };
  }

  if (operativeIsActive(phase)) {
    const entries: CombatTurnOrderEntry[] = [
      operativeEntry,
      ...alive.map((unit) => {
        const unitId = unit.unitId ?? unit.designation;
        return {
          id: unitId,
          kind: 'hostile' as const,
          label: hostileLabel(unit),
          state: 'queued' as const,
          intentLabel: formatIntentReadout(unit.intent),
        };
      }),
    ];
    return { phase, entries };
  }

  const entries: CombatTurnOrderEntry[] = [{ ...operativeEntry, state: 'waiting' }];
  const seen = new Set<string>();

  const pushHostile = (
    unitId: string,
    state: CombatTurnOrderEntryState,
    allowDuplicate = false,
  ) => {
    if (!allowDuplicate && seen.has(unitId)) return;
    const unit = getUnitById(squadList, unitId);
    if (!unit || !isUnitAlive(unit)) return;
    seen.add(unitId);
    entries.push({
      id: `${unitId}-${entries.length}`,
      kind: 'hostile',
      label: hostileLabel(unit),
      state,
      intentLabel: formatIntentReadout(unit.intent),
    });
  };

  const queue = enemyQueue.length > 0
    ? enemyQueue
    : alive.map((unit) => unit.unitId ?? unit.designation);

  queue.forEach((unitId, index) => {
    pushHostile(unitId, index === 0 ? 'active' : 'queued', true);
  });

  for (const unit of alive) {
    const unitId = unit.unitId ?? unit.designation;
    pushHostile(unitId, 'waiting');
  }

  return { phase, entries };
}
