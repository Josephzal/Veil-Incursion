import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { BLACK_MARKET_CARGO_LISTINGS } from '../../data/blackMarket';
import {
  hubContrabandPrice,
  listFenceableStashEntries,
} from '../../data/hubSafehouseEngine';
import { formatCargoRoutingBlackMarketIntelLines } from '../../data/cargoRoutingIntelEngine';
import { getAppraisalBandLabel, resolveOpeningFee } from '../../data/sealedCasketAppraisalEngine';
import {
  getSealedCargoConfig,
  isAppraisableSealedResource,
  listSealedStashEntries,
  SEALED_CASKET_CONFIG,
} from '../../data/sealedCargoEngine';
import { getResourceDisplayName, getResourceCategory, getResourceShortName } from '../../data/resourceRegistry';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useWorldState } from '../../context/WorldStateContext';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import type { ResourceItemId } from '../../types/resourceItem';
import TerminalText from '../TerminalText';
import TacticalButton from '../TacticalButton';
import DossierCardShell from '../hub/DossierCardShell';
import { LoadoutSectionHeader } from '../hub/loadoutTabUi';
import HubCargoIconBox from './HubCargoIconBox';
import { DOSSIER_ROW_BG, dossierOpaqueCtaStyle, SELECT_ACCENT } from '../../constants/dossierSurface';
import { hubCtaButtonStyle } from '../../constants/hubCta';
import { useHubLayout } from '../../context/HubLayoutContext';
import { useHubTypography } from '../../hooks/useHubTypography';
import { terminalHoverStyle, readPressableHover } from '../../utils/terminalHoverStyle';
import {
  HIDDEN_SCROLLBAR_VIEW_STYLE,
  HIDDEN_SCROLLVIEW_PROPS,
} from '../../utils/hiddenScrollbarStyle';

const TERMINAL_GREEN = SELECT_ACCENT;

interface MarketListingRowProps {
  listing: (typeof BLACK_MARKET_CARGO_LISTINGS)[number];
  price: number;
  selected: boolean;
  affordable: boolean;
  economyColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  iconSize: number;
  isDesktop: boolean;
  onPress: () => void;
}

function MarketListingRow({
  listing,
  price,
  selected,
  affordable,
  economyColor,
  borderColor,
  textColor,
  mutedColor,
  iconSize,
  isDesktop,
  onPress,
}: MarketListingRowProps): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      style={(state) => [
        styles.listingRow,
        isDesktop && styles.listingRowDesktop,
        {
          borderColor: selected ? economyColor : borderColor,
          backgroundColor: DOSSIER_ROW_BG,
          opacity: affordable ? 1 : 0.55,
        },
        terminalHoverStyle(readPressableHover(state), state.pressed),
      ]}
    >
      <View style={styles.listingMain}>
        <View style={styles.listingCopy}>
          <TerminalText
            variant="body"
            style={{ color: selected ? economyColor : textColor, fontWeight: '700' }}
            numberOfLines={1}
          >
            {listing.name.toUpperCase()}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: mutedColor }} numberOfLines={2}>
            {listing.effect}
          </TerminalText>
          <TerminalText variant="body" style={{ color: TERMINAL_GREEN, fontWeight: '700' }}>
            {`${price} CR`}
          </TerminalText>
        </View>
        <HubCargoIconBox
          itemId={listing.id}
          borderColor={mutedColor}
          iconSize={iconSize}
        />
      </View>
    </HapticPressable>
  );
}

interface FenceRowProps {
  resourceId: ResourceItemId;
  quantity: number;
  sellValue: number;
  economyColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  iconSize: number;
  isDesktop: boolean;
  onSell: (quantity: number) => void;
}

