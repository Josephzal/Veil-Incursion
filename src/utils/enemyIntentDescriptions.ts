import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import { formatIntentReadout } from './combatTelemetryFormat';
import {
  estimateTurnsRemaining,
  formatCounterTags,
  getIntentCatalogEntry,
} from '../data/enemyIntentCatalog';
import type { EnemyIntentSeverity, EnemyIntentType, IntentCounterTag } from '../types/enemyIntentMeta';

export interface EnemyIntentDetail {
  title: string;
  summary: string;
  effect: string;
  counterplay?: string;
  /** Phase 2 metadata */
  intentType?: EnemyIntentType;
  severity?: EnemyIntentSeverity;
  turnsRemaining?: number;
  counterTags?: readonly IntentCounterTag[];
  isTelegraph?: boolean;
}

/** Legacy prose overlays — catalog is source of truth for counters/severity. */
const INTENT_DETAILS: Partial<Record<EnemyIntent, Omit<EnemyIntentDetail, 'title'>>> = {
  STRIKE: {
    summary: 'Direct kinetic melee pressure against operative Soul Anchor.',
    effect: 'Deals base hostile damage. Blockable by Aegis reserve, parry, and defensive buffs unless marked unblockable.',
  },
  DOUBLE_STRIKE: {
    summary: 'Twin cleave — two rapid kinetic hits in one activation.',
    effect: 'Delivers two strike instances. Each roll can be blocked or parried independently if timed separately.',
  },
  WORLD_ENDER: {
    summary: 'Telegraphed finisher after a charge wind-up.',
    effect: 'Unblockable true-pressure strike. Cannot be parried once released.',
  },
  CHARGE: {
    summary: 'Wind-up turn — hostile channels energy for World-Ender.',
    effect: 'No direct damage this cycle. Advances charge counter toward an unblockable strike next turn.',
  },
  EVADE: {
    summary: 'Defensive posture — hostile prioritizes avoidance.',
    effect: 'Adds +60% miss chance to operative strikes while active (not a guaranteed dodge). Hostile spends the turn buffing instead of striking.',
  },
  FORTIFY: {
    summary: 'Hardens kinetic shell for sustained defense.',
    effect: 'Increases effective armor layers for ~2 turns. Hostile spends the turn fortifying instead of striking.',
  },
  STRIP_STAMINA: {
    summary: 'Targets operative stamina reserves.',
    effect: 'Drains stamina directly rather than Soul Anchor HP. Can push Hex-Shot or Envoy into exhaustion.',
  },
  SIPHON_ABYSSAL: {
    summary: 'Occult drain against Abyssal Reserve.',
    effect: 'Pulls Abyssal Reserve from the operative. Especially dangerous against Aegis ward economy.',
  },
  OVERDRIVE_DISCHARGE: {
    summary: 'Boss overdrive burst.',
    effect: 'Heavy kinetic discharge scaled to boss phase. May interact with counter state on overdrive variants.',
  },
  PAVEMENT_CRUSHER_CHARGE: {
    summary: 'Structural wind-up for Pavement Crusher.',
    effect: 'Telegraphs a high-impact unblockable kinetic slam on the following turn.',
  },
  PAVEMENT_CRUSHER: {
    summary: 'Unblockable kinetic rupture.',
    effect: 'Heavy true-pressure structural strike. Parry-eligible kinetic melee on release.',
  },
  FIELD_REPAIR: {
    summary: 'Support action — restores allied hostiles.',
    effect: 'Heals lowest-HP ally or AoE-repairs the squad depending on profile.',
  },
  HEX_MARK: {
    summary: 'Hex mark — taxes your next ability.',
    effect: 'Applies HEXED: next ability costs +10 stamina; occult abilities deal 20% less damage.',
  },
  BINDING_WARD: {
    summary: 'Protective ward on a rival ally.',
    effect: 'Shields one allied merc — absorbs the next hit. Light breaks grant the ally +1 AP.',
  },
  OCCULT_TETHER: {
    summary: 'Links hostiles in an occult tether network.',
    effect: 'Applies tether state that can redirect or share pressure across the squad.',
  },
  ARTILLERY_CHARGE: {
    summary: 'Ranged wind-up — laser/artillery sighting.',
    effect: 'Telegraphs ARTILLERY FIRE next turn. No damage during charge.',
  },
  ARTILLERY_FIRE: {
    summary: 'Long-range true damage volley.',
    effect: 'Ranged strike — not parry-eligible. Often bypasses frontline positioning.',
  },
  VOID_AMBUSH: {
    summary: 'Ambush telegraph — must be interrupted.',
    effect: 'Untargetable setup into a burst strike unless enough damage is dealt during the window.',
  },
  LASER_SIGHT: {
    summary: 'Marks target for amplified ranged follow-up.',
    effect: 'Setup turn that enables a stronger next attack.',
  },
  TARGET_LOCK: {
    summary: 'Spotter lock-on — marks operative for artillery follow-up.',
    effect: 'Lock resolves into a focused strike next hostile turn unless countered.',
  },
  VEIL_BARRIER: {
    summary: 'Raises occult barrier layers.',
    effect: 'Adds occult wards or mitigation for the hostile.',
  },
  SENSORY_JAM: {
    summary: 'Electronic warfare — jams operative targeting intel.',
    effect: 'Obscures hostile intent readouts until jam ends.',
  },
  PREMATURE_IGNITION: {
    summary: 'Unstable detonation telegraph.',
    effect: 'Hostile is about to explode — interrupt, contain, or kill safely.',
  },
};

