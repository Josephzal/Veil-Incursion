/**
 * Combat Refactor Phase 2 — Intent 2.0 catalog.
 * Maps every existing EnemyIntent string to Phase 2 metadata.
 * Does not replace the EnemyIntent enum.
 */

import type { EnemyIntent } from '../types/run';
import type {
  EnemyIntentCatalogEntry,
  EnemyIntentSeverity,
  EnemyIntentType,
  IntentCounterTag,
} from '../types/enemyIntentMeta';

type CatalogFlags = Pick<
  EnemyIntentCatalogEntry,
  | 'canBeInterrupted'
  | 'canBeFractured'
  | 'canBeBlinded'
  | 'canBeBlocked'
  | 'canBeParried'
  | 'canBeRedirected'
  | 'canBeDispelled'
>;

function flags(partial: Partial<CatalogFlags>): CatalogFlags {
  return {
    canBeInterrupted: false,
    canBeFractured: true,
    canBeBlinded: false,
    canBeBlocked: true,
    canBeParried: false,
    canBeRedirected: false,
    canBeDispelled: false,
    ...partial,
  };
}

function entry(
  partial: Omit<EnemyIntentCatalogEntry, keyof CatalogFlags> & Partial<CatalogFlags>,
): EnemyIntentCatalogEntry {
  const {
    canBeInterrupted,
    canBeFractured,
    canBeBlinded,
    canBeBlocked,
    canBeParried,
    canBeRedirected,
    canBeDispelled,
    ...rest
  } = partial;
  return {
    ...rest,
    ...flags({
      canBeInterrupted,
      canBeFractured,
      canBeBlinded,
      canBeBlocked,
      canBeParried,
      canBeRedirected,
      canBeDispelled,
    }),
  };
}

const BASIC_COUNTERS: IntentCounterTag[] = ['KILL_SOURCE', 'BLOCK', 'SHIELD', 'PARRY', 'FRACTURE'];
const HEAVY_COUNTERS: IntentCounterTag[] = [
  'INTERRUPT', 'PARRY', 'BLOCK', 'SHIELD', 'FRACTURE', 'KILL_SOURCE', 'ARMOR_BREAK', 'BURST_DAMAGE',
];
const LOCK_COUNTERS: IntentCounterTag[] = [
  'BLIND', 'INTERRUPT', 'PARRY', 'DECOY', 'SHIELD', 'KILL_SOURCE', 'FRACTURE', 'ARMOR_BREAK',
];
const CHANNEL_COUNTERS: IntentCounterTag[] = [
  'INTERRUPT', 'SILENCE', 'WARD_BREAK', 'FRACTURE', 'KILL_SOURCE', 'BURST_DAMAGE',
];
const GUARD_COUNTERS: IntentCounterTag[] = [
  'GUARD_BREAK', 'FRACTURE', 'ARMOR_BREAK', 'KILL_SOURCE', 'BURST_DAMAGE',
];
const BUFF_COUNTERS: IntentCounterTag[] = [
  'INTERRUPT', 'DISPEL', 'KILL_SOURCE', 'FRACTURE', 'WARD_BREAK',
];
const DEBUFF_COUNTERS: IntentCounterTag[] = [
  'INTERRUPT', 'SILENCE', 'WARD_BREAK', 'CLEANSE', 'SHIELD', 'KILL_SOURCE',
];
const DETONATE_COUNTERS: IntentCounterTag[] = [
  'INTERRUPT', 'KILL_SOURCE', 'WARD_BREAK', 'ARMOR_BREAK', 'BURST_DAMAGE', 'SHIELD', 'BLOCK',
];
const MARK_COUNTERS: IntentCounterTag[] = [
  'CLEANSE', 'INTERRUPT', 'KILL_SOURCE', 'BLOCK', 'WARD_BREAK',
];
const CONSUME_COUNTERS: IntentCounterTag[] = [
  'KILL_SOURCE', 'INTERRUPT', 'FRACTURE', 'STAGGER',
];

