import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

/** Board-wide catalytic hold & release — same ring resolver as Rift-Ward. */
const EXPANSION_RATE = 0.024;

interface CatalyticConsoleOverlayProps {
  visible: boolean;
  rotStacksTotal: number;
  payloadEstimate: number;
  onRelease: (overlapRatio: number) => void;
}

export default function CatalyticConsoleOverlay({
  visible,
  rotStacksTotal,
  payloadEstimate,
  onRelease,
}: CatalyticConsoleOverlayProps): React.JSX.Element | null {
  const [holding, setHolding] = useState(false);
  const innerScale = useSharedValue(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const innerRatioRef = useRef(0);
  const resolvedRef = useRef(false);

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
      innerRatioRef.current = Math.min(1.25, innerRatioRef.current + EXPANSION_RATE);
      innerScale.value = innerRatioRef.current;
    }, 16);
  };

  const endHold = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setHolding(false);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    onRelease(innerRatioRef.current);
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
        <Text style={styles.meta}>
          {`ROT // ${rotStacksTotal} STACKS — ~${payloadEstimate} OCCULT PAYLOAD`}
        </Text>
        <Text style={styles.hint}>
          {holding ? 'RELEASE ON RING OVERLAP' : 'HOLD TO CHARGE CATALYST'}
        </Text>
      </HapticPressable>
    </View>
  );
}

const CATALYST_SCALE = 0.7;
const INNER_RING = Math.round(220 * 1.15 * CATALYST_SCALE);
const OUTER_RING = Math.round(INNER_RING * 1.2);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 42,
    elevation: 42,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arena: {
    width: OUTER_RING + 40,
    height: OUTER_RING + 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: OUTER_RING,
    height: OUTER_RING,
    borderRadius: OUTER_RING / 2,
    borderWidth: 2,
    borderColor: '#4ade80',
    position: 'absolute',
  },
  innerCircle: {
    width: INNER_RING * 0.92,
    height: INNER_RING * 0.92,
    borderRadius: (INNER_RING * 0.92) / 2,
    backgroundColor: 'rgba(74, 222, 128, 0.28)',
    borderWidth: 1,
    borderColor: '#86efac',
    position: 'absolute',
  },
  meta: {
    position: 'absolute',
    top: 0,
    fontFamily: 'monospace',
    fontSize: 7,
    color: '#bbf7d0',
    letterSpacing: 0.5,
    textAlign: 'center',
    width: OUTER_RING + 40,
  },
  hint: {
    position: 'absolute',
    bottom: 0,
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#dcfce7',
    letterSpacing: 0.6,
  },
});
