import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import TacticalButton from '../components/TacticalButton';
import TerminalOverlay from '../components/TerminalOverlay';
import BlackMarketBg from '../../assets/images/location images/black_market.png';
import { listingsForStock, resolveBlackMarketListingPrice } from '../data/blackMarket';
import {
  getBlackMarketDiscountPct,
  getEffectiveBlackMarketPrice,
} from '../data/boundRequisitionEngine';
import { canPlaceCargoItem, listStagedBlackMarketPlacements } from '../data/cargoGridEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { hubCtaButtonStyle } from '../constants/hubCta';
import {
  NARRATIVE_UNIFIED_PANEL_BORDER,
} from '../constants/narrativeLayout';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventImmersiveBackdrop from '../components/layout/RunEventImmersiveBackdrop';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import RunIncursionCargoPanel from '../components/run/RunIncursionCargoPanel';
import DraggableMarketListing from '../components/run/DraggableMarketListing';
import BlackMarketFenceBay from '../components/run/BlackMarketFenceBay';
import type { CargoDragSource } from '../components/CargoGridBoard';
import type { CargoItemId } from '../types/cargoGrid';
import { resolveCargoItemIcon } from '../utils/cargoItemIcon';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';
import {
  pointInWindowRect,
  resolveCargoGridCellFromWindow,
  HUB_CARGO_INCURSION_CELL_TARGET,
  type CargoGridWindowMetrics,
} from '../utils/cargoGridLayout';
import { resolveRunEventNodeHeaderFromNode } from '../utils/resolveRunEventNodeHeader';
import { HIDDEN_SCROLLBAR_VIEW_STYLE, HIDDEN_SCROLLVIEW_PROPS } from '../utils/hiddenScrollbarStyle';

const MUTED_SLATE = '#94A3B8';
const PHOSPHOR_GREEN = '#4ADE80';
const LEAVE_ACCENT = '#CBD5E1';
const LEAVE_BORDER = '#94A3B8';
const HEADER_BORDER = '#334155';
const MANIFEST_RETURN_TINT = 'rgba(74, 222, 128, 0.08)';
const IMMERSIVE_PANEL_BG = 'rgba(15, 23, 42, 0.85)';
const IMMERSIVE_PANEL_BORDER = '#1e293b';

const FLAT_CTA_OVERRIDE: ViewStyle = Platform.select({
  web: { boxShadow: 'none' },
  default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
}) ?? { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };

const SPLIT_MAX_WIDTH = 1200;
const DROP_PADDING = 12;

type WindowRect = { pageX: number; pageY: number; width: number; height: number };

