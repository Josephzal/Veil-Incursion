/**
 * Action-rail deduplication + shared command-detail strip copy.
 *
 * Consumes canonical action state (AP, disabled reasons, descriptions) and only
 * decides where existing information is presented. It never computes
 * availability, costs, or lock state.
 *
 * Run tests: npx tsx --test src/data/combatActionRailPresentation.test.ts
 */

/**
 * True for a generic "not enough AP" lock — the one reason shared by every card
 * at zero AP. Card-specific resources (Brand, ammo, Flux, Rot, charges, …) are
 * never treated as shared.
 */
export function isSharedApLockDetail(detail: string): boolean {
  return /^NEED\s+\d+\s+AP$/i.test(detail.trim());
}

/**
 * Card keeps its lock footer unless the reason is the shared zero-AP lock,
 * which the rail states once.
 */
export function shouldHoistLockToRail(input: {
  lockDetail: string | null;
  remainingAp: number;
}): boolean {
  if (input.lockDetail == null) return false;
  if (input.remainingAp > 0) return false;
  return isSharedApLockDetail(input.lockDetail);
}

/**
 * Reuse the authored Riposte status copy for the rail line rather than
 * restating a bonus value in the presentation layer. Falls back to the plain
 * modifier name when the copy carries no numeric bonus.
 */
export function formatRiposteModifierLabel(statusShort: string | null | undefined): string {
  const bonus = (statusShort ?? '').match(/\+\s*(\d+)/);
  return bonus ? `RIPOSTE • STRIKES +${bonus[1]}` : 'RIPOSTE • STRIKES';
}

export interface RailStateLine {
  text: string;
  tone: 'modifier' | 'resource';
}

/**
 * One rail-level line for state genuinely shared by the collection.
 * An active combat-wide modifier outranks the zero-AP notice.
 */
export function resolveRailStateLine(input: {
  remainingAp: number;
  riposteReady?: boolean;
  /** Authored shared-modifier copy, e.g. "RIPOSTE • STRIKES +16". */
  riposteModifierLabel?: string | null;
}): RailStateLine | null {
  if (input.riposteReady === true) {
    const label = (input.riposteModifierLabel ?? 'RIPOSTE').trim();
    return { text: `ACTIVE: ${label}`, tone: 'modifier' };
  }
  if (input.remainingAp <= 0) {
    return { text: '0 AP • END TURN', tone: 'resource' };
  }
  return null;
}

export interface ActionDetailStripContent {
  title: string;
  body: string;
  /** True while a committed action pins the strip during targeting. */
  pinned: boolean;
}

/**
 * The strip shows the committed action while targeting; otherwise the
 * hover/focus preview. Hovering a different card cannot replace a pinned action.
 */
export function resolveActionDetailSubject(input: {
  selectedAbility: string | null;
  previewAbility: string | null;
}): { abilityId: string | null; pinned: boolean } {
  if (input.selectedAbility != null) {
    return { abilityId: input.selectedAbility, pinned: true };
  }
  return { abilityId: input.previewAbility, pinned: false };
}

/** Title line: authored name plus the canonical AP cost already shown on the card. */
export function formatActionDetailTitle(input: {
  name: string;
  costImpact: string;
}): string {
  const name = input.name.trim().toUpperCase();
  const ap = input.costImpact.match(/(\d+)\s*AP/i)?.[1];
  return ap ? `${name} • ${ap} AP` : name;
}
