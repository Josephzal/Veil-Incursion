import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { ArenaDefenseState } from '../../data/combatArenaDefenseTelegraphEngine';
import { DEFENSE_TELEGRAPH_PROFILES } from '../../data/combatArenaDefenseTelegraphEngine';

interface CombatArenaDefenseSilhouetteProps {
  defense: ArenaDefenseState;
  /** Bump on hit to flash the active material. */
  hitFlashSeq?: number;
}

/**
 * Phase 2 (+ polish) — body silhouette overlays on arena portraits.
 * KA = angular steel brackets; OW = violet glyph ring; Fractured = crack ticks.
 * Hit flash is material-specific (steel vs violet).
 */
export default function CombatArenaDefenseSilhouette({
  defense,
  hitFlashSeq = 0,
}: CombatArenaDefenseSilhouetteProps): React.JSX.Element | null {
  const { armorProfile, wardProfile, fracturedProfile, kineticArmor, occultWards } = defense;
  const hasAny = Boolean(armorProfile || wardProfile || fracturedProfile);

  const ringSpin = useSharedValue(0);
  const armorHit = useSharedValue(0);
  const wardHit = useSharedValue(0);

  useEffect(() => {
    if (!wardProfile) {
      cancelAnimation(ringSpin);
      ringSpin.value = 0;
      return;
    }
    ringSpin.value = withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(ringSpin);
  }, [wardProfile, ringSpin]);

  useEffect(() => {
    if (hitFlashSeq <= 0) return;
    if (kineticArmor > 0) {
      armorHit.value = 0;
      armorHit.value = withSequence(
        withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
      );
    }
    if (occultWards > 0) {
      wardHit.value = 0;
      wardHit.value = withSequence(
        withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 360, easing: Easing.in(Easing.quad) }),
      );
    }
  }, [hitFlashSeq, kineticArmor, occultWards, armorHit, wardHit]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringSpin.value}deg` }],
  }));

  const armorStyle = useAnimatedStyle(() => ({
    opacity: 0.42 + armorHit.value * 0.5,
  }));

  const wardStyle = useAnimatedStyle(() => ({
    opacity: (armorProfile ? 0.55 : 0.72) + wardHit.value * 0.35,
    borderColor: wardHit.value > 0.2
      ? DEFENSE_TELEGRAPH_PROFILES.OCCULT_WARD.colors.hit
      : DEFENSE_TELEGRAPH_PROFILES.OCCULT_WARD.colors.primary,
  }));

  if (!hasAny) return null;

  const ka = DEFENSE_TELEGRAPH_PROFILES.KINETIC_ARMOR.colors;
  const ow = DEFENSE_TELEGRAPH_PROFILES.OCCULT_WARD.colors;
  const frx = DEFENSE_TELEGRAPH_PROFILES.FRACTURED.colors;
  const dualDefenses = Boolean(armorProfile && wardProfile);

  return (
    <View style={styles.root} pointerEvents="none">
      {armorProfile ? (
        <Animated.View style={[styles.armorShell, armorStyle]}>
          <View style={[styles.plateCorner, styles.tl, { borderColor: ka.primary }]} />
          <View style={[styles.plateCorner, styles.tr, { borderColor: ka.primary }]} />
          <View style={[styles.plateCorner, styles.bl, { borderColor: ka.secondary }]} />
          <View style={[styles.plateCorner, styles.br, { borderColor: ka.secondary }]} />
          {!dualDefenses ? (
            <View
              style={[
                styles.plateBand,
                { borderColor: ka.secondary, backgroundColor: 'rgba(148,163,184,0.14)' },
              ]}
            />
          ) : null}
        </Animated.View>
      ) : null}

      {wardProfile ? (
        <Animated.View
          style={[
            styles.wardRing,
            dualDefenses ? styles.wardRingDual : null,
            ringStyle,
            wardStyle,
          ]}
        >
          <View style={[styles.wardRune, styles.runeN, { backgroundColor: ow.primary }]} />
          <View style={[styles.wardRune, styles.runeE, { backgroundColor: ow.hit }]} />
          <View style={[styles.wardRune, styles.runeS, { backgroundColor: ow.primary }]} />
          <View style={[styles.wardRune, styles.runeW, { backgroundColor: ow.hit }]} />
        </Animated.View>
      ) : null}

      {fracturedProfile ? (
        <View style={[styles.crackLayer, dualDefenses && styles.crackLayerSoft]}>
          <View style={[styles.crack, styles.crackA, { backgroundColor: frx.primary }]} />
          <View style={[styles.crack, styles.crackB, { backgroundColor: frx.hit }]} />
          <View style={[styles.crack, styles.crackC, { backgroundColor: frx.primary }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 6,
  },
  armorShell: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  plateCorner: {
    position: 'absolute',
    width: '20%',
    height: '16%',
    borderWidth: 2,
    borderRadius: 0,
  },
  tl: { top: '10%', left: '12%', borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: '10%', right: '12%', borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: '16%', left: '12%', borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: '16%', right: '12%', borderLeftWidth: 0, borderTopWidth: 0 },
  plateBand: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: '44%',
    height: 2,
    borderWidth: 1,
  },
  wardRing: {
    position: 'absolute',
    top: '5%',
    bottom: '9%',
    left: '7%',
    right: '7%',
    borderWidth: 1.5,
    borderRadius: 999,
    borderStyle: 'dashed',
  },
  /** Inset so KA brackets remain readable when both defenses are up. */
  wardRingDual: {
    top: '14%',
    bottom: '18%',
    left: '16%',
    right: '16%',
    borderWidth: 1.25,
  },
  wardRune: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1,
  },
  runeN: { top: -1, left: '50%', marginLeft: -1.5 },
  runeE: { right: -1, top: '50%', marginTop: -1.5 },
  runeS: { bottom: -1, left: '50%', marginLeft: -1.5 },
  runeW: { left: -1, top: '50%', marginTop: -1.5 },
  crackLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  crackLayerSoft: {
    opacity: 0.65,
  },
  crack: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
    opacity: 0.85,
  },
  crackA: {
    height: '40%',
    top: '20%',
    left: '38%',
    transform: [{ rotate: '18deg' }],
  },
  crackB: {
    height: '26%',
    top: '42%',
    left: '52%',
    transform: [{ rotate: '-24deg' }],
  },
  crackC: {
    height: '20%',
    top: '56%',
    left: '44%',
    transform: [{ rotate: '8deg' }],
  },
});
