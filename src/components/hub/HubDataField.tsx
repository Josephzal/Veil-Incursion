import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TerminalText from '../TerminalText';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import { useResponsiveScale } from '../../hooks/useResponsiveScale';
import { formatBracketHeader } from '../../styles/hubTerminalUi';

type HubFieldIcon = keyof typeof Ionicons.glyphMap;

interface HubDataFieldProps {
  title: string;
  value: string;
  valueColor: string;
  mutedColor: string;
  icon: HubFieldIcon;
  /** Override icon tint (e.g. faction accent for Cabal Alignment). */
  iconColor?: string;
}

export default function HubDataField({
  title,
  value,
  valueColor,
  mutedColor,
  icon,
  iconColor,
}: HubDataFieldProps): React.JSX.Element {
  const { scaleSize, scaleSpacing } = useResponsiveScale();
  const keyColor = hubKeyColor(mutedColor);
  const iconTint = iconColor ?? keyColor;

  return (
    <View style={[styles.root, { gap: scaleSpacing(3) }]}>
      <View style={[styles.headerRow, { gap: scaleSpacing(5) }]}>
        <Ionicons name={icon} size={scaleSize(11)} color={iconTint} style={styles.icon} />
        <TerminalText size={8} letterSpacing={1} style={[styles.key, { color: keyColor }]}>
          {formatBracketHeader(title)}
        </TerminalText>
      </View>
      <TerminalText
        size={10}
        lineHeight={13}
        letterSpacing={0.5}
        style={[styles.value, { color: valueColor, paddingLeft: scaleSpacing(16) }]}
        numberOfLines={2}
      >
        {value}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexShrink: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    flexShrink: 0,
  },
  key: {
    fontWeight: '700',
    flex: 1,
  },
  value: {
    fontWeight: '800',
  },
});