export default function BlackMarketScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    activeIncursion,
    appendRunLog,
    purchaseBlackMarketCargoAtCell,
    returnStagedBlackMarketCargo,
    commitBlackMarketBindings,
    sellPlacedCargoToBlackMarket,
    revertBlackMarketStaging,
    getSelectedVectorNode,
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const {
    isDesktop,
    activeViewportWidth,
    fontScale,
    gap,
    scaleSize,
    scaleSpacing,
  } = useResponsiveLayout();

  const [leaving, setLeaving] = useState(false);
  const [binding, setBinding] = useState(false);
  const [externalHover, setExternalHover] = useState<{ itemId: CargoItemId; row: number; col: number } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ itemId: CargoItemId; x: number; y: number } | null>(null);
  const [manifestDropActive, setManifestDropActive] = useState(false);
  const [fenceDropActive, setFenceDropActive] = useState(false);
  const [hubCellSize, setHubCellSize] = useState(HUB_CARGO_INCURSION_CELL_TARGET);

  const gridMetricsRef = useRef<CargoGridWindowMetrics | null>(null);
  const manifestMetricsRef = useRef<WindowRect | null>(null);
  const fenceMetricsRef = useRef<WindowRect | null>(null);
  const rootRef = useRef<View>(null);
  const rootOffsetRef = useRef({ x: 0, y: 0 });

  const vectorNode = getSelectedVectorNode();
  const headerCopy = resolveRunEventNodeHeaderFromNode(
    vectorNode,
    'BLACK MARKET',
    'VEIL UNDERNET // CONTRABAND CACHE',
  );

  const marketListings = listingsForStock(
    activeIncursion.blackMarketStock.length > 0
      ? activeIncursion.blackMarketStock
      : ['soul-core'],
  );
  const blackMarketDiscountPct = getBlackMarketDiscountPct(activeIncursion);
  const priceForListing = (basePrice: number) =>
    getEffectiveBlackMarketPrice(basePrice, blackMarketDiscountPct);

  const stagedPurchases = useMemo(
    () => listStagedBlackMarketPlacements(activeIncursion.cargo),
    [activeIncursion.cargo],
  );
  const hasStagedPurchases = stagedPurchases.length > 0;
  const bindTotalCost = useMemo(
    () => stagedPurchases.reduce(
      (sum, item) => sum + priceForListing(resolveBlackMarketListingPrice(item.itemId)),
      0,
    ),
    [priceForListing, stagedPurchases],
  );
  const canBind = hasStagedPurchases
    && activeIncursion.runCredits >= bindTotalCost
    && !binding;

  const splitMaxWidth = useMemo(
    () => Math.min(activeViewportWidth * 0.9, SPLIT_MAX_WIDTH),
    [activeViewportWidth],
  );

  const s = useMemo(() => ({
    panelPad: 14 * fontScale,
    section: 8 * fontScale,
    creditLabel: 8 * fontScale,
    creditValue: 13 * fontScale,
    dossierMeta: 8 * fontScale,
    actionGap: 10 * fontScale,
    listGap: 6 * fontScale,
  }), [fontScale]);

  const isOverManifest = useCallback((x: number, y: number) => {
    const rect = manifestMetricsRef.current;
    return rect ? pointInWindowRect(x, y, rect, DROP_PADDING) : false;
  }, []);

  const isOverFence = useCallback((x: number, y: number) => {
    const rect = fenceMetricsRef.current;
    return rect ? pointInWindowRect(x, y, rect, DROP_PADDING) : false;
  }, []);

  const updateDropHighlights = useCallback((
    source: CargoDragSource | null,
    x: number,
    y: number,
  ) => {
    if (!source || source.source !== 'grid') {
      setManifestDropActive(false);
      setFenceDropActive(false);
      return;
    }
    const placed = activeIncursion.cargo.grid.placed.find((item) => item.instanceId === source.instanceId);
    if (placed?.blackMarketStaged) {
      setManifestDropActive(isOverManifest(x, y));
      setFenceDropActive(false);
      return;
    }
    setManifestDropActive(false);
    setFenceDropActive(isOverFence(x, y));
  }, [activeIncursion.cargo.grid.placed, isOverFence, isOverManifest]);

  const tryStageAtPoint = useCallback((
    itemId: CargoItemId,
    absoluteX: number,
    absoluteY: number,
  ) => {
    const metrics = gridMetricsRef.current;
    if (!metrics) return false;
    const cell = resolveCargoGridCellFromWindow(absoluteX, absoluteY, metrics);
    if (!cell) return false;
    const result = purchaseBlackMarketCargoAtCell(itemId, cell.row, cell.col);
    if (!result) return false;
    appendRunLog(result.logLine);
    return result.success;
  }, [appendRunLog, purchaseBlackMarketCargoAtCell]);

  const handleMarketDragStart = useCallback((_itemId: CargoItemId) => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOffsetRef.current = { x, y };
    });
    setExternalHover(null);
  }, []);

  const handleMarketDragMove = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    setDragGhost({ itemId, x: absoluteX, y: absoluteY });
    const metrics = gridMetricsRef.current;
    if (!metrics) {
      setExternalHover(null);
      return;
    }
    const cell = resolveCargoGridCellFromWindow(absoluteX, absoluteY, metrics);
    if (cell && canPlaceCargoItem(activeIncursion.cargo, itemId, cell.row, cell.col)) {
      setExternalHover({ itemId, row: cell.row, col: cell.col });
    } else {
      setExternalHover(null);
    }
  }, [activeIncursion.cargo]);

  const handleMarketDragEnd = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    setDragGhost(null);
    setExternalHover(null);
    tryStageAtPoint(itemId, absoluteX, absoluteY);
  }, [tryStageAtPoint]);

  const handleCargoDragPosition = useCallback((payload: { source: CargoDragSource; x: number; y: number } | null) => {
    if (!payload) {
      setManifestDropActive(false);
      setFenceDropActive(false);
      return;
    }
    updateDropHighlights(payload.source, payload.x, payload.y);
  }, [updateDropHighlights]);

  const handleCargoExternalDrop = useCallback((source: CargoDragSource, absoluteX: number, absoluteY: number) => {
    setManifestDropActive(false);
    setFenceDropActive(false);
    if (source.source !== 'grid') return false;

    const placed = activeIncursion.cargo.grid.placed.find((item) => item.instanceId === source.instanceId);
    if (placed?.blackMarketStaged && isOverManifest(absoluteX, absoluteY)) {
      const result = returnStagedBlackMarketCargo(source.instanceId);
      if (!result) return false;
      appendRunLog(result.logLine);
      return result.success;
    }

    if (!placed?.blackMarketStaged && isOverFence(absoluteX, absoluteY)) {
      const result = sellPlacedCargoToBlackMarket(source.instanceId);
      if (!result) return false;
      appendRunLog(result.logLine);
      return result.success;
    }

    return false;
  }, [
    activeIncursion.cargo.grid.placed,
    appendRunLog,
    isOverFence,
    isOverManifest,
    returnStagedBlackMarketCargo,
    sellPlacedCargoToBlackMarket,
  ]);

  const manifestRef = useRef<View>(null);

  const handleManifestLayout = useCallback((_event: LayoutChangeEvent) => {
    manifestRef.current?.measureInWindow((pageX, pageY, width, height) => {
      manifestMetricsRef.current = { pageX, pageY, width, height };
    });
  }, []);

  const handleBind = () => {
    if (!canBind) return;
    setBinding(true);
    const result = commitBlackMarketBindings();
    if (result) {
      appendRunLog(result.logLine);
    }
    setBinding(false);
  };

  const handleLeave = () => {
    if (leaving) return;
    setLeaving(true);
    revertBlackMarketStaging();
    completeCurrentNode('Contraband cache visit concluded.');
  };

  const bindButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(PHOSPHOR_GREEN, scaleSize, scaleSpacing, !canBind),
      FLAT_CTA_OVERRIDE,
      {
        opacity: canBind ? (state.pressed ? 0.85 : 1) : 0.35,
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [canBind, scaleSize, scaleSpacing],
  );

  const leaveButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(LEAVE_ACCENT, scaleSize, scaleSpacing, leaving),
      FLAT_CTA_OVERRIDE,
      {
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        borderColor: LEAVE_BORDER,
        opacity: leaving ? 0.5 : state.pressed ? 0.88 : 1,
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [leaving, scaleSize, scaleSpacing],
  );

  return (
    <IncursionShell>
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventImmersiveBackdrop
          backgroundImage={BlackMarketBg}
          contentPadding={16 * fontScale}
          overlay={<TerminalOverlay />}
        >
          <View ref={rootRef} style={styles.masterShell}>
            <RunEventNodeHeader
              title={headerCopy.title}
              subtitle={headerCopy.subtitle}
              fontScale={fontScale}
              showRunChrome
            />

            <View style={styles.bodyStage}>
              <View
                style={[
                  styles.splitWrap,
                  {
                    flexDirection: isDesktop ? 'row' : 'column-reverse',
                    gap,
                    maxWidth: splitMaxWidth,
                  },
                ]}
              >
              <View
                style={[
                  styles.panel,
                  styles.marketPanel,
                  { padding: s.panelPad, gap: s.actionGap },
                ]}
              >
                <View
                  style={[
                    styles.creditsReadout,
                    { borderColor: HEADER_BORDER, padding: 10 * fontScale },
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

                <View
                  ref={manifestRef}
                  onLayout={handleManifestLayout}
                  style={[
                    styles.manifestZone,
                    manifestDropActive && styles.manifestZoneActive,
                    { gap: s.listGap, padding: manifestDropActive ? 6 * fontScale : 0 },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionLabel,
                      {
                        color: MUTED_SLATE,
                        fontSize: s.section,
                        lineHeight: s.section * 1.4,
                      },
                    ]}
                  >
                    MANIFEST // DRAG TO CARGO GRID
                  </Text>

                  <ScrollView
                    {...HIDDEN_SCROLLVIEW_PROPS}
                    style={[styles.listScroll, HIDDEN_SCROLLBAR_VIEW_STYLE]}
                    contentContainerStyle={{ gap: s.listGap, paddingBottom: 4 }}
                  >
                    {marketListings.map((listing) => {
                      const effectivePrice = priceForListing(listing.price);
                      return (
                        <DraggableMarketListing
                          key={listing.id}
                          listing={listing}
                          price={effectivePrice}
                          fontScale={fontScale}
                          borderColor={NARRATIVE_UNIFIED_PANEL_BORDER}
                          onDragStart={handleMarketDragStart}
                          onDragMove={handleMarketDragMove}
                          onDragEnd={handleMarketDragEnd}
                        />
                      );
                    })}
                  </ScrollView>

                  {manifestDropActive ? (
                    <Text style={[styles.dropHint, { fontSize: s.dossierMeta, color: PHOSPHOR_GREEN }]}>
                      RELEASE TO RETURN STAGED CARGO
                    </Text>
                  ) : null}
                </View>

                <TacticalButton
                  label={hasStagedPurchases ? `[ BIND TO CARGO ] — ${bindTotalCost} CR` : '[ BIND TO CARGO ]'}
                  active={canBind}
                  onPress={handleBind}
                  accentColor={PHOSPHOR_GREEN}
                  mutedColor={theme.mutedColor}
                  variant="cta"
                  disabled={!canBind}
                  style={bindButtonStyle}
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

              <View
                style={[
                  styles.panel,
                  styles.cargoPanel,
                  { padding: s.panelPad, gap: s.actionGap },
                ]}
              >
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: MUTED_SLATE,
                      fontSize: s.section,
                      lineHeight: s.section * 1.4,
                    },
                  ]}
                >
                  CARGO DECK
                </Text>
                <RunIncursionCargoPanel
                  accentColor={PHOSPHOR_GREEN}
                  externalHover={externalHover}
                  onCellSizeResolved={setHubCellSize}
                  onGridMetricsMeasured={(metrics) => {
                    gridMetricsRef.current = metrics;
                  }}
                  onHubExternalDrop={handleCargoExternalDrop}
                  onDragPositionChange={handleCargoDragPosition}
                />
                <BlackMarketFenceBay
                  fontScale={fontScale}
                  dropActive={fenceDropActive}
                  onLayoutMeasured={(rect) => {
                    fenceMetricsRef.current = rect;
                  }}
                />
              </View>
              </View>
            </View>

            {dragGhost ? (
              <View style={styles.dragGhostLayer} pointerEvents="none">
                <Image
                  source={resolveCargoItemIcon(dragGhost.itemId)}
                  resizeMode="contain"
                  style={[
                    styles.dragGhostIcon,
                    {
                      width: hubCellSize,
                      height: hubCellSize,
                      left: dragGhost.x - rootOffsetRef.current.x - hubCellSize / 2,
                      top: dragGhost.y - rootOffsetRef.current.y - hubCellSize / 2,
                    },
                  ]}
                />
              </View>
            ) : null}
          </View>
        </RunEventImmersiveBackdrop>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  masterShell: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'stretch',
  },
  bodyStage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
  },
  splitWrap: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'stretch',
    minHeight: 0,
  },
  panel: {
    backgroundColor: IMMERSIVE_PANEL_BG,
    borderWidth: 1,
    borderColor: IMMERSIVE_PANEL_BORDER,
    minHeight: 0,
  },
  marketPanel: {
    flex: 1,
  },
  cargoPanel: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  sectionLabel: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    fontWeight: '700',
    flexShrink: 0,
  },
  manifestZone: {
    flex: 1,
    minHeight: 0,
    borderRadius: 2,
  },
  manifestZoneActive: {
    backgroundColor: MANIFEST_RETURN_TINT,
    borderWidth: 1,
    borderColor: PHOSPHOR_GREEN,
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  dropHint: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
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
  dragGhostLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  dragGhostIcon: {
    position: 'absolute',
    opacity: 0.92,
  },
});
