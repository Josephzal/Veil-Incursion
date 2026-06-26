import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import HapticPressable from '../HapticPressable';
import { COMBAT_MINIGAME_GREEN as GREEN } from '../../constants/combatMinigameTheme';

export type EnvoyWardExpansionSpeed = 'slow' | 'normal' | 'fast';

const EXPANSION_RATE: Record<EnvoyWardExpansionSpeed, number> = {
  slow: 0.012,
  fast: 0.038,
  normal: 0.022,
};

interface EnvoyWardOverlayProps {
  visible: boolean;
  expansionSpeed: EnvoyWardExpansionSpeed;
  onRelease: (overlapRatio: number) => void;
}

function EnvoyWardOverlay({
  visible,
  expansionSpeed,
  onRelease,
}: EnvoyWardOverlayProps): React.JSX.Element | null {
  const [holding, setHolding] = useState(false);
  const innerScale = useSharedValue(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const innerRatioRef = useRef(0);
  const resolvedRef = useRef(false);
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  useEffect(() => {
    if (!visible) {
      resolvedRef.current = false;
      innerRatioRef.current = 0;
      innerScale.value = 0;
      setHolding(false);
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    resolvedRef.current = false;
    innerRatioRef.current = 0;
    innerScale.value = 0;
  }, [visible, innerScale]);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
    opacity: 0.35 + innerScale.value * 0.45,
  }));

  if (!visible) return null;

  const startHold = () => {
    if (resolvedRef.current) return;
    setHolding(true);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      innerRatioRef.current = Math.min(1.25, innerRatioRef.current + EXPANSION_RATE[expansionSpeed]);
      innerScale.value = innerRatioRef.current;
    }, 16);
  };

  const endHold = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setHolding(false);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    onReleaseRef.current(innerRatioRef.current);
  };

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <HapticPressable
        style={styles.arena}
        onPressIn={startHold}
        onPressOut={endHold}
      >
        <View style={styles.outerRing} />
        <Animated.View style={[styles.innerCircle, innerStyle]} />
        <Text style={styles.hint}>
          {holding ? 'RELEASE ON RING OVERLAP' : 'HOLD TO CHARGE VOID WARD'}
        </Text>
      </HapticPressable>
    </View>
  );
}

export default memo(EnvoyWardOverlay);

const RING = 220;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 42,
    elevation: 42,
    backgroundColor: GREEN.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arena: {
    width: RING + 40,
    height: RING + 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: GREEN.ring,
    position: 'absolute',
  },
  innerCircle: {
    width: RING * 0.92,
    height: RING * 0.92,
    borderRadius: (RING * 0.92) / 2,
    backgroundColor: GREEN.fill,
    borderWidth: 1,
    borderColor: GREEN.ringSoft,
    position: 'absolute',
  },
  hint: {
    position: 'absolute',
    bottom: 0,
    fontFamily: 'monospace',
    fontSize: 8,
    color: GREEN.textBright,
    letterSpacing: 0.6,
  },
});
