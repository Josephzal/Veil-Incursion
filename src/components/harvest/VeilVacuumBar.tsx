import React, { useCallback } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  VACUUM_BAR_HEIGHT_RATIO,
  VACUUM_BAR_SIDE_INSET_PCT,
  VACUUM_BAR_TOP_RATIO,
} from '../../constants/canisterLayout';

interface VeilVacuumBarProps {
  active: boolean;
  disabled?: boolean;
  fillPct: SharedValue<number>;
  onPressIn: () => void;
  onPressOut: () => void;
  onGlassLayout?: (height: number) => void;
}

export default function VeilVacuumBar({
  active,
  disabled = false,
  fillPct,
  onPressIn,
  onPressOut,
  onGlassLayout,
}: VeilVacuumBarProps): React.JSX.Element {
  const glassHeight = useSharedValue(0);

  const handleGlassLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    glassHeight.value = nextHeight;
    onGlassLayout?.(nextHeight);
  }, [glassHeight, onGlassLayout]);

  const liquidFillStyle = useAnimatedStyle(() => ({
    height: fillPct.value * glassHeight.value,
  }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.glassRegion,
        active ? styles.glassRegionActive : null,
        pressed && !disabled ? styles.glassRegionPressed : null,
      ]}
      accessibilityLabel="hold-to-vacuum-veil-residue"
    >
      <View style={styles.glassClip} onLayout={handleGlassLayout}>
        <View style={styles.glassEmptyTint} />
        <Animated.View style={[styles.liquidFill, liquidFillStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glassRegion: {
    position: 'absolute',
    top: `${VACUUM_BAR_TOP_RATIO * 100}%`,
    left: `${VACUUM_BAR_SIDE_INSET_PCT}%`,
    right: `${VACUUM_BAR_SIDE_INSET_PCT}%`,
    height: `${VACUUM_BAR_HEIGHT_RATIO * 100}%`,
    zIndex: 2,
    pointerEvents: 'auto',
    borderRadius: '6%',
    overflow: 'hidden',
  },
  glassRegionActive: {
    shadowColor: '#00ffff',
    shadowOpacity: 0.85,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  glassRegionPressed: {
    opacity: 0.94,
  },
  glassClip: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: '6%',
  },
  glassEmptyTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
  },
  liquidFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#00ffff',
    opacity: 0.82,
  },
});
