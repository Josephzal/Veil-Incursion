import type { CombatUnitTag } from '../types/aegisCombat';
import type { EnemyAffinity } from '../types/combatEnvironment';
import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import { isUnitAlive } from '../data/combatSquadEngine';
import { resolveEnemyThreatTier } from '../data/enemyRoster';

export const GAUGE_SOUL_ANCHOR = '#FF453A';
export const GAUGE_ABYSSAL = '#00D2C4';
export const GAUGE_STAMINA = '#5C2D91';
export const GAUGE_HOSTILE_HP = '#FF453A';
export const GAUGE_TRACK_BORDER = 'rgba(139, 92, 246, 0.45)';

const INTENT_READOUT: Record<EnemyIntent, string> = {
  STRIKE: 'STRIKE',
  STRIP_STAMINA: 'TARGETING STAMINA RES',
  SIPHON_ABYSSAL: 'SIPHON ABYSSAL RES',
  EVADE: 'EVADE POSTURE',
  CHARGE: 'CHARGING WORLD-ENDER',
  WORLD_ENDER: 'WORLD-ENDER UNBLOCK',
  FORTIFY: 'FORTIFY',
  OVERDRIVE_DISCHARGE: 'OVERDRIVE DISCHARGE',
};

export function formatHostileId(designation: string): string {
  const slug = designation
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug.length > 28 ? slug.slice(0, 28) : slug;
}

export function formatIntentReadout(intent: EnemyIntent): string {
  return INTENT_READOUT[intent] ?? intent.replace(/_/g, ' ');
}

export type EnemyDeckStrikeVariant = 'hp' | 'stamina' | 'abyssal';

const HP_STRIKE_INTENTS: EnemyIntent[] = ['STRIKE', 'WORLD_ENDER', 'OVERDRIVE_DISCHARGE'];

