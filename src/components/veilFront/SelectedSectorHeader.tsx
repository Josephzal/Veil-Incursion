import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { IconBadge } from './VeilFrontUiPrimitives';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import type { SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { SECTOR_FLAVOR_LINES, VEIL_BIOME_VISUALS } from '../../utils/veilFrontSectorUi';

interface SelectedSectorHeaderProps {
  theme: TerminalTheme;
  sector: SectorState;
}

export default function SelectedSectorHeader({
  theme,
  sector,
}: SelectedSectorHeaderProps): React.JSX.Element {
  const { isDossierGrid, scaleSpacing, scaleSize, scaleFont } = useVeilFrontLayout();
  const biomeVisual = VEIL_BIOME_VISUALS[sector.veilBiome];
  const flavor = SECTOR_FLAVOR_LINES[sector.id];

  return (
    <View
      style={[
        styles.strip,
        {
          paddingHorizontal: scaleSpacing(14),
          paddingVertical: scaleSpacing(12),
          gap: scaleSpacing(isDossierGrid ? 14 : 10),
          borderColor: `${biomeVisual.glow}44`,
        },
      ]}
    >
      <View style={[styles.mainRow, { gap: scaleSpacing(12) }]}>
        <IconBadge
          icon={biomeVisual.icon}
          accentColor={biomeVisual.glow}
          size={scaleSize(isDossierGrid ? 36 : 32)}
        />
        <View style={styles.titleGroup}>
          <TerminalText
            size={scaleFont(isDossierGrid ? 14 : 12)}
            letterSpacing={0.8}
            style={{ color: theme.textColor, fontWeight: '800' }}
            numberOfLines={1}
          >
            {sector.displayName.toUpperCase()}
          </TerminalText>
          <TerminalText
            size={scaleFont(8)}
            letterSpacing={1}
            style={{ color: biomeVisual.glow, marginTop: scaleSpacing(2) }}
            numberOfLines={1}
          >
            {sector.biome.toUpperCase()}
          </TerminalText>
        </View>
        {isDossierGrid ? (
          <TerminalText
            size={scaleFont(8)}
            style={{ color: theme.mutedColor, lineHeight: scaleSize(13), flex: 1, minWidth: 0 }}
            numberOfLines={2}
          >
            {flavor}
          </TerminalText>
        ) : null}
      </View>
      {!isDossierGrid ? (
        <TerminalText
          size={scaleFont(8)}
          style={{ color: theme.mutedColor, lineHeight: scaleSize(13) }}
          numberOfLines={2}
        >
          {flavor}
        </TerminalText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    backgroundColor: 'rgba(12, 18, 30, 0.72)',
    minWidth: 0,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  titleGroup: {
    flexShrink: 0,
    minWidth: 0,
    maxWidth: '42%',
  },
});
