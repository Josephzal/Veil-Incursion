import React from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { BLACK_MARKET_CARGO_LISTINGS } from '../../../data/blackMarket';
import { hubContrabandPrice, listFenceableStashEntries } from '../../../data/hubSafehouseEngine';
import { isAppraisableSealedResource, listSealedStashEntries } from '../../../data/sealedCargoEngine';
import { getResourceDisplayName, getResourceShortName } from '../../../data/resourceRegistry';
import { getAppraisalBandLabel } from '../../../data/sealedCasketAppraisalEngine';
import { CARGO_ITEM_CATALOG, type CargoItemId } from '../../../types/cargoGrid';
import type { ResourceItemId } from '../../../types/resourceItem';
import type { PlayerAccount } from '../../../types/game';
import { resolveCargoItemIcon } from '../../../utils/cargoItemIcon';
import { useHubLayout } from '../../../context/HubLayoutContext';
import { formatVendorExchangeCondition } from './vendorPresentation';

const TERMINAL_BRIGHT = '#8ee0c6';
const TERMINAL = '#69c8ad';

export type VendorSubchannel = 'BUY' | 'SELL';

export type VendorSelection =
  | { kind: 'BUY'; listingId: CargoItemId }
  | { kind: 'SELL_RESOURCE'; resourceId: ResourceItemId }
  | { kind: 'SELL_SEALED'; stackId: string }
  | null;

interface VendorWorkspaceProps {
  account: PlayerAccount;
  marketDiscount: number;
  subchannel: VendorSubchannel;
  onChangeSubchannel: (channel: VendorSubchannel) => void;
  selection: VendorSelection;
  onSelect: (selection: VendorSelection) => void;
  compact?: boolean;
  narrow?: boolean;
}

