import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { BLACK_MARKET_CARGO_LISTINGS } from '../../data/blackMarket';
import {
  hubContrabandPrice,
  listFenceableStashEntries,
} from '../../data/hubSafehouseEngine';
import { RESOURCE_REGISTRY } from '../../data/resourceRegistry';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useShadowWar } from '../../context/ShadowWarContext';
import { shadowWarBuffsToRunModifiers } from '../../data/shadowWarBuffEngine';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import TerminalText from '../TerminalText';
import { useResponsiveScale } from '../../hooks/useResponsiveScale';

export default function SafehouseBlackMarketTab(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, purchaseHubContraband, sellFenceResource, appendHubLog } = usePlayerAccount();
  const { activeBuffs } = useShadowWar();
  const marketDiscount = shadowWarBuffsToRunModifiers(activeBuffs).blackMarketDiscountPct;
  const [selectedListingId, setSelectedListingId] = useState<CargoItemId | null>(null);

  const accent = theme.statusColor;
  const panelBg = theme.backgroundColor;
  const { safehouseLeftRatio, isDesktop, scaleSpacing } = useResponsiveScale();
  const buyFlex = isDesktop ? safehouseLeftRatio : 1;
  const sellFlex = isDesktop ? 1 - safehouseLeftRatio : 1;

  const selectedListing = selectedListingId != null
    ? BLACK_MARKET_CARGO_LISTINGS.find((entry) => entry.id === selectedListingId) ?? null
    : null;
  const selectedPrice = selectedListing ? hubContrabandPrice(selectedListing.price, marketDiscount) : 0;
  const canBuy = selectedListing != null && account.cabalCredits >= selectedPrice;

  const fenceEntries = listFenceableStashEntries(account.resourceStash);

  const handleBuy = () => {
    if (!selectedListingId) return;
    const result = purchaseHubContraband(selectedListingId, marketDiscount);
    appendHubLog(result.logLine);
  };

  const handleSell = (resourceId: typeof fenceEntries[number]['resourceId'], quantity: number) => {
    const result = sellFenceResource(resourceId, quantity);
    appendHubLog(result.logLine);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.splitRow, { gap: scaleSpacing(10) }]}>
        <View
          style={[
            styles.panel,
            {
              flex: buyFlex,
              borderColor: theme.borderColor,
              backgroundColor: panelBg,
              padding: scaleSpacing(10),
              gap: scaleSpacing(8),
            },
          ]}
        >
          <TerminalText size={9} letterSpacing={0.8} style={[styles.panelTitle, { color: accent }]}>
            BUY CONTRABAND
          </TerminalText>
          <TerminalText size={7} lineHeight={11} style={[styles.panelSub, { color: theme.mutedColor }]}>
            High-end field gear — purchases stage in hub consumable vault.
          </TerminalText>
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
            {BLACK_MARKET_CARGO_LISTINGS.map((listing) => {
              const price = hubContrabandPrice(listing.price, marketDiscount);
              const selected = selectedListingId === listing.id;
              const affordable = account.cabalCredits >= price;
              return (
                <HapticPressable
                  key={listing.id}
                  onPress={() => setSelectedListingId(listing.id)}
                  style={[
                    styles.listingCard,
                    {
                      borderColor: selected ? accent : theme.borderColor,
                      opacity: affordable ? 1 : 0.55,
                    },
                  ]}
                >
                  <Image source={resolveCargoItemIcon(listing.id)} style={styles.listingIcon} />
                  <View style={styles.listingBody}>
                    <Text style={[styles.listingName, { color: selected ? accent : theme.textColor }]}>
                      {listing.name.toUpperCase()}
                    </Text>
                    <Text style={[styles.listingEffect, { color: theme.mutedColor }]} numberOfLines={2}>
                      {listing.effect}
                    </Text>
                    <Text style={[styles.listingPrice, { color: accent }]}>{`${price} CR`}</Text>
                  </View>
                </HapticPressable>
              );
            })}
          </ScrollView>
          <HapticPressable
            disabled={!canBuy}
            onPress={handleBuy}
            style={[
              styles.actionBtn,
              {
                borderColor: canBuy ? accent : theme.borderColor,
                opacity: canBuy ? 1 : 0.45,
              },
            ]}
          >
            <Text style={[styles.actionBtnText, { color: canBuy ? accent : theme.mutedColor }]}>[ BUY ]</Text>
          </HapticPressable>
        </View>

        <View
          style={[
            styles.panel,
            {
              flex: sellFlex,
              borderColor: theme.borderColor,
              backgroundColor: panelBg,
              padding: scaleSpacing(10),
              gap: scaleSpacing(8),
            },
          ]}
        >
          <TerminalText size={9} letterSpacing={0.8} style={[styles.panelTitle, { color: accent }]}>
            FENCE // LIQUIDATE
          </TerminalText>
          <TerminalText size={7} lineHeight={11} style={[styles.panelSub, { color: theme.mutedColor }]}>
            Sell dog tags, ledgers, and excess ley-slag for Cabal Credits.
          </TerminalText>
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
            {fenceEntries.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.mutedColor }]}>
                NO FENCEABLE SALVAGE IN STASH.
              </Text>
            ) : (
              fenceEntries.map((entry) => (
                <View key={entry.resourceId} style={[styles.fenceRow, { borderColor: theme.borderColor }]}>
                  <View style={styles.fenceInfo}>
                    <Text style={[styles.fenceName, { color: theme.textColor }]}>
                      {RESOURCE_REGISTRY[entry.resourceId].name.toUpperCase()}
                    </Text>
                    <Text style={[styles.fenceMeta, { color: theme.mutedColor }]}>
                      {`${entry.quantity}× @ ${entry.sellValue} CR`}
                    </Text>
                  </View>
                  <View style={styles.fenceActions}>
                    <HapticPressable
                      onPress={() => handleSell(entry.resourceId, 1)}
                      style={[styles.sellBtn, { borderColor: accent }]}
                    >
                      <Text style={[styles.sellBtnText, { color: accent }]}>SELL 1</Text>
                    </HapticPressable>
                    {entry.quantity > 1 ? (
                      <HapticPressable
                        onPress={() => handleSell(entry.resourceId, entry.quantity)}
                        style={[styles.sellBtn, { borderColor: accent }]}
                      >
                        <Text style={[styles.sellBtnText, { color: accent }]}>ALL</Text>
                      </HapticPressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splitRow: { flex: 1, flexDirection: 'row' },
  panel: {
    borderWidth: 1,
  },
  panelTitle: {
    fontWeight: '700',
  },
  panelSub: {},
  listScroll: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 8 },
  listingCard: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 8,
    gap: 8,
  },
  listingIcon: { width: 40, height: 40, resizeMode: 'contain' },
  listingBody: { flex: 1, gap: 2 },
  listingName: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  listingEffect: { fontFamily: 'monospace', fontSize: 7, lineHeight: 10 },
  listingPrice: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  fenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 8,
    gap: 8,
  },
  fenceInfo: { flex: 1, gap: 2 },
  fenceName: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  fenceMeta: { fontFamily: 'monospace', fontSize: 7 },
  fenceActions: { flexDirection: 'row', gap: 4 },
  sellBtn: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  sellBtnText: { fontFamily: 'monospace', fontSize: 7, fontWeight: '700' },
  actionBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  emptyText: { fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
});
