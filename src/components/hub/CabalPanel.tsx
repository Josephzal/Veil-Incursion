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
  /** Size to content (modals) instead of stretching in a flex parent. */
  shrinkWrap?: boolean;
  /** When shrinkWrap, allow inner content to fill a stretched parent height. */
  fillHeight?: boolean;
}

/** Faction-tinted glass slate — shared hub / war-board container. */
export default function CabalPanel({
  children,
  style,
  contentStyle,
  faction,
  shrinkWrap = false,
  fillHeight = false,
}: CabalPanelProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const aligned = faction ?? account.alignedFaction;
  const slateBg = resolveFactionSlateBackground(aligned);
  const slateBorder = resolveFactionSlateInnerBorder(aligned);

  return (
    <View
      style={[
        shrinkWrap ? styles.shrinkOuter : styles.outer,
        shrinkWrap && fillHeight ? styles.shrinkOuterFill : null,
        { backgroundColor: slateBg },
        style,
      ]}
    >
      <View
        style={[
          shrinkWrap ? styles.shrinkInner : styles.inner,
          fillHeight ? styles.shrinkInnerFill : null,
          { borderColor: slateBorder },
          contentStyle,
        ]}
      >
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
  shrinkOuter: {
    alignSelf: 'center',
  },
  shrinkOuterFill: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: '100%',
  },
  shrinkInner: {
    borderWidth: 1,
  },
  shrinkInnerFill: {
    flex: 1,
    minHeight: '100%',
  },
});
