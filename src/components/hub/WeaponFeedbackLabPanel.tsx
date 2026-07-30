/**
 * Phase 3M — developer Weapon Feedback Lab.
 * Uses the real presentation registry + bus (not a mock duplicate).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from '../../data/weaponRegistry';
import { WEAPON_ANCHOR_ATTACK_BY_FAMILY } from '../../data/weaponAnchorAttackRegistry';
import { WEAPON_ULTIMATE_BY_FAMILY } from '../../data/weaponUltimateRegistry';
import {
  buildWeaponCombatFeedbackHit,
  buildWeaponCombatFeedbackPacket,
  getWeaponCombatPresentationProfile,
  patchCombatPresentationSettings,
  resetCombatPresentationSettings,
  getCombatPresentationSettings,
  formatWeaponCombatPresentationValidationReport,
} from '../../data/weaponCombatPresentation';
import type { WeaponFamilyId } from '../../types/weapon';
import {
  dispatchWeaponCombatPresentation,
  setCombatPresentationMounted,
} from '../../utils/combatPresentationBus';
import {
  clearCombatPresentationPlayedCues,
  getCombatPresentationPlayedCues,
  unlockCombatPresentationAudio,
} from '../../utils/combatPresentationAudio';
import WeaponCombatPresentationHost from '../combat/WeaponCombatPresentationHost';
import { resolvePlayerCombatIdlePortrait, resolvePlayerCombatAttackPortrait } from '../../utils/combatPlayerPortrait';
import { Image } from 'react-native';

type LabOutcome =
  | 'HIT'
  | 'MISS'
  | 'CRIT'
  | 'KA'
  | 'OW'
  | 'ARMOR_BREAK'
  | 'WARD_BREAK'
  | 'FRACTURE'
  | 'KILL'
  | 'RELOAD'
  | 'SACRIFICE';

const OUTCOMES: LabOutcome[] = [
  'HIT', 'MISS', 'CRIT', 'KA', 'OW', 'ARMOR_BREAK', 'WARD_BREAK', 'FRACTURE', 'KILL', 'RELOAD', 'SACRIFICE',
];

interface Props {
  mutedColor: string;
  keyColor: string;
}

export default function WeaponFeedbackLabPanel({ mutedColor, keyColor }: Props): React.JSX.Element {
  const [weaponId, setWeaponId] = useState<WeaponFamilyId>('aegis-runed-longsword');
  const [report, setReport] = useState('Ready.');
  const [pose, setPose] = useState<'idle' | 'attack'>('idle');
  const settings = getCombatPresentationSettings();
  const profile = useMemo(() => getWeaponCombatPresentationProfile(weaponId), [weaponId]);
  const portrait = pose === 'idle'
    ? resolvePlayerCombatIdlePortrait(getWeaponFamily(weaponId).classId, weaponId)
    : resolvePlayerCombatAttackPortrait(getWeaponFamily(weaponId).classId, weaponId);

  const force = useCallback((outcome: LabOutcome, ultimate = false) => {
    unlockCombatPresentationAudio();
    setCombatPresentationMounted(true);
    clearCombatPresentationPlayedCues();
    const anchor = WEAPON_ANCHOR_ATTACK_BY_FAMILY[weaponId];
    const ult = WEAPON_ULTIMATE_BY_FAMILY[weaponId];
    const hit = buildWeaponCombatFeedbackHit({
      targetId: 'lab-target',
      order: 0,
      damage: outcome === 'MISS' ? 0 : outcome === 'KILL' ? 99 : 12,
      outcome: outcome === 'MISS' ? 'MISS' : undefined,
      critical: outcome === 'CRIT',
      defenseMaterial: outcome === 'KA' || outcome === 'ARMOR_BREAK'
        ? 'KINETIC_ARMOR'
        : outcome === 'OW' || outcome === 'WARD_BREAK'
          ? 'OCCULT_WARD'
          : 'NONE',
      fullArmorBreak: outcome === 'ARMOR_BREAK',
      fullWardBreak: outcome === 'WARD_BREAK',
      fractureApplied: outcome === 'FRACTURE',
      killed: outcome === 'KILL',
    });
    const packet = buildWeaponCombatFeedbackPacket({
      weaponFamilyId: weaponId,
      actionKind: ultimate ? 'ULTIMATE' : outcome === 'RELOAD' ? 'RELOAD' : 'ANCHOR',
      actionId: ultimate ? ult.id : anchor.id,
      displayActionName: ultimate ? ult.displayName : anchor.displayName,
      hits: [hit],
      reloadOccurred: outcome === 'RELOAD',
      sacrificeOccurred: outcome === 'SACRIFICE',
      ammoRoundsConsumed: outcome === 'RELOAD' ? 0 : 1,
      labForced: true,
    });
    dispatchWeaponCombatPresentation(packet);
    setReport([
      `Forced ${ultimate ? ult.displayName : anchor.displayName} // ${outcome}`,
      `cues: ${getCombatPresentationPlayedCues().join(', ') || '(scheduled)'}`,
      `settings: mute=${settings.sfxMuted} shake=${settings.screenShakeEnabled} reducedMotion=${settings.reducedMotion}`,
    ].join('\n'));
  }, [settings.reducedMotion, settings.screenShakeEnabled, settings.sfxMuted, weaponId]);

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: keyColor }]}>WEAPON FEEDBACK LAB (3M)</Text>
      <Text style={[styles.meta, { color: mutedColor }]}>
        {profile.displayName} · {profile.motionFamily} · {profile.palette}
      </Text>
      <View style={styles.rowWrap}>
        {ALL_WEAPON_FAMILY_IDS.map((id) => (
          <HapticPressable
            key={id}
            onPress={() => setWeaponId(id)}
            style={[styles.chip, weaponId === id ? styles.chipOn : null]}
          >
            <Text style={styles.chipText}>{getWeaponFamily(id).shortName}</Text>
          </HapticPressable>
        ))}
      </View>
      <View style={styles.poseRow}>
        <Image source={portrait} style={styles.pose} resizeMode="contain" />
        <View>
          <HapticPressable onPress={() => setPose('idle')} style={styles.chip}>
            <Text style={styles.chipText}>IDLE POSE</Text>
          </HapticPressable>
          <HapticPressable onPress={() => setPose('attack')} style={styles.chip}>
            <Text style={styles.chipText}>ATTACK POSE</Text>
          </HapticPressable>
        </View>
      </View>
      <View style={styles.hostBox}>
        <WeaponCombatPresentationHost />
      </View>
      <View style={styles.rowWrap}>
        {OUTCOMES.map((o) => (
          <HapticPressable key={o} onPress={() => force(o, false)} style={styles.chip}>
            <Text style={styles.chipText}>{o}</Text>
          </HapticPressable>
        ))}
        <HapticPressable onPress={() => force('HIT', true)} style={styles.chip}>
          <Text style={styles.chipText}>ULTIMATE</Text>
        </HapticPressable>
      </View>
      <View style={styles.rowWrap}>
        <HapticPressable
          onPress={() => {
            patchCombatPresentationSettings({ sfxMuted: !settings.sfxMuted });
            setReport(`sfxMuted=${!settings.sfxMuted}`);
          }}
          style={styles.chip}
        >
          <Text style={styles.chipText}>TOGGLE MUTE</Text>
        </HapticPressable>
        <HapticPressable
          onPress={() => {
            patchCombatPresentationSettings({ reducedMotion: !settings.reducedMotion });
            setReport(`reducedMotion=${!settings.reducedMotion}`);
          }}
          style={styles.chip}
        >
          <Text style={styles.chipText}>TOGGLE REDUCED MOTION</Text>
        </HapticPressable>
        <HapticPressable
          onPress={() => {
            patchCombatPresentationSettings({ screenShakeEnabled: !settings.screenShakeEnabled });
            setReport(`screenShake=${!settings.screenShakeEnabled}`);
          }}
          style={styles.chip}
        >
          <Text style={styles.chipText}>TOGGLE SHAKE</Text>
        </HapticPressable>
        <HapticPressable
          onPress={() => {
            patchCombatPresentationSettings({ reducedFlash: !settings.reducedFlash });
            setReport(`reducedFlash=${!settings.reducedFlash}`);
          }}
          style={styles.chip}
        >
          <Text style={styles.chipText}>TOGGLE REDUCED FLASH</Text>
        </HapticPressable>
        <HapticPressable
          onPress={() => {
            resetCombatPresentationSettings();
            setReport(formatWeaponCombatPresentationValidationReport());
          }}
          style={styles.chip}
        >
          <Text style={styles.chipText}>VALIDATE 3M</Text>
        </HapticPressable>
      </View>
      <Text style={[styles.report, { color: mutedColor }]}>{report}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, paddingVertical: 8 },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  meta: { fontSize: 11 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(120,150,150,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
  },
  chipOn: { borderColor: 'rgba(80,220,180,0.8)' },
  chipText: { color: '#d7e0e0', fontSize: 10, fontWeight: '600' },
  poseRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  pose: { width: 72, height: 120 },
  hostBox: { height: 120, overflow: 'hidden', position: 'relative' },
  report: { fontSize: 11, fontFamily: 'monospace' },
});
