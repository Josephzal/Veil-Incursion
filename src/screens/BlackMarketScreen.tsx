import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import HapticPressable from '../components/HapticPressable';
import TacticalButton from '../components/TacticalButton';
import TerminalOverlay from '../components/TerminalOverlay';
import BlackMarketBg from '../../assets/images/location images/black_market.png';
import { listingsForStock } from '../data/blackMarket';
import {
  getBlackMarketDiscountPct,
  getEffectiveBlackMarketPrice,
} from '../data/boundRequisitionEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { hubCtaButtonStyle } from '../constants/hubCta';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
} from '../constants/narrativeLayout';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame from '../components/layout/RunEventScreenFrame';
import type { CargoItemId } from '../types/cargoGrid';
import { resolveCargoItemIcon } from '../utils/cargoItemIcon';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';

const MUTED_SLATE = '#94A3B8';
const STARK_WHITE = '#F8FAFC';
const PHOSPHOR_GREEN = '#4ADE80';
const RUST_COST = '#C2410C';
const SELECT_BORDER = '#475569';
const HEADER_BORDER = '#334155';
const LEAVE_ACCENT = '#64748B';
const ROW_BG = 'rgba(15, 23, 42, 0.6)';
const SELECT_FILL = 'rgba(71, 85, 105, 0.18)';

const FLAT_CTA_OVERRIDE: ViewStyle = Platform.select({
  web: { boxShadow: 'none' },
  default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
}) ?? { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };

const SPLIT_MAX_WIDTH = 1200;

