/**
 * Phase 3M — nine weapon presentation profiles keyed only by permanent weapon ID.
 */

import type { WeaponFamilyId } from '../../types/weapon';
import type {
  PresentationSequenceStep,
  WeaponCombatPresentationProfile,
} from '../../types/weaponCombatPresentation';
import { WEAPON_ANCHOR_ATTACK_BY_FAMILY } from '../weaponAnchorAttackRegistry';
import { WEAPON_ULTIMATE_BY_FAMILY } from '../weaponUltimateRegistry';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from '../weaponRegistry';

function cueSet(prefix: string): WeaponCombatPresentationProfile['cues'] {
  return {
    release: `sfx.${prefix}.release`,
    travel: `sfx.${prefix}.travel`,
    fleshContact: `sfx.${prefix}.flesh`,
    kineticArmor: `sfx.${prefix}.ka`,
    occultWard: `sfx.${prefix}.ow`,
    fracture: `sfx.${prefix}.fracture`,
    defenseBreak: `sfx.${prefix}.break`,
    killConfirm: `sfx.${prefix}.kill`,
    resourceLoop: `sfx.${prefix}.resource`,
    reloadOrSacrifice: `sfx.${prefix}.reload_sacrifice`,
  };
}

function seq(
  steps: Array<[PresentationSequenceStep['stage'], PresentationSequenceStep['primitive'], number, number, string?]>,
): PresentationSequenceStep[] {
  return steps.map(([stage, primitive, delayMs, durationMs, cueId]) => ({
    stage,
    primitive,
    delayMs,
    durationMs,
    cueId,
  }));
}

function profile(
  weaponFamilyId: WeaponFamilyId,
  partial: Omit<
    WeaponCombatPresentationProfile,
    'weaponFamilyId' | 'displayName' | 'anchorId' | 'ultimateId' | 'idlePoseKey' | 'attackPoseKey' | 'cues'
  > & { cuePrefix: string; cues?: Partial<WeaponCombatPresentationProfile['cues']> },
): WeaponCombatPresentationProfile {
  const family = getWeaponFamily(weaponFamilyId);
  const anchor = WEAPON_ANCHOR_ATTACK_BY_FAMILY[weaponFamilyId];
  const ultimate = WEAPON_ULTIMATE_BY_FAMILY[weaponFamilyId];
  const { cuePrefix, cues: cueOverrides, ...rest } = partial;
  return {
    weaponFamilyId,
    displayName: family.name,
    cues: { ...cueSet(cuePrefix), ...cueOverrides },
    anchorId: anchor.id,
    ultimateId: ultimate.id,
    idlePoseKey: weaponFamilyId,
    attackPoseKey: weaponFamilyId,
    ...rest,
  };
}

export const WEAPON_COMBAT_PRESENTATION_BY_FAMILY: Record<
  WeaponFamilyId,
  WeaponCombatPresentationProfile
