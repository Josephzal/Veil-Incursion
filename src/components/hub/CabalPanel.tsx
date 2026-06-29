import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  resolveFactionSlateBackground,
  resolveFactionSlateInnerBorder,
} from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import type { FactionType } from '../../types/game';

interface CabalPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Override player alignment for border tint. */
  faction?: FactionType | null;
}

/** Faction-tinted glass slate — shared hub / war-board container. */
export default function CabalPanel({
  children,
  style,
  contentStyle,
  faction,
}: CabalPanelProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const aligned = faction ?? account.alignedFaction;
  const slateBg = resolveFactionSlateBackground(aligned);
  const slateBorder = resolveFactionSlateInnerBorder(aligned);

  return (
    <View style={[styles.outer, { backgroundColor: slateBg }, style]}>
      <View style={[styles.inner, { borderColor: slateBorder }, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
