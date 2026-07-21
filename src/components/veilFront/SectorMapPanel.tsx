import React from 'react';
import { StyleSheet, View } from 'react-native';
import VeilFrontMap from './VeilFrontMap';
import type { SectorId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';

interface SectorMapPanelProps {
  theme: TerminalTheme;
  sectors: SectorState[];
  activeSectorId: SectorId;
  onSectorPress: (id: SectorId) => void;
  unlockedSectorIds?: ReadonlySet<SectorId> | readonly SectorId[];
  sectorLockLabels?: Partial<Record<SectorId, string>>;
}

/** Full-bleed survey board — sector map only (stats live on the right panel). */
export default function SectorMapPanel({
  theme,
  sectors,
  activeSectorId,
  onSectorPress,
  unlockedSectorIds,
  sectorLockLabels,
}: SectorMapPanelProps): React.JSX.Element {
  return (
    <View style={styles.panel}>
      <VeilFrontMap
        theme={theme}
        sectors={sectors}
        activeSectorId={activeSectorId}
        onSectorPress={onSectorPress}
        unlockedSectorIds={unlockedSectorIds}
        sectorLockLabels={sectorLockLabels}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
});
