import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import VeilTerminalEffects from '../atmosphere/VeilTerminalEffects';
import ForgeWorkspace, { resolveForgeSelection } from './blackMarket/ForgeWorkspace';
import VendorWorkspace, {
  type VendorSelection,
  type VendorSubchannel,
} from './blackMarket/VendorWorkspace';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useWorldState } from '../../context/WorldStateContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { BLACK_MARKET_CARGO_LISTINGS } from '../../data/blackMarket';
import { hubContrabandPrice, listFenceableStashEntries } from '../../data/hubSafehouseEngine';
import {
  getSealedCargoConfig,
  isAppraisableSealedResource,
  listSealedStashEntries,
  SEALED_CASKET_CONFIG,
} from '../../data/sealedCargoEngine';
import { getAppraisalBandLabel, resolveOpeningFee } from '../../data/sealedCasketAppraisalEngine';
import { getResourceDisplayName, getResourceShortName } from '../../data/resourceRegistry';
import { CARGO_ITEM_CATALOG } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import { formatVendorExchangeCondition } from './blackMarket/vendorPresentation';
import type { ForgeSchematicPresentation } from './blackMarket/forgePresentation';

export type BlackMarketTab = 'FORGE' | 'VENDOR';

const TERMINAL = '#69c8ad';
const TERMINAL_BRIGHT = '#8ee0c6';
const MISSING = '#d88984';
const OCCULT = '#9988b3';

const MODE_ITEMS: Array<{ key: BlackMarketTab; label: string; detail: string }> = [
  { key: 'FORGE', label: 'FORGE', detail: 'Permanent Augments' },
  { key: 'VENDOR', label: 'VENDOR', detail: 'Contraband Exchange' },
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

function DossierSection({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.dossierSection, last && styles.dossierSectionLast]}>
      <TerminalText size={7} letterSpacing={1} style={styles.dossierLabel}>
        {label}
      </TerminalText>
      {children}
    </View>
  );
}

