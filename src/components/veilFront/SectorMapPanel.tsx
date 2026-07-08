import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import VeilFrontMap from './VeilFrontMap';
import { MapSectorSummary, SectorIntel } from './MapSectorOverlays';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import type { SelectedContractState } from '../../types/contract';
import type { SectorId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { getContractSectorCompatibility, getSelectedContractForCompatibility } from '../../utils/contractUi';

interface SectorMapPanelProps {
  theme: TerminalTheme;
  sectors: SectorState[];
  activeSectorId: SectorId;
  onSectorPress: (id: SectorId) => void;
  selectedContract: SelectedContractState;
}

function MapLegend({ theme, showContractLegend }: { theme: TerminalTheme; showContractLegend: boolean }): React.JSX.Element {
  const { scaleSpacing, isCompactHeight } = useVeilFrontLayout();
  const items = [
    { color: '#a855f7', label: 'Anchor' },
    { color: '#818cf8', label: 'Echo' },
    { color: '#fbbf24', label: 'Reward' },
    { color: theme.statusColor, label: 'Selected' },
  ];
  if (showContractLegend) {
    items.push(
      { color: '#34d399', label: 'Ideal' },
      { color: '#fbbf24', label: 'Valid' },
      { color: '#f87171', label: 'Blocked' },
    );
  }

  return (
    <View style={[styles.legend, { gap: scaleSpacing(isCompactHeight ? 6 : 8) }]}>
      {items.map((item) => (
        <View key={item.label} style={[styles.legendItem, { gap: scaleSpacing(3) }]}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <TerminalText variant="micro" style={{ color: theme.mutedColor }}>
            {item.label.toUpperCase()}
          </TerminalText>
        </View>
      ))}
    </View>
  );
}

/** Map panel — top band summary/intel, map canvas, legend. Sectors unchanged. */
export default function SectorMapPanel({
  theme,
  sectors,
  activeSectorId,
  onSectorPress,
  selectedContract,
}: SectorMapPanelProps): React.JSX.Element {
  const { sectionPadding, scaleSpacing, isCompactHeight, isMapTopBandStacked } = useVeilFrontLayout();
  const activeSector = useMemo(
    () => sectors.find((s) => s.id === activeSectorId) ?? sectors[0],
    [sectors, activeSectorId],
  );

  const contractForMap = useMemo(
    () => getSelectedContractForCompatibility(selectedContract),
    [selectedContract],
  );

  const sectorCompatibilityById = useMemo(() => {
    if (!contractForMap) return {} as Partial<Record<SectorId, ReturnType<typeof getContractSectorCompatibility>>>;
    return sectors.reduce<Partial<Record<SectorId, ReturnType<typeof getContractSectorCompatibility>>>>((acc, sector) => {
      acc[sector.id] = getContractSectorCompatibility(contractForMap, sector.id);
      return acc;
    }, {});
  }, [contractForMap, sectors]);

  return (
    <View style={[styles.panel, { padding: sectionPadding, gap: scaleSpacing(isCompactHeight ? 10 : 14) }]}>
      <View
        style={[
          styles.mapTopBand,
          isMapTopBandStacked ? styles.mapTopBandStacked : styles.mapTopBandRow,
          { gap: scaleSpacing(isCompactHeight ? 10 : 16) },
        ]}
      >
        <MapSectorSummary theme={theme} sector={activeSector} />
        {!isMapTopBandStacked ? <View style={styles.mapTopSpacer} /> : null}
        <SectorIntel theme={theme} sector={activeSector} />
      </View>

      <View style={styles.mapStage}>
        <VeilFrontMap
          theme={theme}
          sectors={sectors}
          activeSectorId={activeSectorId}
          onSectorPress={onSectorPress}
          sectorCompatibilityById={sectorCompatibilityById}
        />
      </View>

      <MapLegend theme={theme} showContractLegend={contractForMap != null} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  mapTopBand: {
    flexShrink: 0,
    minWidth: 0,
  },
  mapTopBandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mapTopBandStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  mapTopSpacer: {
    flex: 1,
    minWidth: 8,
  },
  mapStage: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flexShrink: 0,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
