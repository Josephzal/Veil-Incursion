import React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { OTT } from '../../../constants/occultTacticalTerminalTheme';

interface CombatPanelProps extends ViewProps {
  raised?: boolean;
  framed?: boolean;
  children: React.ReactNode;
}

/** Shared black-glass combat panel shell. */
export default function CombatPanel({
  raised = false,
  framed = true,
  style,
  children,
  ...rest
}: CombatPanelProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.panel,
        raised ? styles.raised : styles.deep,
        framed ? styles.framed : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

interface CombatSectionHeaderProps {
  label: string;
  accent?: string;
  trailing?: React.ReactNode;
}

export function CombatSectionHeader({
  label,
  accent = OTT.terminalGreenMuted,
  trailing,
}: CombatSectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.header, { color: accent }]} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
    borderRadius: 2,
  },
  deep: {
    backgroundColor: OTT.deepPanel,
  },
  raised: {
    backgroundColor: OTT.raisedPanel,
  },
  framed: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OTT.borderSubtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6,
  },
  header: {
    fontFamily: OTT.mono,
    fontSize: OTT.headerSize,
    fontWeight: '700',
    letterSpacing: OTT.headerTracking,
    textTransform: 'uppercase',
  },
});