function FenceRow({
  resourceId,
  quantity,
  sellValue,
  economyColor,
  borderColor,
  textColor,
  mutedColor,
  iconSize,
  isDesktop,
  onSell,
}: FenceRowProps): React.JSX.Element {
  const { scaleSize, scaleSpacing } = useHubLayout();
  const [sellQty, setSellQty] = useState(1);

  useEffect(() => {
    setSellQty((prev) => Math.min(prev, quantity));
  }, [quantity]);

  const decrement = () => setSellQty((prev) => Math.max(1, prev - 1));
  const increment = () => setSellQty((prev) => Math.min(quantity, prev + 1));
  const inlineButtonHeight = {
    minHeight: scaleSize(36),
    paddingVertical: scaleSpacing(8),
  };
  const stepButtonStyle = {
    ...inlineButtonHeight,
    minWidth: scaleSize(26),
    paddingHorizontal: scaleSpacing(4),
  };

  return (
    <View
      style={[
        styles.fenceRow,
        isDesktop && styles.fenceRowDesktop,
        { borderColor, backgroundColor: DOSSIER_ROW_BG },
      ]}
    >
      <View style={styles.fenceInfo}>
        <TerminalText variant="body" style={{ color: textColor, fontWeight: '700' }}>
          {getResourceDisplayName(resourceId, true).toUpperCase()}
        </TerminalText>
        <TerminalText variant="caption" style={{ color: mutedColor }}>
          {`${getResourceCategory(resourceId)} // ${quantity}× @ `}
          <Text style={{ color: TERMINAL_GREEN, fontWeight: '700', fontFamily: 'monospace' }}>
            {`${sellValue} CR`}
          </Text>
        </TerminalText>
      </View>
      <View style={styles.fenceActions}>
        <TacticalButton
          label="−"
          active={sellQty > 1}
          onPress={decrement}
          accentColor={economyColor}
          mutedColor={mutedColor}
          variant="inline"
          labelSize={8}
          labelLineHeight={12}
          suppressGlow
          style={[dossierOpaqueCtaStyle(economyColor), stepButtonStyle]}
        />
        <TerminalText variant="body" style={[styles.fenceQty, { color: textColor }]}>
          {sellQty}
        </TerminalText>
        <TacticalButton
          label="+"
          active={sellQty < quantity}
          onPress={increment}
          accentColor={economyColor}
          mutedColor={mutedColor}
          variant="inline"
          labelSize={8}
          labelLineHeight={12}
          suppressGlow
          style={[dossierOpaqueCtaStyle(economyColor), stepButtonStyle]}
        />
        <TacticalButton
          label="[ SELL ]"
          active
          onPress={() => onSell(sellQty)}
          accentColor={economyColor}
          mutedColor={mutedColor}
          variant="inline"
          style={[dossierOpaqueCtaStyle(economyColor), inlineButtonHeight]}
        />
      </View>
      <HubCargoIconBox
        itemId={resourceId}
        borderColor={mutedColor}
        iconSize={iconSize}
      />
    </View>
  );
}

interface SealedAppraisalRowProps {
  stackId: string;
  resourceId: import('../../types/resourceItem').ResourceItemId;
  state: 'SEALED' | 'APPRAISED';
  valueBand?: import('../../types/sealedCargo').AppraisalValueBand;
  sellValue: number;
  cabalCredits: number;
  economyColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  onAppraise: () => void;
  onOpen: () => void;
  onSell: () => void;
}