export default function BlackMarketScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { activeIncursion, appendRunLog, purchaseBlackMarketCargo } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const {
    isDesktop,
    activeViewportWidth,
    fontScale,
    gap,
    scaleSize,
    scaleSpacing,
  } = useResponsiveLayout();

  const [selectedCargoId, setSelectedCargoId] = useState<CargoItemId | null>(null);
  const [leaving, setLeaving] = useState(false);

  const marketListings = listingsForStock(
    activeIncursion.blackMarketStock.length > 0
      ? activeIncursion.blackMarketStock
      : ['soul-core'],
  );
  const blackMarketDiscountPct = getBlackMarketDiscountPct(activeIncursion);
  const priceForListing = (basePrice: number) =>
    getEffectiveBlackMarketPrice(basePrice, blackMarketDiscountPct);

  const selectedCargoListing = selectedCargoId != null
    ? marketListings.find((entry) => entry.id === selectedCargoId) ?? null
    : null;
  const selectedPrice = selectedCargoListing != null
    ? priceForListing(selectedCargoListing.price)
    : 0;

  const cargoPurchaseEnabled = selectedCargoListing != null
    && activeIncursion.runCredits >= selectedPrice;

  const splitMaxWidth = useMemo(
    () => Math.min(activeViewportWidth * 0.9, SPLIT_MAX_WIDTH),
    [activeViewportWidth],
  );

  const s = useMemo(() => {
    const listBudget = 260 * fontScale;
    const computedRowHeight = listBudget / Math.max(marketListings.length, 1);
    const rowMinHeight = Math.max(36 * fontScale, Math.min(52 * fontScale, computedRowHeight));

    return {
      panelPad: 16 * fontScale,
      rowGap: 6 * fontScale,
      rowMinHeight,
      rowPadH: 12 * fontScale,
      rowIcon: Math.min(40 * fontScale, rowMinHeight * 0.65),
      creditPad: 10 * fontScale,
      headerPadBottom: 12 * fontScale,
      headerMarginBottom: 12 * fontScale,
      eyebrow: 9 * fontScale,
      title: 13 * fontScale,
      section: 8 * fontScale,
      rowName: 10 * fontScale,
      rowPrice: 10 * fontScale,
      empty: 10 * fontScale,
      dossierMeta: 8 * fontScale,
      creditLabel: 8 * fontScale,
      creditValue: 13 * fontScale,
      actionGap: 10 * fontScale,
    };
  }, [fontScale, marketListings.length]);

  const handleCargoPurchase = () => {
    if (!selectedCargoId || !cargoPurchaseEnabled) return;
    const result = purchaseBlackMarketCargo(selectedCargoId);
    if (!result) return;
    appendRunLog(result.logLine);
  };

  const handleLeave = () => {
    if (leaving) return;
    setLeaving(true);
    completeCurrentNode('Contraband cache visit concluded.');
  };

  const purchaseButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(PHOSPHOR_GREEN, scaleSize, scaleSpacing, !cargoPurchaseEnabled),
      FLAT_CTA_OVERRIDE,
      {
        opacity: cargoPurchaseEnabled ? (state.pressed ? 0.85 : 1) : 0.2,
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [cargoPurchaseEnabled, scaleSize, scaleSpacing],
  );

  const leaveButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(LEAVE_ACCENT, scaleSize, scaleSpacing, leaving),
      FLAT_CTA_OVERRIDE,
      {
        opacity: leaving ? 0.2 : state.pressed ? 0.85 : 1,
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [leaving, scaleSize, scaleSpacing],
  );

  return (
    <IncursionShell>
      <IncursionRunLayout style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          scrollable={false}
          backgroundImage={BlackMarketBg}
          backgroundScrimOpacity={0.52}
          overlay={<TerminalOverlay />}
          contentPadding={16 * fontScale}
          bodyStyle={styles.frameBody}
        >
          <View style={[styles.masterShell, { maxWidth: splitMaxWidth, gap: s.headerMarginBottom }]}>
            <View
              style={[
                styles.globalHeader,
                {
                  borderBottomColor: HEADER_BORDER,
                  paddingBottom: s.headerPadBottom,
                },
              ]}
            >
              <Text
                style={[
                  styles.headerEyebrow,
                  {
                    color: MUTED_SLATE,
                    fontSize: s.eyebrow,
                    lineHeight: s.eyebrow * 1.35,
                  },
                ]}
              >
                VEIL UNDERNET // CONTRABAND CACHE
              </Text>
              <Text
                style={[
                  styles.headerTitle,
                  {
                    color: STARK_WHITE,
                    fontSize: s.title,
                    lineHeight: s.title * 1.3,
                  },
                ]}
              >
                CONTRABAND CACHE
              </Text>
            </View>

            <View
              style={[
                styles.splitWrap,
                {
                  flexDirection: isDesktop ? 'row' : 'column',
                  gap,
                },
              ]}
            >
              <View
                style={[
                  styles.panel,
                  styles.manifestPanel,
                  { padding: s.panelPad },
                ]}
              >
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: MUTED_SLATE,
                      fontSize: s.section,
                      lineHeight: s.section * 1.4,
                      marginBottom: s.rowGap * 1.5,
                    },
                  ]}
                >
                  MANIFEST // CONTRABAND DOSSIER LIST
                </Text>

                <View style={[styles.manifestList, { gap: s.rowGap }]}>
                  {marketListings.map((listing) => {
                    const isSelected = listing.id === selectedCargoId;
                    const effectivePrice = priceForListing(listing.price);
                    const affordable = activeIncursion.runCredits >= effectivePrice;

                    return (
                      <HapticPressable
                        key={listing.id}
                        onPress={() => setSelectedCargoId(listing.id)}
                        style={(state) => [
                          styles.manifestRow,
                          {
                            minHeight: s.rowMinHeight,
                            paddingHorizontal: s.rowPadH,
                            gap: 10 * fontScale,
                            borderColor: isSelected ? SELECT_BORDER : HEADER_BORDER,
                            backgroundColor: isSelected ? SELECT_FILL : ROW_BG,
                            opacity: state.pressed ? 0.88 : 1,
                          },
                          terminalHoverStyle(readPressableHover(state), state.pressed),
                        ]}
                      >
                        <Image
                          source={resolveCargoItemIcon(listing.id)}
                          style={{ width: s.rowIcon, height: s.rowIcon }}
                          resizeMode="contain"
                        />
                        <View style={styles.rowCopy}>
                          <Text
                            style={[
                              styles.rowName,
                              {
                                color: isSelected ? STARK_WHITE : theme.primaryColor,
                                fontSize: s.rowName,
                                lineHeight: s.rowName * 1.3,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {listing.name.toUpperCase()}
                          </Text>
                          <Text
                            style={[
                              styles.rowMeta,
                              {
                                color: MUTED_SLATE,
                                fontSize: s.dossierMeta,
                                lineHeight: s.dossierMeta * 1.4,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {listing.effect}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.rowPrice,
                            {
                              color: affordable ? PHOSPHOR_GREEN : RUST_COST,
                              fontSize: s.rowPrice,
                              lineHeight: s.rowPrice * 1.3,
                            },
                          ]}
                        >
                          {`${effectivePrice} CR`}
                        </Text>
                      </HapticPressable>
                    );
                  })}
                </View>
              </View>

              <View
                style={[
                  styles.panel,
                  styles.actionPanel,
                  { padding: s.panelPad, gap: s.actionGap },
                ]}
              >
                <View
                  style={[
                    styles.creditsReadout,
                    {
                      padding: s.creditPad,
                      borderColor: HEADER_BORDER,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.creditLabel,
                      {
                        color: MUTED_SLATE,
                        fontSize: s.creditLabel,
                        lineHeight: s.creditLabel * 1.35,
                      },
                    ]}
                  >
                    RUN CREDITS
                  </Text>
                  <Text
                    style={[
                      styles.creditValue,
                      {
                        color: PHOSPHOR_GREEN,
                        fontSize: s.creditValue,
                        lineHeight: s.creditValue * 1.15,
                      },
                    ]}
                  >
                    {activeIncursion.runCredits}
                  </Text>
                  {blackMarketDiscountPct > 0 ? (
                    <Text
                      style={[
                        styles.creditNote,
                        {
                          color: MUTED_SLATE,
                          fontSize: s.dossierMeta,
                          lineHeight: s.dossierMeta * 1.35,
                          marginTop: 4 * fontScale,
                        },
                      ]}
                    >
                      {`−${blackMarketDiscountPct}% CACHE TARIFF`}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.actionMiddle}>
                  {selectedCargoListing == null ? (
                    <Text
                      style={[
                        styles.emptyStateText,
                        {
                          color: MUTED_SLATE,
                          fontSize: s.empty,
                          lineHeight: s.empty * 1.5,
                        },
                      ]}
                    >
                      SELECT A LISTING TO BIND CONTRABAND
                    </Text>
                  ) : null}
                </View>

                <View style={[styles.actionCol, { gap: s.actionGap }]}>
                  <TacticalButton
                    label="[ BIND TO CONTAINMENT ]"
                    active={cargoPurchaseEnabled}
                    onPress={handleCargoPurchase}
                    accentColor={PHOSPHOR_GREEN}
                    mutedColor={theme.mutedColor}
                    variant="cta"
                    disabled={!cargoPurchaseEnabled}
                    style={purchaseButtonStyle}
                  />
                  <TacticalButton
                    label="[ LEAVE CACHE ]"
                    active={!leaving}
                    onPress={handleLeave}
                    accentColor={LEAVE_ACCENT}
                    mutedColor={theme.mutedColor}
                    variant="cta"
                    disabled={leaving}
                    style={leaveButtonStyle}
                  />
                </View>
              </View>
            </View>
          </View>
        </RunEventScreenFrame>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  frameBody: {
    flex: 1,
    minHeight: 0,
  },
  masterShell: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    minHeight: 0,
  },
  globalHeader: {
    width: '100%',
    borderBottomWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  headerEyebrow: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    fontWeight: '600',
  },
  headerTitle: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  splitWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'stretch',
    minHeight: 0,
  },
  panel: {
    backgroundColor: NARRATIVE_UNIFIED_PANEL_BG,
    borderWidth: 1,
    borderColor: NARRATIVE_UNIFIED_PANEL_BORDER,
    minHeight: 0,
  },
  manifestPanel: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  manifestList: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  actionPanel: {
    flex: 1,
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    fontWeight: '700',
    flexShrink: 0,
  },
  manifestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  rowMeta: {
    fontFamily: 'monospace',
    letterSpacing: 0.35,
  },
  rowPrice: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  creditsReadout: {
    borderWidth: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    flexShrink: 0,
  },
  creditLabel: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  creditValue: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  creditNote: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  actionMiddle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    minHeight: 0,
  },
  emptyStateText: {
    fontFamily: 'monospace',
    letterSpacing: 0.6,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionCol: {
    flexShrink: 0,
    width: '100%',
  },
});