export function describeEnemyIntent(
  intent: EnemyIntent,
  unit?: Partial<Pick<
    EnemyCombatProfile,
    | 'baseDamage'
    | 'designation'
    | 'chargeTurns'
    | 'isCharging'
    | 'laserLockTurnsRemaining'
    | 'spotterLockedOn'
  >>,
): EnemyIntentDetail {
  const meta = getIntentCatalogEntry(intent);
  const title = formatIntentReadout(intent);
  const entry = INTENT_DETAILS[intent];
  const damageNote = unit?.baseDamage
    ? ` Base profile damage ~${unit.baseDamage}.`
    : '';
  const turnsRemaining = estimateTurnsRemaining(intent, unit);
  const counterplay = `Counters: ${formatCounterTags(meta.counterTags)}.`;

  return {
    title: meta.displayName || title,
    summary: entry?.summary ?? meta.description,
    effect: `${entry?.effect ?? meta.effectPreview.summary}${damageNote}`,
    counterplay,
    intentType: meta.type,
    severity: meta.severity,
    turnsRemaining,
    counterTags: meta.counterTags,
    isTelegraph: meta.isTelegraph === true || turnsRemaining > 0,
  };
}

/** Compact one-line warning for HIGH/CRITICAL banners. */
export function formatIntentWarningBanner(
  intent: EnemyIntent,
  unit?: Parameters<typeof describeEnemyIntent>[1],
): string | null {
  const meta = getIntentCatalogEntry(intent);
  if (meta.severity !== 'HIGH' && meta.severity !== 'CRITICAL') return null;
  const turns = estimateTurnsRemaining(intent, unit);
  const name = meta.displayName;
  if (meta.type === 'LOCK_ON') {
    return `${name} resolving ${turns > 0 ? `in ${turns} turn(s)` : 'next enemy turn'}.`;
  }
  if (meta.type === 'CHANNEL' || meta.isTelegraph) {
    return `${name} completes ${turns > 0 ? `in ${turns} turn(s)` : 'next turn'}.`;
  }
  if (meta.type === 'GUARD') {
    return `${name} protecting allies.`;
  }
  if (meta.type === 'DETONATE') {
    return `${name} — detonation imminent.`;
  }
  return `${name} [${meta.severity}] — respond this turn.`;
}
