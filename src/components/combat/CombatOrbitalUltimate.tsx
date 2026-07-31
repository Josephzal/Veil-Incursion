import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import UltimateReadyPing from './UltimateReadyPing';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';
import { subscribeWardenStrikePresentation } from '../../data/wardenStrikePresentation';
import { WARDEN_ARENA_PLANE } from '../../data/wardenArenaPlanes';

const ORBIT_RADIUS = 24;
const DOT_SIZE = 7;
const ORB_HITBOX = 44;

/** Center-screen ultimate orb with mastery charge dots on its perimeter. */
export default function CombatOrbitalUltimate(): React.JSX.Element {
  const { ui, handlersRef } = useCombatEnemyChrome();
  const [wardenActive, setWardenActive] = useState(false);

  useEffect(() => subscribeWardenStrikePresentation((event) => {
    setWardenActive(event.phase !== 'done' && event.phase !== 'idle' && !event.result.replayOnly);
  }), []);

  const showDots = ui.masteryProgressVisible && ui.masteryProgressRequired > 0;
  const showPing = ui.ultimatePingVisible && ui.ultimatePingVariant != null;
  const accent = ui.masteryProgressAccent;

  const dotAngles = useMemo(() => {
    const count = ui.masteryProgressRequired;
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, index) => -90 + (360 / count) * index);
  }, [ui.masteryProgressRequired]);

  // During Warden approach the Brand orb/label must sit below the moving player
  // (parent stacking — not a child zIndex fight with isolated parents).
  const hostZ = wardenActive
    ? WARDEN_ARENA_PLANE.brandAndEnemyArt
    : WARDEN_ARENA_PLANE.brandIdle;

  if (!showDots && !showPing) {
    return <View style={[styles.host, { zIndex: hostZ, elevation: hostZ }]} pointerEvents="none" />;
  }

  return (
    <View
      style={[styles.host, { zIndex: hostZ, elevation: hostZ }]}
      pointerEvents="box-none"
      testID="combat-orbital-ultimate"
    >
      {showDots ? dotAngles.map((angleDeg, index) => {
        const rad = (angleDeg * Math.PI) / 180;
        const x = Math.cos(rad) * ORBIT_RADIUS;
        const y = Math.sin(rad) * ORBIT_RADIUS;
        const filled = index < ui.masteryProgressCurrent;
        return (
          <View
            key={`orbital-dot-${index}`}
            style={[
              styles.dot,
              {
                borderColor: accent,
                backgroundColor: filled ? accent : 'rgba(15, 23, 42, 0.75)',
                shadowColor: filled ? accent : 'transparent',
                transform: [{ translateX: x - DOT_SIZE / 2 }, { translateY: y - DOT_SIZE / 2 }],
              },
            ]}
            pointerEvents="none"
          />
        );
      }) : null}

      {showPing ? (
        <View style={styles.pingWrap}>
          <UltimateReadyPing
            ready={ui.ultimatePingReady}
            disabled={ui.ultimatePingDisabled}
            interactionOpen={ui.ultimatePingInteractionOpen}
            variant={ui.ultimatePingVariant!}
            accessibilityLabel={ui.ultimatePingAccessibilityLabel}
            displayName={ui.ultimatePingDisplayName}
            disabledReason={
              ui.ultimatePingDisabled
                ? (ui.ultimatePingInteractionOpen
                  ? 'Ultimate interaction already open'
                  : 'Ultimate unavailable this turn')
                : null
            }
            onPress={() => handlersRef.current.onUltimatePing()}
          />
        </View>
      ) : (
        <View style={styles.idleOrb} pointerEvents="none" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: ORB_HITBOX,
    height: ORB_HITBOX,
    marginLeft: -ORB_HITBOX / 2,
    marginTop: -ORB_HITBOX / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleOrb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  dot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1,
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 3,
  },
});