export const ENEMY_INTENT_CATALOG: Record<EnemyIntent, EnemyIntentCatalogEntry> = {
  STRIKE: entry({
    type: 'BASIC_ATTACK',
    severity: 'LOW',
    displayName: 'Strike',
    description: 'Direct kinetic melee pressure.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: BASIC_COUNTERS,
    canBeParried: true,
    canBeBlocked: true,
    uiPriority: 10,
    effectPreview: { summary: 'Deals base hostile damage.' },
  }),
  DOUBLE_STRIKE: entry({
    type: 'HEAVY_ATTACK',
    severity: 'MODERATE',
    displayName: 'Double Strike',
    description: 'Twin kinetic cleave in one activation.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: HEAVY_COUNTERS,
    canBeParried: true,
    canBeBlocked: true,
    uiPriority: 35,
    effectPreview: { summary: 'Two strike instances.' },
  }),
  STRIP_STAMINA: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Strip Stamina',
    description: 'Drains operative stamina reserves.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: DEBUFF_COUNTERS,
    canBeInterrupted: true,
    uiPriority: 25,
    effectPreview: { summary: 'Drains stamina.', appliesStatus: 'STAMINA_DRAIN' },
  }),
  SIPHON_ABYSSAL: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Siphon Abyssal',
    description: 'Occult drain against Abyssal Reserve.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: [...DEBUFF_COUNTERS, 'WARD_BREAK'],
    canBeInterrupted: true,
    uiPriority: 28,
    effectPreview: { summary: 'Drains Abyssal Reserve.' },
  }),
  EVADE: entry({
    type: 'BUFF',
    severity: 'LOW',
    displayName: 'Evade',
    description: 'Defensive posture — prioritizes avoidance.',
    targetMode: 'SELF',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: ['FRACTURE', 'KILL_SOURCE', 'ROOT'],
    canBeBlocked: false,
    uiPriority: 8,
    effectPreview: { summary: 'Raises miss chance.', appliesStatus: 'EVADING' },
  }),
  CHARGE: entry({
    type: 'CHANNEL',
    severity: 'HIGH',
    displayName: 'Charge',
    description: 'Wind-up for World-Ender.',
    targetMode: 'SELF',
    telegraphTurns: 2,
    resolvesAt: 'NEXT_ENEMY_TURN',
    counterTags: CHANNEL_COUNTERS,
    canBeInterrupted: true,
    canBeBlinded: false,
    isTelegraph: true,
    uiPriority: 80,
    effectPreview: { summary: 'Channels World-Ender — interrupt before release.' },
  }),
  WORLD_ENDER: entry({
    type: 'HEAVY_ATTACK',
    severity: 'CRITICAL',
    displayName: 'World-Ender',
    description: 'Unblockable finisher after charge.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: ['KILL_SOURCE', 'INTERRUPT', 'FRACTURE', 'BURST_DAMAGE'],
    canBeParried: false,
    canBeBlocked: false,
    canBeInterrupted: true,
    uiPriority: 100,
    effectPreview: { summary: 'Unblockable true-pressure strike.' },
  }),
  FORTIFY: entry({
    type: 'GUARD',
    severity: 'MODERATE',
    displayName: 'Fortify',
    description: 'Hardens kinetic shell.',
    targetMode: 'SELF',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: GUARD_COUNTERS,
    canBeBlocked: false,
    uiPriority: 20,
    effectPreview: { summary: 'Increases armor layers.', appliesStatus: 'FORTIFIED' },
  }),
  OVERDRIVE_DISCHARGE: entry({
    type: 'HEAVY_ATTACK',
    severity: 'HIGH',
    displayName: 'Overdrive Discharge',
    description: 'Boss overdrive kinetic burst.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: HEAVY_COUNTERS,
    canBeParried: true,
    uiPriority: 70,
    effectPreview: { summary: 'Heavy kinetic discharge.' },
  }),
  PAVEMENT_CRUSHER_CHARGE: entry({
    type: 'CHANNEL',
    severity: 'HIGH',
    displayName: 'Pavement Crusher Charge',
    description: 'Structural wind-up for Pavement Crusher.',
    targetMode: 'SELF',
    telegraphTurns: 1,
    resolvesAt: 'NEXT_ENEMY_TURN',
    counterTags: CHANNEL_COUNTERS,
    canBeInterrupted: true,
    isTelegraph: true,
    uiPriority: 78,
    effectPreview: { summary: 'Telegraphs unblockable slam next turn.' },
  }),
  PAVEMENT_CRUSHER: entry({
    type: 'HEAVY_ATTACK',
    severity: 'HIGH',
    displayName: 'Pavement Crusher',
    description: 'Unblockable kinetic rupture.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: HEAVY_COUNTERS,
    canBeParried: true,
    canBeBlocked: false,
    uiPriority: 85,
    effectPreview: { summary: 'Heavy structural strike — parry-eligible on release.' },
  }),
  OCCULT_TETHER: entry({
    type: 'SUPPORT_LINK',
    severity: 'MODERATE',
    displayName: 'Occult Tether',
    description: 'Links hostiles in an occult network.',
    targetMode: 'ALLY',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: [...BUFF_COUNTERS, 'DISPEL'],
    canBeDispelled: true,
    canBeInterrupted: true,
    uiPriority: 30,
    effectPreview: { summary: 'Applies tether network.' },
  }),
  SWARM_BITE: entry({
    type: 'BASIC_ATTACK',
    severity: 'LOW',
    displayName: 'Swarm Bite',
    description: 'Fast swarm kinetic bite.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: BASIC_COUNTERS,
    canBeParried: true,
    uiPriority: 12,
    effectPreview: { summary: 'Light swarm damage.' },
  }),
  STAMINA_DRAIN_LEAP: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Stamina Drain Leap',
    description: 'Leap that taxes stamina.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: DEBUFF_COUNTERS,
    canBeInterrupted: true,
    uiPriority: 26,
    effectPreview: { summary: 'Leap + stamina drain.' },
  }),
  VEIL_STATIC: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Veil Static',
    description: 'Occult static interference.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: DEBUFF_COUNTERS,
    canBeInterrupted: true,
    canBeDispelled: true,
    uiPriority: 24,
    effectPreview: { summary: 'Applies veil static interference.' },
  }),
  PREMATURE_IGNITION: entry({
    type: 'DETONATE',
    severity: 'HIGH',
    displayName: 'Premature Ignition',
    description: 'Unstable detonation telegraph.',
    targetMode: 'ALL_PLAYERS',
    telegraphTurns: 1,
    resolvesAt: 'NEXT_ENEMY_TURN',
    counterTags: DETONATE_COUNTERS,
    canBeInterrupted: true,
    isTelegraph: true,
    uiPriority: 88,
    effectPreview: { summary: 'About to detonate — interrupt or contain.' },
  }),
  RESONANCE_OVERLOAD: entry({
    type: 'HEAVY_ATTACK',
    severity: 'HIGH',
    displayName: 'Resonance Overload',
    description: 'Dual-channel rupture burst.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: [...HEAVY_COUNTERS, 'WARD_BREAK'],
    canBeInterrupted: true,
    uiPriority: 75,
    effectPreview: { summary: 'Kinetic + occult overload.' },
  }),
  SINKING_INTO_GRID: entry({
    type: 'CHANNEL',
    severity: 'HIGH',
    displayName: 'Sinking Into Grid',
    description: 'Phases out for Void Ambush.',
    targetMode: 'SELF',
    telegraphTurns: 1,
    resolvesAt: 'NEXT_ENEMY_TURN',
    counterTags: CHANNEL_COUNTERS,
    canBeInterrupted: true,
    isTelegraph: true,
    uiPriority: 82,
    effectPreview: { summary: 'Setup for Void Ambush — deal interrupt threshold.' },
  }),
  VOID_AMBUSH: entry({
    type: 'HEAVY_ATTACK',
    severity: 'HIGH',
    displayName: 'Void Ambush',
    description: 'Ambush burst unless interrupted.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: ['INTERRUPT', 'BURST_DAMAGE', 'KILL_SOURCE', 'FRACTURE'],
    canBeInterrupted: true,
    canBeParried: true,
    uiPriority: 86,
    effectPreview: { summary: 'Occult ambush rupture.' },
  }),
  KINETIC_AFTERSHOCK: entry({
    type: 'HEAVY_ATTACK',
    severity: 'MODERATE',
    displayName: 'Kinetic Aftershock',
    description: 'Delayed kinetic shockwave.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: HEAVY_COUNTERS,
    canBeParried: true,
    uiPriority: 40,
    effectPreview: { summary: 'Aftershock kinetic damage.' },
  }),
  SCAVENGE: entry({
    type: 'CONSUME',
    severity: 'MODERATE',
    displayName: 'Scavenge',
    description: 'Feeds on battlefield residue.',
    targetMode: 'SELF',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: CONSUME_COUNTERS,
    canBeInterrupted: true,
    uiPriority: 22,
    effectPreview: { summary: 'Consumes resource / recovers.' },
  }),
  SENSORY_JAM: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Sensory Jam',
    description: 'Jams operative targeting intel.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: [...DEBUFF_COUNTERS, 'KILL_SOURCE'],
    canBeInterrupted: true,
    uiPriority: 32,
    effectPreview: { summary: 'Obscures intent readouts.', appliesStatus: 'SENSORY_JAMMED' },
  }),
  VEIL_BARRIER: entry({
    type: 'GUARD',
    severity: 'MODERATE',
    displayName: 'Veil Barrier',
    description: 'Raises occult barrier layers.',
    targetMode: 'SELF',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: [...GUARD_COUNTERS, 'WARD_BREAK'],
    canBeDispelled: true,
    uiPriority: 27,
    effectPreview: { summary: 'Adds occult wards.' },
  }),
  TARGET_LOCK: entry({
    type: 'LOCK_ON',
    severity: 'HIGH',
    displayName: 'Target Lock',
    description: 'Marks operative for artillery follow-up.',
    targetMode: 'PLAYER',
    telegraphTurns: 1,
    resolvesAt: 'NEXT_ENEMY_TURN',
    counterTags: LOCK_COUNTERS,
    canBeInterrupted: true,
    canBeBlinded: true,
    canBeParried: true,
    isTelegraph: true,
    uiPriority: 90,
    effectPreview: { summary: 'Lock-On — fires next turn. Counter with Blind / Interrupt / Parry / Kill.' },
  }),
  ASHEN_ROT: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Ashen Rot',
    description: 'Applies ashen rot pressure.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: DEBUFF_COUNTERS,
    canBeInterrupted: true,
    canBeDispelled: true,
    uiPriority: 29,
    effectPreview: { summary: 'Applies ashen rot.', appliesStatus: 'ASHEN_ROT' },
  }),
  ARTILLERY_CHARGE: entry({
    type: 'CHANNEL',
    severity: 'HIGH',
    displayName: 'Artillery Charge',
    description: 'Ranged wind-up — sighting for fire.',
    targetMode: 'PLAYER',
    telegraphTurns: 1,
    resolvesAt: 'NEXT_ENEMY_TURN',
    counterTags: CHANNEL_COUNTERS,
    canBeInterrupted: true,
    isTelegraph: true,
    uiPriority: 84,
    effectPreview: { summary: 'Telegraphs Artillery Fire next turn.' },
  }),
  ARTILLERY_FIRE: entry({
    type: 'HEAVY_ATTACK',
    severity: 'HIGH',
    displayName: 'Artillery Fire',
    description: 'Long-range true damage volley.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: ['KILL_SOURCE', 'SHIELD', 'BLOCK', 'DECOY', 'INTERRUPT', 'FRACTURE'],
    canBeParried: false,
    canBeBlocked: true,
    uiPriority: 87,
    effectPreview: { summary: 'Ranged strike — often bypasses frontline.' },
  }),
  TAR_BIND: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Tar Bind',
    description: 'Binds operative with tar.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: DEBUFF_COUNTERS,
    canBeInterrupted: true,
    uiPriority: 31,
    effectPreview: { summary: 'Applies bind / root.', appliesStatus: 'ROOTED' },
  }),
  LASER_SIGHT: entry({
    type: 'LOCK_ON',
    severity: 'HIGH',
    displayName: 'Laser Sight',
    description: 'Marks target for amplified ranged follow-up.',
    targetMode: 'PLAYER',
    telegraphTurns: 1,
    resolvesAt: 'NEXT_ENEMY_TURN',
    counterTags: LOCK_COUNTERS,
    canBeInterrupted: true,
    canBeBlinded: true,
    canBeParried: true,
    isTelegraph: true,
    uiPriority: 92,
    effectPreview: { summary: 'Lock-On sight — kill or blind before fire.' },
  }),
  STAMINA_TETHER: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Stamina Tether',
    description: 'Tethers and drains stamina.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: DEBUFF_COUNTERS,
    canBeInterrupted: true,
    canBeDispelled: true,
    uiPriority: 27,
    effectPreview: { summary: 'Stamina tether drain.' },
  }),
  JAM_AUGMENT: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Jam Augment',
    description: 'Jams operative augments.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: DEBUFF_COUNTERS,
    canBeInterrupted: true,
    uiPriority: 28,
    effectPreview: { summary: 'Jams augment channels.' },
  }),
  MEMORY_LEECH: entry({
    type: 'DEBUFF',
    severity: 'MODERATE',
    displayName: 'Memory Leech',
    description: 'Leeches memory / focus.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: DEBUFF_COUNTERS,
    canBeInterrupted: true,
    uiPriority: 27,
    effectPreview: { summary: 'Leeches focus / memory.' },
  }),
  FIELD_REPAIR: entry({
    type: 'BUFF',
    severity: 'MODERATE',
    displayName: 'Field Repair',
    description: 'Support — restores allied hostiles.',
    targetMode: 'ALLY',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: BUFF_COUNTERS,
    canBeInterrupted: true,
    uiPriority: 45,
    effectPreview: { summary: 'Heals lowest-HP ally.' },
  }),
  HEX_MARK: entry({
    type: 'MARK',
    severity: 'MODERATE',
    displayName: 'Hex Mark',
    description: 'Marks operative — taxes next ability.',
    targetMode: 'PLAYER',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: MARK_COUNTERS,
    canBeInterrupted: true,
    canBeDispelled: true,
    uiPriority: 42,
    effectPreview: { summary: 'Applies HEXED mark.', appliesStatus: 'HEXED' },
  }),
  BINDING_WARD: entry({
    type: 'GUARD',
    severity: 'HIGH',
    displayName: 'Binding Ward',
    description: 'Protective ward on a rival ally.',
    targetMode: 'ALLY',
    telegraphTurns: 0,
    resolvesAt: 'IMMEDIATE',
    counterTags: GUARD_COUNTERS,
    canBeInterrupted: true,
    canBeDispelled: true,
    uiPriority: 60,
    effectPreview: { summary: 'Shields an ally — Guard Break / Armor Break / Kill source.' },
  }),
};

