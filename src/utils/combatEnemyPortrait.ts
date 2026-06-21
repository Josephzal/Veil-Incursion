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
import Spall from '../../assets/enemy images/spall.png';
import SpallAttacking from '../../assets/enemy images/spall_attack.png';
import Scuttler from '../../assets/enemy images/scuttler.png';
import ScuttlerAttacking from '../../assets/enemy images/scuttler_attack.png';
import Thrall from '../../assets/enemy images/thrall.png';
import ThrallAttacking from '../../assets/enemy images/thrall_attack.png';
import HookWeaver from '../../assets/enemy images/hook_weaver.png';
import HookWeaverAttacking from '../../assets/enemy images/hook_weaver_attack.png';
import MemoryLeech from '../../assets/enemy images/memory_leech.png';
import MemoryLeechAttacking from '../../assets/enemy images/memory_leech_attack.png';
import SmogCaller from '../../assets/enemy images/smog_caller.png';
import SmogCallerAttacking from '../../assets/enemy images/smog_caller_attack.png';
import IronMaiden from '../../assets/enemy images/iron_maiden.png';
import IronMaidenAttacking from '../../assets/enemy images/iron_maiden_attack.png';
import Golem from '../../assets/enemy images/golem.png';
import GolemAttacking from '../../assets/enemy images/golem_attack.png';
import SlagBlood from '../../assets/enemy images/slag_blood.png';
import SlagBloodAttacking from '../../assets/enemy images/slag_blood_attack.png';
import Sapper from '../../assets/enemy images/sapper.png';
import SapperAttacking from '../../assets/enemy images/sapper_attack.png';
import CoilSpikeSniper from '../../assets/enemy images/coil_spike_sniper.png';
import CoilSpikeSniperAttacking from '../../assets/enemy images/coil_spike_sniper_attack.png';
import ResonanceCaster from '../../assets/enemy images/resonance_caster.png';
import ResonanceCasterAttacking from '../../assets/enemy images/resonance_caster_attack.png';
import TarSpitter from '../../assets/enemy images/tar_spitter.png';
import Churn from '../../assets/enemy images/churn.png';
import ChurnAttacking from '../../assets/enemy images/churn_attack.png';
import Splinter from '../../assets/enemy images/splinter.png';
import SplinterAttacking from '../../assets/enemy images/splinter_attack.png';
import Breacher from '../../assets/enemy images/breacher.png';
import BreacherAttacking from '../../assets/enemy images/breacher_attack.png';
import Cutter from '../../assets/enemy images/cutter.png';
import CutterAttacking from '../../assets/enemy images/cutter_attack.png';
import Warden from '../../assets/enemy images/warden.png';
import WardenAttacking from '../../assets/enemy images/warden_attack.png';
import Fixer from '../../assets/enemy images/fixer.png';
import FixerAttacking from '../../assets/enemy images/fixer_attack.png';
import Spotter from '../../assets/enemy images/spotter.png';
import SpotterAttacking from '../../assets/enemy images/spotter_attacking.png';
import Burner from '../../assets/enemy images/burner.png';
import BurnerAttacking from '../../assets/enemy images/burner_attack.png';
import Amalgam from '../../assets/enemy images/amalgam.png';
import AmalgamAttacking from '../../assets/enemy images/amalgam_attack.png';
import WireGhoul from '../../assets/enemy images/wire_ghoul.png';
import WireGhoulAttacking from '../../assets/enemy images/wire_ghoul_attack.png';
import HollowLung from '../../assets/enemy images/hollow_lung.png';
import HollowLungAttacking from '../../assets/enemy images/hollow_lung_attack.png';
import GraveRobber from '../../assets/enemy images/grave_robber.png';
import GraveRobberAttacking from '../../assets/enemy images/grave_robber_attack.png';
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
  'spall': Spall,
  'scuttler': Scuttler,
  'thrall': Thrall,
  'hook-weaver': HookWeaver,
  'memory-leech': MemoryLeech,
  'smog-caller': SmogCaller,
  'iron-maiden': IronMaiden,
  'golem': Golem,
  'slag-blood': SlagBlood,
  'sapper': Sapper,
  'coil-spike-sniper': CoilSpikeSniper,
  'resonance-caster': ResonanceCaster,
  'tar-spitter': TarSpitter,
  'churn': Churn,
  'splinter': Splinter,
  'breacher': Breacher,
  'cutter': Cutter,
  'warden': Warden,
  'fixer': Fixer,
  'spotter': Spotter,
  'burner': Burner,
  'amalgam': Amalgam,
  'wire-ghoul': WireGhoul,
  'hollow-lung': HollowLung,
  'grave-robber': GraveRobber,
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
  'spall': SpallAttacking,
  'scuttler': ScuttlerAttacking,
  'thrall': ThrallAttacking,
  'hook-weaver': HookWeaverAttacking,
  'memory-leech': MemoryLeechAttacking,
  'smog-caller': SmogCallerAttacking,
  'iron-maiden': IronMaidenAttacking,
  'golem': GolemAttacking,
  'slag-blood': SlagBloodAttacking,
  'sapper': SapperAttacking,
  'coil-spike-sniper': CoilSpikeSniperAttacking,
  'resonance-caster': ResonanceCasterAttacking,
  'tar-spitter': TarSpitter,
  'churn': ChurnAttacking,
  'splinter': SplinterAttacking,
  'breacher': BreacherAttacking,
  'cutter': CutterAttacking,
  'warden': WardenAttacking,
  'fixer': FixerAttacking,
  'spotter': SpotterAttacking,
  'burner': BurnerAttacking,
  'amalgam': AmalgamAttacking,
  'wire-ghoul': WireGhoulAttacking,
  'hollow-lung': HollowLungAttacking,
  'grave-robber': GraveRobberAttacking,
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
