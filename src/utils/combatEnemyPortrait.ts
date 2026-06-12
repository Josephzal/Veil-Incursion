import { ImageSourcePropType } from 'react-native';
import ConcreteGargoyle from '../../assets/enemy images/concrete_gargoyle.png';
import GutterGoliath from '../../assets/enemy images/gutter_goliath.png';
import LeySiren from '../../assets/enemy images/ley_siren.png';
import MiasmaTickSwarm from '../../assets/enemy images/miasma_tick.png';
import HollowedPrecinct from '../../assets/enemy images/hollowed_precinct.png';
import FractureHound from '../../assets/enemy images/hound.png';
import EchoingBrute from '../../assets/enemy images/echoing-brute.png';
import SpatialGlitch from '../../assets/enemy images/spatial_glitch.png';
import NullShade from '../../assets/enemy images/null_shade.png';
import AshWeeper from '../../assets/enemy images/ash-weeper.png';
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
};

export function resolveRosterPortrait(rosterId?: string | null): ImageSourcePropType {
  if (!rosterId) return EnemyFallback;
  return ROSTER_PORTRAITS[rosterId as EnemyRosterId] ?? EnemyFallback;
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
