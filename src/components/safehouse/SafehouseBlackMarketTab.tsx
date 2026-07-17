import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { BLACK_MARKET_CARGO_LISTINGS } from '../../data/blackMarket';
import {
  hubContrabandPrice,
  listFenceableStashEntries,
} from '../../data/hubSafehouseEngine';
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
import DossierCardShell from '../hub/DossierCardShell';
import {
  MarketActionButton,
  MarketContentGrid,
  MarketPanel,
  MarketRow,
  MARKET_CONTENT_BOTTOM_PAD,
} from '../hub/marketUi';
import { SELECT_ACCENT } from '../../constants/dossierSurface';
import { useHubLayout } from '../../context/HubLayoutContext';
import {
  HIDDEN_SCROLLBAR_VIEW_STYLE,
  HIDDEN_SCROLLVIEW_PROPS,
} from '../../utils/hiddenScrollbarStyle';

interface FenceRowProps {
  resourceId: ResourceItemId;
  quantity: number;
  sellValue: number;
  economyColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
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
  onSell,
}: FenceRowProps): React.JSX.Element {
  const [sellQty, setSellQty] = useState(1);

  useEffect(() => {
    setSellQty((prev) => Math.min(prev, quantity));
  }, [quantity]);

  return (
    <MarketRow
      title={getResourceDisplayName(resourceId, true).toUpperCase()}
      subtitle={`${getResourceCategory(resourceId)} // ${quantity}× AVAILABLE`}
      valueLine={`${sellValue} CR / UNIT`}
      borderColor={borderColor}
      textColor={textColor}
      mutedColor={mutedColor}
      accentColor={economyColor}
      imageItemId={resourceId}
      actions={(
        <>
          <MarketActionButton
            label="−"
            variant="stepper"
            accentColor={economyColor}
            mutedColor={mutedColor}
            disabled={sellQty <= 1}
            onPress={() => setSellQty((prev) => Math.max(1, prev - 1))}
          />
          <TerminalText variant="body" style={[styles.fenceQty, { color: textColor }]}>
            {sellQty}
          </TerminalText>
          <MarketActionButton
            label="+"
            variant="stepper"
            accentColor={economyColor}
            mutedColor={mutedColor}
            disabled={sellQty >= quantity}
            onPress={() => setSellQty((prev) => Math.min(quantity, prev + 1))}
          />
          <MarketActionButton
            label="[ SELL ]"
            accentColor={economyColor}
            mutedColor={mutedColor}
            onPress={() => onSell(sellQty)}
          />
        </>
      )}
    />
  );
}

interface SealedAppraisalRowProps {
  stackId: string;
  resourceId: ResourceItemId;
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
  const config = getSealedCargoConfig(resourceId) ?? SEALED_CASKET_CONFIG;
  const canAppraise = state === 'SEALED' && cabalCredits >= config.appraisalFee;
  const openingFee = resolveOpeningFee(state === 'APPRAISED', resourceId);
  const canOpen = cabalCredits >= openingFee;

  return (
    <MarketRow
      title={getResourceShortName(resourceId).toUpperCase()}
      subtitle={
        state === 'APPRAISED' && valueBand
          ? `${getAppraisalBandLabel(valueBand, resourceId).toUpperCase()} // APPRAISED`
          : `UNAPPRAISED // APPRAISE ${config.appraisalFee} CR`
      }
      valueLine={`${sellValue} CR`}
      borderColor={borderColor}
      textColor={textColor}
      mutedColor={mutedColor}
      accentColor={economyColor}
      imageItemId={resourceId}
      actions={(
        <>
          {state === 'SEALED' ? (
            <MarketActionButton
              label="[ APPRAISE ]"
              accentColor={economyColor}
              mutedColor={mutedColor}
              disabled={!canAppraise}
              variant={canAppraise ? 'primary' : 'disabled'}
              onPress={onAppraise}
            />
          ) : null}
          <MarketActionButton
            label={openingFee > 0 ? `[ OPEN −${openingFee} ]` : '[ OPEN ]'}
            accentColor={economyColor}
            mutedColor={mutedColor}
            disabled={!canOpen}
            variant={canOpen ? 'primary' : 'disabled'}
            onPress={onOpen}
          />
          <MarketActionButton
            label="[ SELL ]"
            accentColor={economyColor}
            mutedColor={mutedColor}
            onPress={onSell}
          />
        </>
      )}
    />
  );
}

