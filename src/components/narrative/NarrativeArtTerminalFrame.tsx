import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NarrativeFlavorPanel from './NarrativeFlavorPanel';
import {
  NARRATIVE_ART_ZONE_FLEX,
  NARRATIVE_TERMINAL_BORDER_WIDTH,
  NARRATIVE_TERMINAL_FLEX,
  NARRATIVE_TERMINAL_GLASS,
  NARRATIVE_TERMINAL_PADDING,
} from '../../constants/narrativeLayout';
import {
  resolveImmersiveFooterInset,
  resolveImmersiveHorizontalInset,
  resolveImmersiveTopInset,
} from '../../constants/immersiveLayout';

interface NarrativeArtTerminalFrameProps {
  backgroundImage: ImageSourcePropType;
  accentColor?: string;
  flavorText: string;
  flavorPrimaryColor?: string;
  flavorMutedColor?: string;
  children: React.ReactNode;
}

/**
 * Full-bleed narrative canvas: background edge-to-edge, flavor brief left,
 * glass resolver terminal right (safe-area aware).
 */
export default function NarrativeArtTerminalFrame({
  backgroundImage,
  accentColor = '#00ff33',
  flavorText,
  flavorPrimaryColor,
  flavorMutedColor,
  children,
}: NarrativeArtTerminalFrameProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const horizontal = resolveImmersiveHorizontalInset(insets.left, insets.right);

  return (
    <View style={styles.root}>
      <Image
        source={backgroundImage}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <View
        style={[
          styles.safeHost,
          {
            paddingTop: resolveImmersiveTopInset(insets.top),
            paddingBottom: resolveImmersiveFooterInset(insets.bottom),
            paddingLeft: horizontal.paddingLeft,
            paddingRight: horizontal.paddingRight,
          },
        ]}
      >
        <View style={styles.splitRow}>
          <View style={styles.artZone}>
            <NarrativeFlavorPanel
              flavorText={flavorText}
              primaryColor={flavorPrimaryColor}
              mutedColor={flavorMutedColor}
            />
          </View>
          <View
            style={[
              styles.terminal,
              {
                borderLeftColor: accentColor,
                padding: NARRATIVE_TERMINAL_PADDING,
              },
            ]}
          >
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#050608',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  safeHost: {
    flex: 1,
    minHeight: 0,
  },
  splitRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  artZone: {
    flex: NARRATIVE_ART_ZONE_FLEX,
    minWidth: 0,
    minHeight: 0,
  },
  terminal: {
    flex: NARRATIVE_TERMINAL_FLEX,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: NARRATIVE_TERMINAL_GLASS,
    borderLeftWidth: NARRATIVE_TERMINAL_BORDER_WIDTH,
  },
});
