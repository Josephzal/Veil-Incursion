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
import { VEIL } from '../../../theme/veilTerminalTokens';
import { OccultNeonRail } from '../veilChrome';
import {
  HUB_BROWSER_CONTENT_PADDING_H,
  HUB_CARD_BORDER,
  HUB_CARD_BORDER_HOVER,
  HUB_CARD_BORDER_SELECTED,
  HUB_CARD_SURFACE,
  HUB_CARD_SURFACE_HOVER,
  HUB_META,
  HUB_SELECT_SURFACE,
} from '../../../theme/hubPanelSurfaces';

export type { VendorSelection };

const META = HUB_META;
const MISSING = VEIL.blood;
interface VendorWorkspaceProps {
  account: PlayerAccount;
  marketDiscount: number;
  selection: VendorSelection;
  onSelect: (selection: VendorSelection) => void;
  compact?: boolean;
  narrow?: boolean;
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
            <View style={styles.feedTitleRow}>
              <TerminalText size={11} letterSpacing={1.05} style={styles.feedTitle}>
                MARKET OFFERS
              </TerminalText>
              <TerminalText size={7} letterSpacing={0.9} style={styles.feedChannelTag}>
                {' // VND - BUY'}
              </TerminalText>
            </View>
            <TerminalText size={7} letterSpacing={0.8} style={styles.feedCountMint}>
              {`${offerCount} AVAILABLE`}
            </TerminalText>
          </View>
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
                  {selected ? <OccultNeonRail style={styles.signalAccent} /> : null}
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
                    <View style={styles.signalCluster}>
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
            <View style={styles.feedTitleRow}>
              <TerminalText size={11} letterSpacing={1.05} style={styles.feedTitle}>
                RECOVERED HOLDINGS
              </TerminalText>
              <TerminalText size={7} letterSpacing={0.9} style={styles.feedChannelTag}>
                {' // VND - SELL'}
              </TerminalText>
            </View>
            <TerminalText size={7} letterSpacing={0.8} style={styles.feedCountCyan}>
              {`${saleableCount} SELLABLE`}
            </TerminalText>
          </View>
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
                NO SELLABLE HOLDINGS
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
                    style={styles.holdingRow}
                  >
                    {selected ? <OccultNeonRail style={styles.signalAccent} /> : null}
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
                        styles.holdingSelect,
                        compact && styles.holdingSelectCompact,
                        selected && styles.holdingSelectSelected,
                        ((hovered || pressed) && !selected) ? styles.holdingSelectHover : null,
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
                        <TerminalText size={9.5} style={styles.priceCyan}>
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
                    style={styles.holdingRow}
                  >
                    {selected ? <OccultNeonRail style={styles.signalAccent} /> : null}
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
                        styles.holdingSelect,
                        compact && styles.holdingSelectCompact,
                        selected && styles.holdingSelectSelected,
                        ((hovered || pressed) && !selected) ? styles.holdingSelectHover : null,
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
                        <TerminalText size={9.5} style={styles.priceCyan}>
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
    backgroundColor: '#000000',
  },
  workspaceNarrow: {},
  feedCol: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  offersCol: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(137, 170, 163, 0.14)',
    backgroundColor: '#000000',
  },
  offersColNarrow: {},
  holdingsCol: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: '#000000',
  },
  feedHeader: {
    paddingHorizontal: HUB_BROWSER_CONTENT_PADDING_H,
    paddingTop: 10,
    paddingBottom: 6,
    flexShrink: 0,
  },
  feedHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
    minHeight: 28,
  },
  feedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    flexWrap: 'nowrap',
  },
  feedTitle: {
    // Match Contract Board cabal group titles (TERRAN GRID // …).
    color: 'rgba(185, 181, 167, 0.88)',
    fontWeight: '700',
    flexShrink: 1,
  },
  feedChannelTag: {
    color: 'rgba(138, 150, 144, 0.78)',
    fontWeight: '700',
    flexShrink: 0,
  },
  feedCountMint: {
    color: 'rgba(138, 150, 144, 0.78)',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  feedCountCyan: {
    color: 'rgba(138, 150, 144, 0.78)',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
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
    marginHorizontal: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  signalSelectedOffer: {},
  holdingRow: {
    position: 'relative',
    marginHorizontal: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  signalAccent: {
    top: 14,
    bottom: 14,
  },
  signalSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 92,
    paddingVertical: 11,
    paddingLeft: 18,
    paddingRight: 14,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  signalSelectCompact: {
    minHeight: 84,
    paddingVertical: 10,
  },
  signalSelectHover: {
    backgroundColor: HUB_CARD_SURFACE_HOVER,
    borderColor: HUB_CARD_BORDER_HOVER,
  },
  signalSelectSelectedOffer: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  holdingSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 92,
    paddingVertical: 11,
    paddingLeft: 18,
    paddingRight: 14,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  holdingSelectCompact: {
    minHeight: 84,
    paddingVertical: 10,
  },
  holdingSelectHover: {
    backgroundColor: HUB_CARD_SURFACE_HOVER,
    borderColor: HUB_CARD_BORDER_HOVER,
  },
  holdingSelectSelected: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  image: {
    width: 48,
    height: 48,
    opacity: 0.92,
  },
  imageSelected: {
    opacity: 1,
  },
  imageEmpty: {
    backgroundColor: 'transparent',
  },
  signalCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flex: 1,
    minWidth: 0,
  },
  signalMain: {
    flex: 1,
    minWidth: 0,
  },
  signalName: {
    color: VEIL.text,
    fontWeight: '700',
  },
  signalNameSelected: {
    color: '#F0F2EF',
  },
  signalEffect: {
    marginTop: 3,
    color: META,
    letterSpacing: 0,
  },
  signalMeta: {
    marginTop: 3,
    color: META,
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
    color: META,
    fontVariant: ['tabular-nums'],
  },
  signalValue: {
    width: 108,
    alignItems: 'stretch',
    justifyContent: 'center',
    flexShrink: 0,
  },
  priceMint: {
    width: '100%',
    color: VEIL.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  priceCyan: {
    width: '100%',
    color: VEIL.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  valueLabel: {
    marginTop: 3,
    width: '100%',
    color: META,
    fontWeight: '700',
    textAlign: 'right',
  },
  availability: {
    marginTop: 4,
    width: '100%',
    color: META,
    fontWeight: '700',
    textAlign: 'right',
  },
});
