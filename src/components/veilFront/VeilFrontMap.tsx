import React, { useCallback, useId, useMemo, useState } from 'react';
import {
  type ImageSourcePropType,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import {
  SHOW_SECTOR_DEBUG,
  VEIL_FRONT_MAP_SECTORS,
  VEIL_FRONT_MAP_VIEWBOX,
  getVeilFrontMapSector,
  type VeilFrontMapSectorDef,
} from '../../data/veilFrontMapGeometry';
import type { SectorId, SectorState } from '../../types/worldState';
import type { TerminalTheme } from '../../types/theme';
import {
  hitTestSectorAtPoint,
  parseLowPolyPath,
  resolveMapDrawMetrics,
  screenPointToViewBoxExpanded,
  SECTOR_SELECT_HAPTIC_MS,
} from '../../utils/sectorInfluenceVisual';

import VeilFrontMapBase from '../../../assets/images/environment images/veil-front-map-base.png';

const VB_W = VEIL_FRONT_MAP_VIEWBOX.width;
const VB_H = VEIL_FRONT_MAP_VIEWBOX.height;
const MAP_BG = '#000000';

function resolveSvgHref(source: ImageSourcePropType): number | string | undefined {
  if (typeof source === 'number') return source;
  if (typeof source === 'object' && source != null && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return undefined;
}

interface VeilFrontMapProps {
  theme: TerminalTheme;
  sectors: SectorState[];
  activeSectorId: SectorId;
  onSectorPress: (id: SectorId) => void;
  unlockedSectorIds?: ReadonlySet<SectorId> | readonly SectorId[];
  sectorLockLabels?: Partial<Record<SectorId, string>>;
}

/**
 * Veil Front sector map — Figma-traced paths + matching map artwork
 * share viewBox 0 0 1672 941.
 */
export default function VeilFrontMap({
  theme: _theme,
  sectors: _sectors,
  activeSectorId,
  onSectorPress,
  unlockedSectorIds,
  sectorLockLabels,
}: VeilFrontMapProps): React.JSX.Element {
  const reactId = useId().replace(/:/g, '');
  const [hostSize, setHostSize] = useState({ width: 640, height: 400 });
  const [hoveredSectorId, setHoveredSectorId] = useState<SectorId | null>(null);
  const [focusedSectorId, setFocusedSectorId] = useState<SectorId | null>(null);
  const mapHref = useMemo(() => resolveSvgHref(VeilFrontMapBase), []);

  const unlockedSet = useMemo(() => {
    if (!unlockedSectorIds) return null;
    return unlockedSectorIds instanceof Set
      ? unlockedSectorIds
      : new Set(unlockedSectorIds);
  }, [unlockedSectorIds]);

  const isUnlocked = useCallback((id: SectorId) => {
    if (!unlockedSet) return true;
    return unlockedSet.has(id);
  }, [unlockedSet]);

  const drawMetrics = useMemo(
    () => resolveMapDrawMetrics(hostSize.width, hostSize.height, VB_W, VB_H, 'contain'),
    [hostSize.height, hostSize.width],
  );

  const macroLikeSectors = useMemo(
    () => VEIL_FRONT_MAP_SECTORS.map((sector) => ({
      id: sector.id as unknown as import('../../types/regional').MacroSectorId,
      label: sector.name,
      continent: 'NA' as const,
      metropolitanNode: sector.name,
      baseTrafficDensity: 50,
      defaultFaction: 'TERRAN_GRID' as const,
      influence: { TERRAN_GRID: 0, LEGION: 0, SOLARIS: 0 },
      mapGeometry: {
        path: sector.path,
        polygon: parseLowPolyPath(sector.path),
        labelAnchor: sector.label,
        nodeAnchor: sector.label,
      },
    })),
    [],
  );

  const handleHostLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHostSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const handleSectorSelect = useCallback((id: SectorId) => {
    Vibration.vibrate(SECTOR_SELECT_HAPTIC_MS);
    onSectorPress(id);
  }, [onSectorPress]);

  const handleMapPress = useCallback(
    (localX: number, localY: number) => {
      const viewBoxPoint = screenPointToViewBoxExpanded(localX, localY, 1, 0, 0, drawMetrics);
      const hit = hitTestSectorAtPoint(viewBoxPoint, macroLikeSectors);
      if (!hit) return;
      const sectorId = hit.id as unknown as SectorId;
      handleSectorSelect(sectorId);
    },
    [drawMetrics, handleSectorSelect, macroLikeSectors],
  );

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(14)
    .onEnd((event) => {
      runOnJS(handleMapPress)(event.x, event.y);
    });

  const activeDef = getVeilFrontMapSector(activeSectorId);
  const hoverDef = hoveredSectorId
    ? VEIL_FRONT_MAP_SECTORS.find((s) => s.id === hoveredSectorId) ?? null
    : null;
  const focusDef = focusedSectorId
    ? VEIL_FRONT_MAP_SECTORS.find((s) => s.id === focusedSectorId) ?? null
    : null;

  const clipIdFor = (sector: VeilFrontMapSectorDef) => `${reactId}-${sector.clipIdBase}`;

  const renderSectorLabel = (sector: VeilFrontMapSectorDef) => {
    const unlocked = isUnlocked(sector.id);
    const nameFill = unlocked ? 'rgba(220, 225, 220, 0.78)' : 'rgba(210, 215, 210, 0.7)';
    if (unlocked) {
      return (
        <G key={`label-${sector.id}`}>
          <SvgText
            x={sector.label.x}
            y={sector.label.y}
            fill={nameFill}
            fontSize={activeSectorId === sector.id ? 16 : 15}
            fontFamily="monospace"
            fontWeight="700"
            letterSpacing={0.9}
            textAnchor="middle"
          >
            {sector.name}
          </SvgText>
        </G>
      );
    }

    const statusText = sectorLockLabels?.[sector.id] ?? 'LOCKED';
    return (
      <G key={`label-${sector.id}`}>
        <SvgText
          x={sector.label.x}
          y={sector.label.y}
          fill={nameFill}
          fontSize={activeSectorId === sector.id ? 16 : 15}
          fontFamily="monospace"
          fontWeight="700"
          letterSpacing={0.9}
          textAnchor="middle"
        >
          {sector.name}
        </SvgText>
        <SvgText
          x={sector.statusLabel.x}
          y={sector.statusLabel.y}
          fill="rgba(170, 180, 185, 0.55)"
          fontSize={12}
          fontFamily="monospace"
          fontWeight="700"
          letterSpacing={1}
          textAnchor="middle"
        >
          {statusText}
        </SvgText>
      </G>
    );
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.host} onLayout={handleHostLayout}>
        <GestureDetector gesture={tapGesture}>
          <View style={styles.svgWrap}>
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="xMidYMid meet"
              accessible
              accessibilityLabel="Veil Front sector map"
              style={styles.svg}
            >
              <Defs>
                {VEIL_FRONT_MAP_SECTORS.map((sector) => (
                  <ClipPath key={clipIdFor(sector)} id={clipIdFor(sector)}>
                    <Path d={sector.path} />
                  </ClipPath>
                ))}
              </Defs>

              <Rect x={0} y={0} width={VB_W} height={VB_H} fill={MAP_BG} />

              {mapHref != null ? (
                <SvgImage
                  href={mapHref as string | number}
                  x={0}
                  y={0}
                  width={VB_W}
                  height={VB_H}
                  preserveAspectRatio="none"
                />
              ) : (
                <SvgText
                  x={VB_W / 2}
                  y={VB_H / 2}
                  fill="rgba(148, 163, 184, 0.55)"
                  fontSize={16}
                  fontFamily="monospace"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  [ MAP ARTWORK MISSING ]
                </SvgText>
              )}

              {/* Hover: quiet clipped brightness */}
              {!SHOW_SECTOR_DEBUG
              && hoverDef
              && hoverDef.id !== activeSectorId
              && mapHref != null ? (
                <G clipPath={`url(#${clipIdFor(hoverDef)})`} pointerEvents="none">
                  <SvgImage
                    href={mapHref as string | number}
                    x={0}
                    y={0}
                    width={VB_W}
                    height={VB_H}
                    preserveAspectRatio="none"
                    opacity={0.55}
                    {...(Platform.OS === 'web'
                      ? { style: { filter: 'brightness(1.07)' } as object }
                      : null)}
                  />
                </G>
              ) : null}

              {/* Selected: clipped artwork + sector-colored tint */}
              {!SHOW_SECTOR_DEBUG && activeDef && mapHref != null ? (
                <G clipPath={`url(#${clipIdFor(activeDef)})`} pointerEvents="none">
                  <SvgImage
                    href={mapHref as string | number}
                    x={0}
                    y={0}
                    width={VB_W}
                    height={VB_H}
                    preserveAspectRatio="none"
                    {...(Platform.OS === 'web'
                      ? {
                          style: {
                            filter: 'brightness(1.18) contrast(1.08) saturate(1.12)',
                          } as object,
                        }
                      : null)}
                  />
                  <Rect
                    x={0}
                    y={0}
                    width={VB_W}
                    height={VB_H}
                    fill={activeDef.accent}
                    opacity={0.035}
                  />
                </G>
              ) : null}

              {/* Debug: all five paths */}
              {SHOW_SECTOR_DEBUG ? (
                <G id="sector-debug">
                  <SvgText
                    x={24}
                    y={28}
                    fill="rgba(255,255,255,0.55)"
                    fontSize={12}
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    {`viewBox 0 0 ${VB_W} ${VB_H}`}
                  </SvgText>
                  {VEIL_FRONT_MAP_SECTORS.map((sector) => (
                    <G key={`dbg-${sector.id}`}>
                      <Path
                        d={sector.path}
                        fill={sector.accent}
                        fillOpacity={0.1}
                        stroke={sector.accent}
                        strokeWidth={1.25}
                        strokeOpacity={0.85}
                      />
                      <SvgText
                        x={sector.label.x}
                        y={sector.label.y}
                        fill={sector.accent}
                        fontSize={13}
                        fontFamily="monospace"
                        fontWeight="800"
                        textAnchor="middle"
                      >
                        {sector.key}
                      </SvgText>
                    </G>
                  ))}
                </G>
              ) : null}

              {/* Hover boundary */}
              {!SHOW_SECTOR_DEBUG
              && hoverDef
              && hoverDef.id !== activeSectorId ? (
                <Path
                  d={hoverDef.path}
                  fill="none"
                  stroke={hoverDef.accent}
                  strokeWidth={0.75}
                  strokeOpacity={0.35}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              ) : null}

              {/* Focus ring */}
              {!SHOW_SECTOR_DEBUG && focusDef ? (
                <Path
                  d={focusDef.path}
                  fill="none"
                  stroke={focusDef.accent}
                  strokeWidth={1.25}
                  strokeOpacity={0.9}
                  strokeDasharray="4 3"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ) : null}

              {/* Selected boundary */}
              {!SHOW_SECTOR_DEBUG && activeDef ? (
                <G pointerEvents="none">
                  <Path
                    d={activeDef.path}
                    fill="none"
                    stroke={activeDef.accent}
                    strokeWidth={3}
                    strokeOpacity={0.08}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <Path
                    d={activeDef.path}
                    fill="none"
                    stroke={activeDef.accent}
                    strokeWidth={1}
                    strokeOpacity={0.72}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </G>
              ) : null}

              {/* Invisible hitboxes — locked sectors remain selectable for inspection */}
              {!SHOW_SECTOR_DEBUG ? (
                <G id="sector-hitboxes">
                  {VEIL_FRONT_MAP_SECTORS.map((sector) => {
                    const unlocked = isUnlocked(sector.id);
                    const hitProps = {
                      d: sector.path,
                      fill: 'rgba(0,0,0,0.001)',
                      stroke: 'none',
                      onPress: () => handleSectorSelect(sector.id),
                      accessibilityRole: 'button' as const,
                      accessibilityLabel: unlocked
                        ? `Select ${sector.name}`
                        : `Inspect locked sector ${sector.name}`,
                      accessibilityState: { selected: activeSectorId === sector.id },
                      ...(Platform.OS === 'web'
                        ? {
                            cursor: 'pointer',
                            tabIndex: 0,
                            onMouseEnter: () => setHoveredSectorId(sector.id),
                            onMouseLeave: () => setHoveredSectorId((id) => (id === sector.id ? null : id)),
                            onFocus: () => setFocusedSectorId(sector.id),
                            onBlur: () => setFocusedSectorId((id) => (id === sector.id ? null : id)),
                            onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleSectorSelect(sector.id);
                              }
                            },
                          }
                        : {}),
                    };
                    return <Path key={`hit-${sector.id}`} {...(hitProps as object)} />;
                  })}
                </G>
              ) : null}

              {!SHOW_SECTOR_DEBUG ? (
                <G id="sector-labels" pointerEvents="none">
                  {VEIL_FRONT_MAP_SECTORS.map((sector) => renderSectorLabel(sector))}
                </G>
              ) : null}
            </Svg>
          </View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: MAP_BG,
  },
  host: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  svgWrap: {
    ...StyleSheet.absoluteFill,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});
