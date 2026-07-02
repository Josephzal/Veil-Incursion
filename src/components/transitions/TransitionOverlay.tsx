import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  transitionActions,
  useTransitionStore,
  type TransitionState,
} from '../../stores/transitionStore';

const BREACH_FLOOD_MS = 200;
const BREACH_TEAR_MS = 400;
const EXTRACT_IMPLODE_MS = 400;
const EXTRACT_DECOMPRESS_MS = 800;

interface TransitionOverlayProps {
  children: React.ReactNode;
}

function finishTransitionCycle(): void {
  transitionActions.setIdle();
}

export default function TransitionOverlay({ children }: TransitionOverlayProps): React.JSX.Element {
  const transitionState = useTransitionStore((state) => state.transitionState);
  const breachColor = useTransitionStore((state) => state.breachColor);
  const extractFlashColor = useTransitionStore((state) => state.extractFlashColor);

  const prevStateRef = useRef<TransitionState>('IDLE');

  const layoutScale = useSharedValue(1);
  const layoutOpacity = useSharedValue(1);
  const breachOverlayOpacity = useSharedValue(0);
  const breachTearScaleY = useSharedValue(1);
  const evacFlashOpacity = useSharedValue(0);

  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = transitionState;

    if (transitionState === 'BREACHING' && prevState !== 'BREACHING') {
      breachOverlayOpacity.value = 0;
      breachTearScaleY.value = 1;

      breachOverlayOpacity.value = withTiming(1, { duration: BREACH_FLOOD_MS }, (floodDone) => {
        if (floodDone) {
          runOnJS(transitionActions.consumeBreachNavigate)();
        }
      });

      breachTearScaleY.value = withDelay(
        BREACH_FLOOD_MS,
        withTiming(0, { duration: BREACH_TEAR_MS, easing: Easing.in(Easing.exp) }, (tearDone) => {
          if (tearDone) {
            breachOverlayOpacity.value = 0;
            breachTearScaleY.value = 1;
            runOnJS(finishTransitionCycle)();
          }
        }),
      );
    }

    if (transitionState === 'EXTRACTING' && prevState !== 'EXTRACTING') {
      layoutScale.value = 1;
      layoutOpacity.value = 1;
      evacFlashOpacity.value = 0;

      layoutScale.value = withTiming(0.8, { duration: EXTRACT_IMPLODE_MS });
      layoutOpacity.value = withTiming(0, { duration: EXTRACT_IMPLODE_MS });
      evacFlashOpacity.value = withTiming(1, { duration: EXTRACT_IMPLODE_MS }, (implodeDone) => {
        if (!implodeDone) return;
        runOnJS(transitionActions.consumeExtractNavigate)();
        evacFlashOpacity.value = withTiming(0, { duration: EXTRACT_DECOMPRESS_MS });
        layoutScale.value = withTiming(1, { duration: EXTRACT_DECOMPRESS_MS });
        layoutOpacity.value = withTiming(1, { duration: EXTRACT_DECOMPRESS_MS }, (decompressDone) => {
          if (decompressDone) {
            runOnJS(finishTransitionCycle)();
          }
        });
      });
    }
  }, [
    breachOverlayOpacity,
    breachTearScaleY,
    evacFlashOpacity,
    layoutOpacity,
    layoutScale,
    transitionState,
  ]);

  const layoutStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ scale: layoutScale.value }],
    opacity: layoutOpacity.value,
  }));

  const breachOverlayStyle = useAnimatedStyle(() => ({
    opacity: breachOverlayOpacity.value,
    transform: [{ scaleY: breachTearScaleY.value }],
  }));

  const evacOverlayStyle = useAnimatedStyle(() => ({
    opacity: evacFlashOpacity.value,
  }));

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={layoutStyle} pointerEvents="box-none">
        {children}
      </Animated.View>

      {transitionState === 'BREACHING' ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, styles.breachOverlay, { backgroundColor: breachColor }, breachOverlayStyle]}
        />
      ) : null}

      {transitionState === 'EXTRACTING' ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: extractFlashColor }, evacOverlayStyle]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
  },
  breachOverlay: {
    transformOrigin: 'top',
  },
});