> = {
  'aegis-runed-longsword': profile('aegis-runed-longsword', {
    cuePrefix: 'longsword',
    cues: {
      release: 'sfx.aegis.attack',
      fleshContact: 'sfx.aegis.contact_silent',
    },
    motionFamily: 'DIRECTIONAL_SLASH',
    palette: 'PALE_STEEL_MINT',
    trailShape: 'thin_edge',
    hitStopClass: 'MEDIUM',
    shakeClass: 'LIGHT',
    hapticClass: 'LIGHT',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'directional_slash',
    anchorSequence: seq([
      ['ANTICIPATION', 'pose_swap', 0, 60],
      ['RELEASE', 'directional_slash', 40, 140, 'sfx.aegis.attack'],
      ['CONTACT', 'impact_spark', 120, 90],
      ['AFTERMATH', 'fracture_crack', 180, 120, 'sfx.longsword.fracture'],
      ['AFTERMATH', 'resource_pulse', 220, 100, 'sfx.longsword.resource'],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'pose_swap', 0, 80],
      ['RELEASE', 'directional_slash', 40, 120, 'sfx.aegis.ultimate'],
      ['CONTACT', 'impact_spark', 100, 80],
      ['CONTACT', 'impact_spark', 180, 80],
      ['CONTACT', 'impact_spark', 260, 100],
      ['AFTERMATH', 'fracture_crack', 320, 140, 'sfx.longsword.kill'],
    ]),
  }),
  'aegis-rift-edge': profile('aegis-rift-edge', {
    cuePrefix: 'paired',
    cues: {
      release: 'sfx.paired.attack',
      fleshContact: 'sfx.aegis.contact_silent',
    },
    motionFamily: 'MIRRORED_SLASH',
    palette: 'CYAN_VEIL',
    trailShape: 'twin_crossing',
    hitStopClass: 'LIGHT',
    shakeClass: 'LIGHT',
    hapticClass: 'LIGHT',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'mirrored_slash',
    anchorSequence: seq([
      ['ANTICIPATION', 'outline_pulse', 0, 50],
      ['RELEASE', 'mirrored_slash', 30, 130, 'sfx.paired.attack'],
      ['CONTACT', 'impact_spark', 110, 70],
      ['AFTERMATH', 'resource_pulse', 160, 90, 'sfx.paired.resource'],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'outline_pulse', 0, 70],
      ['RELEASE', 'mirrored_slash', 40, 120, 'sfx.paired.ult_flurry'],
      ['CONTACT', 'impact_spark', 100, 70],
      ['CONTACT', 'impact_spark', 160, 70],
      ['AFTERMATH', 'ow_glyph_flare', 220, 120],
    ]),
  }),
  'aegis-claymore-blade': profile('aegis-claymore-blade', {
    cuePrefix: 'unmaker',
    cues: {
      release: 'sfx.unmaker.attack',
      fleshContact: 'sfx.aegis.contact_silent',
    },
    motionFamily: 'HEAVY_VERTICAL',
    palette: 'HEAVY_IRON',
    trailShape: 'thick_descent',
    hitStopClass: 'HEAVY',
    shakeClass: 'HEAVY',
    hapticClass: 'HEAVY',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'heavy_vertical',
    anchorSequence: seq([
      ['ANTICIPATION', 'pose_swap', 0, 90],
      ['RELEASE', 'heavy_vertical', 50, 180, 'sfx.unmaker.attack'],
      ['CONTACT', 'impact_spark', 180, 110],
      ['AFTERMATH', 'fracture_crack', 260, 140, 'sfx.unmaker.fracture'],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'pose_swap', 0, 120],
      ['RELEASE', 'heavy_vertical', 80, 220, 'sfx.unmaker.ultimate'],
      ['CONTACT', 'impact_spark', 260, 140],
      ['AFTERMATH', 'fracture_crack', 360, 160, 'sfx.unmaker.kill'],
    ]),
  }),
  'hex-silver-core-sidearm': profile('hex-silver-core-sidearm', {
    cuePrefix: 'revolver',
    cues: {
      release: 'sfx.revolver.release',
      fleshContact: 'sfx.aegis.contact_silent',
      reloadOrSacrifice: 'sfx.revolver.reload_sacrifice',
    },
    motionFamily: 'PROJECTILE_TRACER',
    palette: 'SILVER_SEAL',
    trailShape: 'narrow_tracer',
    hitStopClass: 'LIGHT',
    shakeClass: 'LIGHT',
    hapticClass: 'LIGHT',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'projectile_tracer',
    anchorSequence: seq([
      ['ANTICIPATION', 'radial_chamber', 0, 40],
      ['RELEASE', 'muzzle_flash', 20, 50, 'sfx.revolver.release'],
      ['RELEASE', 'projectile_tracer', 40, 90],
      ['CONTACT', 'impact_spark', 110, 70],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'radial_chamber', 0, 80],
      ['RELEASE', 'projectile_tracer', 60, 80, 'sfx.revolver.release'],
      ['CONTACT', 'impact_spark', 120, 60],
      ['CONTACT', 'impact_spark', 180, 60],
      ['CONTACT', 'impact_spark', 240, 70],
    ]),
  }),
  'hex-pulse-rifle': profile('hex-pulse-rifle', {
    cuePrefix: 'carbine',
    cues: {
      release: 'sfx.carbine.release',
      fleshContact: 'sfx.aegis.contact_silent',
      reloadOrSacrifice: 'sfx.carbine.reload_sacrifice',
    },
    motionFamily: 'BURST_TRACER',
    palette: 'CINDER_ASH',
    trailShape: 'ash_burst',
    hitStopClass: 'LIGHT',
    shakeClass: 'LIGHT',
    hapticClass: 'LIGHT',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'burst_tracer_group',
    anchorSequence: seq([
      ['ANTICIPATION', 'pose_swap', 0, 40],
      ['RELEASE', 'burst_tracer_group', 20, 160, 'sfx.carbine.release'],
      ['CONTACT', 'impact_spark', 100, 60],
      ['AFTERMATH', 'resource_pulse', 180, 80, 'sfx.carbine.resource'],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'radial_chamber', 0, 70],
      ['RELEASE', 'burst_tracer_group', 40, 220, 'sfx.carbine.release'],
      ['CONTACT', 'impact_spark', 120, 50],
      ['CONTACT', 'impact_spark', 170, 50],
      ['CONTACT', 'impact_spark', 220, 50],
    ]),
  }),
  'hex-void-cannon': profile('hex-void-cannon', {
    cuePrefix: 'blackdoor',
    cues: {
      release: 'sfx.blackdoor.release',
      fleshContact: 'sfx.aegis.contact_silent',
      reloadOrSacrifice: 'sfx.blackdoor.reload_sacrifice',
    },
    motionFamily: 'BREACH_RINGS',
    palette: 'NULL_BREACH',
    trailShape: 'concentric_breach',
    hitStopClass: 'HEAVY',
    shakeClass: 'HEAVY',
    hapticClass: 'HEAVY',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'concentric_breach_rings',
    anchorSequence: seq([
      ['ANTICIPATION', 'concentric_breach_rings', 0, 70],
      ['RELEASE', 'muzzle_flash', 50, 60, 'sfx.blackdoor.release'],
      ['CONTACT', 'impact_spark', 140, 110],
      ['AFTERMATH', 'ka_plate_pulse', 200, 100, 'sfx.blackdoor.ka'],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'concentric_breach_rings', 0, 100],
      ['RELEASE', 'concentric_breach_rings', 80, 160, 'sfx.blackdoor.release'],
      ['CONTACT', 'impact_spark', 220, 140],
      ['AFTERMATH', 'defense_break_float', 320, 120, 'sfx.blackdoor.break'],
    ]),
  }),
  'envoy-echo-lantern': profile('envoy-echo-lantern', {
    cuePrefix: 'vambrace',
    cues: {
      release: 'sfx.vambrace.release',
      fleshContact: 'sfx.aegis.contact_silent',
    },
    motionFamily: 'THREAD_KNOT',
    palette: 'CURSE_VIOLET',
    trailShape: 'curse_thread',
    hitStopClass: 'MEDIUM',
    shakeClass: 'LIGHT',
    hapticClass: 'LIGHT',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'thread_connection',
    anchorSequence: seq([
      ['ANTICIPATION', 'thread_connection', 0, 80],
      ['RELEASE', 'knot_tension', 60, 120, 'sfx.vambrace.release'],
      ['CONTACT', 'ow_glyph_flare', 150, 90],
      ['AFTERMATH', 'resource_pulse', 220, 100, 'sfx.vambrace.resource'],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'thread_connection', 0, 100],
      ['RELEASE', 'knot_tension', 80, 140, 'sfx.vambrace.release'],
      ['CONTACT', 'ow_glyph_flare', 200, 100],
      ['AFTERMATH', 'resource_pulse', 280, 120, 'sfx.vambrace.resource'],
    ]),
  }),
  'envoy-null-conduit': profile('envoy-null-conduit', {
    cuePrefix: 'scythe',
    cues: {
      release: 'sfx.scythe.release',
      fleshContact: 'sfx.aegis.contact_silent',
      travel: 'sfx.aegis.contact_silent',
      kineticArmor: 'sfx.aegis.contact_silent',
      occultWard: 'sfx.aegis.contact_silent',
      fracture: 'sfx.aegis.contact_silent',
      defenseBreak: 'sfx.aegis.contact_silent',
      killConfirm: 'sfx.aegis.contact_silent',
      resourceLoop: 'sfx.aegis.contact_silent',
    },
    motionFamily: 'CRESCENT_ARC',
    palette: 'NULL_CYAN',
    trailShape: 'null_crescent',
    hitStopClass: 'MEDIUM',
    shakeClass: 'MEDIUM',
    hapticClass: 'LIGHT',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'arc_crescent',
    // Scythe: basic = attack→impact; ultimate = ult→attack.
    anchorSequence: seq([
      ['ANTICIPATION', 'pose_swap', 0, 60],
      ['RELEASE', 'arc_crescent', 40, 160, 'sfx.scythe.release'],
      ['CONTACT', 'impact_spark', 150, 80],
      ['AFTERMATH', 'resource_pulse', 210, 100],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'circuit_node_connection', 0, 90],
      ['RELEASE', 'arc_crescent', 70, 180, 'sfx.scythe.ultimate'],
      ['CONTACT', 'impact_spark', 200, 90],
      ['AFTERMATH', 'resource_pulse', 280, 110],
    ]),
  }),
  'envoy-sanguine-prism': profile('envoy-sanguine-prism', {
    cuePrefix: 'heart',
    cues: {
      release: 'sfx.heart.release',
      fleshContact: 'sfx.aegis.contact_silent',
    },
    motionFamily: 'POLYGON_REFRACTION',
    palette: 'CRIMSON_GLASS',
    trailShape: 'refracted_rays',
    hitStopClass: 'MEDIUM',
    shakeClass: 'MEDIUM',
    hapticClass: 'LIGHT',
    artFallback: 'TRANSFORM_IMPULSE',
    reducedMotionPrimitive: 'outline_pulse',
    reducedFlashPrimitive: 'polygonal_refraction',
    anchorSequence: seq([
      ['ANTICIPATION', 'polygonal_refraction', 0, 70],
      ['RELEASE', 'polygonal_refraction', 50, 140, 'sfx.heart.release'],
      ['CONTACT', 'impact_spark', 150, 80],
      ['AFTERMATH', 'resource_pulse', 210, 90, 'sfx.heart.resource'],
    ]),
    ultimateSequence: seq([
      ['ANTICIPATION', 'polygonal_refraction', 0, 100],
      ['RELEASE', 'polygonal_refraction', 80, 160, 'sfx.heart.release'],
      ['CONTACT', 'impact_spark', 200, 90],
      ['AFTERMATH', 'resource_pulse', 280, 110, 'sfx.heart.resource'],
    ]),
  }),
};

export function getWeaponCombatPresentationProfile(
  weaponFamilyId: WeaponFamilyId,
): WeaponCombatPresentationProfile {
  return WEAPON_COMBAT_PRESENTATION_BY_FAMILY[weaponFamilyId];
}

export function listWeaponCombatPresentationProfiles(): WeaponCombatPresentationProfile[] {
  return ALL_WEAPON_FAMILY_IDS.map((id) => WEAPON_COMBAT_PRESENTATION_BY_FAMILY[id]);
}
