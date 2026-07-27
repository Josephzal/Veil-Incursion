import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import HubPrimaryCta from '../components/hub/HubPrimaryCta';
import TerminalOverlay from '../components/TerminalOverlay';
import BlackMarketBg from '../../assets/images/location images/black_market.png';
import { listingsForStock, resolveBlackMarketListingPrice } from '../data/blackMarket';
import {
  canUseKeepsakeNullLedgerCredit,
  isKeepsakeMarkedShelfItem,
  resolveKeepsakeMarkedShelfPrice,
} from '../data/expeditionKeepsakeEconomyEngine';
import { getBrokerMarkedDiscountPrice, hasFieldRunItem } from '../data/runItemFieldEngine';
import {
  getBlackMarketDiscountPct,
} from '../data/boundRequisitionEngine';
import { canPlaceCargoItem, listStagedBlackMarketPlacements } from '../data/cargoGridEngine';
import { isRunItemCatalogId } from '../data/runItemInventoryEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventImmersiveBackdrop from '../components/layout/RunEventImmersiveBackdrop';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import RunIncursionCargoPanel from '../components/run/RunIncursionCargoPanel';
import DraggableMarketListing from '../components/run/DraggableMarketListing';
import BlackMarketFenceBay from '../components/run/BlackMarketFenceBay';
import FieldPlate from '../components/runField/FieldPlate';
import RunActionRail, { RunActionRailSummary } from '../components/runField/RunActionRail';
import type { CargoDragSource } from '../components/CargoGridBoard';
import type { CargoItemId } from '../types/cargoGrid';
import { resolveCargoItemIcon } from '../utils/cargoItemIcon';
import {
  pointInWindowRect,
  resolveCargoGridCellFromWindow,
  INCURSION_CARGO_CELL_SIZE,
  type CargoGridWindowMetrics,
} from '../utils/cargoGridLayout';
import { resolveRunEventNodeHeaderFromNode } from '../utils/resolveRunEventNodeHeader';
import { HIDDEN_SCROLLBAR_VIEW_STYLE, HIDDEN_SCROLLVIEW_PROPS } from '../utils/hiddenScrollbarStyle';
import { RUN_FIELD } from '../theme/runFieldTokens';

const MUTED_SLATE = RUN_FIELD.textSecondary;
const PHOSPHOR_GREEN = RUN_FIELD.mint;
const MANIFEST_ACTIVE_BG = RUN_FIELD.mintSoft;

const SPLIT_MAX_WIDTH = 1200;
const DROP_PADDING = 12;

type WindowRect = { pageX: number; pageY: number; width: number; height: number };

