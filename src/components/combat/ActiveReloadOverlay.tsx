import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import HapticPressable from '../HapticPressable';
import {
  ACTIVE_RELOAD_PASS_MS,
  buildReloadZoneConfig,
  resolveActiveReloadQuality,
} from '../../data/activeReloadEngine';
import {
  DEFAULT_HEX_AMMO_TYPE,
  HEX_AMMO_META,
  HEX_AMMO_TYPES,
  type HexAmmoType,
  type ReloadQuality,
} from '../../types/hexAmmo';

export type ActiveReloadMode = 'flow' | 'tactical';

interface ActiveReloadOverlayProps {
  visible: boolean;
  mode?: ActiveReloadMode;
  perfectWindowScale?: number;
  /** Pre-selected ammo type to highlight (defaults to current loaded ammo). */
  currentAmmoType?: HexAmmoType;
  onResolve: (quality: ReloadQuality, ammoType: HexAmmoType, cursorRatio: number) => void;
}

const CURSOR_WIDTH = 8;
const MIN_BAR_WIDTH = 120;

function ActiveReloadOverlay({
  visible,
  mode = 'tactical',
  perfectWindowScale = 1,
  currentAmmoType = DEFAULT_HEX_AMMO_TYPE,
  onResolve,
}: ActiveReloadOverlayProps): React.JSX.Element | null {
  const [barWidth, setBarWidth] = useState(0);
  const [phase, setPhase] = useState<'select' | 'sweep'>('select');
  const [selectedAmmo, setSelectedAmmo] = useState<HexAmmoType>(currentAmmoType);
  const selectedAmmoRef = useRef<HexAmmoType>(currentAmmoType);
  selectedAmmoRef.current = selectedAmmo;
  const cursorRatio = useSharedValue(0);
  const startMsRef = useRef(0);
  const resolvingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;
  const zoneConfig = useMemo(
    () => buildReloadZoneConfig(perfectWindowScale),
    [perfectWindowScale],
  );
  const zoneConfigRef = useRef(zoneConfig);
  zoneConfigRef.current = zoneConfig;

  const handleBarLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setBarWidth((prev) => (prev === width ? prev : width));
  }, []);

  // Reset to ammo selection each time the overlay opens.
  useEffect(() => {
    if (!visible) {
      resolvingRef.current = false;
      cursorRatio.value = 0;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setPhase('select');
      setSelectedAmmo(currentAmmoType);
      return;
    }
    setPhase('select');
    setSelectedAmmo(currentAmmoType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Run the timing sweep once the player commits an ammo type.
  useEffect(() => {
    if (!visible || phase !== 'sweep') return undefined;
    startMsRef.current = Date.now();
    resolvingRef.current = false;
    cursorRatio.value = 0;

    const tick = () => {
      const elapsed = Date.now() - startMsRef.current;
      const ratio = Math.min(1, elapsed / ACTIVE_RELOAD_PASS_MS);
      cursorRatio.value = ratio;
      if (ratio >= 1 && !resolvingRef.current) {
        resolvingRef.current = true;
        onResolveRef.current(resolveActiveReloadQuality(1, zoneConfigRef.current), selectedAmmoRef.current, 1);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, phase, cursorRatio]);

  const cursorStyle = useAnimatedStyle(() => {
    const track = Math.max(MIN_BAR_WIDTH, barWidth) - CURSOR_WIDTH;
    const left = Math.max(0, Math.min(track, cursorRatio.value * track));
    return { transform: [{ translateX: left }] };
  }, [barWidth]);

  if (!visible) return null;

  const commitAmmo = (ammo: HexAmmoType) => {
    setSelectedAmmo(ammo);
    selectedAmmoRef.current = ammo;
    setPhase('sweep');
  };

  const handleTap = () => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    onResolveRef.current(
      resolveActiveReloadQuality(cursorRatio.value, zoneConfig),
      selectedAmmoRef.current,
      cursorRatio.value,
    );
  };

  const isFlow = mode === 'flow';

  if (phase === 'select') {
    return (
      <View style={styles.overlay} pointerEvents="auto">
        <View style={styles.panel}>
          <Text style={styles.title}>
            {isFlow ? '[ FLOW-STATE RELOAD // SELECT AMMO ]' : '[ PHASE-SHIFT RELOAD // SELECT AMMO ]'}
          </Text>
          <Text style={styles.subtitle}>
            Shape the next magazine — choose an ammo type, then time the reload.
          </Text>
          <View style={styles.ammoList}>
            {HEX_AMMO_TYPES.map((ammo) => {
              const meta = HEX_AMMO_META[ammo];
              const isCurrent = ammo === currentAmmoType;
              return (
                <HapticPressable
                  key={ammo}
                  onPress={() => commitAmmo(ammo)}
                  style={[styles.ammoBtn, { borderColor: meta.color }]}
                >
                  <Text style={[styles.ammoName, { color: meta.color }]}>
                    {`${meta.sigil} ${meta.chip}${isCurrent ? ' // LOADED' : ''}`}
                  </Text>
                  <Text style={styles.ammoEffect}>{meta.shortEffect}</Text>
                </HapticPressable>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  const meta = HEX_AMMO_META[selectedAmmo];
  const cleanLeftPct = zoneConfig.cleanMin * 100;
  const cleanWidthPct = Math.max(0, (zoneConfig.perfectMin - zoneConfig.cleanMin) * 100);
  const goldLeftPct = zoneConfig.perfectMin * 100;
  const goldWidthPct = (zoneConfig.perfectMax - zoneConfig.perfectMin) * 100;
  const cleanEndLeftPct = zoneConfig.perfectMax * 100;
  const cleanEndWidthPct = Math.max(0, (1 - zoneConfig.perfectMax) * 100);
  const failWidthPct = zoneConfig.cleanMin * 100;
  const perfectLabel = `${Math.round(zoneConfig.perfectMin * 100)}–${Math.round(zoneConfig.perfectMax * 100)}%`;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <HapticPressable onPress={handleTap} style={styles.panel}>
        <Text style={[styles.title, { color: meta.color }]}>
          {`${meta.sigil} ${meta.chip} // ${isFlow ? 'FLOW-STATE' : 'PHASE-SHIFT'} RELOAD`}
        </Text>
        <Text style={styles.subtitle}>
          Tap the gold band for a PERFECT reload (Protocol + Overcharged).
        </Text>
        <View style={styles.barTrack} onLayout={handleBarLayout}>
          <View style={[styles.zone, styles.failZone, { left: '0%', width: `${failWidthPct}%` }]} />
          <View style={[styles.zone, styles.cleanZone, { left: `${cleanLeftPct}%`, width: `${cleanWidthPct}%` }]} />
          <View style={[styles.zone, styles.goldZone, { left: `${goldLeftPct}%`, width: `${goldWidthPct}%` }]} />
          <View style={[styles.zone, styles.cleanZone, { left: `${cleanEndLeftPct}%`, width: `${cleanEndWidthPct}%` }]} />
          {barWidth > 0 ? (
            <Animated.View style={[styles.cursor, { width: CURSOR_WIDTH }, cursorStyle]} />
          ) : null}
        </View>
        <View style={styles.legendRow}>
          <Text style={styles.legendGold}>{`GOLD ${perfectLabel} — PERFECT // +1 Protocol + Overcharged`}</Text>
          <Text style={styles.legendClean}>CLEAN — full mag, no Protocol</Text>
          <Text style={styles.legendRed}>FAILED — full mag, −10% first shot</Text>
        </View>
        <Text style={styles.tapHint}>[ TAP ANYWHERE TO STOP ]</Text>
      </HapticPressable>
    </View>
  );
}

export default memo(ActiveReloadOverlay);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.55)',
    backgroundColor: 'rgba(8, 10, 16, 0.96)',
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#fbbf24',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 11,
  },
  ammoList: {
    width: '100%',
    gap: 8,
  },
  ammoBtn: {
    width: '100%',
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  ammoName: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ammoEffect: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  barTrack: {
    width: '100%',
    minWidth: MIN_BAR_WIDTH,
    height: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    position: 'relative',
    overflow: 'hidden',
  },
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  failZone: {
    backgroundColor: 'rgba(248, 113, 113, 0.28)',
  },
  cleanZone: {
    backgroundColor: 'rgba(56, 189, 248, 0.28)',
  },
  goldZone: {
    backgroundColor: 'rgba(251, 191, 36, 0.55)',
  },
  cursor: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 0,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  legendRow: {
    gap: 2,
    alignItems: 'center',
  },
  legendGold: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#fbbf24',
  },
  legendClean: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#38bdf8',
  },
  legendRed: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#f87171',
  },
  tapHint: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 0.8,
    marginTop: 4,
  },
});
