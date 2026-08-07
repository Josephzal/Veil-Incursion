/**
 * Presentation-only battlefield nameplate rules.
 *
 * Owns nothing canonical: no HP math, intent selection, defense values, or
 * status derivation. Callers pass values already resolved by combat/preview
 * authorities and by `resolveActiveEnemyStatuses` (which owns status priority).
 *
 * Run tests: npx tsx --test src/data/combatEnemyNameplatePresentation.test.ts
 */

export type EnemyNameplateDensity = 'ambient' | 'disclosed';

/** Maximum indicators shown in the plate's lower-right region before overflow. */
export const NAMEPLATE_MAX_INDICATORS = 3;

/**
 * Gap in px between the plate's bottom edge and the canonical bracket frame
 * used as the shared silhouette proxy. Single shared value — no per-enemy tuning.
 */
export const NAMEPLATE_SILHOUETTE_GAP = 14;

/**
 * Disclosure is a text-detail level only. It must never change plate size or
 * position, and never adds or removes a semantic region.
 */
export function resolveEnemyNameplateDensity(input: {
  isSelected?: boolean;
  isFocused?: boolean;
  reticleHovered?: boolean;
  isActingEnemy?: boolean;
}): EnemyNameplateDensity {
  if (
    input.isSelected === true
    || input.isFocused === true
    || input.reticleHovered === true
    || input.isActingEnemy === true
  ) {
    return 'disclosed';
  }
  return 'ambient';
}

/** Compact current HP normally; current/max on hover, focus, inspection, targeting. */
export function formatNameplateHp(input: {
  currentHp: number;
  maxHp: number;
  density: EnemyNameplateDensity;
}): string {
  if (input.density === 'disclosed') return `${input.currentHp}/${input.maxHp}`;
  return `${input.currentHp}`;
}

/**
 * Lower-left intent copy built from the canonical glyph / intent label.
 * Returns null only when the authorities supplied no intent at all.
 */
export function formatNameplateIntentLine(input: {
  symbol?: string | null;
  label?: string | null;
  countdownLabel?: string | null;
  density: EnemyNameplateDensity;
  /**
   * Canonical arena priority 1 (imminent). Marked with a static prefix so the
   * danger telegraph survives without a looping animation on the plate.
   */
  imminent?: boolean;
}): string | null {
  const symbol = (input.symbol ?? '').trim();
  const label = (input.label ?? '').trim().toUpperCase();
  if (!symbol && !label) return null;
  const parts = [input.imminent === true ? '!' : '', symbol, label];
  if (input.density === 'disclosed') {
    const countdown = (input.countdownLabel ?? '').trim();
    if (countdown && countdown.toUpperCase() !== label) parts.push(countdown.toUpperCase());
  }
  return parts.filter(Boolean).join(' ');
}

export type NameplateIndicator<K extends string = string> =
  | { kind: 'kineticArmor'; count: number; label: string }
  | { kind: 'occultWard'; count: number; label: string }
  | { kind: 'status'; statusKey: K; label: string };

/**
 * Lower-right indicators, capped so the plate never grows.
 *
 * Priority reuses the canonical tactical read already used elsewhere: hard
 * mitigation (Kinetic Armor, Occult Ward) first, then statuses in the order the
 * caller supplies — `resolveActiveEnemyStatuses` already emits
 * `ENEMY_STATUS_EFFECT_ORDER`, so no second priority authority is introduced.
 */
export function selectNameplateIndicators<K extends string = string>(input: {
  kineticArmor?: number;
  occultWards?: number;
  /** Canonical-ordered status keys with their accessible labels. */
  statuses?: readonly { key: K; label: string }[];
  max?: number;
}): { visible: NameplateIndicator<K>[]; overflow: number } {
  const max = input.max ?? NAMEPLATE_MAX_INDICATORS;
  const all: NameplateIndicator<K>[] = [];

  const armor = input.kineticArmor ?? 0;
  if (armor > 0) all.push({ kind: 'kineticArmor', count: armor, label: 'Kinetic Armor' });

  const wards = input.occultWards ?? 0;
  if (wards > 0) all.push({ kind: 'occultWard', count: wards, label: 'Occult Ward' });

  for (const status of input.statuses ?? []) {
    all.push({ kind: 'status', statusKey: status.key, label: status.label });
  }

  if (all.length <= max) return { visible: all, overflow: 0 };
  return { visible: all.slice(0, max), overflow: all.length - max };
}

/**
 * Fixed semantic regions. Intent owns the lower-left slot in every state; a
 * temporary effect can never take that slot, and indicators can never push it out.
 */
export function resolveNameplateRegions(input: {
  isSlumped: boolean;
  intentLine: string | null;
  slumpedIntentLine?: string | null;
  indicatorCount: number;
  overflow: number;
}): {
  lowerLeft: string;
  lowerRightCount: number;
  lowerRightOverflow: number;
  intentSlotOwnedByIntent: true;
} {
  const lowerLeft = input.isSlumped
    ? (input.slumpedIntentLine ?? 'NO ACTION')
    : (input.intentLine ?? 'NO INTENT');
  return {
    lowerLeft,
    lowerRightCount: input.indicatorCount,
    lowerRightOverflow: input.overflow,
    intentSlotOwnedByIntent: true,
  };
}
