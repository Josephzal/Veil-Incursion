import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import VeilTerminalEffects from '../atmosphere/VeilTerminalEffects';
import ForgeWorkspace, { resolveForgeSelection } from './blackMarket/ForgeWorkspace';
import VendorWorkspace, {
  type VendorSelection,
} from './blackMarket/VendorWorkspace';
import SchematicGlyph, {
  resolveSchematicGlyphFamily,
  schematicClassificationCode,
} from './blackMarket/SchematicGlyph';
import SignalRail from './blackMarket/SignalRail';
import BlackMarketMediaStage, {
  type MediaStageFeedbackPhase,
} from './blackMarket/BlackMarketMediaStage';
import FabricationReceipt, {
  type FabricationReceiptRecord,
} from './blackMarket/FabricationReceipt';
import HoldToFabricateButton from './blackMarket/HoldToFabricateButton';
import type { SchematicGlyphFamily } from './blackMarket/SchematicGlyph';
import { VEIL } from '../../theme/veilTerminalTokens';
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
import { isRunItemCraftOutput } from '../../data/runItemCraftingBridge';
import { CARGO_ITEM_CATALOG } from '../../types/cargoGrid';
import {
  formatCreditBalance,
  resolveBlackMarketArtwork,
} from '../../utils/blackMarketArtwork';
import { fabricationAudioHooks } from '../../utils/fabricationFeedbackAudio';
import { pulseFabricationSeal } from '../../utils/hubButtonHaptics';
import {
  formatVendorExchangeCondition,
  resolveInitialVendorSelection,
  resolveVendorSelectionAfterHoldingRemoved,
} from './blackMarket/vendorPresentation';
import type { ForgeSchematicPresentation } from './blackMarket/forgePresentation';

type FabricationFeedbackPhase = MediaStageFeedbackPhase;

interface FabricationFeedbackRecord {
  recipeId: string;
  label: string;
  kind: 'AUGMENT' | 'CONSUMABLE';
  outputId: string;
  classCode: string;
  family: SchematicGlyphFamily;
  occult: boolean;
  outcome: string;
  category: string;
  consumedResourceIds: string[];
}

export type BlackMarketTab = 'FORGE' | 'VENDOR';

const TERMINAL = VEIL.mint;
const TERMINAL_BRIGHT = VEIL.mintBright;
const MISSING = VEIL.blood;
const OCCULT = VEIL.occult;
const META = VEIL.textMuted;
const TEXT_PRIMARY = VEIL.text;

const MODE_ITEMS: Array<{ key: BlackMarketTab; label: string; detail: string; code: string }> = [
  { key: 'FORGE', label: 'FORGE', detail: 'FABRICATION CHANNEL', code: 'FAB-01' },
  { key: 'VENDOR', label: 'VENDOR', detail: 'EXCHANGE CHANNEL', code: 'VND-01' },
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
      <TerminalText size={7} letterSpacing={1.05} style={styles.dossierLabel}>
        {label}
      </TerminalText>
      {children}
    </View>
  );
}

