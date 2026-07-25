import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BlackMarketCargoListing } from '../../data/blackMarket';
import { DOSSIER_ROW_BG } from '../../constants/dossierSurface';
import HubCargoIconBox from '../safehouse/HubCargoIconBox';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import type { CargoItemId } from '../../types/cargoGrid';
import { VEIL } from '../../theme/veilTerminalTokens';

const STARK_WHITE = '#F8FAFC';
const PHOSPHOR_GREEN = VEIL.mint;
const MUTED_SLATE = '#94A3B8';

interface RunItemMarketListingProps {
  listing: BlackMarketCargoListing;
  price: number;
  fontScale: number;
  borderColor: string;
  markedShelf?: boolean;
  canBuy: boolean;
  buying?: boolean;
  onBuy: (itemId: CargoItemId) => void;
}

export default function RunItemMarketListing({
  listing,
  price,
  fontScale,
  borderColor,
  markedShelf = false,
  canBuy,
  buying = false,
  onBuy,
}: RunItemMarketListingProps): React.JSX.Element {
  const iconSize = Math.round(26 * fontScale);
  const nameSize = Math.max(9, 10 * fontScale);
  const metaSize = Math.max(8, 9 * fontScale);

  return (
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
              color: PHOSPHOR_GREEN,
              fontSize: metaSize,
              lineHeight: metaSize * 1.2,
            },
          ]}
        >
          RUN ITEM // TAP TO BUY
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
              color: PHOSPHOR_GREEN,
              fontSize: metaSize,
              lineHeight: metaSize * 1.2,
            },
          ]}
        >
          {`${price} CR`}
        </Text>
      </View>
      <View style={styles.actions}>
        <HubCargoIconBox
          itemId={listing.id}
          borderColor={MUTED_SLATE}
          iconSize={iconSize}
        />
        <HubPrimaryCta
          label={buying ? '[ BUYING ]' : '[ BUY ]'}
          onPress={() => onBuy(listing.id)}
          disabled={!canBuy || buying}
          variant="glow"
          accessibilityLabel={buying ? 'Buying' : 'Buy'}
          minHeight={36}
          size={8}
          style={styles.buyBtn}
        />
      </View>
    </View>
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
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  actions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 96,
  },
  buyBtn: {
    minWidth: 88,
  },
  name: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  effect: {
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  },
  price: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
