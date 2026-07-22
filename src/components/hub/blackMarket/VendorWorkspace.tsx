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
import { CARGO_ITEM_CATALOG } from '../../../types/cargoGrid';
import type { PlayerAccount } from '../../../types/game';
import { resolveBlackMarketArtwork } from '../../../utils/blackMarketArtwork';
import { useHubLayout } from '../../../context/HubLayoutContext';
import {
  formatVendorExchangeCondition,
  type VendorSelection,
} from './vendorPresentation';

export type { VendorSelection };

const TERMINAL_BRIGHT = '#8ee0c6';
const TERMINAL = '#69c8ad';
const META = '#7a8f99';
const MISSING = '#d88984';
const HOLDING_SIGNAL = '#8aa4b0';
const HOLDING_SIGNAL_BRIGHT = '#b7c9d1';

interface VendorWorkspaceProps {
  account: PlayerAccount;
  marketDiscount: number;
  selection: VendorSelection;
  onSelect: (selection: VendorSelection) => void;
  compact?: boolean;
  narrow?: boolean;
}

function FeedSignalRail({ tone }: { tone: 'mint' | 'cyan' }): React.JSX.Element {
  const active = tone === 'mint' ? 'rgba(105, 200, 173, 0.45)' : 'rgba(138, 164, 176, 0.45)';
  const muted = tone === 'mint' ? 'rgba(127, 166, 157, 0.18)' : 'rgba(138, 164, 176, 0.18)';
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={styles.feedRail}
    >
      <View style={[styles.feedRailSeg, { backgroundColor: muted, width: 42 }]} />
      <View style={[styles.feedRailNode, { backgroundColor: active }]} />
      <View style={[styles.feedRailSeg, { backgroundColor: muted, flex: 1, maxWidth: 90 }]} />
      <View style={[styles.feedRailSeg, { backgroundColor: active, width: 36, height: 2 }]} />
      <View style={[styles.feedRailSeg, { backgroundColor: muted, width: 28 }]} />
    </View>
  );
}

