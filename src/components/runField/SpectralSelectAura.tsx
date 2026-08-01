/**
 * Occult spectral aura for hold-to-bind offer cards.
 * Envoy-hit inspired: dark rising smoke ribbons + pink embers from card center.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export type SpectralAuraPhase = 'idle' | 'hover' | 'holding' | 'selected' | 'burst';

interface SpectralSelectAuraProps {
  phase: SpectralAuraPhase;
  /** 0–1 hold charge — densifies smoke while binding. */
  charge?: Animated.Value;
  /** Increments to replay the outward burst when a bind completes. */
  burstToken?: number;
}

const AURA_NATIVE = false;

const SMOKE_DARK = [
  'rgba(14, 2, 20, 0.62)',
  'rgba(22, 4, 30, 0.52)',
  'rgba(36, 8, 48, 0.48)',
  'rgba(10, 1, 16, 0.58)',
  'rgba(48, 12, 64, 0.42)',
  'rgba(28, 6, 40, 0.5)',
] as const;

const EMBER_PINKS = [
  'rgba(255, 110, 180, 0.95)',
  'rgba(236, 80, 155, 0.92)',
  'rgba(210, 56, 140, 0.9)',
  'rgba(255, 140, 200, 0.88)',
  'rgba(200, 48, 128, 0.9)',
] as const;

type SmokeLayout = {
  kind: 'plume' | 'ember';
  startX: number;
  endX: number;
  startY: number;
  rise: number;
  width: number;
  height: number;
  tiltDeg: number;
  color: string;
  peakOpacity: number;
  endScaleX: number;
  endScaleY: number;
};

function buildAmbientSmoke(): SmokeLayout[] {
  const out: SmokeLayout[] = [];
  for (let i = 0; i < 10; i += 1) {
    const core = i < 4;
    const startX = (i % 2 === 0 ? -1 : 1) * (core ? 3 + (i % 3) * 2 : 6 + (i % 4) * 3);
    const drift = (i % 2 === 0 ? -1 : 1) * (core ? 10 + i * 2 : 16 + i * 2);
    const width = core ? 8 + (i % 3) * 2 : 4 + (i % 3);
    out.push({
      kind: 'plume',
      startX,
      endX: startX + drift,
      startY: (i % 3) - 1,
      rise: -(44 + i * 5),
      width,
      height: width * (core ? 3.1 : 3.8),
      tiltDeg: (i % 2 === 0 ? -1 : 1) * (8 + i * 2),
      color: SMOKE_DARK[i % SMOKE_DARK.length]!,
      peakOpacity: core ? 0.5 : 0.3,
      endScaleX: 1.55,
      endScaleY: 1.8,
    });
  }
  for (let i = 0; i < 9; i += 1) {
    const startX = (i % 2 === 0 ? -1 : 1) * (2 + i * 2);
    out.push({
      kind: 'ember',
      startX,
      endX: startX + (i % 2 === 0 ? -8 : 10),
      startY: (i % 3) - 1,
      rise: -(52 + i * 6),
      width: 1.4 + (i % 3) * 0.4,
      height: 3.2 + (i % 3) * 0.8,
      tiltDeg: (i % 2 === 0 ? -1 : 1) * (6 + i),
      color: EMBER_PINKS[i % EMBER_PINKS.length]!,
      peakOpacity: 0.78,
      endScaleX: 0.4,
      endScaleY: 0.55,
    });
  }
  return out;
}

function buildBurstSmoke(): SmokeLayout[] {
  const out: SmokeLayout[] = [];
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const startX = Math.cos(angle) * 4;
    const startY = Math.sin(angle) * 3;
    const carry = 48 + (i % 4) * 12;
    out.push({
      kind: 'plume',
      startX,
      endX: startX + Math.cos(angle) * carry * 0.7,
      startY,
      rise: -Math.abs(Math.sin(angle) * 28) - (58 + (i % 5) * 10),
      width: 9 + (i % 4) * 3,
      height: 28 + (i % 4) * 10,
      tiltDeg: (angle * 180) / Math.PI + 90,
      color: SMOKE_DARK[i % SMOKE_DARK.length]!,
      peakOpacity: 0.72,
      endScaleX: 2.1,
      endScaleY: 2.4,
    });
  }
  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * Math.PI * 2 + 0.2;
    const startX = Math.cos(angle) * 3;
    out.push({
      kind: 'ember',
      startX,
      endX: startX + Math.cos(angle) * (28 + (i % 5) * 8),
      startY: Math.sin(angle) * 2,
      rise: -(72 + (i % 6) * 12),
      width: 1.7 + (i % 3) * 0.55,
      height: 4 + (i % 3) * 1.3,
      tiltDeg: (angle * 180) / Math.PI,
      color: EMBER_PINKS[i % EMBER_PINKS.length]!,
      peakOpacity: 1,
      endScaleX: 0.35,
      endScaleY: 0.5,
    });
  }
  return out;
}

const AMBIENT = buildAmbientSmoke();
const BURST = buildBurstSmoke();

