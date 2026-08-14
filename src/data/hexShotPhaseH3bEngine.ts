/**
 * Hex Shot Phase H.3b — Cinderline Saturation, Blacksite Triage, Ash Salvo packets.
 * Pure helpers; hub/executor remain the appliers.
 */
import type { CombatGridSlotId } from '../types/combatGrid';
import { ALL_GRID_SLOTS, isCombatGridSlotId } from '../types/combatGrid';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import type { HexShotAbilityId } from '../types/operativeClass';

export const HEX_H3B_ASSIGNABLE_FLEX: readonly HexShotAbilityId[] = [
  'ASH_JACKET_SALVO',
  'SINGULARITY_SLUG',
  'PANOPTICON_PROTOCOL',
  'REVENANTS_ECHO',
  'RIFT_SNARE',
  'PHOSPHORUS_HEX',
  'NULL_SPACE_CLOAK',
  'GHOST_GRID_CAMO',
  'ASTRAL_TARGET_LOCK',
  'CINDERLINE_SATURATION',
  'BLACKSITE_TRIAGE',
] as const;

export const ASH_JACKET_SALVO_PACKETS = [7, 7, 8] as const;
export const ASH_JACKET_SALVO_AGGREGATE = 22;

export const CINDERLINE_TICK_DAMAGE = 5;
export const CINDERLINE_DURATION_ROUNDS = 2;
export const CINDERLINE_STAMINA_COST = 30;

export const BLACKSITE_TRIAGE_HEAL_PCT = 0.2;
export const BLACKSITE_TRIAGE_STAMINA_COST = 35;

export function isHexH3bAssignableFlexId(id: string): id is HexShotAbilityId {
  return (HEX_H3B_ASSIGNABLE_FLEX as readonly string[]).includes(id);
}

/** Authored Blacksite recovery before missing-HP cap. */
export function resolveBlacksiteTriageAuthoredHeal(
  maxHp: number,
  healPercent = BLACKSITE_TRIAGE_HEAL_PCT * 100,
): number {
  return Math.max(1, Math.floor(Math.max(0, maxHp) * (healPercent / 100)));
}

/** Effective heal at current HP (0 when full). */
export function resolveBlacksiteTriageEffectiveHeal(
  currentHp: number,
  maxHp: number,
  healPercent = BLACKSITE_TRIAGE_HEAL_PCT * 100,
): number {
  const missing = Math.max(0, maxHp - currentHp);
  if (missing <= 0) return 0;
  return Math.min(missing, resolveBlacksiteTriageAuthoredHeal(maxHp, healPercent));
}

export function canCastBlacksiteTriage(
  classState: Pick<ClassCombatEncounterState, 'blacksiteTriageUsed'>,
  currentHp: number,
  maxHp: number,
  healPercent = BLACKSITE_TRIAGE_HEAL_PCT * 100,
): { ok: true; heal: number } | { ok: false; reason: 'USED' | 'FULL_HP' } {
  if (classState.blacksiteTriageUsed) return { ok: false, reason: 'USED' };
  const heal = resolveBlacksiteTriageEffectiveHeal(currentHp, maxHp, healPercent);
  if (heal <= 0) return { ok: false, reason: 'FULL_HP' };
  return { ok: true, heal };
}

export function seedCinderlineHazard(
  classState: ClassCombatEncounterState,
  slot: CombatGridSlotId,
  tickDamage = CINDERLINE_TICK_DAMAGE,
): void {
  classState.cinderlineHazards[slot] = { roundsRemaining: CINDERLINE_DURATION_ROUNDS, tickDamage };
}

export function resolveCinderlineSlotForUnit(
  unit: EnemyCombatProfile,
): CombatGridSlotId | null {
  const slot = unit.gridSlot;
  if (!slot || !isCombatGridSlotId(slot)) return null;
  return slot;
}

/**
 * Tick Cinderline for one unit at the start of its turn.
 * Returns damage to apply (0 if ineligible). Does not deal damage itself.
 */
export function resolveCinderlineTickForUnit(
  classState: ClassCombatEncounterState,
  unit: EnemyCombatProfile,
): { damage: number; slot: CombatGridSlotId } | null {
  if (!unit.unitId) return null;
  if (classState.cinderlineTickedUnitIdsThisEnemyPhase[unit.unitId]) return null;
  const slot = resolveCinderlineSlotForUnit(unit);
  if (!slot) return null;
  const hazard = classState.cinderlineHazards[slot];
  if (!hazard || hazard.roundsRemaining <= 0) return null;
  classState.cinderlineTickedUnitIdsThisEnemyPhase[unit.unitId] = true;
  return { damage: hazard.tickDamage ?? CINDERLINE_TICK_DAMAGE, slot };
}

/** End of enemy phase — decrement hazard durations and clear per-round tick marks. */
export function advanceCinderlineHazardsAfterEnemyPhase(
  classState: ClassCombatEncounterState,
): void {
  const next: ClassCombatEncounterState['cinderlineHazards'] = {};
  for (const slot of ALL_GRID_SLOTS) {
    const hazard = classState.cinderlineHazards[slot];
    if (!hazard) continue;
    const remaining = hazard.roundsRemaining - 1;
    if (remaining > 0) next[slot] = { ...hazard, roundsRemaining: remaining };
  }
  classState.cinderlineHazards = next;
  classState.cinderlineTickedUnitIdsThisEnemyPhase = {};
}

export function clearCinderlineHazards(classState: ClassCombatEncounterState): void {
  classState.cinderlineHazards = {};
  classState.cinderlineTickedUnitIdsThisEnemyPhase = {};
}

export function formatCinderlinePreview(
  slot: CombatGridSlotId | null,
  tickDamage = CINDERLINE_TICK_DAMAGE,
): string {
  const where = slot ? `zone ${slot}` : 'selected position';
  return [
    'Immediate damage: 0',
    `${tickDamage} Occult at affected enemy turn start`,
    `${CINDERLINE_DURATION_ROUNDS}-round positional hazard (${where})`,
    'Same-position recast refreshes — does not stack',
  ].join(' · ');
}

export function formatBlacksiteTriagePreview(
  currentHp: number,
  maxHp: number,
  healPercent = BLACKSITE_TRIAGE_HEAL_PCT * 100,
): string {
  const authored = resolveBlacksiteTriageAuthoredHeal(maxHp, healPercent);
  const effective = resolveBlacksiteTriageEffectiveHeal(currentHp, maxHp, healPercent);
  return `Authored recovery ${authored} · Effective ${effective} · Once per encounter`;
}

export function formatAshJacketSalvoPreview(): string {
  return `Packets ${ASH_JACKET_SALVO_PACKETS.join(' + ')} = ${ASH_JACKET_SALVO_AGGREGATE} Kinetic before defense`;
}
