import type { ImageSourcePropType } from 'react-native';
import FortifiedIcon from '../../assets/images/enemy status images/fortified.png';
import EvadingIcon from '../../assets/images/enemy status images/evading.png';
import EnragedIcon from '../../assets/images/enemy status images/enraged.png';
import ConcussedIcon from '../../assets/images/enemy status images/concussed.png';
import DoomedIcon from '../../assets/images/enemy status images/doomed.png';
import type { EnemyIntent } from '../types/run';

export type EnemyStatusEffectKey = 'fortified' | 'evading' | 'enraged' | 'concussed' | 'doomed';

/** Fixed square size for every intel status chip (icons + text abbreviations). */
export const INTEL_STATUS_CHIP_SIZE = 20;

export interface EnemyActiveStatusSource {
  combatTags?: readonly string[];
  evadeActive?: boolean;
  evadeTurnsRemaining?: number;
  intent?: EnemyIntent;
  fortifyTurnsRemaining?: number;
  doomedStacks?: number;
  isEnraged?: boolean;
  chargeTurns?: number;
  isFractured?: boolean;
  veilRotStacks?: number;
  kineticArmor?: number;
  occultWards?: number;
}

export interface EnemyStatusEffectDef {
  key: EnemyStatusEffectKey;
  label: string;
  description: string;
  icon: ImageSourcePropType;
}

/** Unified intel chip — icon statuses and abbreviated defenses share one square size. */
export interface IntelStatusChip {
  id: string;
  abbr: string;
  label: string;
  description: string;
  icon?: ImageSourcePropType;
}

export const ENEMY_STATUS_EFFECT_ORDER: readonly EnemyStatusEffectKey[] = [
  'fortified',
  'evading',
  'enraged',
  'concussed',
  'doomed',
] as const;

export const ENEMY_STATUS_EFFECTS: Record<EnemyStatusEffectKey, EnemyStatusEffectDef> = {
  fortified: {
    key: 'fortified',
    label: 'Fortified',
    description: '+30% Physical Damage Resistance.',
    icon: FortifiedIcon,
  },
  evading: {
    key: 'evading',
    label: 'Evade Posture',
    description: '+50% miss chance vs operative strikes for 2 turns — not a guaranteed dodge.',
    icon: EvadingIcon,
  },
  enraged: {
    key: 'enraged',
    label: 'Enraged',
    description: 'Combat frenzy below HP threshold — increased damage and roster-specific enrage effects.',
    icon: EnragedIcon,
  },
  concussed: {
    key: 'concussed',
    label: 'Concussed',
    description: '-1 Action Point (AP) gain per turn. Cannot use complex abilities.',
    icon: ConcussedIcon,
  },
  doomed: {
    key: 'doomed',
    label: 'Doomed',
    description: 'Takes True Damage (bypasses all armor) equal to 50% max HP in 1 turn.',
    icon: DoomedIcon,
  },
};

const TAG_CHIP_DEFS: Record<string, { abbr: string; label: string; description: string }> = {
  EXPOSED: {
    abbr: 'EX',
    label: 'Exposed',
    description: 'Vulnerable to follow-up strikes — takes increased damage from operative attacks.',
  },
  FRACTURED: {
    abbr: 'FR',
    label: 'Fractured',
    description: 'Structural integrity broken — restricted actions and heightened damage taken.',
  },
  VULNERABLE: {
    abbr: 'VU',
    label: 'Vulnerable',
    description: 'Defenses compromised — incoming damage is amplified.',
  },
  BLINDED: {
    abbr: 'BL',
    label: 'Blinded',
    description: 'Perception disrupted — reduced accuracy and telegraphed intents may be obscured.',
  },
};

/** Derive tray icon keys from live hostile state. */
export function resolveActiveEnemyStatuses(unit: EnemyActiveStatusSource): EnemyStatusEffectKey[] {
  const tags = new Set(unit.combatTags ?? []);
  const statuses: EnemyStatusEffectKey[] = [];

  if ((unit.fortifyTurnsRemaining ?? 0) > 0) statuses.push('fortified');
  if ((unit.evadeTurnsRemaining ?? 0) > 0 || unit.evadeActive) statuses.push('evading');
  if (unit.isEnraged) statuses.push('enraged');
  if (tags.has('CONCUSSED')) statuses.push('concussed');
  if (tags.has('DOOMED') || (unit.doomedStacks ?? 0) > 0) statuses.push('doomed');

  return ENEMY_STATUS_EFFECT_ORDER.filter((key) => statuses.includes(key));
}

/**
 * All intel statuses as uniform selectable chips (icon tray + armor/tags).
 * Use this for the hostile intel container so every status is the same square size.
 */
export function resolveIntelStatusChips(unit: EnemyActiveStatusSource): IntelStatusChip[] {
  const chips: IntelStatusChip[] = [];
  const tags = new Set(unit.combatTags ?? []);

  const ka = unit.kineticArmor ?? 0;
  if (ka > 0) {
    chips.push({
      id: `ka-${ka}`,
      abbr: ka > 1 ? `K${ka}` : 'KA',
      label: 'Kinetic Armor',
      description: `Absorbs ${ka} stack${ka === 1 ? '' : 's'} of kinetic (physical) damage before HP is touched.`,
    });
  }

  const ow = unit.occultWards ?? 0;
  if (ow > 0) {
    chips.push({
      id: `ow-${ow}`,
      abbr: ow > 1 ? `O${ow}` : 'OW',
      label: 'Occult Wards',
      description: `Absorbs ${ow} stack${ow === 1 ? '' : 's'} of occult damage before HP is touched.`,
    });
  }

  for (const key of resolveActiveEnemyStatuses(unit)) {
    const def = ENEMY_STATUS_EFFECTS[key];
    chips.push({
      id: key,
      abbr: def.label.slice(0, 2).toUpperCase(),
      label: def.label,
      description: def.description,
      icon: def.icon,
    });
  }

  if ((unit.chargeTurns ?? 0) > 0 || unit.intent === 'CHARGE' || unit.intent === 'ARTILLERY_CHARGE') {
    chips.push({
      id: 'charging',
      abbr: 'CH',
      label: 'Charging',
      description: 'Winding up a telegraph attack. Interrupt or prepare defense before the payoff lands.',
    });
  }

  if (unit.intent === 'WORLD_ENDER') {
    chips.push({
      id: 'world-ender',
      abbr: 'WE',
      label: 'World-Ender',
      description: 'Catastrophic finisher charged — extreme damage on release. Prioritize interrupt or parry.',
    });
  }

  for (const tag of ['EXPOSED', 'FRACTURED', 'VULNERABLE', 'BLINDED'] as const) {
    const active = tags.has(tag) || (tag === 'FRACTURED' && unit.isFractured);
    if (!active) continue;
    const def = TAG_CHIP_DEFS[tag];
    if (!def) continue;
    chips.push({
      id: tag.toLowerCase(),
      abbr: def.abbr,
      label: def.label,
      description: def.description,
    });
  }

  const rot = unit.veilRotStacks ?? 0;
  if (rot > 0) {
    chips.push({
      id: `veil-rot-${rot}`,
      abbr: rot > 1 ? `R${rot}` : 'VR',
      label: 'Veil Rot',
      description: `Occult corruption stacks (${rot}). Escalates occult pressure and related roster effects.`,
    });
  }

  return chips;
}

export function getEnemyStatusEffectDef(key: EnemyStatusEffectKey): EnemyStatusEffectDef {
  return ENEMY_STATUS_EFFECTS[key];
}
