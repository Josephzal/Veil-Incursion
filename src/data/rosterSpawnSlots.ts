import type { CombatGridSlotId } from '../types/combatGrid';
import type { EncounterGridPos, EncounterUnitSpec } from './synergyEncounterTypes';
import { ENCOUNTER_KEY_TO_ROSTER } from './enemyCombatConfig';
import type { EnemyRosterId } from './enemyRoster';
import type { SpawnSlotAssignment } from './levelEncounterData';

const POS_SLOT_CANDIDATES: Record<EncounterGridPos, readonly CombatGridSlotId[]> = {
  FRONT_LEFT: ['FL_0'],
  FRONT_RIGHT: ['FL_1'],
  BACK_LEFT: ['BL_0'],
  BACK_RIGHT: ['BL_1'],
  FRONT_CENTER: ['FL_0', 'FL_1'],
  BACK_CENTER: ['BL_0', 'BL_1'],
};

const ALL_SLOTS: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0', 'BL_1'];

function takeSlot(
  pos: EncounterGridPos,
  used: Set<CombatGridSlotId>,
): CombatGridSlotId {
  for (const candidate of POS_SLOT_CANDIDATES[pos]) {
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = ALL_SLOTS.find((slot) => !used.has(slot));
  if (!fallback) {
    throw new Error(`rosterToSpawnSlots: no free slot for position ${pos}`);
  }
  used.add(fallback);
  return fallback;
}

export interface RosterToSpawnSlotsOptions {
  /** Alpha-duel synergy fallback — buff every unit regardless of roster flags. */
  forceAllAlpha?: boolean;
}

/** Maps squad roster entries to grid slots while preserving per-unit isAlpha. */
export function rosterToSpawnSlots(
  roster: readonly EncounterUnitSpec[],
  options: RosterToSpawnSlotsOptions = {},
): SpawnSlotAssignment[] {
  const used = new Set<CombatGridSlotId>();
  const assignments: SpawnSlotAssignment[] = [];

  for (const unit of roster) {
    if (unit.type === 'AMALGAM') {
      if (assignments.some((a) => a.rosterId === 'amalgam')) continue;
      used.add('FL_0');
      used.add('FL_1');
      assignments.push({
        rosterId: ENCOUNTER_KEY_TO_ROSTER.AMALGAM,
        slot: 'FL_0',
        isAlpha: options.forceAllAlpha === true || unit.isAlpha === true,
        gridWidth: 2,
      });
      continue;
    }

    const rosterId = ENCOUNTER_KEY_TO_ROSTER[unit.type] as EnemyRosterId;
    assignments.push({
      rosterId,
      slot: takeSlot(unit.pos, used),
      isAlpha: options.forceAllAlpha === true || unit.isAlpha === true,
    });
  }

  return assignments;
}

export function rosterHasMixedAlpha(roster: readonly EncounterUnitSpec[]): boolean {
  const alphas = roster.filter((unit) => unit.isAlpha === true);
  return alphas.length > 0 && alphas.length < roster.length;
}

export function rosterIsAllAlpha(roster: readonly EncounterUnitSpec[]): boolean {
  return roster.length > 0 && roster.every((unit) => unit.isAlpha === true);
}
