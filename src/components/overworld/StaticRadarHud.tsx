import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { ScoutTarget } from '../../utils/overworldBlindScout';
import { TERMINAL_GREEN } from '../../utils/overworldRadarProjection';

const HUD_SIZE = 108;
const CORE = HUD_SIZE / 2;

export interface StaticRadarHudProps {
  blips: ScoutTarget[];
}

export default function StaticRadarHud({ blips }: StaticRadarHudProps): React.JSX.Element {
  const sweepAngle = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    sweepAngle.value = withRepeat(
      withTiming(360, { duration: 3600, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 520, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, sweepAngle]);

  const sweepTransform = useDerivedValue(() => [
    { translateX: CORE },
    { translateY: CORE },
    { rotate: (sweepAngle.value * Math.PI) / 180 },
    { translateX: -CORE },
    { translateY: -CORE },
  ]);

  return (
    <View style={styles.host} pointerEvents="none">
      <Canvas style={styles.canvas}>
        <Circle
          cx={CORE}
          cy={CORE}
          r={CORE - 4}
          color="rgba(9, 13, 22, 0.94)"
        />
        <Circle
          cx={CORE}
          cy={CORE}
          r={CORE - 6}
          color="rgba(0, 255, 51, 0.14)"
          style="stroke"
          strokeWidth={1.5}
        >
          <DashPathEffect intervals={[4, 8]} />
        </Circle>
        <Circle
          cx={CORE}
          cy={CORE}
          r={CORE - 18}
          color="rgba(0, 255, 51, 0.08)"
          style="stroke"
          strokeWidth={1}
        />
        <Group transform={sweepTransform}>
          <Line
            p1={vec(CORE, CORE)}
            p2={vec(CORE, 10)}
            color={TERMINAL_GREEN}
            strokeWidth={1.5}
            opacity={0.82}
          />
          <Line
            p1={vec(CORE, CORE)}
            p2={vec(CORE, 10)}
            color="rgba(0, 255, 51, 0.2)"
            strokeWidth={8}
            opacity={0.4}
          >
            <BlurMask blur={4} style="outer" />
          </Line>
        </Group>
        {blips.map((blip) => {
          const r = blip.radarRadius * (CORE - 20);
          const bx = CORE + Math.cos(blip.radarAngle) * r;
          const by = CORE + Math.sin(blip.radarAngle) * r;
          return (
            <Circle
              key={blip.id}
              cx={bx}
              cy={by}
              r={blip.phase === 'RESONANCE' ? 4 : 3}
              color={TERMINAL_GREEN}
              opacity={blip.blinking ? pulse : 0.92}
            />
          );
        })}
        <Circle cx={CORE} cy={CORE} r={3} color={TERMINAL_GREEN} opacity={0.9} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    zIndex: 16,
  },
  canvas: {
    width: HUD_SIZE,
    height: HUD_SIZE,
  },
});