function SealedAppraisalRow({
  resourceId,
  state,
  valueBand,
  sellValue,
  cabalCredits,
  economyColor,
  borderColor,
  textColor,
  mutedColor,
  onAppraise,
  onOpen,
  onSell,
}: SealedAppraisalRowProps): React.JSX.Element {
  const { scaleSize, scaleSpacing } = useHubLayout();
  const inlineButtonHeight = {
    minHeight: scaleSize(36),
    paddingVertical: scaleSpacing(8),
  };
  const config = getSealedCargoConfig(resourceId) ?? SEALED_CASKET_CONFIG;
  const canAppraise = state === 'SEALED' && cabalCredits >= config.appraisalFee;
  const openingFee = resolveOpeningFee(state === 'APPRAISED', resourceId);
  const canOpen = cabalCredits >= openingFee;

  return (
    <View style={[styles.fenceRow, { borderColor, backgroundColor: DOSSIER_ROW_BG }]}>
      <View style={styles.fenceInfo}>
        <TerminalText variant="body" style={{ color: textColor, fontWeight: '700' }}>
          {getResourceShortName(resourceId).toUpperCase()}
        </TerminalText>
        <TerminalText variant="caption" style={{ color: mutedColor }}>
          {state === 'APPRAISED' && valueBand
            ? `${getAppraisalBandLabel(valueBand, resourceId).toUpperCase()} // SELL ${sellValue} CR`
            : `UNAPPRAISED // SELL ${sellValue} CR // APPRAISE ${config.appraisalFee} CR`}
        </TerminalText>
      </View>
      <View style={styles.fenceActions}>
        {state === 'SEALED' ? (
          <TacticalButton
            label="[ APPRAISE ]"
            active={canAppraise}
            onPress={onAppraise}
            accentColor={economyColor}
            mutedColor={mutedColor}
            variant="inline"
            style={[dossierOpaqueCtaStyle(economyColor), inlineButtonHeight, !canAppraise ? { opacity: 0.45 } : null]}
          />
        ) : null}
        <TacticalButton
          label={openingFee > 0 ? `[ OPEN −${openingFee} ]` : '[ OPEN ]'}
          active={canOpen}
          onPress={onOpen}
          accentColor={economyColor}
          mutedColor={mutedColor}
          variant="inline"
          style={[dossierOpaqueCtaStyle(economyColor), inlineButtonHeight, !canOpen ? { opacity: 0.45 } : null]}
        />
        <TacticalButton
          label="[ SELL ]"
          active
          onPress={onSell}
          accentColor={economyColor}
          mutedColor={mutedColor}
          variant="inline"
          style={[dossierOpaqueCtaStyle(economyColor), inlineButtonHeight]}
        />
      </View>
    </View>
  );
}

