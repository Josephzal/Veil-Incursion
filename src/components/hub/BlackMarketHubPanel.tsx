import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import HubPrimaryCta from './HubPrimaryCta';
import HubPageHeader from './HubPageHeader';
import HubDossierCornerBrackets from './HubDossierCornerBrackets';
import ForgeWorkspace, {
  resolveForgeSelection,
  resolveInitialForgeRecipeId,
} from './blackMarket/ForgeWorkspace';
import VendorWorkspace, {
  type VendorSelection,
} from './blackMarket/VendorWorkspace';
import SchematicGlyph, {
  resolveSchematicGlyphFamily,
  schematicClassificationCode,
} from './blackMarket/SchematicGlyph';
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
  isVendorSelectionValid,
  resolveInitialVendorSelection,
  resolveVendorSelectionAfterHoldingRemoved,
} from './blackMarket/vendorPresentation';
import type { ForgeSchematicPresentation } from './blackMarket/forgePresentation';
import { OccultNeonRail } from './veilChrome';
import {
  HUB_CARD_BORDER,
  HUB_CARD_BORDER_SELECTED,
  HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
  HUB_CHANNEL_BUTTON_COMPACT_PADDING_V,
  HUB_CHANNEL_BUTTON_HEIGHT,
  HUB_CHANNEL_BUTTON_PADDING_V,
  HUB_CHANNEL_RAIL_INSET,
  HUB_BROWSER_CONTENT_PADDING_H,
  HUB_DOSSIER_EDGE_PAD,
  HUB_DOSSIER_FOOTER_BG,
  HUB_DOSSIER_FOOTER_RULE,
  HUB_DOSSIER_LABEL,
  HUB_META,
  HUB_SELECT_SURFACE,
  hubDossierColumnStyle,
  hubDossierShellStyle,
  hubInspectorColumnWidth,
  hubInspectorFocusBarStyle,
  hubPrimaryActionHoverStyle,
  hubPrimaryActionStyle,
  hubPrimaryActionTextHoverStyle,
  hubPrimaryActionTextStyle,
} from '../../theme/hubPanelSurfaces';

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
const META = HUB_META;
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
  const fabTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const fabLocked = fabPhase !== 'idle' && fabPhase !== 'complete';

  const catalogSweep = useRef(new Animated.Value(0)).current;
  const dossierLock = useRef(new Animated.Value(1)).current;
  const txnPulse = useRef(new Animated.Value(0)).current;
  const dossierScan = useRef(new Animated.Value(0)).current;
  const workspaceDim = useRef(new Animated.Value(0)).current;

  const narrow = screenWidth <= 1500;
  const compact = screenHeight <= 800;
  // Standard inspector width — shared with Contract Board / Loadout.
  const inspectorColumnWidth = hubInspectorColumnWidth(screenWidth, 'standard');

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

  // Default / restore Forge selection without overwriting a still-valid choice.
  useEffect(() => {
    if (activeMode !== 'FORGE') return;
    if (selectedRecipeId && resolveForgeSelection(account, selectedRecipeId)) return;
    const next = resolveInitialForgeRecipeId(account);
    if (next) setSelectedRecipeId(next);
  }, [activeMode, account, selectedRecipeId]);

  // Default / restore Vendor selection without overwriting a still-valid choice.
  useEffect(() => {
    if (activeMode !== 'VENDOR') return;
    if (isVendorSelectionValid(account, vendorSelection)) return;
    setVendorSelection(resolveInitialVendorSelection(account, hubBlackMarketDiscountPct));
    setSellQty(1);
  }, [activeMode, account, hubBlackMarketDiscountPct, vendorSelection]);

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
          <OccultNeonRail style={styles.dossierAccent} />
          <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
            SCHEMATIC CONSOLE
          </TerminalText>
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
          <TerminalText size={7.5} letterSpacing={0.85} style={styles.dossierCategory}>
            {protocol}
          </TerminalText>
          <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
            {(displayEntry?.label ?? entry.recipe.label).toUpperCase()}
          </TerminalText>
          <TerminalText size={8.5} lineHeight={14} style={styles.dossierLead}>
            {entry.effectLine}
          </TerminalText>
          <TerminalText
            size={7}
            letterSpacing={0.9}
            style={[
              styles.dossierStatus,
              (fabPhase !== 'idle' || entry.status === 'fabricable') && { color: TERMINAL_BRIGHT },
              fabPhase === 'idle' && entry.status === 'missing' && { color: MISSING },
              fabPhase === 'idle' && entry.status === 'sealed' && { color: MISSING },
              fabPhase === 'idle' && entry.status === 'rumored' && { color: META },
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
                        color: req.concealed ? META : req.ready ? TERMINAL : MISSING,
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
          <View style={styles.dossierFooterRule} />
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
              <TerminalText
                size={7}
                letterSpacing={0.9}
                style={[styles.footerHint, { color: entry.meta.rumoredMinClearance ? MISSING : META }]}
              >
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
        'EXCHANGE CONSOLE',
        'No procurement or liquidation records are currently available.',
        '[ AWAITING RECORD ]',
      );
    }

    if (vendorSelection.source === 'offer') {
      const listing = BLACK_MARKET_CARGO_LISTINGS.find((e) => e.id === vendorSelection.listingId);
      if (!listing) return renderEmptyDossier('PROCUREMENT CONSOLE', 'Offer no longer available.');
      const price = hubContrabandPrice(listing.price, hubBlackMarketDiscountPct);
      const affordable = account.cabalCredits >= price;
      const catalog = CARGO_ITEM_CATALOG[listing.id];
      const artwork = resolveBlackMarketArtwork({ recordType: 'CARGO', recordId: listing.id });
      const classCode = schematicClassificationCode(listing.id);
      return (
        <>
          <View style={styles.dossierHeader}>
          <OccultNeonRail style={styles.dossierAccent} />
          <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
              PROCUREMENT CONSOLE
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
            <View style={styles.dossierFooterRule} />
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
            <HubPrimaryCta
              onPress={handleBuy}
              disabled={!affordable}
              accessibilityLabel={affordable ? `Buy for ${price} credits` : 'Purchase blocked'}
              label={affordable ? `[ BUY FOR ${price} CR ]` : '[ PURCHASE BLOCKED ]'}
              minHeight={52}
            />
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
      if (!entry) return renderEmptyDossier('LIQUIDATION CONSOLE', 'Holding no longer available.');
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
            <OccultNeonRail style={styles.dossierAccent} />
            <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
              LIQUIDATION CONSOLE
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
            <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
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
            <View style={styles.dossierFooterRule} />
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
            <HubPrimaryCta
              onPress={handleSellResource}
              accessibilityLabel={`Sell ${qty} for ${proceeds} credits`}
              label={`[ SELL ${qty} FOR ${proceeds} CR ]`}
              minHeight={52}
            />
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
        'EXCHANGE CONSOLE',
        'No procurement or liquidation records are currently available.',
        '[ AWAITING RECORD ]',
      );
    }
    const sealed = sealedEntries.find((e) => e.stackId === vendorSelection.stackId);
    if (!sealed) return renderEmptyDossier('LIQUIDATION CONSOLE', 'Sealed cargo no longer available.');
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
          <OccultNeonRail style={styles.dossierAccent} />
          <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
            LIQUIDATION CONSOLE
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
          <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
            {getResourceShortName(sealed.resourceId).toUpperCase()}
          </TerminalText>
          <TerminalText size={7} letterSpacing={0.9} style={styles.dossierStatus}>
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
          <View style={styles.dossierFooterRule} />
          {sealed.state === 'SEALED' ? (
            <HubPrimaryCta
              onPress={() => showFeedback(appraiseSealedCargoInHub(sealed.stackId).logLine)}
              disabled={!canAppraise}
              label={`[ APPRAISE −${config.appraisalFee} CR ]`}
              minHeight={52}
              style={{ marginBottom: 8 }}
            />
          ) : null}
          <HubPrimaryCta
            onPress={() => showFeedback(openSealedCargoInHub(sealed.stackId).logLine)}
            disabled={!canOpen}
            label={openingFee > 0 ? `[ OPEN −${openingFee} CR ]` : '[ OPEN ]'}
            minHeight={52}
            style={{ marginBottom: 8 }}
          />
          <HubPrimaryCta
            onPress={() => {
              showFeedback(sellSealedCargoInHub(sealed.stackId).logLine);
              // Holdings effect advances selection once the stack leaves the stash.
            }}
            label={`[ SELL FOR ${sealed.sellValue} CR ]`}
            minHeight={52}
          />
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
        <OccultNeonRail style={styles.dossierAccent} />
        <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
          {eyebrow}
        </TerminalText>
        <TerminalText size={7.5} letterSpacing={0.85} style={styles.dossierCategory}>
          NO RECORD SELECTED
        </TerminalText>
        <View style={styles.emptyMedia}>
          <BlackMarketMediaStage compact={compact}>
            <SchematicGlyph family="generic" size={compact ? 84 : 96} animate={!reduceMotion} />
          </BlackMarketMediaStage>
        </View>
        <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
          AWAITING SIGNAL
        </TerminalText>
        <TerminalText size={8.5} lineHeight={14} style={styles.dossierLead}>
          {body}
        </TerminalText>
      </View>
      <View style={styles.dossierBody} />
      <View style={styles.dossierFooter}>
        <View style={styles.dossierFooterRule} />
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
        <HubPageHeader
          eyebrow="RESTRICTED EXCHANGE // BM-01"
          title="BLACK MARKET"
          compact={compact}
          trailing={(
            <View style={styles.creditBalance}>
              <TerminalText size={6.5} letterSpacing={1} style={styles.creditLabel}>
                CREDIT BALANCE
              </TerminalText>
              <TerminalText size={13} letterSpacing={0.25} style={styles.balanceCredits}>
                {`${formatCreditBalance(account.cabalCredits)} CR`}
              </TerminalText>
            </View>
          )}
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
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                  styles.mode,
                  narrow && styles.modeNarrow,
                  compact && styles.modeCompact,
                  selected && styles.modeSelected,
                  ((hovered || pressed) && !selected) ? styles.modeHover : null,
                  pressed && { opacity: 0.92 },
                ])}
              >
                {selected ? (
                  <OccultNeonRail style={styles.modeNeon} />
                ) : (
                  <View
                    pointerEvents="none"
                    accessible={false}
                    style={styles.modeEdge}
                  />
                )}
                <View style={styles.modeTop}>
                  <TerminalText
                    size={9}
                    letterSpacing={1}
                    style={{ color: selected ? VEIL.text : META, fontWeight: '800', flex: 1 }}
                    numberOfLines={1}
                  >
                    {mode.label}
                  </TerminalText>
                  <TerminalText
                    size={6}
                    letterSpacing={0.7}
                    style={{ color: selected ? TERMINAL : META, fontWeight: '700' }}
                  >
                    {mode.code}
                  </TerminalText>
                </View>
                <TerminalText size={6.5} letterSpacing={0.8} style={styles.modeDetail} numberOfLines={1}>
                  {mode.detail}
                </TerminalText>
              </HapticPressable>
            );
          })}
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

      <View style={[styles.dossierColumn, { width: inspectorColumnWidth, flexGrow: 0, flexBasis: inspectorColumnWidth, maxWidth: inspectorColumnWidth }]}>
        <View style={[styles.dossier, activeMode === 'VENDOR' && styles.dossierVendor]}>
          <HubDossierCornerBrackets />
          <Animated.View style={[styles.dossierFill, { opacity: dossierLock }]}>
            {activeMode === 'FORGE'
              ? (forgeSelection
                ? renderForgeDossier(forgeSelection)
                : renderEmptyDossier('SCHEMATIC CONSOLE', 'Select an augment from the schematic feed.'))
              : renderVendorDossier()}
          </Animated.View>
        </View>
      </View>

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
    alignItems: 'stretch',
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    ...Platform.select({
      web: {
        width: '100%',
        height: '100%',
      } as object,
      default: {},
    }),
  },
  workspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    zIndex: 1,
    position: 'relative',
  },
  dossierColumn: {
    ...hubDossierColumnStyle(),
    flexShrink: 0,
  },
  creditBalance: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    flexShrink: 0,
    minWidth: 140,
    paddingBottom: 2,
  },
  creditLabel: {
    color: META,
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceCredits: {
    color: VEIL.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modes: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HUB_CHANNEL_BUTTON_HEIGHT,
    paddingHorizontal: HUB_BROWSER_CONTENT_PADDING_H,
    paddingBottom: 6,
    flexShrink: 0,
    gap: 10,
  },
  modesCompact: {
    minHeight: HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
  },
  mode: {
    position: 'relative',
    // Match Loadout Descent Manifest slot width (1/5 of the channel rail).
    width: 168,
    minWidth: 168,
    flexGrow: 0,
    flexShrink: 0,
    height: HUB_CHANNEL_BUTTON_HEIGHT,
    minHeight: HUB_CHANNEL_BUTTON_HEIGHT,
    maxHeight: HUB_CHANNEL_BUTTON_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: HUB_CHANNEL_BUTTON_PADDING_V,
    paddingBottom: HUB_CHANNEL_BUTTON_PADDING_V,
    backgroundColor: VEIL.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VEIL.lineFaint,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        outlineStyle: 'none',
        // Same math as Loadout `repeat(5, 1fr)` + 10px gaps.
        width: 'calc((100% - 40px) / 5)',
        minWidth: 'calc((100% - 40px) / 5)',
        maxWidth: 'calc((100% - 40px) / 5)',
      } as object,
      default: {},
    }),
  },
  modeNarrow: {
    // Match Loadout `manifestSlotNarrow` when the rail scrolls / compresses.
    width: 168,
    minWidth: 168,
    maxWidth: 168,
  },
  modeCompact: {
    height: HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
    minHeight: HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
    maxHeight: HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
    paddingTop: HUB_CHANNEL_BUTTON_COMPACT_PADDING_V,
    paddingBottom: HUB_CHANNEL_BUTTON_COMPACT_PADDING_V,
  },
  modeSelected: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  modeHover: {
    backgroundColor: VEIL.surface2,
  },
  modeEdge: {
    position: 'absolute',
    left: 0,
    top: HUB_CHANNEL_RAIL_INSET,
    bottom: HUB_CHANNEL_RAIL_INSET,
    width: 2,
    backgroundColor: VEIL.lineFaint,
  },
  modeNeon: {
    top: HUB_CHANNEL_RAIL_INSET,
    bottom: HUB_CHANNEL_RAIL_INSET,
  },
  modeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeDetail: {
    marginTop: 6,
    color: META,
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
    ...hubDossierShellStyle(),
  },
  dossierFill: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
    minWidth: 0,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      } as object,
      default: {
        flex: 1,
      },
    }),
  },
  dossierHeader: {
    position: 'relative',
    paddingTop: 22,
    paddingBottom: 16,
    paddingLeft: 28,
    paddingRight: 24,
    flexShrink: 0,
    overflow: 'visible',
  },
  dossierHeaderEmpty: {
    paddingBottom: 8,
  },
  dossierAccent: {
    ...hubInspectorFocusBarStyle(),
  },
  emptyMedia: {
    marginTop: 6,
    marginBottom: 2,
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
    marginBottom: 8,
  },
  dossierCategory: {
    marginTop: 7,
    color: HUB_DOSSIER_LABEL,
    fontWeight: '700',
  },
  dossierTitle: {
    marginTop: 8,
    color: '#F2F4F1',
    fontWeight: '700',
  },
  dossierLead: {
    marginTop: 8,
    color: TEXT_PRIMARY,
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
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
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
    color: HUB_DOSSIER_LABEL,
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
    color: META,
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
    paddingTop: 14,
    paddingBottom: 16,
    paddingLeft: 24,
    paddingRight: 22,
    backgroundColor: HUB_DOSSIER_FOOTER_BG,
    flexShrink: 0,
    overflow: 'hidden',
  },
  dossierFooterRule: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: HUB_DOSSIER_FOOTER_RULE,
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
    minHeight: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  actionPrimary: {
    ...hubPrimaryActionStyle(),
  },
  actionPrimaryHover: {
    ...hubPrimaryActionHoverStyle(),
  },
  actionPrimaryText: {
    ...hubPrimaryActionTextStyle(),
  },
  actionPrimaryTextHover: {
    ...hubPrimaryActionTextHoverStyle(),
  },
  actionDisabled: {
    backgroundColor: 'rgba(185, 181, 167, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(185, 181, 167, 0.16)',
  },
  actionDisabledText: {
    color: 'rgba(222, 227, 223, 0.32)',
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