function SmokeParticle({
  layout,
  travel,
  strength,
  burstMode,
}: {
  layout: SmokeLayout;
  travel: Animated.Value;
  strength: Animated.AnimatedAddition | Animated.Value;
  burstMode?: boolean;
}): React.JSX.Element {
  const isEmber = layout.kind === 'ember';
  const endY = layout.startY + layout.rise;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: layout.width,
          height: layout.height,
          marginLeft: -layout.width / 2,
          marginTop: -layout.height / 2,
          borderRadius: Math.min(layout.width, layout.height) / 2,
          backgroundColor: layout.color,
          opacity: Animated.multiply(
            strength,
            travel.interpolate({
              inputRange: [0, 0.12, 0.5, 1],
              outputRange: [
                0,
                layout.peakOpacity,
                layout.peakOpacity * (isEmber ? 0.65 : 0.85),
                burstMode ? 0 : layout.peakOpacity * 0.12,
              ],
            }),
          ),
          transform: [
            {
              translateX: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [layout.startX, layout.endX],
              }),
            },
            {
              translateY: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [layout.startY, endY],
              }),
            },
            { rotate: `${layout.tiltDeg}deg` },
            {
              scaleX: travel.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: isEmber
                  ? [0.7, 1.05, layout.endScaleX]
                  : [0.45, 1, layout.endScaleX],
              }),
            },
            {
              scaleY: travel.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: isEmber
                  ? [0.85, 1.15, layout.endScaleY]
                  : [0.55, 1.2, layout.endScaleY],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function phaseBase(phase: SpectralAuraPhase): number {
  switch (phase) {
    case 'hover':
      return 0.38;
    case 'holding':
      // Low base so charge ramp is the visible intensify during hold.
      return 0.14;
    case 'selected':
      // Sustained emanation after bind (charge stays at 1).
      return 0.58;
    default:
      return 0;
  }
}

function phaseChargeWeight(phase: SpectralAuraPhase): number {
  switch (phase) {
    case 'holding':
      return 1.05;
    case 'selected':
      return 0.55;
    case 'hover':
      return 0.15;
    default:
      return 0;
  }
}

export default function SpectralSelectAura({
  phase,
  charge,
  burstToken = 0,
}: SpectralSelectAuraProps): React.JSX.Element | null {
  const fallbackCharge = useRef(new Animated.Value(0)).current;
  const chargeValue = charge ?? fallbackCharge;
  const ambientTravel = useRef(new Animated.Value(0)).current;
  const burstTravel = useRef(new Animated.Value(0)).current;
  const burstGate = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const strength = useMemo(
    () => Animated.add(
      phaseBase(phase),
      Animated.multiply(chargeValue, phaseChargeWeight(phase)),
    ),
    [chargeValue, phase],
  );

  useEffect(() => {
    if (!charge) {
      Animated.timing(fallbackCharge, {
        toValue: phase === 'selected' || phase === 'holding' ? 1 : phase === 'hover' ? 0.3 : 0,
        duration: 200,
        useNativeDriver: AURA_NATIVE,
      }).start();
    }
  }, [charge, fallbackCharge, phase]);

  useEffect(() => {
    loopRef.current?.stop();
    loopRef.current = null;
    if (phase === 'idle') {
      ambientTravel.setValue(0);
      return;
    }
    ambientTravel.setValue(0);
    const loop = Animated.loop(
      Animated.timing(ambientTravel, {
        toValue: 1,
        duration: phase === 'holding' ? 1000 : 1500,
        easing: Easing.linear,
        useNativeDriver: AURA_NATIVE,
      }),
    );
    loopRef.current = loop;
    loop.start();
    return () => {
      loopRef.current?.stop();
    };
  }, [ambientTravel, phase]);

  useEffect(() => {
    if (burstToken <= 0) return;
    burstTravel.stopAnimation();
    burstGate.stopAnimation();
    burstTravel.setValue(0);
    burstGate.setValue(1);
    Animated.parallel([
      Animated.timing(burstTravel, {
        toValue: 1,
        duration: 780,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: AURA_NATIVE,
      }),
      Animated.timing(burstGate, {
        toValue: 0,
        duration: 640,
        delay: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: AURA_NATIVE,
      }),
    ]).start();
  }, [burstGate, burstToken, burstTravel]);

  if (phase === 'idle' && burstToken <= 0) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      {AMBIENT.map((layout, index) => (
        <SmokeParticle
          key={`amb-${index}`}
          layout={layout}
          travel={ambientTravel}
          strength={strength}
        />
      ))}

      {burstToken > 0
        ? BURST.map((layout, index) => (
          <Animated.View
            key={`burst-${index}`}
            style={{ opacity: burstGate }}
            pointerEvents="none"
          >
            <SmokeParticle
              layout={layout}
              travel={burstTravel}
              strength={burstGate}
              burstMode
            />
          </Animated.View>
        ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
    overflow: 'visible',
  },
  particle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
});
