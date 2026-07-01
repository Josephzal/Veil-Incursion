import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafehouseTypography } from '../../hooks/useSafehouseTypography';
import type { CargoItemId } from '../../types/cargoGrid';
import { pulseCargoItemPickup } from '../../utils/hubButtonHaptics';
import HubCargoIconBox from './HubCargoIconBox';

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
  const { iconSize } = useSafehouseTypography();

  const dragGesture = Gesture.Pan()
    .minDistance(6)
    .onStart((event) => {
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
      <HubCargoIconBox itemId={itemId} borderColor={borderColor} iconSize={iconSize} />
    </GestureDetector>
  );
}
