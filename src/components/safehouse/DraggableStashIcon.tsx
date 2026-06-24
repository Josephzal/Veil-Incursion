import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { CargoItemId } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import { pulseCargoItemPickup } from '../../utils/hubButtonHaptics';

interface DraggableStashIconProps {
  itemId: CargoItemId;
  borderColor: string;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}

export default function DraggableStashIcon({
  itemId,
  borderColor,
  onDragStart,
  onDragMove,
  onDragEnd,
}: DraggableStashIconProps): React.JSX.Element {
  const dragGesture = Gesture.Pan()
    .minDistance(6)
    .onBegin((event) => {
      runOnJS(pulseCargoItemPickup)();
      runOnJS(onDragStart)(itemId);
      runOnJS(onDragMove)(itemId, event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      runOnJS(onDragMove)(itemId, event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(onDragEnd)(itemId, event.absoluteX, event.absoluteY);
    });

  return (
    <GestureDetector gesture={dragGesture}>
      <View style={[styles.dragHandle, { borderColor }]}>
        <Image
          source={resolveCargoItemIcon(itemId)}
          resizeMode="contain"
          style={styles.dragIcon}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  dragHandle: {
    width: 44,
    borderLeftWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#0a0b0f',
  },
  dragIcon: {
    width: 28,
    height: 28,
  },
});
