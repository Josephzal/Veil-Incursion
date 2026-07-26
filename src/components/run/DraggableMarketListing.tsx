import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { BlackMarketCargoListing } from '../../data/blackMarket';
import { DOSSIER_FOREGROUND, SELECT_ACCENT_GLOW } from '../../constants/dossierSurface';
import HubCargoIconBox from '../safehouse/HubCargoIconBox';
import { pulseCargoItemPickup } from '../../utils/hubButtonHaptics';
import type { CargoItemId } from '../../types/cargoGrid';
import { VEIL } from '../../theme/veilTerminalTokens';
import { viewShadow } from '../../utils/adaptiveStyles';

const STARK_WHITE = VEIL.text;
const MUTED_SLATE = VEIL.textMuted;

interface DraggableMarketListingProps {
  listing: BlackMarketCargoListing;
  price: number;
  fontScale: number;
  borderColor?: string;
  markedShelf?: boolean;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}

export default function DraggableMarketListing({
  listing,
  price,
  fontScale,
  borderColor = VEIL.lineStrong,
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
      <View
        style={[
          styles.row,
          {
            borderColor,
            minHeight: Math.max(56, 60 * fontScale),
          },
          viewShadow({
            color: VEIL.mint,
            opacity: 0.12,
            radius: 8,
            offset: { width: 0, height: 0 },
          }),
        ]}
      >
        <View style={[styles.mintTick, { backgroundColor: VEIL.mint }]} />
        <View style={[styles.copy, { gap: 3 * fontScale, paddingVertical: 9 * fontScale }]}>
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
                color: VEIL.mint,
                fontSize: metaSize,
                lineHeight: metaSize * 1.2,
              },
            ]}
          >
            {isRunItem ? 'RUN ITEM // DRAG TO CARGO DECK' : 'CONTRABAND // DRAG TO CARGO GRID'}
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
                color: VEIL.mintBright,
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
    backgroundColor: DOSSIER_FOREGROUND,
    overflow: 'hidden',
  },
  mintTick: {
    width: 2,
    alignSelf: 'stretch',
    opacity: 0.85,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: SELECT_ACCENT_GLOW,
  },
  iconRail: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: VEIL.line,
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
