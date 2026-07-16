import type { CombatGridSlotId } from '../types/combatGrid';
import type { CombatUnitTag } from '../types/aegisCombat';
import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import { isUnitAlive } from '../data/combatSquadEngine';
import { resolveEnemyThreatTier } from '../data/enemyRoster';
import {
  estimateTurnsRemaining,
  getIntentSeverity,
  getIntentType,
} from '../data/enemyIntentCatalog';
import { resolveActiveEnemyStatuses, type EnemyStatusEffectKey } from './enemyStatusEffects';

export type { EnemyStatusEffectKey } from './enemyStatusEffects';

export type CombatClassImpactKind = 'AEGIS_SLICE' | 'HEX_BULLET' | 'ENVOY_BURST';

export const GAUGE_SOUL_ANCHOR = '#FF453A';
export const GAUGE_ABYSSAL = '#00D2C4';
export const GAUGE_RUNIC_BRAND = '#a855f7';
export const GAUGE_MAGAZINE = '#fbbf24';
export const GAUGE_VEIL_FLUX = '#c084fc';
export const GAUGE_STAMINA = '#5C2D91';
export const GAUGE_HOSTILE_HP = '#FF453A';
export const GAUGE_TRACK_BORDER = 'rgba(139, 92, 246, 0.45)';