export default function BlackMarketHubPanel(): React.JSX.Element {
  const {
    account,
    craftRecipe,
    appendHubLog,
    purchaseHubContraband,
    sellFenceResource,
    appraiseSealedCargoInHub,
    openSealedCargoInHub,
    sellSealedCargoInHub,
  } = usePlayerAccount();
  const { hubBlackMarketDiscountPct } = useWorldState();
  const { screenWidth, screenHeight } = useHubLayout();
  const reduceMotion = usePrefersReducedMotion();

  const [activeMode, setActiveMode] = useState<BlackMarketTab>('FORGE');
  const [vendorChannel, setVendorChannel] = useState<VendorSubchannel>('BUY');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [vendorSelection, setVendorSelection] = useState<VendorSelection>(null);
  const [sellQty, setSellQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const catalogSweep = useRef(new Animated.Value(0)).current;
  const dossierLock = useRef(new Animated.Value(1)).current;
  const txnPulse = useRef(new Animated.Value(0)).current;

  const narrow = screenWidth <= 1500;
  const compact = screenHeight <= 800;
  const dossierWidth = narrow
    ? 410
    : Math.min(470, Math.max(420, Math.floor(screenWidth * 0.26)));

  const forgeSelection = useMemo(
    () => resolveForgeSelection(account, selectedRecipeId),
    [account, selectedRecipeId],
  );

  const fenceEntries = listFenceableStashEntries(account.resourceStash)
    .filter((entry) => !isAppraisableSealedResource(entry.resourceId));
  const sealedEntries = listSealedStashEntries(account.resourceStash, account.sealedCargoStacks ?? []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const styleId = 'black-market-focus-styles';
    if (document.getElementById(styleId)) return undefined;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
[data-black-market] button:focus-visible,
[data-black-market] [role="button"]:focus-visible,
[data-black-market] [role="tab"]:focus-visible {
  outline: 2px solid ${TERMINAL_BRIGHT} !important;
  outline-offset: 2px !important;
}`;
    document.head.appendChild(style);
    return undefined;
  }, []);

  // Clamp sell quantity when holdings change.
  useEffect(() => {
    if (vendorSelection?.kind !== 'SELL_RESOURCE') return;
    const entry = fenceEntries.find((e) => e.resourceId === vendorSelection.resourceId);
    if (!entry) {
      setVendorSelection(null);
      setSellQty(1);
      return;
    }
    setSellQty((prev) => Math.min(Math.max(1, prev), entry.quantity));
  }, [fenceEntries, vendorSelection]);

  const playSweep = () => {
    if (reduceMotion) return;
    catalogSweep.setValue(0);
    Animated.timing(catalogSweep, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => catalogSweep.setValue(0));
  };

  const playDossierLock = () => {
    if (reduceMotion) {
      dossierLock.setValue(1);
      return;
    }
    dossierLock.setValue(0.9);
    Animated.timing(dossierLock, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const playTxnPulse = () => {
    if (reduceMotion) return;
    txnPulse.setValue(0);
    Animated.timing(txnPulse, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => txnPulse.setValue(0));
  };

  const showFeedback = (line: string) => {
    setFeedback(line);
    playTxnPulse();
    appendHubLog(line.startsWith('>>') ? line : `>> ${line}`);
  };

  const handleModeChange = (mode: BlackMarketTab) => {
    if (mode === activeMode) return;
    setActiveMode(mode);
    playSweep();
    playDossierLock();
  };

  const handleVendorChannel = (channel: VendorSubchannel) => {
    if (channel === vendorChannel) return;
    setVendorChannel(channel);
    setVendorSelection(null);
    setSellQty(1);
    playSweep();
    playDossierLock();
  };

  const handleSelectRecipe = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    playDossierLock();
  };

  const handleVendorSelect = (next: VendorSelection) => {
    setVendorSelection(next);
    setSellQty(1);
    playDossierLock();
  };

  const handleFabricate = () => {
    if (!forgeSelection?.canFabricate) return;
    const result = craftRecipe(forgeSelection.recipe.id);
    showFeedback(
      result.success
        ? `FABRICATION COMPLETE — ${forgeSelection.recipe.label.toUpperCase()} INSTALLED`
        : result.logLine,
    );
  };

  const handleBuy = () => {
    if (vendorSelection?.kind !== 'BUY') return;
    const listing = BLACK_MARKET_CARGO_LISTINGS.find((e) => e.id === vendorSelection.listingId);
    if (!listing) return;
    const price = hubContrabandPrice(listing.price, hubBlackMarketDiscountPct);
    if (account.cabalCredits < price) return;
    const result = purchaseHubContraband(vendorSelection.listingId, hubBlackMarketDiscountPct);
    showFeedback(
      result.logLine.includes('PURCHASE') || result.logLine.includes('ACQUIRED')
        ? `TRANSACTION CLEARED — ${listing.name.toUpperCase()} ACQUIRED · −${price} CR`
        : result.logLine,
    );
  };

  const handleSellResource = () => {
    if (vendorSelection?.kind !== 'SELL_RESOURCE') return;
    const entry = fenceEntries.find((e) => e.resourceId === vendorSelection.resourceId);
    if (!entry) return;
    const qty = Math.min(sellQty, entry.quantity);
    const result = sellFenceResource(entry.resourceId, qty);
    const proceeds = entry.sellValue * qty;
    showFeedback(
      `EXCHANGE COMPLETE — ${qty} ${getResourceShortName(entry.resourceId).toUpperCase()} TRANSFERRED · +${proceeds} CR`,
    );
    if (entry.quantity - qty <= 0) {
      setVendorSelection(null);
      setSellQty(1);
    }
    // Always log engine line for fidelity.
    if (result.logLine && !result.logLine.includes('EXCHANGE COMPLETE')) {
      appendHubLog(result.logLine);
    }
  };

  const renderForgeDossier = (entry: ForgeSchematicPresentation) => {
    const media = resolveCargoItemIcon(entry.recipe.outputId as never);
    return (
      <>
        <View style={styles.dossierHeader}>
          <View style={styles.dossierAccent} />
          <TerminalText size={7} letterSpacing={1.1} style={styles.dossierEyebrow}>
            FORGE DOSSIER
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>
            {entry.recipe.kind === 'AUGMENT' ? 'PERMANENT AUGMENT' : 'FABRICATION RECORD'}
          </TerminalText>
          <TerminalText size={15.5} letterSpacing={0.35} style={styles.dossierTitle}>
            {entry.recipe.label.toUpperCase()}
          </TerminalText>
          <TerminalText
            size={7}
            letterSpacing={0.9}
            style={[
              styles.dossierStatus,
              entry.status === 'fabricable' && { color: TERMINAL_BRIGHT },
              entry.status === 'missing' && { color: MISSING },
              (entry.status === 'rumored' || entry.status === 'sealed') && { color: OCCULT },
            ]}
          >
            {entry.stateLabel}
          </TerminalText>
        </View>

        <ScrollView style={styles.dossierBody} contentContainerStyle={{ paddingBottom: 8 }}>
          {media && entry.visibility === 'KNOWN' ? (
            <View style={styles.dossierMedia}>
              <Image source={media} style={styles.dossierMediaImage} resizeMode="contain" />
            </View>
          ) : null}

          <DossierSection label="EFFECT">
            <TerminalText size={8.5} style={styles.dossierValue}>
              {entry.effectLine}
            </TerminalText>
            {entry.recipe.kind === 'AUGMENT' ? (
              <TerminalText size={7.5} style={styles.dossierSecondary}>
                Permanent installation — remains after extraction.
              </TerminalText>
            ) : null}
          </DossierSection>

          {entry.visibility === 'RUMORED' ? (
            <>
              <DossierSection label="SCHEMATIC SOURCE">
                <TerminalText size={8.5} style={styles.dossierValue}>
                  {entry.meta.sourceHint || 'Unverified forge transmission'}
                </TerminalText>
              </DossierSection>
              <DossierSection label="MATERIAL REQUIREMENTS" last>
                <TerminalText size={8.5} style={styles.dossierValue}>
                  Recover additional sector intelligence.
                </TerminalText>
                <TerminalText size={7.5} style={styles.dossierSecondary}>
                  Costs remain sealed until the schematic is understood.
                </TerminalText>
              </DossierSection>
            </>
          ) : (
            <>
              <DossierSection label="MATERIAL REQUIREMENTS">
                {entry.requirements.map((req) => (
                  <View
                    key={req.resourceId}
                    style={[
                      styles.requirementRow,
                      !req.ready && styles.requirementMissing,
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TerminalText size={7.5} style={styles.requirementName} numberOfLines={1}>
                        {req.displayName}
                      </TerminalText>
                      <TerminalText size={7.5} style={styles.requirementCount}>
                        {req.concealed
                          ? 'Recover additional sector intelligence.'
                          : `${req.held} HELD / ${req.required} REQUIRED`}
                      </TerminalText>
                    </View>
                    <TerminalText
                      size={6.5}
                      letterSpacing={0.8}
                      style={{
                        color: req.ready ? TERMINAL : MISSING,
                        fontWeight: '700',
                      }}
                    >
                      {req.concealed ? 'UNKNOWN' : req.ready ? 'READY' : 'MISSING'}
                    </TerminalText>
                  </View>
                ))}
              </DossierSection>
              {entry.meta.sourceHint ? (
                <DossierSection label="SCHEMATIC SOURCE" last={!entry.alreadyOwned}>
                  <TerminalText size={8.5} style={styles.dossierValue}>
                    {entry.meta.sourceHint}
                  </TerminalText>
                </DossierSection>
              ) : null}
              {entry.alreadyOwned ? (
                <DossierSection label="OWNERSHIP" last>
                  <TerminalText size={8.5} style={styles.dossierValue}>
                    Already fabricated and installed.
                  </TerminalText>
                </DossierSection>
              ) : null}
            </>
          )}
        </ScrollView>

        <View style={styles.dossierFooter}>
          {feedback ? (
            <TerminalText size={7} style={styles.feedbackLine} numberOfLines={2}>
              {feedback}
            </TerminalText>
          ) : null}
          {entry.alreadyOwned ? (
            <View style={[styles.actionButton, styles.actionDisabled]}>
              <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
                [ ALREADY FABRICATED ]
              </TerminalText>
            </View>
          ) : entry.visibility === 'RUMORED' ? (
            <>
              <TerminalText size={7} letterSpacing={0.9} style={[styles.footerHint, { color: OCCULT }]}>
                {entry.meta.rumoredMinClearance
                  ? `CLEARANCE ${entry.meta.rumoredMinClearance} REQUIRED`
                  : 'UNVERIFIED SCHEMATIC'}
              </TerminalText>
              <View style={[styles.actionButton, styles.actionDisabled]}>
                <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
                  [ SCHEMATIC SEALED ]
                </TerminalText>
              </View>
            </>
          ) : entry.canFabricate ? (
            <>
              <TerminalText size={7} letterSpacing={0.9} style={[styles.footerHint, { color: TERMINAL }]}>
                MATERIALS VERIFIED
              </TerminalText>
              <HapticPressable
                onPress={handleFabricate}
                accessibilityRole="button"
                accessibilityLabel="Fabricate augment"
                style={({ pressed }) => ([
                  styles.actionButton,
                  styles.actionPrimary,
                  pressed && { opacity: 0.9 },
                ])}
              >
                <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                  [ FABRICATE AUGMENT ]
                </TerminalText>
              </HapticPressable>
            </>
          ) : (
            <>
              <TerminalText size={7} letterSpacing={0.9} style={[styles.footerHint, { color: MISSING }]}>
                {`${Math.max(1, entry.missingCount)} MATERIAL REQUIREMENT${entry.missingCount === 1 ? '' : 'S'} INCOMPLETE`}
              </TerminalText>
              <View style={[styles.actionButton, styles.actionDisabled]}>
                <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
                  [ FABRICATION BLOCKED ]
                </TerminalText>
              </View>
            </>
          )}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.txnPulse,
              {
                opacity: txnPulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.7, 0] }),
              },
            ]}
          />
        </View>
      </>
    );
  };

  const renderVendorDossier = () => {
    if (!vendorSelection) {
      return renderEmptyDossier('PROCUREMENT DOSSIER', 'Select an augment or item from the market feed.');
    }

    if (vendorSelection.kind === 'BUY') {
      const listing = BLACK_MARKET_CARGO_LISTINGS.find((e) => e.id === vendorSelection.listingId);
      if (!listing) return renderEmptyDossier('PROCUREMENT DOSSIER', 'Offer no longer available.');
      const price = hubContrabandPrice(listing.price, hubBlackMarketDiscountPct);
      const affordable = account.cabalCredits >= price;
      const catalog = CARGO_ITEM_CATALOG[listing.id];
      const image = resolveCargoItemIcon(listing.id);
      return (
        <>
          <View style={styles.dossierHeader}>
            <View style={styles.dossierAccent} />
            <TerminalText size={7} letterSpacing={1.1} style={styles.dossierEyebrow}>
              VENDOR DOSSIER
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>
              CONTRABAND OFFER
            </TerminalText>
            <TerminalText size={15.5} letterSpacing={0.35} style={styles.dossierTitle}>
              {listing.name.toUpperCase()}
            </TerminalText>
            <TerminalText
              size={7}
              letterSpacing={0.9}
              style={[styles.dossierStatus, { color: affordable ? TERMINAL_BRIGHT : MISSING }]}
            >
              {affordable ? 'AVAILABLE' : 'INSUFFICIENT FUNDS'}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody}>
            {image ? (
              <View style={styles.dossierMedia}>
                <Image source={image} style={styles.dossierMediaImage} resizeMode="contain" />
              </View>
            ) : null}
            <DossierSection label="EFFECT">
              <TerminalText size={8.5} style={styles.dossierValue}>
                {listing.description || listing.effect}
              </TerminalText>
            </DossierSection>
            <DossierSection label="CATEGORY">
              <TerminalText size={8.5} style={styles.dossierValue}>
                Contraband cargo
              </TerminalText>
            </DossierSection>
            <DossierSection label="CARGO FOOTPRINT">
              <TerminalText size={8.5} style={styles.dossierValue}>
                {catalog ? `${catalog.width}×${catalog.height}` : '1×1'}
              </TerminalText>
            </DossierSection>
            <DossierSection label="PURCHASE PRICE" last>
              <TerminalText size={13} style={styles.pricePrimary}>
                {`${price} CR`}
              </TerminalText>
              <TerminalText size={7.5} style={styles.dossierSecondary}>
                {`${account.cabalCredits} CR AVAILABLE`}
              </TerminalText>
            </DossierSection>
          </ScrollView>
          <View style={styles.dossierFooter}>
            {feedback ? (
              <TerminalText size={7} style={styles.feedbackLine} numberOfLines={2}>
                {feedback}
              </TerminalText>
            ) : null}
            {!affordable ? (
              <TerminalText size={7} letterSpacing={0.8} style={[styles.footerHint, { color: MISSING }]}>
                {`${price} CR REQUIRED · ${account.cabalCredits} CR AVAILABLE`}
              </TerminalText>
            ) : (
              <View style={styles.txnSummary}>
                <View>
                  <TerminalText size={6.5} letterSpacing={0.9} style={styles.txnSummaryLabel}>
                    PURCHASE PRICE
                  </TerminalText>
                  <TerminalText size={11} style={styles.txnSummaryValue}>
                    {`${price} CR`}
                  </TerminalText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <TerminalText size={6.5} letterSpacing={0.9} style={styles.txnSummaryLabel}>
                    FUNDS
                  </TerminalText>
                  <TerminalText size={11} style={styles.txnSummaryValue}>
                    {`${account.cabalCredits} CR`}
                  </TerminalText>
                </View>
              </View>
            )}
            <HapticPressable
              onPress={handleBuy}
              disabled={!affordable}
              accessibilityRole="button"
              accessibilityLabel={affordable ? `Buy for ${price} credits` : 'Purchase blocked'}
              style={({ pressed }) => ([
                styles.actionButton,
                affordable ? styles.actionPrimary : styles.actionDisabled,
                pressed && affordable && { opacity: 0.9 },
              ])}
            >
              <TerminalText
                size={8}
                letterSpacing={1}
                style={affordable ? styles.actionPrimaryText : styles.actionDisabledText}
              >
                {affordable ? `[ BUY FOR ${price} CR ]` : '[ PURCHASE BLOCKED ]'}
              </TerminalText>
            </HapticPressable>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.txnPulse,
                {
                  opacity: txnPulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.7, 0] }),
                },
              ]}
            />
          </View>
        </>
      );
    }

    if (vendorSelection.kind === 'SELL_RESOURCE') {
      const entry = fenceEntries.find((e) => e.resourceId === vendorSelection.resourceId);
      if (!entry) return renderEmptyDossier('PROCUREMENT DOSSIER', 'Holding no longer available.');
      const exchange = formatVendorExchangeCondition(entry.resourceId);
      const image = resolveCargoItemIcon(entry.resourceId);
      const qty = Math.min(sellQty, entry.quantity);
      const proceeds = entry.sellValue * qty;
      return (
        <>
          <View style={styles.dossierHeader}>
            <View style={styles.dossierAccent} />
            <TerminalText size={7} letterSpacing={1.1} style={styles.dossierEyebrow}>
              VENDOR DOSSIER
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>
              {exchange.categoryLabel}
            </TerminalText>
            <TerminalText size={15.5} letterSpacing={0.35} style={styles.dossierTitle}>
              {getResourceDisplayName(entry.resourceId, true).toUpperCase()}
            </TerminalText>
            <TerminalText size={7} letterSpacing={0.9} style={styles.dossierStatus}>
              {`${entry.quantity} HELD`}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody}>
            {image ? (
              <View style={styles.dossierMedia}>
                <Image source={image} style={styles.dossierMediaImage} resizeMode="contain" />
              </View>
            ) : null}
            <DossierSection label="UNIT VALUE">
              <TerminalText size={13} style={styles.pricePrimary}>
                {`${entry.sellValue} CR`}
              </TerminalText>
              <TerminalText size={7.5} style={styles.dossierSecondary}>
                {exchange.rateLabel}
              </TerminalText>
            </DossierSection>
            <DossierSection label="HOLDINGS" last>
              <TerminalText size={8.5} style={styles.dossierValue}>
                {`${entry.quantity} available for exchange`}
              </TerminalText>
            </DossierSection>
          </ScrollView>
          <View style={styles.dossierFooter}>
            {feedback ? (
              <TerminalText size={7} style={styles.feedbackLine} numberOfLines={2}>
                {feedback}
              </TerminalText>
            ) : null}
            <TerminalText size={6.5} letterSpacing={0.9} style={styles.txnSummaryLabel}>
              QUANTITY
            </TerminalText>
            <View style={styles.qtyControls}>
              <HapticPressable
                onPress={() => setSellQty((prev) => Math.max(1, prev - 1))}
                disabled={qty <= 1}
                accessibilityRole="button"
                accessibilityLabel="Decrease sale quantity"
                style={[styles.qtyBtn, qty <= 1 && { opacity: 0.35 }]}
              >
                <TerminalText size={11} style={{ color: TERMINAL_BRIGHT, fontWeight: '700' }}>−</TerminalText>
              </HapticPressable>
              <View
                style={styles.qtyOutput}
                {...(Platform.OS === 'web' ? ({ 'aria-live': 'polite' } as object) : {})}
              >
                <TerminalText size={8} style={{ color: '#e0e7e4', fontVariant: ['tabular-nums'] }}>
                  {`${qty} / ${entry.quantity}`}
                </TerminalText>
              </View>
              <HapticPressable
                onPress={() => setSellQty((prev) => Math.min(entry.quantity, prev + 1))}
                disabled={qty >= entry.quantity}
                accessibilityRole="button"
                accessibilityLabel="Increase sale quantity"
                style={[styles.qtyBtn, qty >= entry.quantity && { opacity: 0.35 }]}
              >
                <TerminalText size={11} style={{ color: TERMINAL_BRIGHT, fontWeight: '700' }}>+</TerminalText>
              </HapticPressable>
            </View>
            <View style={[styles.txnSummary, { marginTop: 12 }]}>
              <View>
                <TerminalText size={6.5} letterSpacing={0.9} style={styles.txnSummaryLabel}>
                  TOTAL PROCEEDS
                </TerminalText>
                <TerminalText size={11} style={styles.txnSummaryValue}>
                  {`${proceeds} CR`}
                </TerminalText>
              </View>
            </View>
            <HapticPressable
              onPress={handleSellResource}
              accessibilityRole="button"
              accessibilityLabel={`Sell ${qty} for ${proceeds} credits`}
              style={({ pressed }) => ([
                styles.actionButton,
                styles.actionPrimary,
                pressed && { opacity: 0.9 },
              ])}
            >
              <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                {`[ SELL ${qty} FOR ${proceeds} CR ]`}
              </TerminalText>
            </HapticPressable>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.txnPulse,
                {
                  opacity: txnPulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.7, 0] }),
                },
              ]}
            />
          </View>
        </>
      );
    }

    // Sealed cargo
    const sealed = sealedEntries.find((e) => e.stackId === vendorSelection.stackId);
    if (!sealed) return renderEmptyDossier('PROCUREMENT DOSSIER', 'Sealed cargo no longer available.');
    const config = getSealedCargoConfig(sealed.resourceId) ?? SEALED_CASKET_CONFIG;
    const openingFee = resolveOpeningFee(sealed.state === 'APPRAISED', sealed.resourceId);
    const canAppraise = sealed.state === 'SEALED' && account.cabalCredits >= config.appraisalFee;
    const canOpen = account.cabalCredits >= openingFee;
    const image = resolveCargoItemIcon(sealed.resourceId);

    return (
      <>
        <View style={styles.dossierHeader}>
          <View style={styles.dossierAccent} />
          <TerminalText size={7} letterSpacing={1.1} style={styles.dossierEyebrow}>
            VENDOR DOSSIER
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>
            SEALED CARGO
          </TerminalText>
          <TerminalText size={15.5} letterSpacing={0.35} style={styles.dossierTitle}>
            {getResourceShortName(sealed.resourceId).toUpperCase()}
          </TerminalText>
          <TerminalText size={7} letterSpacing={0.9} style={[styles.dossierStatus, { color: OCCULT }]}>
            {sealed.state === 'APPRAISED' ? 'APPRAISED' : 'SEALED'}
          </TerminalText>
        </View>
        <ScrollView style={styles.dossierBody}>
          {image ? (
            <View style={styles.dossierMedia}>
              <Image source={image} style={styles.dossierMediaImage} resizeMode="contain" />
            </View>
          ) : null}
          <DossierSection label="STATUS">
            <TerminalText size={8.5} style={styles.dossierValue}>
              {sealed.state === 'APPRAISED' && sealed.valueBand
                ? getAppraisalBandLabel(sealed.valueBand, sealed.resourceId)
                : 'Unappraised sealed container'}
            </TerminalText>
          </DossierSection>
          <DossierSection label="SALE VALUE" last>
            <TerminalText size={13} style={styles.pricePrimary}>
              {`${sealed.sellValue} CR`}
            </TerminalText>
            <TerminalText size={7.5} style={styles.dossierSecondary}>
              Selling forfeits hidden contents.
            </TerminalText>
          </DossierSection>
        </ScrollView>
        <View style={styles.dossierFooter}>
          {sealed.state === 'SEALED' ? (
            <HapticPressable
              onPress={() => showFeedback(appraiseSealedCargoInHub(sealed.stackId).logLine)}
              disabled={!canAppraise}
              style={({ pressed }) => ([
                styles.actionButton,
                canAppraise ? styles.actionPrimary : styles.actionDisabled,
                { marginBottom: 8 },
                pressed && canAppraise && { opacity: 0.9 },
              ])}
            >
              <TerminalText
                size={8}
                letterSpacing={1}
                style={canAppraise ? styles.actionPrimaryText : styles.actionDisabledText}
              >
                {`[ APPRAISE −${config.appraisalFee} CR ]`}
              </TerminalText>
            </HapticPressable>
          ) : null}
          <HapticPressable
            onPress={() => showFeedback(openSealedCargoInHub(sealed.stackId).logLine)}
            disabled={!canOpen}
            style={({ pressed }) => ([
              styles.actionButton,
              canOpen ? styles.actionPrimary : styles.actionDisabled,
              { marginBottom: 8 },
              pressed && canOpen && { opacity: 0.9 },
            ])}
          >
            <TerminalText
              size={8}
              letterSpacing={1}
              style={canOpen ? styles.actionPrimaryText : styles.actionDisabledText}
            >
              {openingFee > 0 ? `[ OPEN −${openingFee} CR ]` : '[ OPEN ]'}
            </TerminalText>
          </HapticPressable>
          <HapticPressable
            onPress={() => {
              showFeedback(sellSealedCargoInHub(sealed.stackId).logLine);
              setVendorSelection(null);
            }}
            style={({ pressed }) => ([
              styles.actionButton,
              styles.actionPrimary,
              pressed && { opacity: 0.9 },
            ])}
          >
            <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
              {`[ SELL FOR ${sealed.sellValue} CR ]`}
            </TerminalText>
          </HapticPressable>
        </View>
      </>
    );
  };

  const renderEmptyDossier = (eyebrow: string, body: string) => (
    <>
      <View style={styles.dossierHeader}>
        <View style={styles.dossierAccent} />
        <TerminalText size={7} letterSpacing={1.1} style={styles.dossierEyebrow}>
          {eyebrow}
        </TerminalText>
        <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>
          NO RECORD SELECTED
        </TerminalText>
        <TerminalText size={15.5} letterSpacing={0.35} style={styles.dossierTitle}>
          AWAITING SIGNAL
        </TerminalText>
      </View>
      <View style={styles.dossierBody}>
        <TerminalText size={8.5} style={styles.dossierValue}>
          {body}
        </TerminalText>
      </View>
      <View style={styles.dossierFooter}>
        <View style={[styles.actionButton, styles.actionDisabled]}>
          <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
            [ SELECT A RECORD ]
          </TerminalText>
        </View>
      </View>
    </>
  );

  const catalogSweepStyle = {
    opacity: catalogSweep.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.55, 0] }),
    transform: [{
      translateY: catalogSweep.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }),
    }],
  };

  return (
    <View
      style={styles.board}
      {...(Platform.OS === 'web' ? ({ 'data-black-market': 'true' } as object) : null)}
    >
      <VeilTerminalEffects intensity="subtle" />

      <View style={styles.workspace}>
        <View style={[styles.localHeader, compact && styles.localHeaderCompact]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TerminalText size={7.5} letterSpacing={1} style={styles.breadcrumb}>
              BLACK MARKET / CONTRABAND LANE
            </TerminalText>
            <TerminalText size={13.5} letterSpacing={0.7} style={styles.localTitle}>
              FABRICATION & PROCUREMENT
            </TerminalText>
          </View>
          <View style={styles.balance}>
            <TerminalText size={7} letterSpacing={1} style={styles.balanceLabel}>
              AVAILABLE FUNDS
            </TerminalText>
            <TerminalText size={10.5} letterSpacing={0.6} style={styles.balanceCredits}>
              {`${account.cabalCredits} CR`}
            </TerminalText>
            <TerminalText size={7} letterSpacing={0.6} style={styles.balanceMeta}>
              {`${account.veilResidueBalance} VEIL RESIDUE · MARKET FEED STABLE`}
            </TerminalText>
          </View>
        </View>

        <View
          style={styles.modes}
          accessibilityRole="tablist"
          {...(Platform.OS === 'web' ? ({ 'aria-label': 'Black Market mode' } as object) : {})}
        >
          {MODE_ITEMS.map((mode) => {
            const selected = activeMode === mode.key;
            return (
              <HapticPressable
                key={mode.key}
                onPress={() => handleModeChange(mode.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                {...(Platform.OS === 'web' ? ({ 'aria-selected': selected } as object) : {})}
                style={({ pressed }) => ([
                  styles.mode,
                  selected && styles.modeSelected,
                  pressed && { opacity: 0.9 },
                ])}
              >
                <TerminalText
                  size={8}
                  letterSpacing={0.9}
                  style={{ color: selected ? TERMINAL_BRIGHT : '#879b95', fontWeight: '800' }}
                >
                  {mode.label}
                </TerminalText>
                <TerminalText size={7} style={{ marginTop: 3, color: '#7f928c' }}>
                  {mode.detail}
                </TerminalText>
                {selected ? <View style={styles.modeUnderline} /> : null}
              </HapticPressable>
            );
          })}
          <View style={styles.modeSpacer} />
        </View>

        <View style={styles.modeContent}>
          {!reduceMotion ? (
            <Animated.View pointerEvents="none" style={[styles.catalogSweep, catalogSweepStyle]} />
          ) : null}
          {activeMode === 'FORGE' ? (
            <ForgeWorkspace
              selectedRecipeId={selectedRecipeId}
              onSelectRecipe={handleSelectRecipe}
              compact={compact}
              narrow={narrow}
            />
          ) : (
            <VendorWorkspace
              account={account}
              marketDiscount={hubBlackMarketDiscountPct}
              subchannel={vendorChannel}
              onChangeSubchannel={handleVendorChannel}
              selection={vendorSelection}
              onSelect={handleVendorSelect}
              compact={compact}
              narrow={narrow}
            />
          )}
        </View>
      </View>

      <Animated.View
        style={[
          styles.dossier,
          { width: dossierWidth, maxWidth: dossierWidth, opacity: dossierLock },
        ]}
      >
        {activeMode === 'FORGE'
          ? (forgeSelection
            ? renderForgeDossier(forgeSelection)
            : renderEmptyDossier('FORGE DOSSIER', 'Select an augment from the schematic feed.'))
          : renderVendorDossier()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#010304',
    position: 'relative',
  },
  workspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: 'rgba(137, 190, 179, 0.18)',
  },
  localHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 28,
    minHeight: 72,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.13)',
    flexShrink: 0,
  },
  localHeaderCompact: {
    minHeight: 60,
    paddingTop: 10,
    paddingBottom: 9,
  },
  breadcrumb: {
    color: '#84958f',
    fontWeight: '700',
  },
  localTitle: {
    marginTop: 4,
    color: '#e0e7e4',
    fontWeight: '700',
  },
  balance: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    color: '#84958f',
    fontWeight: '700',
  },
  balanceCredits: {
    marginTop: 3,
    color: TERMINAL_BRIGHT,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  balanceMeta: {
    marginTop: 3,
    color: '#91a39f',
    fontVariant: ['tabular-nums'],
  },
  modes: {
    flexDirection: 'row',
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.16)',
    flexShrink: 0,
  },
  mode: {
    position: 'relative',
    minWidth: 180,
    maxWidth: 250,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRightWidth: 1,
    borderRightColor: 'rgba(137, 170, 163, 0.12)',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  modeSelected: {
    backgroundColor: 'rgba(105, 200, 173, 0.04)',
  },
  modeUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: TERMINAL,
  },
  modeSpacer: {
    flex: 1,
  },
  modeContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  catalogSweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    zIndex: 4,
    backgroundColor: 'rgba(142, 223, 198, 0.35)',
  },
  dossier: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#030707',
    flexShrink: 0,
  },
  dossierHeader: {
    position: 'relative',
    paddingTop: 24,
    paddingBottom: 21,
    paddingLeft: 32,
    paddingRight: 28,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.14)',
    flexShrink: 0,
  },
  dossierAccent: {
    position: 'absolute',
    top: 24,
    bottom: 21,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
  },
  dossierEyebrow: {
    color: '#84958f',
    fontWeight: '700',
  },
  dossierCategory: {
    marginTop: 8,
    color: TERMINAL,
    fontWeight: '700',
  },
  dossierTitle: {
    marginTop: 9,
    color: '#e2e9e6',
    fontWeight: '700',
  },
  dossierStatus: {
    marginTop: 10,
    color: '#91a39f',
    fontWeight: '700',
  },
  dossierBody: {
    flex: 1,
    minHeight: 0,
    paddingTop: 22,
    paddingBottom: 26,
    paddingLeft: 32,
    paddingRight: 28,
  },
  dossierMedia: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.11)',
  },
  dossierMediaImage: {
    width: 128,
    height: 128,
  },
  dossierSection: {
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.11)',
  },
  dossierSectionLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  dossierLabel: {
    color: '#7f928c',
    fontWeight: '700',
  },
  dossierValue: {
    marginTop: 6,
    color: '#d2dcd8',
    lineHeight: 20,
  },
  dossierSecondary: {
    marginTop: 4,
    color: '#90a19c',
    lineHeight: 18,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  requirementMissing: {},
  requirementName: {
    color: '#d5dfdc',
    fontWeight: '700',
  },
  requirementCount: {
    marginTop: 3,
    color: '#91a39f',
    fontVariant: ['tabular-nums'],
  },
  pricePrimary: {
    marginTop: 6,
    color: '#e2e9e6',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dossierFooter: {
    position: 'relative',
    paddingTop: 16,
    paddingBottom: 22,
    paddingLeft: 32,
    paddingRight: 28,
    backgroundColor: 'rgba(3, 7, 8, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(137, 190, 179, 0.2)',
    flexShrink: 0,
    overflow: 'hidden',
  },
  footerHint: {
    marginBottom: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedbackLine: {
    marginBottom: 10,
    color: TERMINAL_BRIGHT,
    fontWeight: '700',
    textAlign: 'center',
  },
  txnSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  txnSummaryLabel: {
    color: '#7f928c',
    fontWeight: '700',
  },
  txnSummaryValue: {
    marginTop: 3,
    color: '#e0e7e4',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  qtyControls: {
    flexDirection: 'row',
    minHeight: 46,
    marginTop: 8,
  },
  qtyBtn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(105, 200, 173, 0.025)',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.3)',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  qtyOutput: {
    flex: 1,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(137, 170, 163, 0.18)',
  },
  actionButton: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  actionPrimary: {
    backgroundColor: TERMINAL,
    borderWidth: 1,
    borderColor: TERMINAL_BRIGHT,
  },
  actionPrimaryText: {
    color: '#06110e',
    fontWeight: '800',
  },
  actionDisabled: {
    backgroundColor: 'rgba(105, 200, 173, 0.025)',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.18)',
  },
  actionDisabledText: {
    color: 'rgba(188, 204, 198, 0.34)',
    fontWeight: '800',
  },
  txnPulse: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: TERMINAL_BRIGHT,
  },
});