export default function VendorWorkspace({
  account,
  marketDiscount,
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
  const offerCount = BLACK_MARKET_CARGO_LISTINGS.length;

  return (
    <View style={[styles.workspace, narrow && styles.workspaceNarrow]}>
      {/* MARKET OFFERS */}
      <View style={[styles.feedCol, styles.offersCol, narrow && styles.offersColNarrow]}>
        <View style={styles.feedHeader}>
          <View style={styles.feedHeaderTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TerminalText size={6.5} letterSpacing={0.9} style={styles.feedChannel}>
                PROCUREMENT CHANNEL // VND-BUY
              </TerminalText>
              <TerminalText size={10} letterSpacing={0.35} style={styles.feedTitle}>
                MARKET OFFERS
              </TerminalText>
            </View>
            <TerminalText size={7} letterSpacing={0.8} style={styles.feedCountMint}>
              {`${offerCount} AVAILABLE`}
            </TerminalText>
          </View>
          <FeedSignalRail tone="mint" />
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
          {offerCount === 0 ? (
            <View style={styles.emptyBlock}>
              <TerminalText size={9} letterSpacing={0.6} style={styles.emptyTitle}>
                NO ACTIVE OFFERS
              </TerminalText>
              <TerminalText size={8} style={styles.emptyCopy}>
                The exchange has no procurement records available.
              </TerminalText>
            </View>
          ) : (
            BLACK_MARKET_CARGO_LISTINGS.map((listing) => {
              const price = hubContrabandPrice(listing.price, marketDiscount);
              const selected = selection?.source === 'offer'
                && selection.listingId === listing.id;
              const affordable = account.cabalCredits >= price;
              const catalog = CARGO_ITEM_CATALOG[listing.id];
              const footprint = catalog ? `${catalog.width}×${catalog.height}` : '1×1';
              const artwork = resolveBlackMarketArtwork({
                recordType: 'CARGO',
                recordId: listing.id,
              });
              return (
                <View
                  key={`offer:${listing.id}`}
                  style={[styles.signal, selected && styles.signalSelectedOffer]}
                >
                  {selected ? <View style={styles.signalAccentMint} /> : null}
                  <HapticPressable
                    onPress={() => onSelect({ source: 'offer', listingId: listing.id })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Purchase offer ${listing.name}`}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                      styles.signalSelect,
                      compact && styles.signalSelectCompact,
                      selected && styles.signalSelectSelectedOffer,
                      ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
                      pressed && { opacity: 0.92 },
                    ])}
                  >
                    {artwork ? (
                      <Image
                        source={artwork.source}
                        style={[styles.image, selected && styles.imageSelected]}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={[styles.image, styles.imageEmpty]} />
                    )}
                    <View style={styles.signalMain}>
                      <TerminalText
                        size={11}
                        letterSpacing={0.15}
                        style={[styles.signalName, selected && styles.signalNameSelected]}
                        numberOfLines={1}
                      >
                        {listing.name.toUpperCase()}
                      </TerminalText>
                      <TerminalText size={7} letterSpacing={0.45} style={styles.signalMeta} numberOfLines={1}>
                        {`CONTRABAND · ${footprint}`}
                      </TerminalText>
                      <TerminalText size={7.5} style={styles.signalEffect} numberOfLines={1}>
                        {listing.effect.replace(/^EFFECT:\s*/i, '')}
                      </TerminalText>
                      <View style={styles.signalBottom}>
                        <TerminalText size={7} style={styles.signalHeld}>
                          1 AVAILABLE
                        </TerminalText>
                      </View>
                    </View>
                    <View style={styles.signalValue}>
                      <TerminalText size={9.5} style={styles.priceMint}>
                        {`${price} CR`}
                      </TerminalText>
                      <TerminalText size={6.5} letterSpacing={0.7} style={styles.valueLabel}>
                        UNIT PRICE
                      </TerminalText>
                      <TerminalText
                        size={6.5}
                        letterSpacing={0.7}
                        style={[styles.availability, !affordable && { color: MISSING }]}
                      >
                        {affordable ? 'AVAILABLE' : 'INSUFFICIENT FUNDS'}
                      </TerminalText>
                    </View>
                  </HapticPressable>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* RECOVERED HOLDINGS */}
      <View style={[styles.feedCol, styles.holdingsCol]}>
        <View style={styles.feedHeader}>
          <View style={styles.feedHeaderTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TerminalText size={6.5} letterSpacing={0.9} style={styles.feedChannel}>
                LIQUIDATION CHANNEL // VND-SELL
              </TerminalText>
              <TerminalText size={10} letterSpacing={0.35} style={styles.feedTitle}>
                RECOVERED HOLDINGS
              </TerminalText>
            </View>
            <TerminalText size={7} letterSpacing={0.8} style={styles.feedCountCyan}>
              {`${saleableCount} SALEABLE`}
            </TerminalText>
          </View>
          <FeedSignalRail tone="cyan" />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: scaleSpacing(12) }}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web'
            ? ({
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(138, 164, 176, 0.22) transparent',
              } as object)
            : null)}
        >
          {saleableCount === 0 ? (
            <View style={styles.emptyBlock}>
              <TerminalText size={9} letterSpacing={0.6} style={styles.emptyTitle}>
                NO SALEABLE HOLDINGS
              </TerminalText>
              <TerminalText size={8} style={styles.emptyCopy}>
                Extracted items eligible for liquidation will appear here.
              </TerminalText>
            </View>
          ) : (
            <>
              {fenceEntries.map((entry) => {
                const selected = selection?.source === 'holding'
                  && selection.kind === 'RESOURCE'
                  && selection.resourceId === entry.resourceId;
                const exchange = formatVendorExchangeCondition(entry.resourceId);
                const artwork = resolveBlackMarketArtwork({
                  recordType: 'RESOURCE',
                  recordId: entry.resourceId,
                });
                return (
                  <View
                    key={`holding:resource:${entry.resourceId}`}
                    style={[styles.signal, selected && styles.signalSelectedHolding]}
                  >
                    {selected ? <View style={styles.signalAccentCyan} /> : null}
                    <HapticPressable
                      onPress={() => onSelect({
                        source: 'holding',
                        kind: 'RESOURCE',
                        resourceId: entry.resourceId,
                      })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Liquidation holding ${getResourceDisplayName(entry.resourceId)}`}
                      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                        styles.signalSelect,
                        compact && styles.signalSelectCompact,
                        selected && styles.signalSelectSelectedHolding,
                        ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
                        pressed && { opacity: 0.92 },
                      ])}
                    >
                      {artwork ? (
                        <Image
                          source={artwork.source}
                          style={[styles.image, selected && styles.imageSelected]}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.image, styles.imageEmpty]} />
                      )}
                      <View style={styles.signalMain}>
                        <TerminalText
                          size={11}
                          letterSpacing={0.15}
                          style={[styles.signalName, selected && styles.signalNameSelected]}
                          numberOfLines={1}
                        >
                          {getResourceDisplayName(entry.resourceId, true).toUpperCase()}
                        </TerminalText>
                        <TerminalText size={7} letterSpacing={0.45} style={styles.signalMeta}>
                          {exchange.categoryLabel}
                        </TerminalText>
                        <View style={styles.signalBottom}>
                          <TerminalText size={7} style={styles.signalHeld}>
                            {`HELD ${entry.quantity}`}
                          </TerminalText>
                        </View>
                      </View>
                      <View style={styles.signalValue}>
                        <TerminalText size={9} style={styles.priceCyan}>
                          {`${entry.sellValue} CR`}
                        </TerminalText>
                        <TerminalText size={6.5} letterSpacing={0.7} style={styles.valueLabel}>
                          UNIT VALUE
                        </TerminalText>
                        <TerminalText size={6.5} letterSpacing={0.65} style={styles.availability}>
                          {exchange.rateLabel.replace(/^MARKET RATE:\s*/i, '')}
                        </TerminalText>
                      </View>
                    </HapticPressable>
                  </View>
                );
              })}
              {sealedEntries.map((entry) => {
                const selected = selection?.source === 'holding'
                  && selection.kind === 'SEALED'
                  && selection.stackId === entry.stackId;
                const artwork = resolveBlackMarketArtwork({
                  recordType: 'SEALED',
                  recordId: entry.resourceId,
                });
                const appraised = entry.state === 'APPRAISED' && entry.valueBand;
                return (
                  <View
                    key={`holding:sealed:${entry.stackId}`}
                    style={[styles.signal, selected && styles.signalSelectedHolding]}
                  >
                    {selected ? <View style={styles.signalAccentCyan} /> : null}
                    <HapticPressable
                      onPress={() => onSelect({
                        source: 'holding',
                        kind: 'SEALED',
                        stackId: entry.stackId,
                      })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Liquidation sealed ${getResourceShortName(entry.resourceId)}`}
                      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                        styles.signalSelect,
                        compact && styles.signalSelectCompact,
                        selected && styles.signalSelectSelectedHolding,
                        ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
                        pressed && { opacity: 0.92 },
                      ])}
                    >
                      {artwork ? (
                        <Image
                          source={artwork.source}
                          style={[styles.image, selected && styles.imageSelected]}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.image, styles.imageEmpty]} />
                      )}
                      <View style={styles.signalMain}>
                        <TerminalText
                          size={11}
                          letterSpacing={0.15}
                          style={[styles.signalName, selected && styles.signalNameSelected]}
                          numberOfLines={1}
                        >
                          {getResourceShortName(entry.resourceId).toUpperCase()}
                        </TerminalText>
                        <TerminalText size={7} letterSpacing={0.45} style={styles.signalMeta}>
                          {appraised
                            ? `${getAppraisalBandLabel(entry.valueBand!, entry.resourceId).toUpperCase()} · APPRAISED`
                            : 'SEALED CARGO · UNAPPRAISED'}
                        </TerminalText>
                      </View>
                      <View style={styles.signalValue}>
                        <TerminalText size={9} style={styles.priceCyan}>
                          {`${entry.sellValue} CR`}
                        </TerminalText>
                        <TerminalText size={6.5} letterSpacing={0.7} style={styles.valueLabel}>
                          SALE VALUE
                        </TerminalText>
                        <TerminalText size={6.5} letterSpacing={0.7} style={styles.availability}>
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
  workspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#020606',
  },
  workspaceNarrow: {},
  feedCol: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  offersCol: {
    flexGrow: 1.05,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 340,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(137, 170, 163, 0.14)',
    backgroundColor: '#020706',
  },
  offersColNarrow: {
    minWidth: 300,
  },
  holdingsCol: {
    flexGrow: 0.86,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 280,
    backgroundColor: '#03080a',
  },
  feedHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    flexShrink: 0,
  },
  feedHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  feedChannel: {
    color: META,
    fontWeight: '700',
    marginBottom: 3,
  },
  feedTitle: {
    color: '#e8f0ed',
    fontWeight: '700',
  },
  feedCountMint: {
    color: TERMINAL,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  feedCountCyan: {
    color: HOLDING_SIGNAL,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  feedRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 10,
    overflow: 'hidden',
  },
  feedRailSeg: {
    height: StyleSheet.hairlineWidth,
  },
  feedRailNode: {
    width: 5,
    height: 5,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  emptyBlock: {
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  emptyTitle: {
    color: '#a7b6b1',
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyCopy: {
    color: '#7f928c',
    lineHeight: 18,
  },
  signal: {
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  signalSelectedOffer: {},
  signalSelectedHolding: {},
  signalAccentMint: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    backgroundColor: '#75d4b3',
    zIndex: 1,
  },
  signalAccentCyan: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    backgroundColor: HOLDING_SIGNAL,
    zIndex: 1,
  },
  signalSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 96,
    paddingVertical: 11,
    paddingHorizontal: 14,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  signalSelectCompact: {
    minHeight: 88,
    paddingVertical: 10,
  },
  signalSelectHover: {
    ...Platform.select({
      web: {
        backgroundImage: [
          'linear-gradient(#a7b0ac, #a7b0ac)',
          'linear-gradient(90deg, rgba(167, 176, 172, 0.1), rgba(167, 176, 172, 0.018) 72%)',
        ].join(', '),
        backgroundSize: '2px calc(100% - 20px), auto',
        backgroundPosition: 'left center, 0 0',
        backgroundRepeat: 'no-repeat, no-repeat',
      } as object,
      default: {
        backgroundColor: 'rgba(167, 176, 172, 0.08)',
      },
    }),
  },
  signalSelectSelectedOffer: {
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, rgba(100, 211, 175, 0.09), rgba(100, 211, 175, 0.015) 72%)',
      } as object,
      default: {
        backgroundColor: 'rgba(100, 211, 175, 0.07)',
      },
    }),
  },
  signalSelectSelectedHolding: {
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, rgba(138, 164, 176, 0.11), rgba(138, 164, 176, 0.015) 72%)',
      } as object,
      default: {
        backgroundColor: 'rgba(138, 164, 176, 0.08)',
      },
    }),
  },
  image: {
    width: 52,
    height: 52,
    opacity: 0.92,
  },
  imageSelected: {
    opacity: 1,
  },
  imageEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(137, 170, 163, 0.16)',
    backgroundColor: 'rgba(8, 14, 13, 0.6)',
  },
  signalMain: {
    flex: 1,
    minWidth: 0,
  },
  signalName: {
    color: '#f1f6f3',
    fontWeight: '700',
  },
  signalNameSelected: {
    color: '#ffffff',
  },
  signalEffect: {
    marginTop: 3,
    color: '#a7b6b1',
    letterSpacing: 0,
  },
  signalMeta: {
    marginTop: 3,
    color: '#6f8480',
    fontWeight: '600',
  },
  signalBottom: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  signalHeld: {
    color: '#91a39f',
    fontVariant: ['tabular-nums'],
  },
  signalValue: {
    width: 96,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  priceMint: {
    color: TERMINAL_BRIGHT,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  priceCyan: {
    color: HOLDING_SIGNAL_BRIGHT,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  valueLabel: {
    marginTop: 3,
    color: META,
    fontWeight: '700',
  },
  availability: {
    marginTop: 4,
    color: '#7f928c',
    fontWeight: '700',
  },
});
