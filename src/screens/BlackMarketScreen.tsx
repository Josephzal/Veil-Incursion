import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BlackMarketBg from '../../assets/images/location images/black_market.png';
import { BLACK_MARKET_CARGO_LISTINGS, BLACK_MARKET_ITEM_PRICE } from '../data/blackMarket';
import { countCargoItemInstances } from '../data/cargoGridEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';
import SelectionContinueButton from '../components/SelectionContinueButton';
import type { CargoItemId } from '../types/cargoGrid';
import { resolveCargoItemIcon } from '../utils/cargoItemIcon';

const TERMINAL_ACCENT = '#00ff33';
const CELL_SIZE = 84;
const DETAIL_BLOCK_HEIGHT = 110;
const ACTION_DISABLED_BORDER = '#1a2e22';
const ACTION_DISABLED_BG = '#070809';
const ACTION_DISABLED_TEXT = '#2a4032';

export default function BlackMarketScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, activeIncursion, appendRunLog, purchaseBlackMarketCargo } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const [selectedCargoId, setSelectedCargoId] = useState<CargoItemId | null>(null);
  const [leaving, setLeaving] = useState(false);

  const selectedCargoListing = selectedCargoId != null
    ? BLACK_MARKET_CARGO_LISTINGS.find((entry) => entry.id === selectedCargoId) ?? null
    : null;

  const cargoPurchaseEnabled = selectedCargoListing != null
    && activeIncursion.runCredits >= BLACK_MARKET_ITEM_PRICE;

  const ownedQty = selectedCargoId != null
    ? countCargoItemInstances(activeIncursion.cargo, selectedCargoId)
    : 0;

  const handleCargoPurchase = () => {
    if (!selectedCargoId || !cargoPurchaseEnabled) return;
    const result = purchaseBlackMarketCargo(selectedCargoId);
    if (!result) return;
    appendRunLog(result.logLine);
  };

  const handleLeave = () => {
    if (leaving) return;
    setLeaving(true);
    completeCurrentNode('Black market visit concluded.');
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.screenBody}>
          <OperativeTelemetryBar />

          <View style={styles.content}>
            <Image source={BlackMarketBg} style={styles.backgroundImage} resizeMode="cover" />
            <View style={styles.backgroundScrim} pointerEvents="none" />

            <View style={styles.contentForeground}>
              <View style={[styles.docHeader, { borderBottomColor: theme.borderColor }]}>
                <Text style={[styles.docLabel, { color: theme.mutedColor }]}>
                  VEIL UNDERNET // BLACK MARKET NODE
                </Text>
                <Text style={styles.docTitle}>BLACK MARKET</Text>
                <Text style={[styles.creditsLine, { color: TERMINAL_ACCENT }]}>
                  RUN CREDITS: {activeIncursion.runCredits}
                </Text>
              </View>

              <View style={[styles.shopPanel, { borderColor: theme.borderColor }]}>
                <Text style={[styles.shopSubHeader, { color: theme.mutedColor }]}>
                  CARGO CONTRABAND // {BLACK_MARKET_ITEM_PRICE} CR PER UNIT // STAGED TO CONTAINMENT
                </Text>

                <View style={styles.grid}>
                  {BLACK_MARKET_CARGO_LISTINGS.map((listing) => {
                    const isSelected = listing.id === selectedCargoId;
                    const owned = countCargoItemInstances(activeIncursion.cargo, listing.id);
                    return (
                      <Pressable
                        key={listing.id}
                        onPress={() => setSelectedCargoId(listing.id)}
                        style={({ pressed }) => [
                          styles.gridCell,
                          { borderColor: isSelected ? TERMINAL_ACCENT : theme.borderColor },
                          pressed ? { opacity: 0.75 } : null,
                        ]}
                      >
                        <View style={styles.cellImageWrap}>
                          <Image
                            source={resolveCargoItemIcon(listing.id)}
                            style={styles.cellImage}
                            resizeMode="contain"
                          />
                        </View>
                        <Text style={[styles.cellPrice, { color: theme.mutedColor }]}>
                          {listing.price} CR
                        </Text>
                        {owned > 0 ? (
                          <Text style={[styles.cellQty, { color: theme.mutedColor }]}>x{owned}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.detailBlock, { borderColor: theme.borderColor }]}>
                  {selectedCargoListing != null ? (
                    <View style={styles.detailHeader}>
                      <View style={styles.detailImageWrap}>
                        <Image
                          source={resolveCargoItemIcon(selectedCargoListing.id)}
                          style={styles.detailImage}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.detailCopy}>
                        <Text style={[styles.detailTitle, { color: TERMINAL_ACCENT }]} numberOfLines={1}>
                          {selectedCargoListing.name.toUpperCase()}
                        </Text>
                        <Text style={[styles.detailBody, { color: theme.primaryColor }]} numberOfLines={3}>
                          {selectedCargoListing.description}
                        </Text>
                        <Text style={[styles.detailEffect, { color: theme.mutedColor }]} numberOfLines={2}>
                          {selectedCargoListing.effect}
                        </Text>
                        <Text style={[styles.detailEffect, { color: theme.mutedColor }]}>
                          {`OWNED: ${ownedQty} // PRICE: ${selectedCargoListing.price} CR`}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.detailPlaceholder}>
                      <Text style={[styles.detailBody, { color: theme.mutedColor }]}>
                        SELECT A LISTING TO REVIEW CONTRABAND PROFILE.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.actions}>
                  <Pressable
                    disabled={!cargoPurchaseEnabled}
                    onPress={handleCargoPurchase}
                    style={({ pressed }) => [
                      styles.btn,
                      {
                        borderColor: cargoPurchaseEnabled ? TERMINAL_ACCENT : ACTION_DISABLED_BORDER,
                        backgroundColor: cargoPurchaseEnabled ? '#0a0b0f' : ACTION_DISABLED_BG,
                        opacity: cargoPurchaseEnabled && pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.btnText, { color: cargoPurchaseEnabled ? TERMINAL_ACCENT : ACTION_DISABLED_TEXT }]}>
                      [ PURCHASE TO CONTAINMENT ]
                    </Text>
                  </Pressable>
                </View>
              </View>

              <SelectionContinueButton
                enabled={!leaving}
                onPress={handleLeave}
                borderColor={theme.borderColor}
                mutedColor={theme.mutedColor}
                label="[ LEAVE MARKET ]"
              />
            </View>
          </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 8, 0.52)',
  },
  contentForeground: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  docHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 10,
  },
  docLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
    marginBottom: 4,
  },
  docTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: TERMINAL_ACCENT,
    marginBottom: 4,
  },
  creditsLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
  },
  shopPanel: {
    borderWidth: 1,
    backgroundColor: 'rgba(10, 11, 15, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  shopSubHeader: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginBottom: 12,
  },
  gridCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
    backgroundColor: '#0a0b0f',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cellImageWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellPrice: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
  },
  cellQty: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    alignSelf: 'flex-end',
  },
  detailBlock: {
    borderWidth: 1,
    backgroundColor: '#0a0b0f',
    padding: 12,
    marginBottom: 12,
    height: DETAIL_BLOCK_HEIGHT,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  detailImageWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
  },
  detailTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  detailBody: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  detailEffect: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