export default function BlackMarketScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    activeIncursion,
    appendRunLog,
    purchaseBlackMarketCargo,
    purchaseBlackMarketCargoAtCell,
    returnStagedBlackMarketCargo,
    commitBlackMarketBindings,
    commitBlackMarketCreditPurchase,
    sellPlacedCargoToBlackMarket,
    revertBlackMarketStaging,
    getSelectedVectorNode,
    useBrokerFlashcard,
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const {
    isDesktop,
    activeViewportWidth,
    fontScale,
    gap,
  } = useResponsiveLayout();

  const [buyingRunItemId, setBuyingRunItemId] = useState<CargoItemId | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [binding, setBinding] = useState(false);
  const [externalHover, setExternalHover] = useState<{ itemId: CargoItemId; row: number; col: number } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ itemId: CargoItemId; x: number; y: number } | null>(null);
  const [manifestDropActive, setManifestDropActive] = useState(false);
  const [fenceDropActive, setFenceDropActive] = useState(false);
  const [hubCellSize, setHubCellSize] = useState(INCURSION_CARGO_CELL_SIZE);

  const gridMetricsRef = useRef<CargoGridWindowMetrics | null>(null);
  const cargoPanelMetricsRef = useRef<WindowRect | null>(null);
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
  const brokerMarkedId = activeIncursion.itemRuntime.brokerMarkedItemId;
  const hasBrokerFlashcard = hasFieldRunItem(activeIncursion.runItems, 'broker-flashcard');
  const priceForListing = (basePrice: number, itemId: CargoItemId) => {
    const keepsakePrice = resolveKeepsakeMarkedShelfPrice(
      basePrice,
      itemId,
      activeIncursion.keepsakeRuntime,
      blackMarketDiscountPct,
    ).price;
    return getBrokerMarkedDiscountPrice(keepsakePrice, brokerMarkedId === itemId);
  };

  const stagedPurchases = useMemo(
    () => listStagedBlackMarketPlacements(activeIncursion.cargo),
    [activeIncursion.cargo],
  );
  const hasStagedPurchases = stagedPurchases.length > 0;
  const bindTotalCost = useMemo(
    () => stagedPurchases.reduce(
      (sum, item) => sum + priceForListing(resolveBlackMarketListingPrice(item.itemId), item.itemId),
      0,
    ),
    [priceForListing, stagedPurchases],
  );
  const canCreditBind = hasStagedPurchases
    && stagedPurchases.length === 1
    && canUseKeepsakeNullLedgerCredit(activeIncursion.keepsakeRuntime)
    && !binding;
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
    creditValue: 14 * fontScale,
    dossierMeta: 8 * fontScale,
    actionGap: 10 * fontScale,
    listGap: 7 * fontScale,
  }), [fontScale]);

  const sectionLabelStyle = useMemo(
    () => [
      styles.sectionLabel,
      {
        color: MUTED_SLATE,
        fontSize: s.section,
        lineHeight: s.section * 1.4,
      },
    ],
    [s.section],
  );

  const isOverManifest = useCallback((x: number, y: number) => {
    const rect = manifestMetricsRef.current;
    return rect ? pointInWindowRect(x, y, rect, DROP_PADDING) : false;
  }, []);

  const isOverFence = useCallback((x: number, y: number) => {
    const rect = fenceMetricsRef.current;
    return rect ? pointInWindowRect(x, y, rect, DROP_PADDING) : false;
  }, []);

  const isOverCargoDeck = useCallback((x: number, y: number) => {
    const grid = gridMetricsRef.current;
    if (grid && pointInWindowRect(x, y, grid, DROP_PADDING)) return true;
    const panel = cargoPanelMetricsRef.current;
    return panel ? pointInWindowRect(x, y, panel, DROP_PADDING) : false;
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

  const tryBuyRunItemAtPoint = useCallback((
    itemId: CargoItemId,
    absoluteX: number,
    absoluteY: number,
  ) => {
    if (!isRunItemCatalogId(itemId) || buyingRunItemId) return false;
    if (!isOverCargoDeck(absoluteX, absoluteY)) return false;
    setBuyingRunItemId(itemId);
    const result = purchaseBlackMarketCargo(itemId);
    if (result) appendRunLog(result.logLine);
    setBuyingRunItemId(null);
    return Boolean(result?.success);
  }, [appendRunLog, buyingRunItemId, isOverCargoDeck, purchaseBlackMarketCargo]);

  const handleMarketDragStart = useCallback((_itemId: CargoItemId) => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOffsetRef.current = { x, y };
    });
    setExternalHover(null);
  }, []);

  const handleMarketDragMove = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    setDragGhost({ itemId, x: absoluteX, y: absoluteY });
    if (isRunItemCatalogId(itemId)) {
      setExternalHover(null);
      return;
    }
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
    if (isRunItemCatalogId(itemId)) {
      tryBuyRunItemAtPoint(itemId, absoluteX, absoluteY);
      return;
    }
    tryStageAtPoint(itemId, absoluteX, absoluteY);
  }, [tryBuyRunItemAtPoint, tryStageAtPoint]);

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
  const cargoPanelRef = useRef<View>(null);

  const handleManifestLayout = useCallback((_event: LayoutChangeEvent) => {
    manifestRef.current?.measureInWindow((pageX, pageY, width, height) => {
      manifestMetricsRef.current = { pageX, pageY, width, height };
    });
  }, []);

  const handleCargoPanelLayout = useCallback((_event: LayoutChangeEvent) => {
    cargoPanelRef.current?.measureInWindow((pageX, pageY, width, height) => {
      cargoPanelMetricsRef.current = { pageX, pageY, width, height };
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

  const handleCreditBind = () => {
    if (!canCreditBind) return;
    setBinding(true);
    const result = commitBlackMarketCreditPurchase();
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

  const remainingCredits = activeIncursion.runCredits - bindTotalCost;

  return (
    <IncursionShell>
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventImmersiveBackdrop
          backgroundImage={BlackMarketBg}
          contentPadding={16 * fontScale}
          scrimOpacity={RUN_FIELD.environmentScrimLight}
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
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap,
                    maxWidth: splitMaxWidth,
                  },
                ]}
              >
                <FieldPlate
                  density="standard"
                  tone="neutral"
                  brackets={false}
                  style={styles.marketPanel}
                  contentStyle={[styles.panelContent, { gap: s.actionGap, padding: s.panelPad }]}
                >
                  <View style={styles.panelEyebrow}>
                    <Text style={[styles.panelEyebrowText, { color: PHOSPHOR_GREEN, fontSize: s.dossierMeta }]}>
                      CACHE SIGNAL // LIVE STOCK
                    </Text>
                  </View>

                  <FieldPlate
                    density="wash"
                    tone="neutral"
                    brackets={false}
                    style={styles.creditsReadout}
                    contentStyle={styles.creditsReadoutContent}
                  >
                    <Text style={sectionLabelStyle}>
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
                          },
                        ]}
                      >
                        {`−${blackMarketDiscountPct}% CACHE TARIFF`}
                      </Text>
                    ) : null}
                  </FieldPlate>

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
                      MANIFEST // DRAG INTO CARGO TO STAGE
                    </Text>

                    <ScrollView
                      {...HIDDEN_SCROLLVIEW_PROPS}
                      style={[styles.listScroll, HIDDEN_SCROLLBAR_VIEW_STYLE]}
                      contentContainerStyle={{ gap: s.listGap, paddingBottom: 4 }}
                    >
                      {marketListings.map((listing) => {
                        const effectivePrice = priceForListing(listing.price, listing.id);
                        const brokerMarked = brokerMarkedId === listing.id;
                        return (
                          <DraggableMarketListing
                            key={listing.id}
                            listing={listing}
                            price={effectivePrice}
                            markedShelf={
                              isKeepsakeMarkedShelfItem(activeIncursion.keepsakeRuntime, listing.id)
                              || brokerMarked
                            }
                            fontScale={fontScale}
                            onDragStart={handleMarketDragStart}
                            onDragMove={handleMarketDragMove}
                            onDragEnd={handleMarketDragEnd}
                          />
                        );
                      })}
                    </ScrollView>

                    {hasBrokerFlashcard ? (
                      <HubPrimaryCta
                        label="[ BROKER FLASHCARD — REROLL STOCK ]"
                        onPress={() => {
                          useBrokerFlashcard();
                        }}
                        variant="glow"
                        accessibilityLabel="Broker flashcard reroll stock"
                        minHeight={42}
                        size={7.5}
                        style={styles.panelCta}
                      />
                    ) : null}

                    {manifestDropActive ? (
                      <Text style={[styles.dropHint, { fontSize: s.dossierMeta, color: PHOSPHOR_GREEN }]}>
                        RELEASE TO RETURN STAGED CARGO
                      </Text>
                    ) : null}
                  </View>

                  {canUseKeepsakeNullLedgerCredit(activeIncursion.keepsakeRuntime) ? (
                    <HubPrimaryCta
                      label="[ NULL LEDGER CREDIT ]"
                      onPress={canCreditBind ? handleCreditBind : undefined}
                      disabled={!canCreditBind}
                      variant="glow"
                      accessibilityLabel="Null ledger credit"
                      minHeight={42}
                      size={7.5}
                      style={styles.panelCta}
                    />
                  ) : null}

                  <View style={styles.purchaseFooter}>
                    {hasStagedPurchases ? (
                      <RunActionRailSummary
                        lines={[
                          { label: 'STAGED', value: String(stagedPurchases.length) },
                          { label: 'COST', value: `${bindTotalCost} CR` },
                          { label: 'REMAINING', value: `${remainingCredits} CR`, danger: remainingCredits < 0 },
                        ]}
                      />
                    ) : null}
                    <HubPrimaryCta
                      label={hasStagedPurchases ? `PURCHASE — ${bindTotalCost} CR` : 'PURCHASE'}
                      onPress={canBind ? handleBind : undefined}
                      disabled={!canBind}
                      variant="glow"
                      accessibilityLabel="Purchase staged cargo"
                      minHeight={48}
                      style={styles.purchaseCta}
                    />
                  </View>
                </FieldPlate>

                <FieldPlate
                  density="standard"
                  tone="neutral"
                  brackets
                  style={styles.cargoPanel}
                  contentStyle={[styles.panelContent, { gap: s.actionGap, padding: s.panelPad }]}
                >
                  <View
                    ref={cargoPanelRef}
                    onLayout={handleCargoPanelLayout}
                    style={styles.cargoDeckBlock}
                  >
                    <View style={styles.panelEyebrow}>
                      <Text style={[styles.panelEyebrowText, { color: PHOSPHOR_GREEN, fontSize: s.dossierMeta }]}>
                        HOLD // STAGED THEN PURCHASE
                      </Text>
                    </View>
                    <Text style={sectionLabelStyle}>
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
                  </View>
                  <BlackMarketFenceBay
                    fontScale={fontScale}
                    dropActive={fenceDropActive}
                    onLayoutMeasured={(rect) => {
                      fenceMetricsRef.current = rect;
                    }}
                  />
                </FieldPlate>
              </View>
            </View>

            <RunActionRail
              mode="screen"
              primaryLabel="CONTINUE INCURSION"
              onPrimary={handleLeave}
              primaryDisabled={leaving}
            />

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
  panelContent: {
    flex: 1,
    minHeight: 0,
  },
  marketPanel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  cargoPanel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  panelCta: {
    alignSelf: 'stretch',
    width: '100%',
  },
  cargoDeckBlock: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    gap: 8,
  },
  purchaseFooter: {
    flexShrink: 0,
    width: '100%',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  purchaseCta: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 300,
  },
  panelEyebrow: {
    flexShrink: 0,
  },
  panelEyebrowText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.1,
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
    backgroundColor: MANIFEST_ACTIVE_BG,
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
    flexShrink: 0,
  },
  creditsReadoutContent: {
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
