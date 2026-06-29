import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import HapticPressable from '../HapticPressable';
import { pulseHubButton } from '../../utils/hubButtonHaptics';

const STATE_VIOLET = '#c4b5fd';

interface ScannerBreachButtonProps {
  label: string;
  enabled: boolean;
  accent: string;
  mutedColor: string;
  onPress: () => void;
}

/** Industrial octagonal breach control with marching pixel border. */
export default function ScannerBreachButton({
  label,
  enabled,
  accent,
  mutedColor,
  onPress,
}: ScannerBreachButtonProps): React.JSX.Element {
  const march = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(march, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [march]);

  const borderColor = enabled ? accent : mutedColor;
  const topMarch = march.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  return (
    <HapticPressable
      onPress={() => {
        if (!enabled) return;
        pulseHubButton();
        onPress();
      }}
      disabled={!enabled}
      style={({ pressed }) => [
        styles.shell,
        {
          borderColor,
          opacity: enabled ? pressed ? 0.82 : 1 : 0.42,
        },
      ]}
    >
      <View style={[styles.octClip, { borderColor }]}>
        <View style={[styles.octFill, { backgroundColor: enabled ? `${accent}12` : 'rgba(0,0,0,0.35)' }]}>
          <Animated.View
            style={[
              styles.marchTop,
              {
                backgroundColor: accent,
                transform: [{ translateX: topMarch }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.marchBottom,
              {
                backgroundColor: accent,
                transform: [{
                  translateX: march.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                }],
              },
            ]}
          />
          <View style={[styles.cornerCut, styles.cornerCutTL, { backgroundColor: '#050608' }]} />
          <View style={[styles.cornerCut, styles.cornerCutTR, { backgroundColor: '#050608' }]} />
          <View style={[styles.cornerCut, styles.cornerCutBL, { backgroundColor: '#050608' }]} />
          <View style={[styles.cornerCut, styles.cornerCutBR, { backgroundColor: '#050608' }]} />
          <Text style={[styles.label, { color: enabled ? STATE_VIOLET : mutedColor }]}>
            {label}
          </Text>
        </View>
      </View>
    </HapticPressable>
  );
}

const CHAMFER = 7;

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'stretch',
  },
  octClip: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  octFill: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  marchTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
    width: 18,
    opacity: 0.85,
  },
  marchBottom: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: 2,
    width: 18,
    opacity: 0.85,
  },
  cornerCut: {
    position: 'absolute',
    width: CHAMFER,
    height: CHAMFER,
  },
  cornerCutTL: { top: -1, left: -1 },
  cornerCutTR: { top: -1, right: -1 },
  cornerCutBL: { bottom: -1, left: -1 },
  cornerCutBR: { bottom: -1, right: -1 },
  label: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
});