export default function VendorWorkspace({
  account,
  marketDiscount,
  subchannel,
  onChangeSubchannel,
  selection,
  onSelect,
  compact = false,
  narrow = false,
}: VendorWorkspaceProps): React.JSX.Element {
  const { scaleSpacing } = useHubLayout();

  const fenceEntries = listFenceableStashEntries(account.resourceStash)
    .filter((entry) => !isAppraisableSealedResource(entry.resourceId));
  const sealedEntries = listSealedStashEntries(account.resourceStash, account.sealedCargoStacks ?? []);
  const saleableCount = fenceEntries.length + sealedEntries.length;

  return (
    <View style={styles.catalog}>
      <View
        style={styles.channels}
        accessibilityRole="tablist"
        {...(Platform.OS === 'web' ? ({ 'aria-label': 'Vendor transaction type' } as object) : {})}
      >
        {([
          { key: 'BUY' as const, label: 'BUY', count: `${BLACK_MARKET_CARGO_LISTINGS.length} OFFERS` },
          { key: 'SELL' as const, label: 'SELL', count: `${saleableCount} HOLDINGS` },
        ]).map((channel) => {
          const selected = subchannel === channel.key;
          return (
            <HapticPressable
              key={channel.key}
              onPress={() => onChangeSubchannel(channel.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              {...(Platform.OS === 'web' ? ({ 'aria-selected': selected } as object) : {})}
              style={({ pressed }) => ([
                styles.channel,
                selected && styles.channelSelected,
                pressed && { opacity: 0.9 },
              ])}
            >
              <TerminalText
                size={7.5}
                letterSpacing={0.9}
                style={{ color: selected ? TERMINAL_BRIGHT : '#879b95', fontWeight: '700' }}
              >
                {channel.label}
              </TerminalText>
              <TerminalText size={6.5} letterSpacing={0.7} style={{ color: '#7f928c', fontWeight: '700' }}>
                {channel.count}
              </TerminalText>
              {selected ? <View style={styles.channelUnderline} /> : null}
            </HapticPressable>
          );
        })}
        <View style={styles.channelSpacer} />
      </View>

      <View style={styles.feed}>
        <View style={styles.catalogHeader}>
          <TerminalText size={7} letterSpacing={1} style={styles.catalogHeaderText}>
            {subchannel === 'BUY' ? 'AVAILABLE CONTRABAND' : 'RECOVERED HOLDINGS'}
          </TerminalText>
          <TerminalText size={7} letterSpacing={1} style={styles.catalogHeaderText}>
            {subchannel === 'BUY'
              ? `${BLACK_MARKET_CARGO_LISTINGS.length} OFFERS`
              : `${saleableCount} SALEABLE`}
          </TerminalText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: scaleSpacing(12) }}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web'
            ? ({
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(105, 200, 173, 0.22) transparent',
              } as object)
            : null)}
        >
          {subchannel === 'BUY' ? (
            BLACK_MARKET_CARGO_LISTINGS.length === 0 ? (
              <TerminalText size={8} style={styles.emptyCopy}>
                The vendor has no purchasable inventory during the current market cycle.
              </TerminalText>
            ) : (
              BLACK_MARKET_CARGO_LISTINGS.map((listing) => {
                const price = hubContrabandPrice(listing.price, marketDiscount);
                const selected = selection?.kind === 'BUY' && selection.listingId === listing.id;
                const affordable = account.cabalCredits >= price;
                const catalog = CARGO_ITEM_CATALOG[listing.id];
                const footprint = catalog ? `${catalog.width}×${catalog.height}` : '1×1';
                const image = resolveCargoItemIcon(listing.id);
                return (
                  <View key={listing.id} style={[styles.signal, selected && styles.signalSelected]}>
                    {selected ? <View style={styles.signalAccent} /> : null}
                    <HapticPressable
                      onPress={() => onSelect({ kind: 'BUY', listingId: listing.id })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Inspect ${listing.name}`}
                      style={({ pressed }) => ([
                        styles.signalSelect,
                        styles.signalSelectBuy,
                        narrow && styles.signalSelectNarrow,
                        compact && styles.signalSelectCompact,
                        pressed && { opacity: 0.92 },
                      ])}
                    >
                      {image ? (
                        <Image source={image} style={[styles.image, narrow && styles.imageNarrow]} resizeMode="contain" />
                      ) : (
                        <View style={[styles.image, narrow && styles.imageNarrow]} />
                      )}
                      <View style={styles.signalMain}>
                        <TerminalText size={10} letterSpacing={0.3} style={styles.signalName} numberOfLines={1}>
                          {listing.name.toUpperCase()}
                        </TerminalText>
                        <TerminalText size={8} style={styles.signalEffect} numberOfLines={2}>
                          {listing.effect.replace(/^EFFECT:\s*/i, '')}
                        </TerminalText>
                        <TerminalText size={7} letterSpacing={0.5} style={styles.signalMeta} numberOfLines={1}>
                          {`CONTRABAND · ${footprint}`}
                        </TerminalText>
                      </View>
                      <View style={styles.signalValue}>
                        <TerminalText size={10} style={styles.price}>
                          {`${price} CR`}
                        </TerminalText>
                        <TerminalText size={6.5} letterSpacing={0.8} style={styles.availability}>
                          {affordable ? 'AVAILABLE' : 'INSUFFICIENT FUNDS'}
                        </TerminalText>
                      </View>
                    </HapticPressable>
                  </View>
                );
              })
            )
          ) : (
            <>
              {fenceEntries.length === 0 && sealedEntries.length === 0 ? (
                <TerminalText size={8} style={styles.emptyCopy}>
                  No recovered items currently qualify for this exchange.
                </TerminalText>
              ) : null}
              {fenceEntries.map((entry) => {
                const selected = selection?.kind === 'SELL_RESOURCE'
                  && selection.resourceId === entry.resourceId;
                const exchange = formatVendorExchangeCondition(entry.resourceId);
                const image = resolveCargoItemIcon(entry.resourceId);
                return (
                  <View key={entry.resourceId} style={[styles.signal, selected && styles.signalSelected]}>
                    {selected ? <View style={styles.signalAccent} /> : null}
                    <HapticPressable
                      onPress={() => onSelect({ kind: 'SELL_RESOURCE', resourceId: entry.resourceId })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Inspect ${getResourceDisplayName(entry.resourceId)}`}
                      style={({ pressed }) => ([
                        styles.signalSelect,
                        styles.signalSelectSell,
                        narrow && styles.signalSelectNarrow,
                        compact && styles.signalSelectCompact,
                        pressed && { opacity: 0.92 },
                      ])}
                    >
                      {image ? (
                        <Image source={image} style={[styles.image, narrow && styles.imageNarrow]} resizeMode="contain" />
                      ) : (
                        <View style={[styles.image, narrow && styles.imageNarrow]} />
                      )}
                      <View style={styles.signalMain}>
                        <TerminalText size={10} letterSpacing={0.3} style={styles.signalName} numberOfLines={1}>
                          {getResourceDisplayName(entry.resourceId, true).toUpperCase()}
                        </TerminalText>
                        <TerminalText size={7.5} letterSpacing={0.5} style={styles.signalMeta}>
                          {exchange.categoryLabel}
                        </TerminalText>
                        <TerminalText size={7.5} style={styles.held}>
                          {`${entry.quantity} HELD`}
                        </TerminalText>
                      </View>
                      <View style={styles.signalValue}>
                        <TerminalText size={9.5} style={styles.price}>
                          {`${entry.sellValue} CR / UNIT`}
                        </TerminalText>
                        <TerminalText size={6.5} letterSpacing={0.7} style={styles.availability}>
                          {exchange.rateLabel}
                        </TerminalText>
                      </View>
                    </HapticPressable>
                  </View>
                );
              })}
              {sealedEntries.map((entry) => {
                const selected = selection?.kind === 'SELL_SEALED' && selection.stackId === entry.stackId;
                const image = resolveCargoItemIcon(entry.resourceId);
                const appraised = entry.state === 'APPRAISED' && entry.valueBand;
                return (
                  <View key={entry.stackId} style={[styles.signal, selected && styles.signalSelected]}>
                    {selected ? <View style={styles.signalAccent} /> : null}
                    <HapticPressable
                      onPress={() => onSelect({ kind: 'SELL_SEALED', stackId: entry.stackId })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Inspect sealed ${getResourceShortName(entry.resourceId)}`}
                      style={({ pressed }) => ([
                        styles.signalSelect,
                        styles.signalSelectSell,
                        narrow && styles.signalSelectNarrow,
                        compact && styles.signalSelectCompact,
                        pressed && { opacity: 0.92 },
                      ])}
                    >
                      {image ? (
                        <Image source={image} style={[styles.image, narrow && styles.imageNarrow]} resizeMode="contain" />
                      ) : (
                        <View style={[styles.image, narrow && styles.imageNarrow]} />
                      )}
                      <View style={styles.signalMain}>
                        <TerminalText size={10} letterSpacing={0.3} style={styles.signalName} numberOfLines={1}>
                          {getResourceShortName(entry.resourceId).toUpperCase()}
                        </TerminalText>
                        <TerminalText size={7.5} letterSpacing={0.5} style={styles.signalMeta}>
                          {appraised
                            ? `${getAppraisalBandLabel(entry.valueBand!, entry.resourceId).toUpperCase()} · APPRAISED`
                            : 'SEALED CARGO · UNAPPRAISED'}
                        </TerminalText>
                      </View>
                      <View style={styles.signalValue}>
                        <TerminalText size={9.5} style={styles.price}>
                          {`${entry.sellValue} CR`}
                        </TerminalText>
                        <TerminalText size={6.5} letterSpacing={0.8} style={styles.availability}>
                          {appraised ? 'APPRAISED' : 'SEALED'}
                        </TerminalText>
                      </View>
                    </HapticPressable>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  catalog: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  channels: {
    flexDirection: 'row',
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.14)',
    flexShrink: 0,
  },
  channel: {
    position: 'relative',
    minWidth: 160,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 18,
    borderRightWidth: 1,
    borderRightColor: 'rgba(137, 170, 163, 0.1)',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  channelSelected: {
    backgroundColor: 'rgba(105, 200, 173, 0.035)',
  },
  channelUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: TERMINAL,
  },
  channelSpacer: {
    flex: 1,
  },
  feed: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.11)',
    flexShrink: 0,
  },
  catalogHeaderText: {
    color: '#83948f',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  emptyCopy: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    color: '#91a39f',
    lineHeight: 19,
  },
  signal: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.11)',
  },
  signalSelected: {
    backgroundColor: 'rgba(105, 200, 173, 0.05)',
  },
  signalAccent: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
    zIndex: 1,
  },
  signalSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    minHeight: 106,
    paddingVertical: 12,
    paddingHorizontal: 20,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  signalSelectBuy: {},
  signalSelectSell: {},
  signalSelectNarrow: {
    gap: 14,
  },
  signalSelectCompact: {
    minHeight: 94,
    paddingVertical: 10,
  },
  image: {
    width: 64,
    height: 64,
  },
  imageNarrow: {
    width: 56,
    height: 56,
  },
  signalMain: {
    flex: 1,
    minWidth: 0,
  },
  signalName: {
    color: '#e0e7e4',
    fontWeight: '700',
  },
  signalEffect: {
    marginTop: 5,
    color: '#a1b0ac',
    lineHeight: 18,
  },
  signalMeta: {
    marginTop: 7,
    color: '#82948f',
    fontWeight: '700',
  },
  held: {
    marginTop: 6,
    color: '#a1b0ac',
    fontVariant: ['tabular-nums'],
  },
  signalValue: {
    width: 140,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  price: {
    color: TERMINAL_BRIGHT,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  availability: {
    marginTop: 5,
    color: '#7f928c',
    fontWeight: '700',
  },
});
