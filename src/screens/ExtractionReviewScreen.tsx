import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExtractionBg from '../../assets/images/location images/extraction.png';
import HapticPressable from '../components/HapticPressable';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useDevSandboxExit } from '../hooks/useDevSandboxExit';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import DossierCardShell from '../components/hub/DossierCardShell';
import { hubCtaButtonStyle } from '../constants/hubCta';
import {
  resolveImmersiveContentPadding,
  resolveImmersiveFooterInset,
  resolveImmersiveHorizontalInset,
} from '../constants/immersiveLayout';
import { CARGO_CELL_GAP } from '../constants/cargoGridLayout';
import { resolveCargoGridCellBackground, resolveHubCargoMatShellMetrics } from '../constants/cargoGridVisual';
import CargoGridBackdrop from '../components/cargo/CargoGridBackdrop';
import {
  EMERGENCY_EXTRACT_CARGO_BLEED_PCT,
} from '../types/sectorPacing';
import type { ClassType } from '../types/game';
import type { RunState } from '../types/run';
import {
  CARGO_GRID_COLS,
  CARGO_GRID_ROWS,
  CARGO_ITEM_CATALOG,
  type CargoItemId,
  type CargoRunState,
  type PlacedCargoItem,
} from '../types/cargoGrid';
import {
  cargoGridFrameDimensions,
  spriteSizeForCargoItem,
} from '../components/CargoGridBoard';
import { resolveCargoItemIcon } from '../utils/cargoItemIcon';
import {
  resolveHubLoadoutCellSize,
  HUB_CARGO_INCURSION_CELL_MAX,
  HUB_CARGO_INCURSION_CELL_TARGET,
} from '../utils/cargoGridLayout';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';

const MUTED_SLATE = '#94A3B8';
const STARK_WHITE = '#F8FAFC';
const EXTRACT_CYAN = '#06B6D4';
const DESCENT_ORANGE = '#EA580C';
const DESCENT_BORDER = '#7C2D12';
const MASTER_MAX_WIDTH = 1100;

const FLAT_CTA_OVERRIDE: ViewStyle = Platform.select({
  web: { boxShadow: 'none' },
  default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
}) ?? { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };

function cellsForItem(itemId: CargoItemId, originRow: number, originCol: number): string[] {
  const def = CARGO_ITEM_CATALOG[itemId];
  const keys: string[] = [];
  for (let row = originRow; row < originRow + def.height; row += 1) {
    for (let col = originCol; col < originCol + def.width; col += 1) {
      keys.push(`${row},${col}`);
    }
  }
  return keys;
}

function cellOriginLeft(col: number, cellSize: number): number {
  return col * (cellSize + CARGO_CELL_GAP);
}