const FALLBACK: EnemyIntentCatalogEntry = entry({
  type: 'BASIC_ATTACK',
  severity: 'LOW',
  displayName: 'Unknown Intent',
  description: 'Uncatalogued hostile action — falls back to basic attack metadata.',
  targetMode: 'PLAYER',
  telegraphTurns: 0,
  resolvesAt: 'IMMEDIATE',
  counterTags: BASIC_COUNTERS,
  canBeParried: true,
  uiPriority: 1,
  effectPreview: { summary: 'Hostile tactical action.' },
});

export function getIntentCatalogEntry(intent: EnemyIntent): EnemyIntentCatalogEntry {
  return ENEMY_INTENT_CATALOG[intent] ?? FALLBACK;
}

export function getIntentType(intent: EnemyIntent): EnemyIntentType {
  return getIntentCatalogEntry(intent).type;
}

export function getIntentSeverity(intent: EnemyIntent): EnemyIntentSeverity {
  return getIntentCatalogEntry(intent).severity;
}

export function isHighOrCriticalIntent(intent: EnemyIntent): boolean {
  const s = getIntentSeverity(intent);
  return s === 'HIGH' || s === 'CRITICAL';
}

export function isTelegraphIntent(intent: EnemyIntent): boolean {
  return getIntentCatalogEntry(intent).isTelegraph === true;
}