const INTENT_READOUT: Record<EnemyIntent, string> = {
  STRIKE: 'STRIKE',
  STRIP_STAMINA: 'TARGETING STAMINA RES',
  SIPHON_ABYSSAL: 'SIPHON ABYSSAL RES',
  EVADE: '+60% DODGE',
  CHARGE: 'CHARGING WORLD-ENDER',
  WORLD_ENDER: 'WORLD-ENDER UNBLOCK',
  FORTIFY: 'FORTIFY',
  OVERDRIVE_DISCHARGE: 'OVERDRIVE DISCHARGE',
  PAVEMENT_CRUSHER_CHARGE: 'PAVEMENT CRUSHER CHARGE',
  PAVEMENT_CRUSHER: 'PAVEMENT CRUSHER',
  OCCULT_TETHER: 'OCCULT TETHER',
  SWARM_BITE: 'SWARM BITE',
  STAMINA_DRAIN_LEAP: 'STAMINA DRAIN LEAP',
  DOUBLE_STRIKE: 'DOUBLE STRIKE',
  VEIL_STATIC: 'VEIL STATIC',
  PREMATURE_IGNITION: 'PREMATURE IGNITION',
  RESONANCE_OVERLOAD: 'RESONANCE OVERLOAD',
  SINKING_INTO_GRID: 'SINKING INTO GRID',
  VOID_AMBUSH: 'VOID AMBUSH',
  KINETIC_AFTERSHOCK: 'KINETIC AFTERSHOCK',
  SCAVENGE: 'SCAVENGE',
  SENSORY_JAM: 'SENSORY JAM',
  VEIL_BARRIER: 'VEIL BARRIER',
  TARGET_LOCK: 'TARGET LOCK',
  ASHEN_ROT: 'ASHEN ROT',
  ARTILLERY_CHARGE: 'ARTILLERY CHARGE',
  ARTILLERY_FIRE: 'ARTILLERY FIRE',
  TAR_BIND: 'TAR BIND',
  LASER_SIGHT: 'LASER SIGHT',
  STAMINA_TETHER: 'STAMINA TETHER',
  JAM_AUGMENT: 'JAM AUGMENT',
  MEMORY_LEECH: 'MEMORY LEECH',
  FIELD_REPAIR: 'FIELD REPAIR',
  HEX_MARK: 'HEX MARK',
  BINDING_WARD: 'BINDING WARD',
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

const HP_STRIKE_INTENTS: EnemyIntent[] = [
  'STRIKE',
  'WORLD_ENDER',
  'OVERDRIVE_DISCHARGE',
  'PAVEMENT_CRUSHER',
  'DOUBLE_STRIKE',
  'VOID_AMBUSH',
  'RESONANCE_OVERLOAD',
];

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

export function formatAegisReserveRatio(reserve: number, cap: number): number {
  if (cap <= 0) return 0;
  return clampRatio(reserve / cap);
}

export interface AegisReserveLabelOptions {
  voidWardPrimed?: boolean;
  overcharged?: boolean;
  eviscerateReady?: boolean;
  riposteReady?: boolean;
}

export function formatSoulAnchorLabel(
  current: number,
  max: number,
  options?: { debt?: number; trueMax?: number },
): string {
  if (max <= 0) return 'SOUL // 0%';
  const pct = Math.round((current / max) * 100);
  const debt = options?.debt ?? 0;
  const trueMax = options?.trueMax ?? max;
  if (debt > 0 && trueMax > 0) {
    const debtPct = Math.round((debt / trueMax) * 100);
    return `SOUL // ${pct}% • DEBT ${debtPct}% (TEMP)`;
  }
  return `SOUL // ${pct}%`;
}

export function formatAegisReserveLabel(
  reserve: number,
  cap: number,
  options: AegisReserveLabelOptions = {},
): string {
  const capLabel = cap > 100 ? `${reserve}/${cap}` : `${reserve}%`;
  const tags: string[] = [];
  if (options.voidWardPrimed) tags.push('WARD');
  if (options.riposteReady) tags.push('RIPOSTE');
  if (options.overcharged) tags.push('OVERCHARGED');
  if (options.eviscerateReady) tags.push('EVISCERATE');
  const suffix = tags.length > 0 ? ` • ${tags.join(' • ')}` : '';
  return `AR // ${capLabel}${suffix}`;
}

export function formatRunicBrandsLabel(count: number, cap: number): string {
  return `BRANDS // ${count}/${cap}`;
}

export type EnemyPortraitGlow =
  | 'none'
  | 'player-selected'
  | 'enemy-attacking'
  | 'enemy-charging'
  | 'fracture-breach';

export type EnemyPortraitAnim = 'none' | 'lunge' | 'shimmy';

export type EnemyIntentShimmer = 'fortify' | 'evade';

const ENEMY_DAMAGE_INTENTS: EnemyIntent[] = [
  'STRIKE',
  'WORLD_ENDER',
  'OVERDRIVE_DISCHARGE',
  'PAVEMENT_CRUSHER',
  'DOUBLE_STRIKE',
  'VOID_AMBUSH',
  'RESONANCE_OVERLOAD',
];
const ENEMY_SIPHON_INTENTS: EnemyIntent[] = ['STRIP_STAMINA', 'SIPHON_ABYSSAL'];
/** Wind-up turns — no attack sprite / lunge until the follow-through intent fires. */
const ENEMY_WINDUP_INTENTS: EnemyIntent[] = [
  'CHARGE',
  'PAVEMENT_CRUSHER_CHARGE',
  'ARTILLERY_CHARGE',
  'TARGET_LOCK',
  'LASER_SIGHT',
];
const ENEMY_CHARGE_INTENTS: EnemyIntent[] = ['FORTIFY', 'CHARGE'];

export function isEnemyWindUpIntent(intent: EnemyIntent): boolean {
  return ENEMY_WINDUP_INTENTS.includes(intent);
}

export function isEnemyDamageIntent(intent: EnemyIntent): boolean {
  return ENEMY_DAMAGE_INTENTS.includes(intent);
}

/** Hostile is executing a direct strike against operative HP, stamina, or abyssal reserve. */
export function isDirectPlayerStrikeIntent(intent: EnemyIntent): boolean {
  return getEnemyDeckStrikeVariant(intent) != null;
}

export function isEnemySiphonIntent(intent: EnemyIntent): boolean {
  return ENEMY_SIPHON_INTENTS.includes(intent);
}

export function isEnemyChargeIntent(intent: EnemyIntent): boolean {
  return ENEMY_CHARGE_INTENTS.includes(intent) || isEnemyWindUpIntent(intent);
}

export function isEnemyBuffIntent(intent: EnemyIntent): boolean {
  return intent === 'FORTIFY' || intent === 'EVADE' || intent === 'CHARGE' || intent === 'FIELD_REPAIR'
    || isEnemyWindUpIntent(intent);
}

export type EnemyTurnMotionKind = 'buff' | 'melee' | 'ranged';

/** Physical motion bucket for the active enemy turn (drives anchor choreography). */
export function classifyEnemyTurnMotion(
  intent: EnemyIntent,
  options?: { arenaLayout?: boolean; gridSlot?: CombatGridSlotId | null },
): EnemyTurnMotionKind {
  if (isEnemyBuffIntent(intent) || intent === 'OCCULT_TETHER' || intent === 'VEIL_STATIC' || intent === 'SINKING_INTO_GRID') return 'buff';
  if (intent === 'SWARM_BITE' || intent === 'STAMINA_DRAIN_LEAP') return 'ranged';
  if (isEnemyDamageIntent(intent)) return 'melee';
  if (isEnemySiphonIntent(intent)) return 'ranged';
  return 'ranged';
}

export type EnemyTurnPhase = 'reading' | 'buff' | 'melee_attack' | 'ranged_attack';

export function resolveEnemyTurnPhase(
  intent: EnemyIntent,
  stage: 'reading' | 'executing' | null,
  options?: { arenaLayout?: boolean; gridSlot?: CombatGridSlotId | null },
): EnemyTurnPhase | null {
  if (!stage) return null;
  if (stage === 'reading') return 'reading';
  const kind = classifyEnemyTurnMotion(intent, options);
  if (kind === 'buff') return 'buff';
  if (kind === 'melee') return 'melee_attack';
  return 'ranged_attack';
}

export type StatusFloatTone = 'fortify' | 'evade' | 'charge' | 'neutral';

const BUFF_FLOAT_LABELS: Partial<Record<EnemyIntent, string>> = {
  FORTIFY: 'Fortify',
  OCCULT_TETHER: 'Tether',
  VEIL_STATIC: 'Static',
  SINKING_INTO_GRID: 'Phase',
  EVADE: '+60% Dodge',
  CHARGE: 'Charge',
  FIELD_REPAIR: 'Repair',
};

export function getEnemyBuffFloatLabel(intent: EnemyIntent): string {
  return BUFF_FLOAT_LABELS[intent] ?? formatIntentReadout(intent);
}

export function getStatusFloatTone(intent: EnemyIntent): StatusFloatTone {
  if (intent === 'FORTIFY') return 'fortify';
  if (intent === 'EVADE') return 'evade';
  if (intent === 'CHARGE') return 'charge';
  return 'neutral';
}

export interface CombatGridUnitSnapshot {
  unitId: string;
  slot: import('../types/combatGrid').CombatGridSlotId;
  designation: string;
  currentHp: number;
  maxHp: number;
  intent: EnemyIntent;
  intentLabel?: string;
  /** Phase 2 — Intent 2.0 metadata for intel UI. */
  intentSeverity?: import('../types/enemyIntentMeta').EnemyIntentSeverity;
  intentType?: import('../types/enemyIntentMeta').EnemyIntentType;
  intentTurnsRemaining?: number;
  fractureGauge?: number;
  fractureMax?: number;
  kineticArmor?: number;
  occultWards?: number;
  combatTags?: string[];
  evadeActive?: boolean;
  evadeTurnsRemaining?: number;
  fortifyTurnsRemaining?: number;
  chargeTurns?: number;
  doomedStacks?: number;
  /** Envoy — Veil Rot stacks (0–4) on this hostile. */
  veilRotStacks?: number;
  /** Icon tray keys — fortified, evading, concussed, doomed. */
  activeStatuses?: readonly EnemyStatusEffectKey[];
  isBoss?: boolean;
  isApex?: boolean;
  isElite?: boolean;
  isAlpha?: boolean;
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
  /** Anchor motion phase — idle when null/absent on inactive units. */
  turnPhase?: EnemyTurnPhase | null;
  /** Buff/status floater proc above hitbox. */
  statusFloatSeq?: number;
  statusFloatLabel?: string;
  statusFloatTone?: StatusFloatTone;
  /** True while a backline melee dash tween is in flight. */
  isBacklineDashing?: boolean;
  /** Increments to trigger backline melee dash-and-return VFX. */
  backlineMeleeDashSeq?: number;
  isBlocked: boolean;
  isHookValid: boolean;
  isFractured: boolean;
  /** True while fracture break is pending — tap this hostile to execute breach. */
  isFractureBreachTarget?: boolean;
  portraitGlow?: EnemyPortraitGlow;
  portraitAnim?: EnemyPortraitAnim;
  intentShimmer?: EnemyIntentShimmer | null;
  /** Increments on player critical hit — drives hit-stop slash VFX. */
  critImpactSeq?: number;
  critImpactChannel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  /** Increments when the operative's attack is stat-evaded — drives hitbox floater. */
  evadeImpactSeq?: number;
  /** Increments to drive IMMUNE floaters above hitbox. */
  immuneFloatSeq?: number;
  immuneFloatLabel?: string;
  /** Increments when the operative deals HP damage to this unit (drives hit flash). */
  hitFlashSeq?: number;
  /** Direct player hit class VFX — Aegis slice, Hex bullet, Envoy burst. */
  classImpactFxSeq?: number;
  classImpactFxKind?: CombatClassImpactKind;
  /** Increments on eradication — drives dissolve VFX before removal. */
  dissolveSeq?: number;
  /** True once dissolve animation finished — hide from grid. */
  dissolveHidden?: boolean;
  /** Persistent enrage latch — drives crimson overlay. */
  isEnraged?: boolean;
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
  | 'evadeTurnsRemaining'
  | 'fortifyTurnsRemaining'
  | 'intent'
  | 'chargeTurns'
  | 'doomedStacks'
  | 'isFractured'
  | 'isEnraged'
  | 'veilRotStacks'
  | 'kineticArmor'
  | 'occultWards'
>;

/** Human-readable hostile status labels for the intel panel. */
export function formatEnemyStatusLabels(unit: EnemyStatusUnitFields): string[] {
  const labels: string[] = [];
  const tags = new Set(unit.combatTags ?? []);

  const ka = unit.kineticArmor ?? 0;
  const ow = unit.occultWards ?? 0;
  if (ka > 0) labels.push(ka === 1 ? 'KA' : `KA x${ka}`);
  if (ow > 0) labels.push(ow === 1 ? 'OW' : `OW x${ow}`);

  if (unit.isEnraged) labels.push('ENRAGED');
  if (unit.evadeActive || (unit.evadeTurnsRemaining ?? 0) > 0) labels.push('EVADING');
  if ((unit.fortifyTurnsRemaining ?? 0) > 0) labels.push('FORTIFIED');
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

  const rotStacks = unit.veilRotStacks ?? 0;
  if (rotStacks > 0) {
    labels.push(rotStacks === 1 ? 'VEIL ROT' : `VEIL ROT x${rotStacks}`);
  }

  return labels;
}

export function formatEnemyStatusLine(unit: EnemyStatusUnitFields): string {
  const labels = formatEnemyStatusLabels(unit);
  return labels.length > 0 ? labels.join(' / ') : 'CLEAR';
}

import type { CombatTurnOrderSnapshot } from './combatTurnOrder';

export interface CombatSquadUiSnapshot {
  units: CombatGridUnitSnapshot[];
  targetingActive: boolean;
  squadSize: number;
  stagedAbilityId?: string | null;
  turnOrder?: CombatTurnOrderSnapshot;
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
    intentSeverity: getIntentSeverity(unit.intent),
    intentType: getIntentType(unit.intent),
    intentTurnsRemaining: estimateTurnsRemaining(unit.intent, unit),
    fractureGauge: unit.fractureGauge ?? 0,
    fractureMax: unit.fractureMax ?? 100,
    kineticArmor: unit.kineticArmor ?? 0,
    occultWards: unit.occultWards ?? 0,
    combatTags: unit.combatTags ?? [],
    evadeActive: unit.evadeActive,
    fortifyTurnsRemaining: unit.fortifyTurnsRemaining ?? 0,
    chargeTurns: unit.chargeTurns ?? 0,
    doomedStacks: unit.doomedStacks ?? 0,
    activeStatuses: resolveActiveEnemyStatuses({
      combatTags: unit.combatTags ?? [],
      evadeActive: unit.evadeActive,
      intent: unit.intent,
      fortifyTurnsRemaining: unit.fortifyTurnsRemaining ?? 0,
      doomedStacks: unit.doomedStacks ?? 0,
      isEnraged: unit.isEnraged ?? false,
    }),
    isBoss: unit.isBoss,
    isApex: unit.isApex,
    isAlpha: unit.isAlpha === true,
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
  fractureGauge?: number;
  fractureMax?: number;
  kineticArmor?: number;
  occultWards?: number;
  combatTags?: string[];
  veilRotStacks?: number;
  isAlpha?: boolean;
}