function cellOriginTop(row: number, cellSize: number): number {
  return row * (cellSize + CARGO_CELL_GAP);
}

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
          { color: STARK_WHITE, fontSize: valueSize, lineHeight: valueSize * 1.3 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

interface EvacuationCargoPreviewProps {
  cargo: CargoRunState;
  cellSize: number;
  scaleSpacing: (value: number) => number;
}

function EvacuationCargoPreview({
  cargo,
  cellSize,
  scaleSpacing,
}: EvacuationCargoPreviewProps): React.JSX.Element {
  const { frameWidth, frameHeight } = useMemo(
    () => cargoGridFrameDimensions(cellSize),
    [cellSize],
  );
  const matShell = useMemo(
    () => resolveHubCargoMatShellMetrics(frameWidth, frameHeight, scaleSpacing),
    [frameHeight, frameWidth, scaleSpacing],
  );

  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    cargo.grid.placed.forEach((item) => {
      cellsForItem(item.itemId, item.originRow, item.originCol).forEach((key) => set.add(key));
    });
    return set;
  }, [cargo.grid.placed]);

  return (
    <View style={[styles.hubCargoMatShell, styles.hubCargoMatShellTextured, matShell]}>
      <CargoGridBackdrop />
      <View
        style={[
          styles.cargoGridFrame,
          { width: frameWidth, height: frameHeight },
        ]}
      >
        <View style={[styles.cellsLayer, { gap: CARGO_CELL_GAP }]}>
          {Array.from({ length: CARGO_GRID_ROWS }, (_, row) =>
            Array.from({ length: CARGO_GRID_COLS }, (_, col) => {
              const key = `${row},${col}`;
              const occupied = occupiedCells.has(key);
              return (
                <View
                  key={key}
                  style={[
                    styles.cargoCell,
                    {
                      width: cellSize,
                      height: cellSize,
                      borderColor: occupied ? 'rgba(148, 163, 184, 0.35)' : 'rgba(51, 65, 85, 0.8)',
                      backgroundColor: resolveCargoGridCellBackground({
                        occupied,
                        isPreview: false,
                        canDrop: false,
                        cargoBackdrop: true,
                      }),
                    },
                  ]}
                />
              );
            }),
          )}
        </View>

        <View style={styles.placedLayer} pointerEvents="none">
          {cargo.grid.placed.map((item: PlacedCargoItem) => {
            const spriteSize = spriteSizeForCargoItem(item.itemId, cellSize);
            return (
              <View
                key={`${item.instanceId}@${item.originRow},${item.originCol}`}
                style={[
                  styles.placedItemAnchor,
                  {
                    left: cellOriginLeft(item.originCol, cellSize),
                    top: cellOriginTop(item.originRow, cellSize),
                    width: spriteSize.width,
                    height: spriteSize.height,
                  },
                ]}
              >
                <Image
                  source={resolveCargoItemIcon(item.itemId)}
                  style={styles.placedSprite}
                  resizeMode="contain"
                />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface EvacUltimatumButtonProps {
  primaryLabel: string;
  subtext: string;
  borderColor: string;
  backgroundColor: string;
  primaryColor: string;
  onPress: () => void;
  scaleSize: (value: number) => number;
  scaleSpacing: (value: number) => number;
  primarySize: number;
  subtextSize: number;
}

function EvacUltimatumButton({
  primaryLabel,
  subtext,
  borderColor,
  backgroundColor,
  primaryColor,
  onPress,
  scaleSize,
  scaleSpacing,
  primarySize,
  subtextSize,
}: EvacUltimatumButtonProps): React.JSX.Element {
  const buttonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(borderColor, scaleSize, scaleSpacing, false),
      FLAT_CTA_OVERRIDE,
      {
        borderColor,
        backgroundColor,
        gap: 6 * (primarySize / 11),
        opacity: state.pressed ? 0.88 : 1,
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [backgroundColor, borderColor, primarySize, scaleSize, scaleSpacing],
  );

  return (
    <HapticPressable onPress={onPress} style={buttonStyle}>
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
  const { isDesktop, activeViewportWidth, fontScale, gap, scaleSize, scaleSpacing } = useResponsiveLayout();
  const [cargoDeckSize, setCargoDeckSize] = useState({ width: 0, height: 0 });

  const reviewKind = activeIncursion.extractionReviewKind;
  const anchorIndex = activeIncursion.pendingSafeAnchorIndex;
  const activeClass = activeIncursion.activeClass ?? 'AEGIS';
  const secondaryTelemetry = useMemo(
    () => resolveSecondaryTelemetry(activeClass, runState),
    [activeClass, runState],
  );

  const showDescent = reviewKind !== 'EMERGENCY_RECALL';

  const extractSubtext = useMemo(() => {
    if (reviewKind === 'EMERGENCY_RECALL') {
      return `Emergency bleed — ${EMERGENCY_EXTRACT_CARGO_BLEED_PCT}% cargo lost. End incursion now.`;
    }
    if (reviewKind === 'MASTER_LINK') {
      return 'Prime conduit — bank cargo to Cabal HQ. Guaranteed clean exit.';
    }
    return 'Bank current cargo to Cabal HQ. End incursion.';
  }, [reviewKind]);

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
      panelPad: 24 * fontScale,
      panelGap: 20 * fontScale,
      ultimatumGap: 32 * fontScale,
      masterGap: 24 * fontScale,
      headerPadBottom: 14 * fontScale,
      headerMarginBottom: 18 * fontScale,
    }),
    [fontScale],
  );

  const cargoCellSize = useMemo(
    () => resolveHubLoadoutCellSize(
      cargoDeckSize.width,
      cargoDeckSize.height,
      HUB_CARGO_INCURSION_CELL_TARGET,
      HUB_CARGO_INCURSION_CELL_MAX,
    ),
    [cargoDeckSize.height, cargoDeckSize.width],
  );

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
                  },
                ]}
              >
                <DossierCardShell
                  fillHeight
                  padding={s.panelPad}
                  style={styles.leftPanel}
                  contentStyle={{ gap: s.panelGap }}
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
                      <EvacuationCargoPreview
                        cargo={activeIncursion.cargo}
                        cellSize={cargoCellSize}
                        scaleSpacing={scaleSpacing}
                      />
                    </View>
                  </View>
                </DossierCardShell>

                <View
                  style={[
                    styles.rightPanel,
                    {
                      gap: s.ultimatumGap,
                    },
                  ]}
                >
                  <EvacUltimatumButton
                    primaryLabel="[ INITIATE EXTRACTION ]"
                    subtext={extractSubtext}
                    borderColor={EXTRACT_CYAN}
                    backgroundColor="rgba(6, 182, 212, 0.12)"
                    primaryColor={STARK_WHITE}
                    onPress={handleExtract}
                    scaleSize={scaleSize}
                    scaleSpacing={scaleSpacing}
                    primarySize={s.ultimatumPrimary}
                    subtextSize={s.ultimatumSubtext}
                  />

                  {showDescent ? (
                    <EvacUltimatumButton
                      primaryLabel="[ DESCEND: SUB-GRID ]"
                      subtext="Retain current health and payload. Increase threat constraints."
                      borderColor={DESCENT_BORDER}
                      backgroundColor="rgba(0, 0, 0, 0.8)"
                      primaryColor={DESCENT_ORANGE}
                      onPress={handleDescend}
                      scaleSize={scaleSize}
                      scaleSpacing={scaleSpacing}
                      primarySize={s.ultimatumPrimary}
                      subtextSize={s.ultimatumSubtext}
                    />
                  ) : null}
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
  leftPanel: {
    flex: 1,
    minHeight: 0,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    minHeight: 0,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    letterSpacing: 0.9,
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
    letterSpacing: 0.7,
  },
  telemetryValue: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
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
  },
  hubCargoMatShell: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hubCargoMatShellTextured: {
    backgroundColor: 'rgba(5, 6, 8, 0.55)',
  },
  cargoGridFrame: {
    position: 'relative',
    alignSelf: 'center',
    zIndex: 1,
  },
  cellsLayer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    zIndex: 1,
  },
  cargoCell: {
    borderWidth: 1,
  },
  placedLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  placedItemAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placedSprite: {
    width: '100%',
    height: '100%',
  },
  ultimatumPrimary: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  ultimatumSubtext: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.45,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
