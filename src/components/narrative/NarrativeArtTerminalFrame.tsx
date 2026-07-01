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
  NARRATIVE_TERMINAL_BORDER_WIDTH,
  NARRATIVE_TERMINAL_GLASS,
} from '../../constants/narrativeLayout';
import {
  resolveImmersiveFooterInset,
  resolveImmersiveHorizontalInset,
  resolveImmersiveTopInset,
} from '../../constants/immersiveLayout';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

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
  const {
    isDesktop,
    activeViewportWidth,
    columnWidth,
    gap,
    scaleSpacing,
  } = useResponsiveLayout();

  const terminalPadding = isDesktop ? scaleSpacing(24) : scaleSpacing(18);

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
        <View
          style={[
            styles.masterContainer,
            {
              maxWidth: isDesktop ? activeViewportWidth : undefined,
              gap: isDesktop ? gap : 0,
            },
          ]}
        >
          <View
            style={[
              styles.artZone,
              isDesktop ? styles.desktopColumn : styles.mobileArtZone,
              isDesktop ? { width: columnWidth } : null,
            ]}
          >
            <NarrativeFlavorPanel
              flavorText={flavorText}
              primaryColor={flavorPrimaryColor}
              mutedColor={flavorMutedColor}
            />
          </View>
          <View
            style={[
              styles.terminal,
              isDesktop ? styles.desktopColumn : styles.mobileTerminal,
              isDesktop ? { width: columnWidth } : null,
              {
                borderLeftColor: accentColor,
                padding: terminalPadding,
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
    alignItems: 'center',
  },
  masterContainer: {
    width: '100%',
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  desktopColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  mobileArtZone: {
    flex: 0.58,
    minWidth: 0,
    minHeight: 0,
  },
  mobileTerminal: {
    flex: 0.42,
    minWidth: 0,
    minHeight: 0,
  },
  artZone: {
    minHeight: 0,
  },
  terminal: {
    minHeight: 0,
    backgroundColor: NARRATIVE_TERMINAL_GLASS,
    borderLeftWidth: NARRATIVE_TERMINAL_BORDER_WIDTH,
  },
});