export default function SafehouseBlackMarketTab(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    account,
    purchaseHubContraband,
    sellFenceResource,
    appendHubLog,
    appraiseSealedCargoInHub,
    openSealedCargoInHub,
    sellSealedCargoInHub,
  } = usePlayerAccount();
  const { hubBlackMarketDiscountPct } = useWorldState();
  const marketDiscount = hubBlackMarketDiscountPct;
  const [selectedListingId, setSelectedListingId] = useState<CargoItemId | null>(null);

  const economyColor = SELECT_ACCENT;
  const { isDesktop, scaleSpacing } = useHubLayout();

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
  const scrollProps = {
    style: [
      styles.listScroll,
      Platform.OS === 'web' && styles.listScrollWeb,
      HIDDEN_SCROLLBAR_VIEW_STYLE,
    ],
    contentContainerStyle: styles.listContent,
    ...HIDDEN_SCROLLVIEW_PROPS,
    nestedScrollEnabled: true,
    keyboardShouldPersistTaps: 'handled' as const,
  };

  return (
    <View style={styles.root}>
      <MarketContentGrid
        stacked={!isDesktop}
        left={(
          <MarketPanel
            label="Buy"
            padding={panelPadding}
            footer={(
              <MarketActionButton
                label="[ BUY ]"
                fullWidth
                accentColor={economyColor}
                mutedColor={theme.mutedColor}
                disabled={!canBuy}
                variant={canBuy ? 'primary' : 'disabled'}
                onPress={handleBuy}
              />
            )}
          >
            <ScrollView {...scrollProps}>
              {BLACK_MARKET_CARGO_LISTINGS.map((listing) => {
                const price = hubContrabandPrice(listing.price, marketDiscount);
                const selected = selectedListingId === listing.id;
                const affordable = account.cabalCredits >= price;
                return (
                  <MarketRow
                    key={listing.id}
                    title={listing.name.toUpperCase()}
                    subtitle={listing.effect}
                    valueLine={`${price} CR`}
                    selected={selected}
                    disabled={!affordable}
                    onPress={() => setSelectedListingId(listing.id)}
                    borderColor={theme.borderColor}
                    textColor={theme.textColor}
                    mutedColor={theme.mutedColor}
                    accentColor={economyColor}
                    imageItemId={listing.id}
                  />
                );
              })}
            </ScrollView>
          </MarketPanel>
        )}
        right={(
          <MarketPanel
            label="Sell"
            padding={panelPadding}
          >
            <ScrollView {...scrollProps}>
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
                    onSell={(qty) => handleSell(entry.resourceId, qty)}
                  />
                ))
              )}
            </ScrollView>
          </MarketPanel>
        )}
      />

      {sealedEntries.length > 0 ? (
        <DossierCardShell
          padding={panelPadding}
          style={[styles.appraisalPanel, { marginTop: scaleSpacing(MARKET_CONTENT_BOTTOM_PAD > 0 ? 16 : 10) }]}
        >
          <TerminalText variant="panelTitle" letterSpacing={0.8} style={[styles.panelTitle, { color: theme.statusColor }]}>
            APPRAISAL // SEALED CARGO
          </TerminalText>
          <TerminalText variant="caption" style={{ color: theme.mutedColor, marginBottom: 8 }}>
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
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  listScrollWeb: {
    flex: 1,
    minHeight: 0,
    height: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: MARKET_CONTENT_BOTTOM_PAD,
  },
  fenceQty: {
    minWidth: 22,
    textAlign: 'center',
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  appraisalPanel: {
    flexShrink: 0,
  },
  panelTitle: {
    fontWeight: '700',
    flexShrink: 0,
    marginBottom: 6,
  },
});