function MarketAtmosphere(): React.JSX.Element {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="bmCircuit" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="14" x2="28" y2="14" stroke="rgba(137,170,163,0.04)" strokeWidth="0.6" />
            <Line x1="14" y1="0" x2="14" y2="28" stroke="rgba(137,170,163,0.03)" strokeWidth="0.6" />
            <Circle cx="14" cy="14" r="1.2" fill="rgba(137,170,163,0.05)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bmCircuit)" opacity={0.22} />
      </Svg>
      <View style={styles.atmVignette} />
      <View style={styles.atmSigil}>
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          <Circle cx="100" cy="100" r="78" stroke="rgba(137,170,163,0.05)" strokeWidth="1" fill="none" />
          <Circle cx="100" cy="100" r="48" stroke="rgba(137,170,163,0.04)" strokeWidth="1" fill="none" />
          <Line x1="100" y1="20" x2="100" y2="180" stroke="rgba(137,170,163,0.035)" strokeWidth="1" />
          <Line x1="20" y1="100" x2="180" y2="100" stroke="rgba(137,170,163,0.035)" strokeWidth="1" />
        </Svg>
      </View>
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
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [vendorSelection, setVendorSelection] = useState<VendorSelection>(null);
  const [sellQty, setSellQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fabPhase, setFabPhase] = useState<FabricationFeedbackPhase>('idle');
  const [fabRecord, setFabRecord] = useState<FabricationFeedbackRecord | null>(null);
  const [fabReceipt, setFabReceipt] = useState<FabricationReceiptRecord | null>(null);
  const vendorInitialized = useRef(false);
  const fabTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const fabLocked = fabPhase !== 'idle' && fabPhase !== 'complete';

  const catalogSweep = useRef(new Animated.Value(0)).current;
  const dossierLock = useRef(new Animated.Value(1)).current;
  const txnPulse = useRef(new Animated.Value(0)).current;
  const dossierScan = useRef(new Animated.Value(0)).current;
  const workspaceDim = useRef(new Animated.Value(0)).current;

  const narrow = screenWidth <= 1500;
  const compact = screenHeight <= 800;
  const dossierWidth = narrow
    ? 410
    : Math.min(470, Math.max(420, Math.floor(screenWidth * 0.26)));

  const forgeSelection = useMemo(
    () => resolveForgeSelection(account, selectedRecipeId),
    [account, selectedRecipeId],
  );

  const fenceEntries = useMemo(
    () => listFenceableStashEntries(account.resourceStash)
      .filter((entry) => !isAppraisableSealedResource(entry.resourceId)),
    [account.resourceStash],
  );
  const sealedEntries = useMemo(
    () => listSealedStashEntries(account.resourceStash, account.sealedCargoStacks ?? []),
    [account.resourceStash, account.sealedCargoStacks],
  );

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
}
@keyframes bm-fab-packet {
  0% { opacity: 0; transform: translate(0, 0); }
  20% { opacity: 0.85; }
  100% { opacity: 0; transform: translate(180px, -40px); }
}
[data-black-market] [data-fab-packet] {
  animation: bm-fab-packet 420ms ease-out infinite;
}
[data-black-market] [data-fab-packet="b"] { animation-delay: 80ms; }
[data-black-market] [data-fab-packet="c"] { animation-delay: 160ms; }
`;
    document.head.appendChild(style);
    return undefined;
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      dossierScan.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(dossierScan, {
        toValue: 1,
        duration: 5600,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      dossierScan.setValue(0);
    };
  }, [dossierScan, reduceMotion]);

  // Initialize Vendor selection when entering the channel.
  useEffect(() => {
    if (activeMode !== 'VENDOR') {
      vendorInitialized.current = false;
      return;
    }
    if (vendorInitialized.current) return;
    vendorInitialized.current = true;
    setVendorSelection(resolveInitialVendorSelection(account, hubBlackMarketDiscountPct));
    setSellQty(1);
  }, [activeMode, account, hubBlackMarketDiscountPct]);

  // Clamp sell quantity / recover selection when holdings change.
  useEffect(() => {
    if (activeMode !== 'VENDOR') return;
    if (!vendorSelection || vendorSelection.source !== 'holding') return;

    if (vendorSelection.kind === 'RESOURCE') {
      const entry = fenceEntries.find((e) => e.resourceId === vendorSelection.resourceId);
      if (!entry) {
        setVendorSelection(
          resolveVendorSelectionAfterHoldingRemoved(
            account,
            hubBlackMarketDiscountPct,
            vendorSelection,
          ),
        );
        setSellQty(1);
        return;
      }
      setSellQty((prev) => Math.min(Math.max(1, prev), entry.quantity));
      return;
    }

    const sealed = sealedEntries.find((e) => e.stackId === vendorSelection.stackId);
    if (!sealed) {
      setVendorSelection(
        resolveVendorSelectionAfterHoldingRemoved(
          account,
          hubBlackMarketDiscountPct,
          vendorSelection,
        ),
      );
      setSellQty(1);
    }
  }, [
    activeMode,
    account,
    fenceEntries,
    hubBlackMarketDiscountPct,
    sealedEntries,
    vendorSelection,
  ]);

  const playSweep = () => {
    if (reduceMotion) return;
    catalogSweep.setValue(0);
    Animated.timing(catalogSweep, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start(() => catalogSweep.setValue(0));
  };

  const playDossierLock = () => {
    if (reduceMotion) {
      dossierLock.setValue(1);
      return;
    }
    dossierLock.setValue(0.88);
    Animated.timing(dossierLock, {
      toValue: 1,
      duration: 140,
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

  const clearFabTimers = () => {
    fabTimers.current.forEach((id) => clearTimeout(id));
    fabTimers.current = [];
  };

  const resetFabricationFeedback = React.useCallback(() => {
    clearFabTimers();
    setFabPhase('idle');
    setFabRecord(null);
    setFabReceipt(null);
    workspaceDim.setValue(0);
  }, [workspaceDim]);

  useEffect(() => () => {
    clearFabTimers();
  }, []);

  useEffect(() => {
    if (activeMode !== 'FORGE') {
      resetFabricationFeedback();
    }
  }, [activeMode, resetFabricationFeedback]);

  const showFeedback = (line: string) => {
    setFeedback(line);
    playTxnPulse();
    appendHubLog(line.startsWith('>>') ? line : `>> ${line}`);
  };

  const handleModeChange = (mode: BlackMarketTab) => {
    if (mode === activeMode) return;
    setActiveMode(mode);
    if (mode === 'VENDOR') {
      vendorInitialized.current = false;
      resetFabricationFeedback();
    }
    playSweep();
    playDossierLock();
  };

  const handleSelectRecipe = (recipeId: string) => {
    if (fabLocked) return;
    setSelectedRecipeId(recipeId);
    playDossierLock();
  };

  const handleVendorSelect = (next: VendorSelection) => {
    setVendorSelection(next);
    setSellQty(1);
    setFeedback(null);
    playDossierLock();
  };

  const dismissFabReceipt = React.useCallback(() => {
    setFabReceipt(null);
    setFabPhase('idle');
    setFabRecord(null);
    if (!reduceMotion) {
      Animated.timing(workspaceDim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      workspaceDim.setValue(0);
    }
  }, [reduceMotion, workspaceDim]);

  const handleFabricate = () => {
    if (!forgeSelection?.canFabricate || fabLocked) return;
    const entry = forgeSelection;
    const result = craftRecipe(entry.recipe.id);
    if (!result.success) {
      showFeedback(result.logLine);
      return;
    }

    const sealed = entry.status === 'rumored' || entry.status === 'sealed';
    const family = isRunItemCraftOutput(entry.recipe.outputId) && entry.recipe.kind !== 'AUGMENT'
      ? 'run' as const
      : resolveSchematicGlyphFamily(entry.recipe.id, entry.recipe.kind, sealed);
    const classCode = schematicClassificationCode(entry.recipe.id);
    const category = entry.recipe.kind === 'AUGMENT'
      ? 'PERMANENT AUGMENT'
      : isRunItemCraftOutput(entry.recipe.outputId)
        ? 'RUN ITEM PROTOCOL'
        : 'FABRICATION RECORD';
    const outcome = entry.recipe.kind === 'AUGMENT'
      ? 'AUGMENT REGISTERED'
      : 'ADDED TO HUB STAGING';
    const classification = entry.recipe.kind === 'AUGMENT'
      ? undefined
      : isRunItemCraftOutput(entry.recipe.outputId)
        ? 'RUN ITEM'
        : 'TACTICAL CONSUMABLE';
    const artwork = resolveBlackMarketArtwork({
      recordType: entry.recipe.kind === 'AUGMENT' ? 'AUGMENT' : 'CARGO',
      recordId: entry.recipe.outputId,
    });
    const snapshot: FabricationFeedbackRecord = {
      recipeId: entry.recipe.id,
      label: entry.recipe.label,
      kind: entry.recipe.kind,
      outputId: entry.recipe.outputId,
      classCode,
      family,
      occult: sealed,
      outcome,
      category,
      consumedResourceIds: entry.requirements
        .filter((req) => !req.concealed)
        .map((req) => req.resourceId),
    };
    const buildReceipt = (): FabricationReceiptRecord => ({
      receiptId: `fab-${entry.recipe.id}-${Date.now()}`,
      fabricatedRecordId: entry.recipe.id,
      itemId: entry.recipe.outputId,
      label: snapshot.label,
      outcome: snapshot.outcome,
      classCode: snapshot.classCode,
      category: snapshot.category,
      classification,
      quantity: entry.recipe.kind === 'AUGMENT' ? undefined : 1,
      artwork: artwork?.source ?? null,
      glyphFamily: snapshot.family,
      occult: sealed,
    });

    clearFabTimers();
    setFabRecord(snapshot);
    setFabReceipt(null);
    setFeedback(null);
    appendHubLog(result.logLine);
    fabricationAudioHooks.play('fabrication_accept');

    const schedule = (ms: number, fn: () => void) => {
      fabTimers.current.push(setTimeout(fn, ms));
    };

    if (reduceMotion) {
      setFabPhase('complete');
      fabricationAudioHooks.play('fabrication_complete');
      setFabReceipt(buildReceipt());
      return;
    }

    setFabPhase('accepted');
    Animated.timing(workspaceDim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();

    schedule(180, () => {
      setFabPhase('converging');
      fabricationAudioHooks.play('fabrication_converge');
    });
    schedule(520, () => {
      setFabPhase('assembling');
    });
    schedule(950, () => {
      setFabPhase('sealing');
      fabricationAudioHooks.play('fabrication_seal');
      pulseFabricationSeal();
    });
    schedule(1080, () => {
      setFabPhase('complete');
      fabricationAudioHooks.play('fabrication_complete');
      setFabReceipt(buildReceipt());
      playTxnPulse();
    });
    schedule(1400, () => {
      Animated.timing(workspaceDim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleBuy = () => {
    if (vendorSelection?.source !== 'offer') return;
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
    // Offers remain listed; keep the purchased offer selected.
  };

  const handleSellResource = () => {
    if (vendorSelection?.source !== 'holding' || vendorSelection.kind !== 'RESOURCE') return;
    const entry = fenceEntries.find((e) => e.resourceId === vendorSelection.resourceId);
    if (!entry) return;
    const qty = Math.min(sellQty, entry.quantity);
    const result = sellFenceResource(entry.resourceId, qty);
    const proceeds = entry.sellValue * qty;
    showFeedback(
      `EXCHANGE COMPLETE — ${qty} ${getResourceShortName(entry.resourceId).toUpperCase()} TRANSFERRED · +${proceeds} CR`,
    );
    if (entry.quantity - qty <= 0) {
      // Stash updates asynchronously — holdings effect advances selection when the unit is gone.
      setSellQty(1);
    }
    if (result.logLine && !result.logLine.includes('EXCHANGE COMPLETE')) {
      appendHubLog(result.logLine);
    }
  };

  const renderForgeDossier = (entry: ForgeSchematicPresentation) => {
    const displayEntry = fabRecord && fabPhase !== 'idle'
      ? {
          label: fabRecord.label,
          category: fabRecord.category,
          classCode: fabRecord.classCode,
          family: fabRecord.family,
          occult: fabRecord.occult,
          outputId: fabRecord.outputId,
          kind: fabRecord.kind,
        }
      : null;
    const artwork = resolveBlackMarketArtwork({
      recordType: (displayEntry?.kind ?? entry.recipe.kind) === 'AUGMENT' ? 'AUGMENT' : 'CARGO',
      recordId: displayEntry?.outputId ?? entry.recipe.outputId,
    });
    const sealed = displayEntry?.occult
      ?? (entry.status === 'rumored' || entry.status === 'sealed');
    const family = displayEntry?.family
      ?? (isRunItemCraftOutput(entry.recipe.outputId) && entry.recipe.kind !== 'AUGMENT'
        ? 'run' as const
        : resolveSchematicGlyphFamily(entry.recipe.id, entry.recipe.kind, sealed));
    const classCode = displayEntry?.classCode ?? schematicClassificationCode(entry.recipe.id);
    const category = displayEntry?.category ?? (
      entry.recipe.kind === 'AUGMENT'
        ? 'PERMANENT AUGMENT'
        : isRunItemCraftOutput(entry.recipe.outputId)
          ? 'RUN ITEM PROTOCOL'
          : 'FABRICATION RECORD'
    );
    const protocol = sealed
      ? `SEALED PROTOCOL // ${classCode}`
      : `RECON PROTOCOL // ${classCode}`;
    const statusLabel = fabPhase === 'accepted' || fabPhase === 'converging'
      ? 'SCHEMATIC ACCEPTED'
      : fabPhase === 'assembling' || fabPhase === 'sealing'
        ? 'BINDING RECORD…'
        : fabPhase === 'complete' && fabRecord
          ? 'FABRICATION COMPLETE'
          : entry.stateLabel;
    const convergingIds = fabPhase === 'converging' || fabPhase === 'assembling'
      ? (fabRecord?.consumedResourceIds ?? [])
      : [];

    return (
      <>
        <View style={styles.dossierHeader}>
          <View style={styles.dossierAccent} />
          <BlackMarketMediaStage
            source={artwork?.source}
            classification={classCode}
            compact={compact}
            showUnavailable={false}
            feedbackPhase={fabPhase}
            reducedMotion={reduceMotion}
            occult={sealed}
          >
            {!artwork ? (
              <View style={[styles.dossierVizInner, sealed && styles.dossierVizSealed]}>
                <SchematicGlyph
                  family={family}
                  size={compact ? 118 : 138}
                  sealed={sealed}
                  animate={!reduceMotion && fabPhase === 'idle'}
                />
                {sealed ? <View pointerEvents="none" style={styles.dossierUvWash} /> : null}
                {!reduceMotion && fabPhase === 'idle' ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.dossierScanline,
                      {
                        opacity: dossierScan.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.08, 0.28, 0.08],
                        }),
                        transform: [{
                          translateY: dossierScan.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, compact ? 100 : 120],
                          }),
                        }],
                      },
                    ]}
                  />
                ) : null}
              </View>
            ) : null}
          </BlackMarketMediaStage>

          <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
            {category}
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.85} style={[styles.dossierCategory, sealed && { color: OCCULT }]}>
            {protocol}
          </TerminalText>
          <TerminalText size={20} letterSpacing={0.2} style={styles.dossierTitle}>
            {(displayEntry?.label ?? entry.recipe.label).toUpperCase()}
          </TerminalText>
          <TerminalText size={8.5} style={styles.dossierLead}>
            {entry.effectLine}
          </TerminalText>
          <TerminalText
            size={7}
            letterSpacing={0.9}
            style={[
              styles.dossierStatus,
              (fabPhase !== 'idle' || entry.status === 'fabricable') && { color: TERMINAL_BRIGHT },
              fabPhase === 'idle' && entry.status === 'missing' && { color: MISSING },
              fabPhase === 'idle' && sealed && { color: OCCULT },
            ]}
          >
            {statusLabel}
          </TerminalText>
          {fabPhase === 'complete' && fabRecord ? (
            <TerminalText size={7} letterSpacing={0.8} style={styles.fabOutcome}>
              {fabRecord.outcome}
            </TerminalText>
          ) : null}
        </View>

        <ScrollView style={styles.dossierBody} contentContainerStyle={{ paddingBottom: 8 }}>
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
                      convergingIds.includes(req.resourceId) && styles.requirementConverging,
                    ]}
                  >
                    <View
                      style={[
                        styles.requirementMarker,
                        { backgroundColor: req.ready ? TERMINAL : MISSING },
                      ]}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TerminalText size={8} style={styles.requirementName} numberOfLines={1}>
                        {req.displayName}
                      </TerminalText>
                      <TerminalText size={7.5} style={styles.requirementCount}>
                        {req.concealed
                          ? 'Recover additional sector intelligence.'
                          : `${req.held} / ${req.required}`}
                      </TerminalText>
                    </View>
                    <TerminalText
                      size={6.5}
                      letterSpacing={0.8}
                      style={{
                        color: req.concealed ? OCCULT : req.ready ? TERMINAL : MISSING,
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
                <DossierSection label="STATUS" last>
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
          {fabPhase !== 'idle' && fabRecord ? (
            <>
              <TerminalText size={7} letterSpacing={0.9} style={[styles.footerHint, { color: TERMINAL }]}>
                {fabPhase === 'complete' ? 'FABRICATION COMPLETE' : fabPhase === 'sealing' || fabPhase === 'assembling'
                  ? 'BINDING IN PROGRESS'
                  : 'SCHEMATIC ACCEPTED'}
              </TerminalText>
              <View style={[styles.actionButton, fabPhase === 'complete' ? styles.actionDisabled : styles.actionPrimary]}>
                <TerminalText
                  size={8}
                  letterSpacing={1}
                  style={fabPhase === 'complete' ? styles.actionDisabledText : styles.actionPrimaryText}
                >
                  {fabPhase === 'complete'
                    ? `[ ${fabRecord.outcome} ]`
                    : '[ FABRICATION IN PROGRESS ]'}
                </TerminalText>
              </View>
            </>
          ) : entry.alreadyOwned ? (
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
                MATERIALS VERIFIED · HOLD 1S TO BIND
              </TerminalText>
              <HoldToFabricateButton
                onComplete={handleFabricate}
                disabled={fabLocked}
              />
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
      return renderEmptyDossier(
        'EXCHANGE DOSSIER',
        'No procurement or liquidation records are currently available.',
        '[ AWAITING RECORD ]',
      );
    }

    if (vendorSelection.source === 'offer') {
      const listing = BLACK_MARKET_CARGO_LISTINGS.find((e) => e.id === vendorSelection.listingId);
      if (!listing) return renderEmptyDossier('PROCUREMENT DOSSIER', 'Offer no longer available.');
      const price = hubContrabandPrice(listing.price, hubBlackMarketDiscountPct);
      const affordable = account.cabalCredits >= price;
      const catalog = CARGO_ITEM_CATALOG[listing.id];
      const artwork = resolveBlackMarketArtwork({ recordType: 'CARGO', recordId: listing.id });
      const classCode = schematicClassificationCode(listing.id);
      return (
        <>
          <View style={styles.dossierHeader}>
            <View style={styles.dossierAccent} />
            <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
              PROCUREMENT DOSSIER
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.85} style={styles.dossierCategory}>
              {`RECOVERED FIELD ASSET // ${classCode}`}
            </TerminalText>
            <BlackMarketMediaStage
              source={artwork?.source}
              classification={classCode}
              compact={compact}
              showUnavailable={!artwork}
            />
            <TerminalText size={18} letterSpacing={0.2} style={styles.dossierTitle}>
              {listing.name.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.7} style={styles.dossierLead}>
              Contraband cargo
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
            <DossierSection label="QUANTITY">
              <TerminalText size={8.5} style={styles.dossierValue}>
                1
              </TerminalText>
            </DossierSection>
            <DossierSection label="CARGO FOOTPRINT">
              <TerminalText size={8.5} style={styles.dossierValue}>
                {catalog ? `${catalog.width}×${catalog.height}` : '1×1'}
              </TerminalText>
            </DossierSection>
            <DossierSection label="UNIT PRICE" last>
              <TerminalText size={13} style={styles.pricePrimary}>
                {`${price} CR`}
              </TerminalText>
              <TerminalText size={7.5} style={styles.dossierSecondary}>
                {`${formatCreditBalance(account.cabalCredits)} CR AVAILABLE`}
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

    if (vendorSelection.source === 'holding' && vendorSelection.kind === 'RESOURCE') {
      const entry = fenceEntries.find((e) => e.resourceId === vendorSelection.resourceId);
      if (!entry) return renderEmptyDossier('LIQUIDATION DOSSIER', 'Holding no longer available.');
      const exchange = formatVendorExchangeCondition(entry.resourceId);
      const artwork = resolveBlackMarketArtwork({
        recordType: 'RESOURCE',
        recordId: entry.resourceId,
      });
      const classCode = schematicClassificationCode(entry.resourceId);
      const qty = Math.min(sellQty, entry.quantity);
      const proceeds = entry.sellValue * qty;
      return (
        <>
          <View style={styles.dossierHeader}>
            <View style={[styles.dossierAccent, styles.dossierAccentHolding]} />
            <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
              LIQUIDATION DOSSIER
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.85} style={styles.dossierCategory}>
              {`RECOVERED HOLDING // ${classCode}`}
            </TerminalText>
            <BlackMarketMediaStage
              source={artwork?.source}
              classification={classCode}
              compact={compact}
              showUnavailable={!artwork}
            />
            <TerminalText size={18} letterSpacing={0.2} style={styles.dossierTitle}>
              {getResourceDisplayName(entry.resourceId, true).toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.7} style={styles.dossierLead}>
              {exchange.categoryLabel}
            </TerminalText>
            <TerminalText size={7} letterSpacing={0.9} style={styles.dossierStatus}>
              {`${entry.quantity} HELD`}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody}>
            <DossierSection label="CATEGORY">
              <TerminalText size={8.5} style={styles.dossierValue}>
                {exchange.categoryLabel}
              </TerminalText>
            </DossierSection>
            <DossierSection label="UNIT VALUE">
              <TerminalText size={13} style={styles.pricePrimary}>
                {`${entry.sellValue} CR`}
              </TerminalText>
            </DossierSection>
            <DossierSection label="MARKET RATE">
              <TerminalText size={8.5} style={styles.dossierValue}>
                {exchange.rateLabel}
              </TerminalText>
            </DossierSection>
            <DossierSection label="HELD" last>
              <TerminalText size={8.5} style={styles.dossierValue}>
                {`${entry.quantity}`}
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

    // Sealed cargo holding
    if (vendorSelection.source !== 'holding' || vendorSelection.kind !== 'SEALED') {
      return renderEmptyDossier(
        'EXCHANGE DOSSIER',
        'No procurement or liquidation records are currently available.',
        '[ AWAITING RECORD ]',
      );
    }
    const sealed = sealedEntries.find((e) => e.stackId === vendorSelection.stackId);
    if (!sealed) return renderEmptyDossier('LIQUIDATION DOSSIER', 'Sealed cargo no longer available.');
    const config = getSealedCargoConfig(sealed.resourceId) ?? SEALED_CASKET_CONFIG;
    const openingFee = resolveOpeningFee(sealed.state === 'APPRAISED', sealed.resourceId);
    const canAppraise = sealed.state === 'SEALED' && account.cabalCredits >= config.appraisalFee;
    const canOpen = account.cabalCredits >= openingFee;
    const artwork = resolveBlackMarketArtwork({
      recordType: 'SEALED',
      recordId: sealed.resourceId,
    });
    const classCode = schematicClassificationCode(sealed.resourceId);

    return (
      <>
        <View style={styles.dossierHeader}>
          <View style={[styles.dossierAccent, styles.dossierAccentHolding]} />
          <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
            LIQUIDATION DOSSIER
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.85} style={styles.dossierCategory}>
            {`SEALED CARGO // ${classCode}`}
          </TerminalText>
          <BlackMarketMediaStage
            source={artwork?.source}
            classification={classCode}
            compact={compact}
            showUnavailable={!artwork}
          />
          <TerminalText size={18} letterSpacing={0.2} style={styles.dossierTitle}>
            {getResourceShortName(sealed.resourceId).toUpperCase()}
          </TerminalText>
          <TerminalText size={7} letterSpacing={0.9} style={[styles.dossierStatus, { color: OCCULT }]}>
            {sealed.state === 'APPRAISED' ? 'APPRAISED' : 'SEALED'}
          </TerminalText>
        </View>
        <ScrollView style={styles.dossierBody}>
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
              // Holdings effect advances selection once the stack leaves the stash.
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

  const renderEmptyDossier = (
    eyebrow: string,
    body: string,
    actionLabel = '[ SELECT A RECORD ]',
  ) => (
    <>
      <View style={[styles.dossierHeader, styles.dossierHeaderEmpty]}>
        <View style={styles.dossierAccent} />
        <BlackMarketMediaStage compact={compact}>
          <SchematicGlyph family="generic" size={compact ? 100 : 118} animate={!reduceMotion} />
        </BlackMarketMediaStage>
        <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
          {eyebrow}
        </TerminalText>
        <TerminalText size={7.5} letterSpacing={0.85} style={styles.dossierCategory}>
          NO RECORD SELECTED
        </TerminalText>
        <TerminalText size={18} letterSpacing={0.2} style={styles.dossierTitle}>
          AWAITING SIGNAL
        </TerminalText>
        <TerminalText size={8.5} style={styles.dossierLead}>
          {body}
        </TerminalText>
      </View>
      <View style={styles.dossierBody} />
      <View style={styles.dossierFooter}>
        <View style={[styles.actionButton, styles.actionDisabled]}>
          <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
            {actionLabel}
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
      <MarketAtmosphere />
      <VeilTerminalEffects intensity="subtle" scanlineOpacity={0.045} />

      <View style={styles.workspace}>
        {!reduceMotion && fabPhase !== 'idle' ? (
          <Animated.View
            pointerEvents="none"
            accessible={false}
            {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
            style={[
              styles.workspaceDim,
              {
                opacity: workspaceDim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.22],
                }),
              },
            ]}
          />
        ) : null}
        {!reduceMotion && (fabPhase === 'converging' || fabPhase === 'assembling') ? (
          <View
            pointerEvents="none"
            accessible={false}
            {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
            style={styles.convergePackets}
          >
            <View
              style={[styles.packet, styles.packetA]}
              {...(Platform.OS === 'web' ? ({ 'data-fab-packet': 'a' } as object) : null)}
            />
            <View
              style={[styles.packet, styles.packetB]}
              {...(Platform.OS === 'web' ? ({ 'data-fab-packet': 'b' } as object) : null)}
            />
            <View
              style={[styles.packet, styles.packetC]}
              {...(Platform.OS === 'web' ? ({ 'data-fab-packet': 'c' } as object) : null)}
            />
          </View>
        ) : null}
        <View style={[styles.localHeader, compact && styles.localHeaderCompact]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TerminalText size={7} letterSpacing={1.05} style={styles.headerEyebrow}>
              RESTRICTED EXCHANGE // BM-01
            </TerminalText>
            <TerminalText size={18} letterSpacing={0.3} style={styles.localTitle}>
              BLACK MARKET
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={1.05} style={styles.breadcrumb}>
              {activeMode === 'FORGE'
                ? 'UNLICENSED FABRICATION CHANNEL'
                : 'UNLICENSED PROCUREMENT CHANNEL'}
            </TerminalText>
          </View>
          <View style={styles.creditBalance}>
            <TerminalText size={6.5} letterSpacing={1} style={styles.creditLabel}>
              CREDIT BALANCE
            </TerminalText>
            <View style={styles.creditValueRow}>
              <TerminalText size={13} letterSpacing={0.25} style={styles.balanceCredits}>
                {formatCreditBalance(account.cabalCredits)}
              </TerminalText>
              <TerminalText size={9} letterSpacing={0.7} style={styles.creditSuffix}>
                {' CR'}
              </TerminalText>
            </View>
          </View>
        </View>

        <SignalRail
          label={activeMode === 'FORGE' ? 'FORGE CHANNEL' : 'VENDOR CHANNEL'}
          code={activeMode === 'FORGE' ? 'FAB-01' : 'VND-01'}
          active
          compact={compact}
        />

        <View
          style={[styles.modes, compact && styles.modesCompact]}
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
                  compact && styles.modeCompact,
                  selected && styles.modeSelected,
                  pressed && { opacity: 0.9 },
                ])}
              >
                <TerminalText
                  size={9}
                  letterSpacing={1.05}
                  style={{ color: selected ? '#eef4f1' : '#7f928c', fontWeight: '800' }}
                >
                  {mode.label}
                </TerminalText>
                <TerminalText size={6.5} letterSpacing={0.8} style={{ marginTop: 4, color: META }}>
                  {mode.detail}
                </TerminalText>
                <TerminalText size={6} letterSpacing={0.7} style={styles.modeCode}>
                  {mode.code}
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
              pulseResourceIds={
                fabPhase === 'converging' || fabPhase === 'assembling'
                  ? (fabRecord?.consumedResourceIds ?? [])
                  : []
              }
            />
          ) : (
            <VendorWorkspace
              account={account}
              marketDiscount={hubBlackMarketDiscountPct}
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
          activeMode === 'VENDOR' && styles.dossierVendor,
          { width: dossierWidth, maxWidth: dossierWidth, opacity: dossierLock },
        ]}
      >
        {activeMode === 'FORGE'
          ? (forgeSelection
            ? renderForgeDossier(forgeSelection)
            : renderEmptyDossier('FORGE DOSSIER', 'Select an augment from the schematic feed.'))
          : renderVendorDossier()}
      </Animated.View>

      {activeMode === 'FORGE' && fabReceipt ? (
        <FabricationReceipt
          key={fabReceipt.receiptId}
          record={fabReceipt}
          onDismiss={dismissFabReceipt}
          reducedMotion={reduceMotion}
        />
      ) : null}
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
  atmVignette: {
    ...StyleSheet.absoluteFill,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, rgba(0,0,0,0.55), transparent 18%, transparent 82%, rgba(0,0,0,0.55)), linear-gradient(180deg, rgba(0,0,0,0.35), transparent 22%, transparent 78%, rgba(0,0,0,0.5))',
      } as object,
      default: {},
    }),
  },
  atmSigil: {
    position: 'absolute',
    right: '2%',
    top: '18%',
    width: '34%',
    aspectRatio: 1,
    opacity: 0.55,
  },
  workspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(137, 190, 179, 0.16)',
    zIndex: 1,
    position: 'relative',
  },
  localHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    minHeight: 72,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
    flexShrink: 0,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(180deg, rgba(4, 12, 11, 0.92), rgba(2, 6, 6, 0))',
      } as object,
      default: {
        backgroundColor: 'rgba(3, 8, 8, 0.72)',
      },
    }),
  },
  localHeaderCompact: {
    minHeight: 58,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerEyebrow: {
    color: META,
    fontWeight: '700',
    marginBottom: 4,
  },
  breadcrumb: {
    marginTop: 5,
    color: META,
    fontWeight: '700',
  },
  localTitle: {
    color: '#eef4f1',
    fontWeight: '700',
  },
  creditBalance: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  creditLabel: {
    color: TERMINAL,
    fontWeight: '700',
  },
  creditValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 3,
  },
  balanceCredits: {
    color: '#f2f7f5',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  creditSuffix: {
    color: TERMINAL,
    fontWeight: '700',
  },
  modes: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingBottom: 2,
    flexShrink: 0,
    gap: 8,
  },
  modesCompact: {
    minHeight: 50,
  },
  mode: {
    position: 'relative',
    minWidth: 190,
    maxWidth: 240,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 12,
    backgroundColor: 'rgba(5, 12, 11, 0.4)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        outlineStyle: 'none',
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
      } as object,
      default: {},
    }),
  },
  modeCompact: {
    minWidth: 160,
    paddingTop: 8,
    paddingBottom: 9,
  },
  modeSelected: {
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(135deg, rgba(105, 200, 173, 0.08), rgba(105, 200, 173, 0.015))',
      } as object,
      default: {
        backgroundColor: 'rgba(105, 200, 173, 0.06)',
      },
    }),
  },
  modeCode: {
    marginTop: 3,
    color: '#5f746f',
    fontWeight: '700',
  },
  workspaceDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 2,
  },
  convergePackets: {
    position: 'absolute',
    left: '28%',
    top: '48%',
    width: 220,
    height: 80,
    zIndex: 3,
  },
  packet: {
    position: 'absolute',
    width: 5,
    height: 5,
    backgroundColor: 'rgba(105, 200, 173, 0.75)',
  },
  packetA: { left: 0, top: 20 },
  packetB: { left: 18, top: 40 },
  packetC: { left: 8, top: 58 },
  modeUnderline: {
    position: 'absolute',
    left: 16,
    right: 15,
    bottom: 0,
    height: 2,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, #62CDB5 0 68%, transparent 68% 73%, rgba(98, 205, 181, 0.35) 73% 100%)',
      } as object,
      default: {
        backgroundColor: TERMINAL,
      },
    }),
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
    flexShrink: 0,
    zIndex: 1,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, #07110f 0%, #030707 48%, #020606 100%)',
      } as object,
      default: {
        backgroundColor: '#040a09',
      },
    }),
  },
  dossierHeader: {
    position: 'relative',
    paddingTop: 18,
    paddingBottom: 16,
    paddingLeft: 28,
    paddingRight: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.12)',
    flexShrink: 0,
  },
  dossierHeaderEmpty: {
    paddingBottom: 12,
  },
  dossierAccent: {
    position: 'absolute',
    top: 18,
    bottom: 16,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
    ...Platform.select({
      web: {
        boxShadow: '0 0 14px rgba(117, 212, 179, 0.28)',
      } as object,
      default: {},
    }),
  },
  dossierAccentHolding: {
    backgroundColor: '#8aa4b0',
    ...Platform.select({
      web: {
        boxShadow: '0 0 14px rgba(138, 164, 176, 0.22)',
      } as object,
      default: {},
    }),
  },
  dossierVendor: {},
  dossierVizInner: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    width: '100%',
  },
  dossierVizSealed: {
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(circle at 50% 45%, rgba(153, 136, 179, 0.1), transparent 68%)',
      } as object,
      default: {
        backgroundColor: 'rgba(153, 136, 179, 0.05)',
      },
    }),
  },
  dossierUvWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(153, 136, 179, 0.05)',
  },
  dossierScanline: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(117, 212, 179, 0.35)',
  },
  dossierEyebrow: {
    color: META,
    fontWeight: '700',
  },
  dossierCategory: {
    marginTop: 7,
    color: TERMINAL,
    fontWeight: '700',
  },
  dossierTitle: {
    marginTop: 8,
    color: '#f3f8f5',
    fontWeight: '700',
  },
  dossierLead: {
    marginTop: 10,
    color: TEXT_PRIMARY,
    lineHeight: 20,
    letterSpacing: 0,
  },
  dossierStatus: {
    marginTop: 10,
    color: META,
    fontWeight: '700',
  },
  fabOutcome: {
    marginTop: 6,
    color: TERMINAL,
    fontWeight: '700',
  },
  dossierBody: {
    flex: 1,
    minHeight: 0,
    paddingTop: 18,
    paddingBottom: 22,
    paddingLeft: 28,
    paddingRight: 24,
  },
  dossierSection: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  dossierSectionLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  dossierLabel: {
    color: META,
    fontWeight: '700',
  },
  dossierValue: {
    marginTop: 6,
    color: TEXT_PRIMARY,
    lineHeight: 20,
    letterSpacing: 0,
  },
  dossierSecondary: {
    marginTop: 4,
    color: '#8a9b96',
    lineHeight: 18,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.09)',
  },
  requirementMissing: {},
  requirementConverging: {
    backgroundColor: 'rgba(105, 200, 173, 0.08)',
  },
  requirementMarker: {
    width: 2,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  requirementName: {
    color: '#e4ece8',
    fontWeight: '700',
  },
  requirementCount: {
    marginTop: 3,
    color: META,
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