/** Maps hostile intents to the transparent strike overlay shown on the operative deck. */
export function getEnemyDeckStrikeVariant(intent: EnemyIntent): EnemyDeckStrikeVariant | null {
  if (HP_STRIKE_INTENTS.includes(intent)) return 'hp';
  if (intent === 'STRIP_STAMINA') return 'stamina';
  if (intent === 'SIPHON_ABYSSAL') return 'abyssal';
  return null;
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

export type EnemyPortraitGlow = 'none' | 'player-selected' | 'enemy-attacking' | 'enemy-charging';

export type EnemyPortraitAnim = 'none' | 'lunge' | 'shimmy';

export type EnemyIntentShimmer = 'fortify' | 'evade';

const ENEMY_DAMAGE_INTENTS: EnemyIntent[] = ['STRIKE', 'WORLD_ENDER', 'OVERDRIVE_DISCHARGE'];
const ENEMY_SIPHON_INTENTS: EnemyIntent[] = ['STRIP_STAMINA', 'SIPHON_ABYSSAL'];
const ENEMY_CHARGE_INTENTS: EnemyIntent[] = ['FORTIFY', 'CHARGE'];

export function isEnemyDamageIntent(intent: EnemyIntent): boolean {
  return ENEMY_DAMAGE_INTENTS.includes(intent);
}

export function isEnemySiphonIntent(intent: EnemyIntent): boolean {
  return ENEMY_SIPHON_INTENTS.includes(intent);
}

export function isEnemyChargeIntent(intent: EnemyIntent): boolean {
  return ENEMY_CHARGE_INTENTS.includes(intent);
}

export interface CombatGridUnitSnapshot {
  unitId: string;
  slot: import('../types/combatGrid').CombatGridSlotId;
  designation: string;
  currentHp: number;
  maxHp: number;
  intent: EnemyIntent;
  intentLabel?: string;
  affinity?: import('../types/combatEnvironment').EnemyAffinity;
  fractureGauge?: number;
  fractureMax?: number;
  kineticArmor?: number;
  occultWards?: number;
  combatTags?: string[];
  evadeActive?: boolean;
  chargeTurns?: number;
  doomedStacks?: number;
  isBoss?: boolean;
  isApex?: boolean;
  isElite?: boolean;
  isVeilStalker?: boolean;
  enemyClass?: import('../types/run').EnemyClass;
  rosterId?: string;
  isDead: boolean;
  isSelected: boolean;
  isTargetable: boolean;
  isFocused: boolean;
  /** True while this unit is the active enemy-turn actor (wind-up or execute). */
  isActingEnemy?: boolean;
  isExecutingAttack?: boolean;
  /** True while a backline melee dash tween is in flight. */
  isBacklineDashing?: boolean;
  /** Increments to trigger backline melee dash-and-return VFX. */
  backlineMeleeDashSeq?: number;
  isBlocked: boolean;
  isHookValid: boolean;
  isFractured: boolean;
  portraitGlow?: EnemyPortraitGlow;
  portraitAnim?: EnemyPortraitAnim;
  intentShimmer?: EnemyIntentShimmer | null;
  /** Increments on player critical hit — drives hit-stop slash VFX. */
  critImpactSeq?: number;
  critImpactChannel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  /** Increments when the operative's attack is stat-evaded — drives hitbox floater. */
  evadeImpactSeq?: number;
  /** Increments when the operative deals HP damage to this unit (drives hit flash). */
  hitFlashSeq?: number;
  /** Increments on eradication — drives dissolve VFX before removal. */
  dissolveSeq?: number;
  /** True once dissolve animation finished — hide from grid. */
  dissolveHidden?: boolean;
}

const STATUS_TAG_ORDER: CombatUnitTag[] = [
  'CONCUSSED',
  'DOOMED',
  'EXPOSED',
  'FRACTURED',
  'VULNERABLE',
  'BLINDED',
];

export type EnemyStatusUnitFields = Pick<
  CombatGridUnitSnapshot,
  | 'combatTags'
  | 'evadeActive'
  | 'intent'
  | 'chargeTurns'
  | 'doomedStacks'
  | 'isFractured'
>;

/** Human-readable hostile status labels for the intel panel. */
export function formatEnemyStatusLabels(unit: EnemyStatusUnitFields): string[] {
  const labels: string[] = [];
  const tags = new Set(unit.combatTags ?? []);

  if (unit.evadeActive || unit.intent === 'EVADE') labels.push('EVADING');
  if (unit.intent === 'FORTIFY') labels.push('FORTIFIED');
  if ((unit.chargeTurns ?? 0) > 0 || unit.intent === 'CHARGE') labels.push('CHARGING');
  if (unit.intent === 'WORLD_ENDER') labels.push('WORLD-ENDER');

  for (const tag of STATUS_TAG_ORDER) {
    if (!tags.has(tag)) continue;
    if (tag === 'DOOMED' && (unit.doomedStacks ?? 0) > 1) {
      labels.push(`DOOMED x${unit.doomedStacks}`);
    } else {
      labels.push(tag);
    }
  }

  if (unit.isFractured && !tags.has('FRACTURED')) {
    labels.push('FRACTURED');
  }

  return labels;
}

export function formatEnemyStatusLine(unit: EnemyStatusUnitFields): string {
  const labels = formatEnemyStatusLabels(unit);
  return labels.length > 0 ? labels.join(' / ') : 'CLEAR';
}

export interface CombatSquadUiSnapshot {
  units: CombatGridUnitSnapshot[];
  targetingActive: boolean;
  squadSize: number;
  stagedAbilityId?: string | null;
}

export function buildInitialSquadUiSnapshot(
  squad: readonly EnemyCombatProfile[],
): CombatSquadUiSnapshot {
  const units = squad.map((unit) => ({
    unitId: unit.unitId ?? unit.designation,
    slot: (unit.gridSlot ?? 'FL_0') as import('../types/combatGrid').CombatGridSlotId,
    designation: unit.designation,
    currentHp: unit.currentHp,
    maxHp: unit.maxHp,
    intent: unit.intent,
    intentLabel: formatIntentReadout(unit.intent),
    affinity: unit.affinity,
    fractureGauge: unit.fractureGauge ?? 0,
    fractureMax: unit.fractureMax ?? 100,
    kineticArmor: unit.kineticArmor ?? 0,
    occultWards: unit.occultWards ?? 0,
    combatTags: unit.combatTags ?? [],
    evadeActive: unit.evadeActive,
    chargeTurns: unit.chargeTurns ?? 0,
    doomedStacks: unit.doomedStacks ?? 0,
    isBoss: unit.isBoss,
    isApex: unit.isApex,
    isElite: (() => {
      const tier = resolveEnemyThreatTier({
        isBoss: unit.isBoss,
        isApex: unit.isApex,
        rosterId: unit.rosterId,
      });
      return tier === 'ELITE' || tier === 'APEX';
    })(),
    isVeilStalker: unit.isVeilStalker,
    enemyClass: unit.class,
    rosterId: unit.rosterId,
    isDead: !isUnitAlive(unit),
    isSelected: false,
    isTargetable: false,
    isFocused: false,
    isBlocked: false,
    isHookValid: false,
    isFractured: (unit.combatTags ?? []).includes('FRACTURED') || unit.fracturedThisRound === true,
    portraitGlow: 'none' as EnemyPortraitGlow,
    portraitAnim: 'none' as EnemyPortraitAnim,
  }));
  return {
    units,
    targetingActive: false,
    squadSize: units.filter((u) => !u.isDead).length,
    stagedAbilityId: null,
  };
}

export interface CombatEnemyTelemetry {
  unitId?: string;
  designation: string;
  currentHp: number;
  maxHp: number;
  intent: EnemyIntent;
  affinity?: EnemyAffinity;
  fractureGauge?: number;
  fractureMax?: number;
  kineticArmor?: number;
  occultWards?: number;
  combatTags?: string[];
}
