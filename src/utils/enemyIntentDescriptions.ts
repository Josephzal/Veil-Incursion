import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import { formatIntentReadout } from './combatTelemetryFormat';

export interface EnemyIntentDetail {
  title: string;
  summary: string;
  effect: string;
  counterplay?: string;
}

const INTENT_DETAILS: Partial<Record<EnemyIntent, Omit<EnemyIntentDetail, 'title'>>> = {
  STRIKE: {
    summary: 'Direct kinetic melee pressure against operative Soul Anchor.',
    effect: 'Deals base hostile damage. Blockable by Aegis reserve, parry, and defensive buffs unless marked unblockable.',
    counterplay: 'Prime Void Ward before ending turn to intercept kinetic melee. Fracture the attacker to strip armor and amplify follow-up damage.',
  },
  DOUBLE_STRIKE: {
    summary: 'Twin cleave — two rapid kinetic hits in one activation.',
    effect: 'Delivers two strike instances. Each roll can be blocked or parried independently if timed separately.',
    counterplay: 'High fracture gain per hit. Stagger or stun before execution if possible.',
  },
  WORLD_ENDER: {
    summary: 'Telegraphed finisher after a charge wind-up.',
    effect: 'Unblockable true-pressure strike. Cannot be parried once released.',
    counterplay: 'Interrupt during CHARGE turns or burst the charger before release.',
  },
  CHARGE: {
    summary: 'Wind-up turn — hostile channels energy for World-Ender.',
    effect: 'No direct damage this cycle. Advances charge counter toward an unblockable strike next turn.',
    counterplay: 'Use the free player turn to fracture, stun, or eliminate the charger.',
  },
  EVADE: {
    summary: 'Defensive posture — hostile prioritizes avoidance.',
    effect: 'Grants 50% evade chance against player attacks while active. Hostile spends the turn buffing instead of striking.',
    counterplay: 'Do not over-commit AP on a single evading target. Strip evade with concuss or guaranteed-hit abilities.',
  },
  FORTIFY: {
    summary: 'Hardens kinetic shell for sustained defense.',
    effect: 'Increases effective armor layers for ~2 turns. Hostile spends the turn fortifying instead of striking.',
    counterplay: 'Use armor-pierce, occult, or fracture to bypass hardened shell.',
  },
  STRIP_STAMINA: {
    summary: 'Targets operative stamina reserves.',
    effect: 'Drains stamina directly rather than Soul Anchor HP. Can push Hex-Shot or Envoy into exhaustion.',
    counterplay: 'End turn early if stamina-critical. Aegis players ignore stamina but should still respect tempo loss.',
  },
  SIPHON_ABYSSAL: {
    summary: 'Occult drain against Abyssal Reserve.',
    effect: 'Pulls Abyssal Reserve from the operative. Especially dangerous against Aegis ward economy.',
    counterplay: 'Spend or shield reserve before the hostile phase. Kill the siphon source quickly.',
  },
  OVERDRIVE_DISCHARGE: {
    summary: 'Boss overdrive burst.',
    effect: 'Heavy kinetic discharge scaled to boss phase. May interact with counter state on overdrive variants.',
    counterplay: 'Fracture and burst during telegraph windows. Reserve parry for non-overdrive melee intents.',
  },
  PAVEMENT_CRUSHER_CHARGE: {
    summary: 'Structural wind-up for Pavement Crusher.',
    effect: 'Telegraphs a high-impact unblockable kinetic slam on the following turn.',
    counterplay: 'Focus fire during charge. Disrupt with stun or fracture if available.',
  },
  PAVEMENT_CRUSHER: {
    summary: 'Unblockable kinetic rupture.',
    effect: 'Heavy true-pressure structural strike. Parry-eligible kinetic melee on release.',
    counterplay: 'Void Ward parry reflects fracture on perfect lock. Reduce HP before impact.',
  },
  FIELD_REPAIR: {
    summary: 'Support action — restores allied hostiles.',
    effect: 'Heals lowest-HP ally or AoE-repairs the squad depending on profile.',
    counterplay: 'Focus the fixer first. Burst wounded allies before repair resolves.',
  },
  OCCULT_TETHER: {
    summary: 'Links hostiles in an occult tether network.',
    effect: 'Applies tether state that can redirect or share pressure across the squad.',
    counterplay: 'Break tether carriers early. Spread damage to avoid single-link over-focus.',
  },
  ARTILLERY_CHARGE: {
    summary: 'Ranged wind-up — laser/artillery sighting.',
    effect: 'Telegraphs ARTILLERY FIRE next turn. No damage during charge.',
    counterplay: 'Close or eliminate before fire turn. Use player turn to reposition resources.',
  },
  ARTILLERY_FIRE: {
    summary: 'Long-range true damage volley.',
    effect: 'Ranged strike — not parry-eligible. Often bypasses frontline positioning.',
    counterplay: 'Kill artillery before fire or stack mitigation on Soul Anchor.',
  },
  VOID_AMBUSH: {
    summary: 'Ambush telegraph — must be interrupted.',
    effect: 'Untargetable setup into a burst strike unless enough damage is dealt during the window.',
    counterplay: 'Spend the player turn dealing threshold damage to interrupt before execution.',
  },
  LASER_SIGHT: {
    summary: 'Marks target for amplified ranged follow-up.',
    effect: 'Setup turn that enables a stronger next attack.',
    counterplay: 'Kill or fracture the spotter during the sight turn.',
  },
  VEIL_BARRIER: {
    summary: 'Raises occult barrier layers.',
    effect: 'Adds occult wards or mitigation for the hostile.',
    counterplay: 'Switch to occult-pierce or sustained fracture pressure.',
  },
  SENSORY_JAM: {
    summary: 'Electronic warfare — jams operative targeting intel.',
    effect: 'Obscures hostile intent readouts until jam ends.',
    counterplay: 'Play around known patterns. Prioritize jammer elimination.',
  },
};

export function describeEnemyIntent(
  intent: EnemyIntent,
  unit?: Pick<EnemyCombatProfile, 'baseDamage' | 'designation'>,
): EnemyIntentDetail {
  const title = formatIntentReadout(intent);
  const entry = INTENT_DETAILS[intent];
  if (entry) {
    const damageNote = unit?.baseDamage
      ? ` Base profile damage ~${unit.baseDamage}.`
      : '';
    return {
      title,
      summary: entry.summary,
      effect: `${entry.effect}${damageNote}`,
      counterplay: entry.counterplay,
    };
  }
  return {
    title,
    summary: 'Hostile tactical action.',
    effect: `${formatIntentReadout(intent)} — consult roster intel for exact scaling.`,
    counterplay: 'Maintain fracture pressure and spend AP efficiently before the hostile phase.',
  };
}