export function formatCounterTags(tags: readonly IntentCounterTag[]): string {
  return tags.map((t) => t.replace(/_/g, ' ')).join(', ');
}

export function severityColor(severity: EnemyIntentSeverity): string {
  switch (severity) {
    case 'LOW':
      return '#94a3b8';
    case 'MODERATE':
      return '#fbbf24';
    case 'HIGH':
      return '#f97316';
    case 'CRITICAL':
      return '#ef4444';
    default:
      return '#94a3b8';
  }
}

/** Estimate remaining telegraph turns from live combatant fields. */
export function estimateTurnsRemaining(
  intent: EnemyIntent,
  unit?: {
    chargeTurns?: number;
    isCharging?: boolean;
    laserLockTurnsRemaining?: number;
    spotterLockedOn?: boolean;
  },
): number {
  const meta = getIntentCatalogEntry(intent);
  if (meta.telegraphTurns <= 0 && !meta.isTelegraph) return 0;
  if (unit?.laserLockTurnsRemaining != null && unit.laserLockTurnsRemaining > 0) {
    return unit.laserLockTurnsRemaining;
  }
  if (intent === 'CHARGE' && (unit?.chargeTurns ?? 0) > 0) {
    return Math.max(1, 3 - (unit?.chargeTurns ?? 0));
  }
  if (unit?.isCharging || unit?.spotterLockedOn || meta.isTelegraph) {
    return Math.max(1, meta.telegraphTurns || 1);
  }
  return meta.telegraphTurns;
}
