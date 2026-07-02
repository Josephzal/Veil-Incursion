import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { BlackMarketCargoListing } from '../../data/blackMarket';
import { DOSSIER_ROW_BG } from '../../constants/dossierSurface';
import HubCargoIconBox from '../safehouse/HubCargoIconBox';
import { pulseCargoItemPickup } from '../../utils/hubButtonHaptics';
import type { CargoItemId } from '../../types/cargoGrid';

const STARK_WHITE = '#F8FAFC';
const PHOSPHOR_GREEN = '#4ADE80';
const MUTED_SLATE = '#94A3B8';

interface DraggableMarketListingProps {
  listing: BlackMarketCargoListing;
  price: number;
  fontScale: number;
  borderColor: string;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}

export default function DraggableMarketListing({
  listing,
  price,
  fontScale,
  borderColor,
  onDragStart,
  onDragMove,
  onDragEnd,
}: DraggableMarketListingProps): React.JSX.Element {
  const iconSize = Math.round(26 * fontScale);
  const nameSize = Math.max(9, 10 * fontScale);
  const metaSize = Math.max(8, 9 * fontScale);

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
      <View
        style={[
          styles.row,
          {
            borderColor,
            minHeight: Math.max(52, 56 * fontScale),
          },
        ]}
      >
        <View style={[styles.copy, { gap: 3 * fontScale, paddingVertical: 8 * fontScale }]}>
          <Text
            style={[
              styles.name,
              {
                color: STARK_WHITE,
                fontSize: nameSize,
                lineHeight: nameSize * 1.25,
              },
            ]}
            numberOfLines={1}
          >
            {listing.name.toUpperCase()}
          </Text>
          <Text
            style={[
              styles.effect,
              {
                color: MUTED_SLATE,
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
                color: PHOSPHOR_GREEN,
                fontSize: metaSize,
                lineHeight: metaSize * 1.2,
              },
            ]}
          >
            {`${price} CR`}
          </Text>
        </View>
        <HubCargoIconBox
          itemId={listing.id}
          borderColor={MUTED_SLATE}
          iconSize={iconSize}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    backgroundColor: DOSSIER_ROW_BG,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  name: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  effect: {
    fontFamily: 'monospace',
    letterSpacing: 0.35,
    fontWeight: '600',
  },
  price: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.45,
  },
});
