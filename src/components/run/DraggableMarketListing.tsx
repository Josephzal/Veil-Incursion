import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { BlackMarketCargoListing } from '../../data/blackMarket';
import HubCargoIconBox from '../safehouse/HubCargoIconBox';
import FieldPlate from '../runField/FieldPlate';
import { RUN_FIELD } from '../../theme/runFieldTokens';
import { pulseCargoItemPickup } from '../../utils/hubButtonHaptics';
import type { CargoItemId } from '../../types/cargoGrid';
import { VEIL } from '../../theme/veilTerminalTokens';

interface DraggableMarketListingProps {
  listing: BlackMarketCargoListing;
  price: number;
  fontScale: number;
  markedShelf?: boolean;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}

export default function DraggableMarketListing({
  listing,
  price,
  fontScale,
  markedShelf = false,
  onDragStart,
  onDragMove,
  onDragEnd,
}: DraggableMarketListingProps): React.JSX.Element {
  const iconSize = Math.round(28 * fontScale);
  const nameSize = Math.max(10, 11 * fontScale);
  const metaSize = Math.max(8, 9 * fontScale);
  const isRunItem = Boolean(listing.isRunItem);

  const dragGesture = Gesture.Pan()
    .minDistance(6)
    .onStart((event) => {
      runOnJS(pulseCargoItemPickup)();
      runOnJS(onDragStart)(listing.id);
      runOnJS(onDragMove)(listing.id, event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      runOnJS(onDragMove)(listing.id, event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(onDragEnd)(listing.id, event.absoluteX, event.absoluteY);
    });

  return (
    <GestureDetector gesture={dragGesture}>
      <FieldPlate
        density="light"
        tone="mint"
        brackets={false}
        style={styles.row}
        contentStyle={[styles.rowContent, { minHeight: Math.max(56, 60 * fontScale) }]}
      >
        <View style={[styles.copy, { gap: 3 * fontScale, paddingVertical: 9 * fontScale }]}>
          <Text
            style={[
              styles.name,
              {
                color: RUN_FIELD.text,
                fontSize: nameSize,
                lineHeight: nameSize * 1.25,
              },
            ]}
            numberOfLines={1}
          >
            {listing.name}
          </Text>
          <Text
            style={[
              styles.effect,
              {
                color: RUN_FIELD.mint,
                fontSize: metaSize,
                lineHeight: metaSize * 1.2,
              },
            ]}
          >
            {isRunItem ? 'Run item · drag to cargo deck' : 'Contraband · drag to cargo grid'}
          </Text>
          {markedShelf ? (
            <Text
              style={[
                styles.effect,
                {
                  color: '#FBBF24',
                  fontSize: metaSize,
                  lineHeight: metaSize * 1.2,
                },
              ]}
            >
              MARKED SHELF // -40%
            </Text>
          ) : null}
          <Text
            style={[
              styles.effect,
              {
                color: RUN_FIELD.textSecondary,
                fontSize: metaSize,
                lineHeight: metaSize * 1.35,
              },
            ]}
            numberOfLines={2}
          >
            {listing.effect}
          </Text>
          <Text
            style={[
              styles.price,
              {
                color: RUN_FIELD.mint,
                fontSize: metaSize,
                lineHeight: metaSize * 1.2,
              },
            ]}
          >
            {`${price} CR`}
          </Text>
        </View>
        <View style={styles.iconRail}>
          <HubCargoIconBox
            itemId={listing.id}
            borderColor={VEIL.mint}
            iconSize={iconSize}
          />
        </View>
      </FieldPlate>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  iconRail: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: RUN_FIELD.line,
  },
  name: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  effect: {
    fontFamily: RUN_FIELD.mono,
    letterSpacing: 0.35,
    fontWeight: '600',
  },
  price: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
});
