import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { IconBadge } from './VeilFrontUiPrimitives';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import type { SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { SECTOR_FLAVOR_LINES, VEIL_BIOME_VISUALS } from '../../utils/veilFrontSectorUi';

interface SelectedSectorInlineHeaderProps {
  theme: TerminalTheme;
  sector: SectorState;
}

/** Compact sector identity block for the map panel top-left. */
export default function SelectedSectorInlineHeader({
  theme,
  sector,
}: SelectedSectorInlineHeaderProps): React.JSX.Element {
  const { scaleSpacing, scaleSize, scaleFont, descriptionLines, showOptionalCopy } = useVeilFrontLayout();
  const biomeVisual = VEIL_BIOME_VISUALS[sector.veilBiome];
  const flavor = SECTOR_FLAVOR_LINES[sector.id];

  return (
    <View style={[styles.root, { gap: scaleSpacing(10), maxWidth: scaleSpacing(420) }]}>
      <IconBadge icon={biomeVisual.icon} accentColor={biomeVisual.glow} size={scaleSize(32)} />
      <View style={styles.copy}>
        <TerminalText
          size={scaleFont(14)}
          letterSpacing={0.6}
          style={{ color: theme.textColor, fontWeight: '800', lineHeight: scaleSize(16) }}
          numberOfLines={1}
        >
          {sector.displayName.toUpperCase()}
        </TerminalText>
        <TerminalText
          size={scaleFont(7.5)}
          letterSpacing={1.2}
          style={{ color: biomeVisual.glow, marginTop: scaleSpacing(2) }}
          numberOfLines={1}
        >
          {biomeVisual.label.toUpperCase()}
        </TerminalText>
        {showOptionalCopy ? (
          <TerminalText
            size={scaleFont(7)}
            style={{ color: theme.mutedColor, marginTop: scaleSpacing(6), lineHeight: scaleSize(11) }}
            numberOfLines={descriptionLines}
          >
            {flavor}
          </TerminalText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
});