export default function SafehouseBlackMarketTab(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, purchaseHubContraband, sellFenceResource, appendHubLog, appraiseSealedCargoInHub, openSealedCargoInHub, sellSealedCargoInHub } = usePlayerAccount();
  const { hubBlackMarketDiscountPct } = useWorldState();
  const marketDiscount = hubBlackMarketDiscountPct;
  const [selectedListingId, setSelectedListingId] = useState<CargoItemId | null>(null);

  const accent = theme.statusColor;
  const economyColor = SELECT_ACCENT;
  const {
    isDesktop,
    scaleSpacing,
    scaleSize,
    marketBuyLaneWidth,
    deploymentLaneWidth,
  } = useHubLayout();
  const { iconSize } = useHubTypography();

  const selectedListing = selectedListingId != null
    ? BLACK_MARKET_CARGO_LISTINGS.find((entry) => entry.id === selectedListingId) ?? null
    : null;
  const selectedPrice = selectedListing ? hubContrabandPrice(selectedListing.price, marketDiscount) : 0;
  const canBuy = selectedListing != null && account.cabalCredits >= selectedPrice;

  const fenceEntries = listFenceableStashEntries(account.resourceStash)
    .filter((entry) => !isAppraisableSealedResource(entry.resourceId));
  const sealedEntries = listSealedStashEntries(account.resourceStash, account.sealedCargoStacks ?? []);

  const handleBuy = () => {
    if (!selectedListingId) return;
    const result = purchaseHubContraband(selectedListingId, marketDiscount);
    appendHubLog(result.logLine);
  };

  const handleSell = (resourceId: typeof fenceEntries[number]['resourceId'], quantity: number) => {
    const result = sellFenceResource(resourceId, quantity);
    appendHubLog(result.logLine);
  };

  const panelPadding = scaleSpacing(10);

  return (
    <View style={styles.root}>
      <View style={[styles.splitRow, isDesktop && styles.splitDesktop, { gap: scaleSpacing(10) }]}>
        <View
          style={[
            styles.buyColumn,
            Platform.OS === 'web' && styles.buyColumnWeb,
            isDesktop ? { width: marketBuyLaneWidth, flexShrink: 0 } : { flex: 1 },
            { gap: scaleSpacing(6) },
          ]}
        >
          <LoadoutSectionHeader label="Vendor // Contraband" />
          <DossierCardShell
            fillHeight
            padding={panelPadding}
            contentStyle={[styles.panelColumn, Platform.OS === 'web' ? styles.panelFill : null]}
          >
          <TerminalText variant="caption" style={[styles.panelSub, { color: theme.mutedColor }]}>
            High-end field gear — purchases stage in hub consumable vault.
          </TerminalText>
          <ScrollView
            style={[
              styles.listScroll,
              Platform.OS === 'web' && styles.listScrollWeb,
              HIDDEN_SCROLLBAR_VIEW_STYLE,
            ]}
            contentContainerStyle={styles.listContent}
            {...HIDDEN_SCROLLVIEW_PROPS}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {BLACK_MARKET_CARGO_LISTINGS.map((listing) => {
              const price = hubContrabandPrice(listing.price, marketDiscount);
              const selected = selectedListingId === listing.id;
              const affordable = account.cabalCredits >= price;
              return (
                <MarketListingRow
                  key={listing.id}
                  listing={listing}
                  price={price}
                  selected={selected}
                  affordable={affordable}
                  economyColor={economyColor}
                  borderColor={theme.borderColor}
                  textColor={theme.textColor}
                  mutedColor={theme.mutedColor}
                  iconSize={iconSize}
                  isDesktop={isDesktop}
                  onPress={() => setSelectedListingId(listing.id)}
                />
              );
            })}
          </ScrollView>
          <TacticalButton
            label="[ BUY ]"
            active={canBuy}
            onPress={handleBuy}
            accentColor={economyColor}
            mutedColor={theme.mutedColor}
            variant="cta"
            style={[
              styles.buyButton,
              hubCtaButtonStyle(economyColor, scaleSize, scaleSpacing, !canBuy),
              dossierOpaqueCtaStyle(economyColor),
              !canBuy ? { opacity: 0.45 } : null,
            ]}
          />
          </DossierCardShell>
        </View>

        <View
          style={[
            styles.fenceColumn,
            isDesktop && styles.fenceColumnDesktop,
            Platform.OS === 'web' && styles.fenceColumnWeb,
            isDesktop ? { minWidth: deploymentLaneWidth } : { flex: 1 },
            { gap: scaleSpacing(6) },
          ]}
        >
          <LoadoutSectionHeader label="Fence // Liquidate" />
          <DossierCardShell
            fillHeight
            padding={panelPadding}
            contentStyle={[styles.panelColumn, Platform.OS === 'web' ? styles.panelFill : null]}
          >
          <TerminalText variant="caption" style={[styles.panelSub, { color: theme.mutedColor }]}>
            {formatCargoRoutingBlackMarketIntelLines()[0]}
          </TerminalText>
          <TerminalText variant="caption" style={[styles.panelSub, { color: theme.mutedColor, marginTop: 4 }]}>
            {formatCargoRoutingBlackMarketIntelLines()[1]}
          </TerminalText>
          <ScrollView
            style={[
              styles.listScroll,
              Platform.OS === 'web' && styles.listScrollWeb,
              HIDDEN_SCROLLBAR_VIEW_STYLE,
            ]}
            contentContainerStyle={styles.listContent}
            {...HIDDEN_SCROLLVIEW_PROPS}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {fenceEntries.length === 0 ? (
              <TerminalText variant="caption" style={{ color: theme.mutedColor }}>
                NO FENCEABLE SALVAGE IN STASH.
              </TerminalText>
            ) : (
              fenceEntries.map((entry) => (
                <FenceRow
                  key={entry.resourceId}
                  resourceId={entry.resourceId}
                  quantity={entry.quantity}
                  sellValue={entry.sellValue}
                  economyColor={economyColor}
                  borderColor={theme.borderColor}
                  textColor={theme.textColor}
                  mutedColor={theme.mutedColor}
                  iconSize={iconSize}
                  isDesktop={isDesktop}
                  onSell={(qty) => handleSell(entry.resourceId, qty)}
                />
              ))
            )}
          </ScrollView>
          </DossierCardShell>
        </View>
      </View>

      {sealedEntries.length > 0 ? (
        <DossierCardShell
          padding={panelPadding}
          style={[styles.appraisalPanel, { marginTop: scaleSpacing(10) }]}
        >
          <TerminalText variant="panelTitle" letterSpacing={0.8} style={[styles.panelTitle, { color: accent }]}>
            APPRAISAL // SEALED CARGO
          </TerminalText>
          <TerminalText variant="caption" style={[styles.panelSub, { color: theme.mutedColor }]}>
            Appraise to reveal value band. Opening fee waived after appraisal. Selling forfeits hidden contents.
          </TerminalText>
          <View style={styles.listContent}>
            {sealedEntries.map((entry) => (
              <SealedAppraisalRow
                key={entry.stackId}
                stackId={entry.stackId}
                resourceId={entry.resourceId}
                state={entry.state === 'APPRAISED' ? 'APPRAISED' : 'SEALED'}
                valueBand={entry.valueBand}
                sellValue={entry.sellValue}
                cabalCredits={account.cabalCredits}
                economyColor={economyColor}
                borderColor={theme.borderColor}
                textColor={theme.textColor}
                mutedColor={theme.mutedColor}
                onAppraise={() => appendHubLog(appraiseSealedCargoInHub(entry.stackId).logLine)}
                onOpen={() => appendHubLog(openSealedCargoInHub(entry.stackId).logLine)}
                onSell={() => appendHubLog(sellSealedCargoInHub(entry.stackId).logLine)}
              />
            ))}
          </View>
        </DossierCardShell>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  splitDesktop: {
    alignItems: 'stretch',
  },
  buyColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  buyColumnWeb: {
    alignSelf: 'stretch',
    height: '100%',
  },
  fenceColumn: {
    minWidth: 0,
    minHeight: 0,
  },
  fenceColumnDesktop: {
    flex: 1,
  },
  fenceColumnWeb: Platform.select({
    web: {
      position: 'sticky',
      top: 0,
      alignSelf: 'stretch',
      height: '100%',
      flexShrink: 0,
    },
    default: {
      flexShrink: 0,
    },
  }),
  panelColumn: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    gap: 8,
  },
  panelFill: {
    height: '100%',
    alignSelf: 'stretch',
  },
  panelTitle: {
    fontWeight: '700',
    flexShrink: 0,
  },
  panelSub: {
    flexShrink: 0,
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  listScrollWeb: {
    flex: 1,
    minHeight: 0,
    height: 0,
    overflow: 'auto',
  },
  listContent: {
    gap: 6,
    paddingBottom: 8,
  },
  buyButton: {
    flexShrink: 0,
  },
  listingRow: {
    width: '100%',
    borderWidth: 1,
    minHeight: 44,
    overflow: 'hidden',
  },
  listingRowDesktop: {
    minHeight: 56,
  },
  listingMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 44,
  },
  listingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    width: '100%',
    overflow: 'hidden',
  },
  fenceRowDesktop: {
    minHeight: 56,
  },
  fenceInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fenceActions: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  fenceQty: {
    minWidth: 20,
    textAlign: 'center',
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  appraisalPanel: {
    flexShrink: 0,
  },
});
