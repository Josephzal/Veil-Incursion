import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExtractionBg from '../../assets/images/location images/extraction.png';
import HapticPressable from '../components/HapticPressable';
import CargoPackingPanel from '../components/CargoPackingPanel';
import DossierCardShell from '../components/hub/DossierCardShell';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useDevSandboxExit } from '../hooks/useDevSandboxExit';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import { hubCtaButtonStyle } from '../constants/hubCta';
import {
  resolveImmersiveContentPadding,
  resolveImmersiveFooterInset,
  resolveImmersiveHorizontalInset,
} from '../constants/immersiveLayout';
import { HUB_CARGO_MAT_INSET } from '../constants/cargoGridVisual';
import {
  EMERGENCY_EXTRACT_CARGO_BLEED_PCT,
} from '../types/sectorPacing';
import { formatCargoRoutingExtractionReviewLine } from '../data/cargoRoutingIntelEngine';
import {
  countSpecialCargoHeldInRun,
  resolveCargoRoutingContextFromIncursion,
} from '../data/postRunCargoRoutingRunState';
import {
  computeBaseSectorExtractionPayout,
  isKeepsakeStampedExtractionNode,
  previewKeepsakeStampedExtractionPayout,
} from '../data/expeditionKeepsakeEconomyEngine';
import type { ClassType } from '../types/game';
import type { RunState } from '../types/run';
import { calculateGridOccupancy } from '../data/cargoGridEngine';
import { getFactionAccent } from '../data/factions';
import {
  HUB_CARGO_INCURSION_CELL_MAX,
  HUB_CARGO_INCURSION_CELL_TARGET,
  resolveHubMatAwareLoadoutCellSize,
} from '../utils/cargoGridLayout';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';

const MUTED_SLATE = '#94A3B8';
const STARK_WHITE = '#F8FAFC';
const EXTRACT_CYAN = '#06B6D4';
const DESCENT_ORANGE = '#EA580C';
const DESCENT_CRIMSON = '#991B1B';
const MASTER_MAX_WIDTH = 1100;

const FLAT_CTA_OVERRIDE: ViewStyle = Platform.select({
  web: { boxShadow: 'none' },
  default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
}) ?? { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };

function resolveSecondaryTelemetry(
  activeClass: ClassType,
  runState: RunState,
): { label: string; value: string } {
  const value = `${runState.currentStamina}/${runState.maxStamina}`;
  switch (activeClass) {
    case 'HEX_SHOT':
      return { label: 'STAMINA', value };
    case 'ENVOY':
      return { label: 'FLUX', value };
    default:
      return { label: 'RESERVE', value };
  }
}

interface TelemetryRowProps {
  label: string;
  value: string;
  labelSize: number;
  valueSize: number;
}

