import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

const BASE_SIZE = 112;
const STICK_SIZE = 44;
const STICK_TRAVEL = (BASE_SIZE - STICK_SIZE) / 2 - 4;

export interface VirtualJoystickProps {
  vectorX: SharedValue<number>;
  vectorY: SharedValue<number>;
  enabled?: boolean;
}

export default function VirtualJoystick({
  vectorX,
  vectorY,
  enabled = true,
}: VirtualJoystickProps): React.JSX.Element {
  const stickX = useSharedValue(0);
  const stickY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((event) => {
      const clampedX = Math.min(STICK_TRAVEL, Math.max(-STICK_TRAVEL, event.translationX));
      const clampedY = Math.min(STICK_TRAVEL, Math.max(-STICK_TRAVEL, event.translationY));
      stickX.value = clampedX;
      stickY.value = clampedY;
      vectorX.value = clampedX / STICK_TRAVEL;
      vectorY.value = clampedY / STICK_TRAVEL;
    })
    .onEnd(() => {
      vectorX.value = 0;
      vectorY.value = 0;
      stickX.value = withSpring(0, { damping: 16, stiffness: 220 });
      stickY.value = withSpring(0, { damping: 16, stiffness: 220 });
    })
    .onFinalize(() => {
      vectorX.value = 0;
      vectorY.value = 0;
    });

  const stickStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: stickX.value },
      { translateY: stickY.value },
    ],
  }));

  return (
    <View style={styles.host} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <View style={styles.base}>
          <Animated.View style={[styles.stick, stickStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    zIndex: 20,
  },
  base: {
    width: BASE_SIZE,
    height: BASE_SIZE,
    borderRadius: BASE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 51, 0.28)',
    backgroundColor: 'rgba(0, 255, 51, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stick: {
    width: STICK_SIZE,
    height: STICK_SIZE,
    borderRadius: STICK_SIZE / 2,
    borderWidth: 2,
    borderColor: '#00ff66',
    backgroundColor: 'rgba(0, 255, 102, 0.62)',
    shadowColor: '#00ff33',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
});
