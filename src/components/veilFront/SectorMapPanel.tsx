import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import VeilFrontMap from './VeilFrontMap';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import type { SectorId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { hazardLabel, rewardLabel, sectorTierColor } from '../../utils/veilFrontSectorUi';

interface SectorMapPanelProps {
  theme: TerminalTheme;
  sectors: SectorState[];
  activeSectorId: SectorId;
  onSectorPress: (id: SectorId) => void;
}

function StatLine({ label, value, valueColor, mutedColor }: { label: string; value: string; valueColor: string; mutedColor: string }) {
  const { scaleFont, scaleSpacing } = useVeilFrontLayout();
  return (
    <View style={[styles.statLine, { gap: scaleSpacing(8) }]}>
      <TerminalText size={scaleFont(5.6)} letterSpacing={0.9} style={[styles.statLabel, { color: mutedColor }]}>
        {label}
      </TerminalText>
      <TerminalText size={scaleFont(7.2)} letterSpacing={0.4} style={{ color: valueColor, fontWeight: '800' }}>
        {value}
      </TerminalText>
    </View>
  );
}

/**
 * Clean tactical scan board — connected sector borders, grid and names only.
 * Threat/Reward/Echo/Anchor sit directly on the map (upper right, no container).
 */
export default function SectorMapPanel({
  theme,
  sectors,
  activeSectorId,
  onSectorPress,
}: SectorMapPanelProps): React.JSX.Element {
  const { sectionPadding } = useVeilFrontLayout();
  const activeSector = useMemo(
    () => sectors.find((s) => s.id === activeSectorId) ?? sectors[0],
    [sectors, activeSectorId],
  );

  const anchorActive = activeSector.activeAnchor != null;

  return (
    <View style={[styles.panel, { padding: sectionPadding }]}>
      <View style={styles.mapStage}>
        <VeilFrontMap
          theme={theme}
          sectors={sectors}
          activeSectorId={activeSectorId}
          onSectorPress={onSectorPress}
        />
      </View>

      <View style={[styles.statsOverlay, { top: sectionPadding, left: sectionPadding }]} pointerEvents="none">
        <StatLine label="THREAT" value={hazardLabel(activeSector.hazardLevel).toUpperCase()} valueColor={sectorTierColor(activeSector.hazardLevel)} mutedColor={theme.mutedColor} />
        <StatLine label="YIELD" value={rewardLabel(activeSector.rewardLevel).toUpperCase()} valueColor={sectorTierColor(activeSector.rewardLevel)} mutedColor={theme.mutedColor} />
        <StatLine label="ANCHOR" value={anchorActive ? 'ACTIVE' : 'NONE'} valueColor={anchorActive ? '#c084fc' : theme.mutedColor} mutedColor={theme.mutedColor} />
      </View>
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
  mapStage: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  statsOverlay: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
  },
  statLabel: {
    minWidth: 54,
  },
});
