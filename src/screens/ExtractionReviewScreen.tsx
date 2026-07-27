import React, { useCallback, useMemo, useState } from 'react';
import {
  ImageBackground,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExtractionBg from '../../assets/images/location images/extraction.png';
import CargoPackingPanel from '../components/CargoPackingPanel';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import FieldPlate from '../components/runField/FieldPlate';
import FieldMetricStrip from '../components/runField/FieldMetricStrip';
import FieldSectionHeader from '../components/runField/FieldSectionHeader';
import HubPrimaryCta from '../components/hub/HubPrimaryCta';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useDevSandboxExit } from '../hooks/useDevSandboxExit';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import {
  resolveImmersiveContentPadding,
  resolveImmersiveFooterInset,
  resolveImmersiveHorizontalInset,
} from '../constants/immersiveLayout';
import { HUB_CARGO_MAT_INSET, resolveHubCargoMatShellMetrics } from '../constants/cargoGridVisual';
import { cargoGridFrameDimensions } from '../components/CargoGridBoard';
import {
  EMERGENCY_EXTRACT_CARGO_BLEED_PCT,
} from '../types/sectorPacing';
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
import { RUN_FIELD } from '../theme/runFieldTokens';

const MUTED_SLATE = RUN_FIELD.textSecondary;
const MASTER_MAX_WIDTH = 1100;

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
  const { isDesktop, activeViewportWidth, fontScale, scaleSpacing } = useResponsiveLayout();
  const [cargoDeckSize, setCargoDeckSize] = useState({ width: 0, height: 0 });

  const reviewKind = activeIncursion.extractionReviewKind;
  const anchorIndex = activeIncursion.pendingSafeAnchorIndex;
  const activeClass = activeIncursion.activeClass ?? 'AEGIS';
  const activeCabal = getFactionAccent(activeIncursion.alignedFaction ?? null);
  const secondaryTelemetry = useMemo(
    () => resolveSecondaryTelemetry(activeClass, runState),
    [activeClass, runState],
  );

  const showDescent = reviewKind !== 'EMERGENCY_RECALL';

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

  const cargoPreviewDimensions = useMemo(() => {
    if (cargoCellSize <= 0) return null;
    const frame = cargoGridFrameDimensions(cargoCellSize);
    const mat = resolveHubCargoMatShellMetrics(
      frame.frameWidth,
      frame.frameHeight,
      scaleSpacing,
      HUB_CARGO_MAT_INSET,
    );
    return { width: mat.width, height: mat.height };
  }, [cargoCellSize, scaleSpacing]);

  const noopRelocate = useCallback(() => false, []);

  const cargoMassPct = useMemo(
    () => calculateGridOccupancy(activeIncursion.cargo),
    [activeIncursion.cargo],
  );
  const cargoIsEmpty = activeIncursion.cargo.grid.placed.length === 0;

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

  const operativeMetrics = useMemo(() => {
    const metrics: { label: string; value: string; accent?: boolean; danger?: boolean }[] = [
      {
        label: 'HP',
        value: `${runState.soulAnchorIntegrity}/${runState.maxSoulAnchor}`,
      },
      {
        label: secondaryTelemetry.label,
        value: secondaryTelemetry.value,
      },
    ];
    if (stampedPayoutPreview != null) {
      metrics.push({ label: 'STAMPED', value: `${stampedPayoutPreview} CR` });
    }
    metrics.push({
      label: 'MASS',
      value: `${Math.round(cargoMassPct * 100)}%`,
      danger: cargoMassPct > 0.7,
    });
    return metrics;
  }, [cargoMassPct, runState.maxSoulAnchor, runState.soulAnchorIntegrity, secondaryTelemetry, stampedPayoutPreview]);

  return (
    <IncursionShell>
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
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
                eyebrow="SECURED VECTOR"
                title="EVAC REVIEW"
                subtitle={evacHeaderSubtitle ?? 'Choose extraction or deeper descent.'}
                fontScale={fontScale}
                showRunChrome
              />

              <View
                style={[
                  styles.masterContainer,
                  {
                    maxWidth: masterMaxWidth,
                    gap: s.masterGap,
                  },
                ]}
              >
                <FieldMetricStrip items={operativeMetrics} />

                <FieldPlate
                  density="light"
                  brackets
                  style={styles.cargoSummaryPlate}
                  contentStyle={styles.cargoSummaryContent}
                >
                  <FieldSectionHeader
                    label="Cargo at risk"
                    meta={cargoIsEmpty ? 'Deck clear' : `${Math.round(cargoMassPct * 100)}% occupancy`}
                  />
                  {cargoIsEmpty ? (
                    <Text style={[styles.cargoEmptyText, { fontSize: s.telemetryLabel }]}>
                      No cargo held — nothing at risk on extract.
                    </Text>
                  ) : (
                    <View style={styles.cargoPreviewMeasure} onLayout={handleCargoDeckLayout}>
                      <View
                        pointerEvents="none"
                        style={[
                          styles.cargoPreviewHost,
                          cargoPreviewDimensions
                            ? {
                              width: cargoPreviewDimensions.width,
                              height: cargoPreviewDimensions.height,
                            }
                            : null,
                        ]}
                      >
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
                  )}
                </FieldPlate>

                {showDescent ? (
                  <Text style={[styles.threatBody, { fontSize: s.ultimatumSubtext, color: MUTED_SLATE }]}>
                    Descent bypasses localized safe-zones. Anomaly density rises ~45%. Operative retains health and payload.
                  </Text>
                ) : null}

                <View style={styles.bottomActionSpacer} />

                <View
                  style={[
                    styles.decisionRow,
                    {
                      flexDirection: isDesktop ? 'row' : 'column',
                      gap: s.panelGap,
                    },
                  ]}
                >
                  {showDescent ? (
                    <HubPrimaryCta
                      label="[ CONTINUE DESCENT ]"
                      onPress={handleDescend}
                      variant="danger"
                      accessibilityLabel="Continue descent"
                      minHeight={54}
                      style={styles.decisionCard}
                    />
                  ) : null}
                  <HubPrimaryCta
                    label="[ INITIATE EXTRACTION ]"
                    onPress={handleExtract}
                    variant="classic"
                    accessibilityLabel="Initiate extraction"
                    minHeight={54}
                    style={styles.decisionCard}
                  />
                </View>
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
    backgroundColor: `rgba(5, 9, 10, ${RUN_FIELD.environmentScrim})`,
    minHeight: 0,
  },
  contentShell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  masterContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    minHeight: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  bottomActionSpacer: {
    flex: 1,
    minHeight: 12,
  },
  cargoSummaryPlate: {
    flexShrink: 0,
    minWidth: 0,
    minHeight: 0,
  },
  cargoSummaryContent: {
    padding: 14,
    gap: 10,
    minHeight: 0,
  },
  decisionRow: {
    width: '100%',
    flexShrink: 0,
    alignItems: 'stretch',
  },
  decisionCard: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  threatBody: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '600',
    letterSpacing: 0.35,
    textAlign: 'center',
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  cargoPreviewMeasure: {
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cargoPreviewHost: {
    minWidth: 0,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cargoEmptyText: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: MUTED_SLATE,
  },
});
