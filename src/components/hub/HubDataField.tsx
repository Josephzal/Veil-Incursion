import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import { formatBracketHeader } from '../../styles/hubTerminalUi';

type HubFieldIcon = keyof typeof Ionicons.glyphMap;

interface HubDataFieldProps {
  title: string;
  value: string;
  valueColor: string;
  mutedColor: string;
  icon: HubFieldIcon;
}

export default function HubDataField({
  title,
  value,
  valueColor,
  mutedColor,
  icon,
}: HubDataFieldProps): React.JSX.Element {
  const keyColor = hubKeyColor(mutedColor);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Ionicons name={icon} size={11} color={keyColor} style={styles.icon} />
        <Text style={[styles.key, { color: keyColor }]}>
          {formatBracketHeader(title)}
        </Text>
      </View>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 3,
    flexShrink: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  icon: {
    flexShrink: 0,
  },
  key: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    flex: 1,
  },
  value: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 13,
    paddingLeft: 16,
  },
});
