import { ImageSourcePropType } from 'react-native';
import ConcreteGargoyle from '../../assets/enemy images/concrete_gargoyle.png';
import GargoyleAttacking from '../../assets/enemy images/gargoyle_attacking.png';
import GutterGoliath from '../../assets/enemy images/gutter_goliath.png';
import GutterGoliathAttacking from '../../assets/enemy images/gutter_goliath_attacking.png';
import LeySiren from '../../assets/enemy images/ley_siren.png';
import LeySirenAttacking from '../../assets/enemy images/ley_siren_attacking.png';
import MiasmaTickSwarm from '../../assets/enemy images/miasma_tick.png';
import HollowedPrecinct from '../../assets/enemy images/hollowed_precinct.png';
import HollowedPrecinctAttacking from '../../assets/enemy images/hollowed_precinct_attacking.png';
import FractureHound from '../../assets/enemy images/hound.png';
import FractureHoundAttacking from '../../assets/enemy images/hound_attacking.png';
import EchoingBrute from '../../assets/enemy images/echoing-brute.png';
import EchoingBruteAttacking from '../../assets/enemy images/echoing_brute_attacking.png';
import SpatialGlitch from '../../assets/enemy images/spatial_glitch.png';
import SpatialGlitchAttacking from '../../assets/enemy images/spatial_glitch_attacking.png';
import NullShade from '../../assets/enemy images/null_shade.png';
import NullShadeAttacking from '../../assets/enemy images/null_shade_attacking.png';
import AshWeeper from '../../assets/enemy images/ash-weeper.png';
import AshWeeperAttacking from '../../assets/enemy images/ash_weeper_attacking.png';
import EnemyFallback from '../../assets/enemy images/enemyl2.png';
import EnemyStalker from '../../assets/enemy images/stalkerv1.png';
import type { RunNodeType } from '../types/game';
import type { EnemyCombatProfile } from '../types/run';
import type { EnemyRosterId } from '../data/enemyRoster';

const ROSTER_PORTRAITS: Partial<Record<EnemyRosterId, ImageSourcePropType>> = {
  'concrete-gargoyle': ConcreteGargoyle,
  'gutter-goliath': GutterGoliath,
  'echoing-brute': EchoingBrute,
  'ley-siren': LeySiren,
  'ash-weeper': AshWeeper,
  'miasma-tick-swarm': MiasmaTickSwarm,
  'fracture-hound': FractureHound,
  'null-shade': NullShade,
  'spatial-glitch': SpatialGlitch,
  'boss-hollowed-precinct': HollowedPrecinct,
  'spall': NullShade,
  'scuttler': NullShade,
  'thrall': NullShade,
  'hook-weaver': NullShade,
  'memory-leech': NullShade,
  'smog-caller': NullShade,
  'iron-maiden': NullShade,
  'golem': NullShade,
  'slag-blood': NullShade,
  'sapper': NullShade,
  'coil-spike-sniper': NullShade,
  'resonance-caster': NullShade,
  'tar-spitter': NullShade,
  'churn': NullShade,
  'splinter': NullShade,
};

const ROSTER_ATTACK_PORTRAITS: Partial<Record<EnemyRosterId, ImageSourcePropType>> = {
  'concrete-gargoyle': GargoyleAttacking,
  'gutter-goliath': GutterGoliathAttacking,
  'echoing-brute': EchoingBruteAttacking,
  'ley-siren': LeySirenAttacking,
  'ash-weeper': AshWeeperAttacking,
  'fracture-hound': FractureHoundAttacking,
  'null-shade': NullShadeAttacking,
  'spatial-glitch': SpatialGlitchAttacking,
  'boss-hollowed-precinct': HollowedPrecinctAttacking,
  'spall': NullShadeAttacking,
  'scuttler': NullShadeAttacking,
  'thrall': NullShadeAttacking,
  'hook-weaver': NullShadeAttacking,
  'memory-leech': NullShadeAttacking,
  'smog-caller': NullShadeAttacking,
  'iron-maiden': NullShadeAttacking,
  'golem': NullShadeAttacking,
  'slag-blood': NullShadeAttacking,
  'sapper': NullShadeAttacking,
  'coil-spike-sniper': NullShadeAttacking,
  'resonance-caster': NullShadeAttacking,
  'tar-spitter': NullShadeAttacking,
  'churn': NullShadeAttacking,
  'splinter': NullShadeAttacking,
};

export function resolveRosterPortrait(rosterId?: string | null): ImageSourcePropType {
  if (!rosterId) return EnemyFallback;
  return ROSTER_PORTRAITS[rosterId as EnemyRosterId] ?? EnemyFallback;
}

export function resolveRosterAttackPortrait(rosterId?: string | null): ImageSourcePropType | null {
  if (!rosterId) return null;
  return ROSTER_ATTACK_PORTRAITS[rosterId as EnemyRosterId] ?? null;
}

export function resolveCombatEnemyPortrait(options: {
  isBoss?: boolean;
  isVeilStalker?: boolean;
  rosterId?: string | null;
  nodeType?: RunNodeType | null;
  isElite?: boolean;
  enemyClass?: EnemyCombatProfile['class'];
}): ImageSourcePropType {
  if (options.isVeilStalker) return EnemyStalker;
  if (options.rosterId) return resolveRosterPortrait(options.rosterId);
  if (options.isBoss) return EnemyFallback;
  return EnemyFallback;
}

export function resolveUnitCombatPortrait(
  unit: Pick<
    EnemyCombatProfile,
    'isBoss' | 'isVeilStalker' | 'class' | 'rosterId'
  >,
  nodeType?: RunNodeType | null,
): ImageSourcePropType {
  if (unit.isVeilStalker) return EnemyStalker;
  if (unit.rosterId) return resolveRosterPortrait(unit.rosterId);
  if (unit.isBoss) return EnemyFallback;
  return EnemyFallback;
}

export function resolveUnitCombatAttackPortrait(
  unit: Pick<
    EnemyCombatProfile,
    'isBoss' | 'isVeilStalker' | 'class' | 'rosterId'
  >,
  idlePortrait: ImageSourcePropType,
): ImageSourcePropType {
  if (unit.isVeilStalker || unit.isBoss) return idlePortrait;
  if (unit.rosterId) {
    return resolveRosterAttackPortrait(unit.rosterId) ?? idlePortrait;
  }
  return idlePortrait;
}

export function resolvePortraitKeySuffix(options: {
  isBoss: boolean;
  isVeilStalker?: boolean;
  rosterId?: string | null;
  nodeType?: RunNodeType | null;
}): string {
  if (options.isVeilStalker) return 'stalker';
  if (options.rosterId) return options.rosterId;
  if (options.isBoss) return 'boss';
  if (options.nodeType === 'ELITE_COMBAT') return 'elite';
  return 'standard';
}