function TelemetryRow({ label, value, labelSize, valueSize }: TelemetryRowProps): React.JSX.Element {
  return (
    <View style={styles.telemetryRow}>
      <Text
        style={[
          styles.telemetryLabel,
          { color: MUTED_SLATE, fontSize: labelSize, lineHeight: labelSize * 1.4 },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.telemetryValue,
          {
            color: STARK_WHITE,
            fontSize: valueSize,
            lineHeight: valueSize * 1.3,
            minWidth: valueSize * 4.5,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

interface AnomalousMassReadoutProps {
  massPct: number;
  fontScale: number;
}

function AnomalousMassReadout({ massPct, fontScale }: AnomalousMassReadoutProps): React.JSX.Element {
  const pulse = useRef(new Animated.Value(0.35)).current;
  const fillWidth = `${Math.max(4, Math.round(massPct * 100))}%`;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 1400, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.35, duration: 1400, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const labelSize = 8 * fontScale;
  const hashSize = 7 * fontScale;
  const hashSeed = Math.round(massPct * 9973).toString(16).toUpperCase().padStart(6, '0');

  return (
    <View style={[styles.massFooter, { gap: 8 * fontScale, paddingTop: 12 * fontScale }]}>
      <Text
        style={[
          styles.sectionLabel,
          { color: MUTED_SLATE, fontSize: labelSize, lineHeight: labelSize * 1.4 },
        ]}
      >
        [ ANOMALOUS MASS DETECTED ]
      </Text>
      <View style={styles.massTrack}>
        <Animated.View
          style={[
            styles.massFill,
            {
              width: fillWidth as `${number}%`,
              opacity: pulse,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.massHash,
          { color: MUTED_SLATE, fontSize: hashSize, lineHeight: hashSize * 1.45 },
        ]}
      >
        {`SIG // ${hashSeed} // MASS INDEX ${(massPct * 10).toFixed(1)}v`}
      </Text>
    </View>
  );
}

interface ThreatForecastProps {
  activeCabal: string;
  fontScale: number;
}

function ThreatForecast({ activeCabal, fontScale }: ThreatForecastProps): React.JSX.Element {
  const headerSize = 8 * fontScale;
  const bodySize = 8 * fontScale;

  return (
    <View style={[styles.threatBlock, { gap: 8 * fontScale, paddingHorizontal: 4 * fontScale }]}>
      <Text
        style={[
          styles.threatHeader,
          {
            color: activeCabal,
            fontSize: headerSize,
            lineHeight: headerSize * 1.45,
          },
        ]}
      >
        {'>> SUB-GRID TELEMETRY WARNING'}
      </Text>
      <Text
        style={[
          styles.threatBody,
          {
            color: MUTED_SLATE,
            fontSize: bodySize,
            lineHeight: bodySize * 1.55,
          },
        ]}
      >
        Descent protocol bypasses localized safe-zones. Anomaly density will increase by 45%.
        Operative assumes all risk.
      </Text>
    </View>
  );
}

interface EvacUltimatumButtonProps {
  primaryLabel: string;
  subtext: string;
  variant: 'extract' | 'descent';
  onPress: () => void;
  scaleSize: (value: number) => number;
  scaleSpacing: (value: number) => number;
  primarySize: number;
  subtextSize: number;
  hazardPatternId: string;
}

function EvacUltimatumButton({
  primaryLabel,
  subtext,
  variant,
  onPress,
  scaleSize,
  scaleSpacing,
  primarySize,
  subtextSize,
  hazardPatternId,
}: EvacUltimatumButtonProps): React.JSX.Element {
  const isExtract = variant === 'extract';
  const borderColor = isExtract ? EXTRACT_CYAN : DESCENT_CRIMSON;
  const backgroundColor = isExtract ? 'rgba(6, 182, 212, 0.1)' : 'rgba(153, 27, 27, 0.1)';
  const primaryColor = isExtract ? STARK_WHITE : DESCENT_ORANGE;

  const buttonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(borderColor, scaleSize, scaleSpacing, false),
      FLAT_CTA_OVERRIDE,
      {
        borderColor,
        backgroundColor,
        borderLeftWidth: isExtract ? 4 : 1,
        gap: 6 * (primarySize / 11),
        opacity: state.pressed ? 0.88 : 1,
        overflow: 'hidden' as const,
        position: 'relative' as const,
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [backgroundColor, borderColor, isExtract, primarySize, scaleSize, scaleSpacing],
  );

  return (
    <HapticPressable onPress={onPress} style={buttonStyle}>
      {!isExtract ? (
        <View pointerEvents="none" style={styles.hazardStripeLayer}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <Pattern
                id={hazardPatternId}
                width={10}
                height={10}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <Rect width={5} height={10} fill="rgba(153, 27, 27, 0.05)" />
                <Rect x={5} width={5} height={10} fill="transparent" />
              </Pattern>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${hazardPatternId})`} />
          </Svg>
        </View>
      ) : null}
      <Text
        style={[
          styles.ultimatumPrimary,
          {
            color: primaryColor,
            fontSize: primarySize,
            lineHeight: primarySize * 1.25,
          },
        ]}
      >
        {primaryLabel}
      </Text>
      <Text
        style={[
          styles.ultimatumSubtext,
          {
            color: MUTED_SLATE,
            fontSize: subtextSize,
            lineHeight: subtextSize * 1.45,
          },
        ]}
      >
        {subtext}
      </Text>
    </HapticPressable>
  );
}

export default function ExtractionReviewScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    continueFromExtractionReview,
    confirmSafeAnchorExtraction,
    confirmMasterExtraction,
    applyEmergencyRecallCargoBleed,
  } = useRun();
  const { startScanning } = useGameFlow();
  const { finalizeSectorExtraction } = useDescentNavigator();
  const { exitToDevTestHub } = useDevSandboxExit();
  const insets = useSafeAreaInsets();
  const { isDesktop, activeViewportWidth, fontScale, scaleSize, scaleSpacing } = useResponsiveLayout();
  const [cargoDeckSize, setCargoDeckSize] = useState({ width: 0, height: 0 });
  const hazardPatternId = useMemo(
    () => `evac-hazard-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  const reviewKind = activeIncursion.extractionReviewKind;
  const anchorIndex = activeIncursion.pendingSafeAnchorIndex;
  const activeClass = activeIncursion.activeClass ?? 'AEGIS';
  const activeCabal = getFactionAccent(activeIncursion.alignedFaction ?? null);
  const secondaryTelemetry = useMemo(
    () => resolveSecondaryTelemetry(activeClass, runState),
    [activeClass, runState],
  );

  const showDescent = reviewKind !== 'EMERGENCY_RECALL';

  const extractSubtext = useMemo(() => {
    if (reviewKind === 'EMERGENCY_RECALL') {
      return `Emergency bleed — ${EMERGENCY_EXTRACT_CARGO_BLEED_PCT}% cargo lost. End incursion now.`;
    }
    const routingContext = resolveCargoRoutingContextFromIncursion(activeIncursion);
    const specialCargoLine = routingContext
      ? formatCargoRoutingExtractionReviewLine(countSpecialCargoHeldInRun(
        activeIncursion.cargo,
        activeIncursion.runBankedSnapshot,
        activeIncursion.activeContract,
        routingContext,
      ))
      : null;
    if (reviewKind === 'MASTER_LINK') {
      const base = 'Prime conduit — anchor payload to Cabal HQ. Guaranteed severance.';
      return specialCargoLine ? `${base} ${specialCargoLine}` : base;
    }
    const base = 'Anchor payload to Cabal HQ. Sever the Veil tether.';
    return specialCargoLine ? `${base} ${specialCargoLine}` : base;
  }, [activeIncursion, reviewKind]);

  const evacHeaderSubtitle = useMemo(() => {
    if (reviewKind === 'SAFE_ANCHOR' && anchorIndex != null) {
      return `SAFE ANCHOR ${anchorIndex} // CLEAN EVAC — NO PENALTY`;
    }
    if (reviewKind === 'MASTER_LINK') {
      return 'PRIME CONDUIT — BOOSTED PAYOUT ON EXTRACT';
    }
    if (reviewKind === 'EMERGENCY_RECALL') {
      return `EMERGENCY RECALL // ${EMERGENCY_EXTRACT_CARGO_BLEED_PCT}% CARGO BLEED`;
    }
    return undefined;
  }, [anchorIndex, reviewKind]);

  const masterMaxWidth = Math.min(activeViewportWidth * 0.9, MASTER_MAX_WIDTH);
  const contentPadding = 16 * fontScale;
  const horizontal = resolveImmersiveHorizontalInset(insets.left, insets.right);
  const framePaddingTop = resolveImmersiveContentPadding(insets.top, contentPadding);
  const framePaddingBottom = Math.max(
    contentPadding,
    resolveImmersiveFooterInset(insets.bottom),
  );

  const s = useMemo(
    () => ({
      headerSize: 16 * fontScale,
      sectionLabel: 8 * fontScale,
      telemetryLabel: 9 * fontScale,
      telemetryValue: 11 * fontScale,
      ultimatumPrimary: 12 * fontScale,
      ultimatumSubtext: 9 * fontScale,
      panelGap: 20 * fontScale,
      masterGap: 24 * fontScale,
    }),
    [fontScale],
  );

  const cargoCellSize = useMemo(
    () => resolveHubMatAwareLoadoutCellSize(
      cargoDeckSize.width,
      cargoDeckSize.height,
      scaleSpacing,
      HUB_CARGO_INCURSION_CELL_TARGET,
      HUB_CARGO_INCURSION_CELL_MAX,
      HUB_CARGO_MAT_INSET,
    ),
    [cargoDeckSize.height, cargoDeckSize.width, scaleSpacing],
  );

  const noopRelocate = useCallback(() => false, []);

  const cargoMassPct = useMemo(
    () => calculateGridOccupancy(activeIncursion.cargo),
    [activeIncursion.cargo],
  );

  const stampedPayoutPreview = useMemo(() => {
    if (!isKeepsakeStampedExtractionNode(activeIncursion)) return null;
    const base = computeBaseSectorExtractionPayout(activeIncursion);
    return previewKeepsakeStampedExtractionPayout(
      activeIncursion.keepsakeRuntime,
      activeIncursion,
      base,
    );
  }, [activeIncursion]);

  const handleCargoDeckLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCargoDeckSize({ width, height });
  }, []);

  const handleExtract = () => {
    if (exitToDevTestHub()) return;
    if (reviewKind === 'SAFE_ANCHOR' && anchorIndex != null) {
      confirmSafeAnchorExtraction(anchorIndex);
    } else if (reviewKind === 'MASTER_LINK') {
      confirmMasterExtraction();
    } else if (reviewKind === 'EMERGENCY_RECALL') {
      applyEmergencyRecallCargoBleed();
    }
    finalizeSectorExtraction();
  };

  const handleDescend = () => {
    if (exitToDevTestHub()) return;
    continueFromExtractionReview();
    startScanning();
  };

  return (
    <IncursionShell>
      <IncursionRunLayout style={{ backgroundColor: theme.backgroundColor }}>
        <ImageBackground
          source={ExtractionBg}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.scrim}>
            <View
              style={[
                styles.contentShell,
                {
                  paddingTop: framePaddingTop,
                  paddingBottom: framePaddingBottom,
                  paddingLeft: contentPadding + horizontal.paddingLeft,
                  paddingRight: contentPadding + horizontal.paddingRight,
                },
              ]}
            >
              <RunEventNodeHeader
                title="EVAC VECTOR SECURED"
                subtitle={evacHeaderSubtitle}
                fontScale={fontScale}
              />

              <View
                style={[
                  styles.masterContainer,
                  {
                    maxWidth: masterMaxWidth,
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: s.masterGap,
                    alignItems: 'stretch',
                  },
                ]}
              >
                <DossierCardShell
                  fillHeight
                  padding={24 * fontScale}
                  accentColor={activeCabal}
                  style={styles.evacPanel}
                  contentStyle={{ gap: s.panelGap, justifyContent: 'space-between' }}
                >
                  <View style={{ gap: 10 * fontScale }}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        {
                          color: MUTED_SLATE,
                          fontSize: s.sectionLabel,
                          lineHeight: s.sectionLabel * 1.4,
                        },
                      ]}
                    >
                      TELEMETRY // OPERATIVE STANDING
                    </Text>
                    <TelemetryRow
                      label="CURRENT HP"
                      value={`${runState.soulAnchorIntegrity}/${runState.maxSoulAnchor}`}
                      labelSize={s.telemetryLabel}
                      valueSize={s.telemetryValue}
                    />
                    <TelemetryRow
                      label={secondaryTelemetry.label}
                      value={secondaryTelemetry.value}
                      labelSize={s.telemetryLabel}
                      valueSize={s.telemetryValue}
                    />
                    {stampedPayoutPreview != null ? (
                      <TelemetryRow
                        label="STAMPED PAYOUT"
                        value={`${stampedPayoutPreview} CR`}
                        labelSize={s.telemetryLabel}
                        valueSize={s.telemetryValue}
                      />
                    ) : null}
                  </View>

                  <View style={styles.cargoDeckSection}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        {
                          color: MUTED_SLATE,
                          fontSize: s.sectionLabel,
                          lineHeight: s.sectionLabel * 1.4,
                        },
                      ]}
                    >
                      CARGO DECK // AT RISK
                    </Text>
                    <View style={styles.cargoPreviewMeasure} onLayout={handleCargoDeckLayout}>
                      <View pointerEvents="none" style={styles.cargoPreviewHost}>
                        <CargoPackingPanel
                          cargo={activeIncursion.cargo}
                          theme={theme}
                          accentColor={activeCabal}
                          onRelocateItem={noopRelocate}
                          hideContinueButton
                          hidePackHeader
                          embedded
                          compactCellSize={cargoCellSize}
                          cargoBackdrop
                          hubCargoMatInset={HUB_CARGO_MAT_INSET}
                        />
                      </View>
                    </View>
                  </View>

                  <AnomalousMassReadout massPct={cargoMassPct} fontScale={fontScale} />
                </DossierCardShell>

                <DossierCardShell
                  fillHeight
                  padding={24 * fontScale}
                  accentColor={activeCabal}
                  style={styles.evacPanel}
                  contentStyle={styles.rightPanelBody}
                >
                    <View style={[styles.rightTopBlock, { gap: 10 * fontScale }]}>
                      <Text
                        style={[
                          styles.sectionLabel,
                          {
                            color: MUTED_SLATE,
                            fontSize: s.sectionLabel,
                            lineHeight: s.sectionLabel * 1.4,
                          },
                        ]}
                      >
                        [ DIRECTIVE UPLINK ]
                      </Text>

                      <EvacUltimatumButton
                        primaryLabel="[ INITIATE EXTRACTION ]"
                        subtext={extractSubtext}
                        variant="extract"
                        onPress={handleExtract}
                        scaleSize={scaleSize}
                        scaleSpacing={scaleSpacing}
                        primarySize={s.ultimatumPrimary}
                        subtextSize={s.ultimatumSubtext}
                        hazardPatternId={hazardPatternId}
                      />
                    </View>

                    {showDescent ? (
                      <View style={styles.threatCenter}>
                        <ThreatForecast activeCabal={activeCabal} fontScale={fontScale} />
                      </View>
                    ) : (
                      <View style={styles.threatSpacer} />
                    )}

                    {showDescent ? (
                      <View style={styles.descendBlock}>
                        <EvacUltimatumButton
                          primaryLabel="[ DESCEND: SUB-GRID ]"
                          subtext="Retain current health and payload. Increase threat constraints."
                          variant="descent"
                          onPress={handleDescend}
                          scaleSize={scaleSize}
                          scaleSpacing={scaleSpacing}
                          primarySize={s.ultimatumPrimary}
                          subtextSize={s.ultimatumSubtext}
                          hazardPatternId={hazardPatternId}
                        />
                      </View>
                    ) : null}
                </DossierCardShell>
              </View>
            </View>
          </View>
        </ImageBackground>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    minHeight: 0,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    minHeight: 0,
  },
  contentShell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  globalHeader: {
    width: '100%',
    borderBottomWidth: 1,
    gap: 6,
    flexShrink: 0,
  },
  globalHeaderTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 2,
  },
  globalHeaderMeta: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  masterContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    minHeight: 0,
    alignItems: 'stretch',
  },
  evacPanel: {
    flex: 1,
    minHeight: 0,
  },
  rightPanelBody: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
  },
  rightTopBlock: {
    flexShrink: 0,
  },
  threatSpacer: {
    flex: 1,
    minHeight: 0,
  },
  threatCenter: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingVertical: 16,
  },
  threatBlock: {
    width: '100%',
  },
  threatHeader: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  threatBody: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.35,
  },
  descendBlock: {
    flexShrink: 0,
    marginTop: 'auto',
  },
  sectionLabel: {
    fontFamily: 'monospace',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  telemetryLabel: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
    flex: 1,
  },
  telemetryValue: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  massFooter: {
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.65)',
  },
  massTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(51, 65, 85, 0.55)',
    overflow: 'hidden',
  },
  massFill: {
    height: '100%',
    backgroundColor: EXTRACT_CYAN,
    borderRadius: 2,
  },
  massHash: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  hazardStripeLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  cargoDeckSection: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  cargoPreviewMeasure: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cargoPreviewHost: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ultimatumPrimary: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    zIndex: 1,
  },
  ultimatumSubtext: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.45,
    textAlign: 'center',
    paddingHorizontal: 8,
    zIndex: 1,
  },
});
