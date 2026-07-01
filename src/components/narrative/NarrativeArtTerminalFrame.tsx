import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NarrativeFlavorPanel from './NarrativeFlavorPanel';
import TerminalOverlay from '../TerminalOverlay';
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
  header?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Full-bleed narrative canvas: field report left, resolver / tension terminal right.
 */
export default function NarrativeArtTerminalFrame({
  backgroundImage,
  flavorText,
  flavorPrimaryColor,
  flavorMutedColor,
  header,
  children,
}: NarrativeArtTerminalFrameProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const horizontal = resolveImmersiveHorizontalInset(insets.left, insets.right);
  const {
    isDesktop,
    activeViewportWidth,
    columnWidth,
    gap,
  } = useResponsiveLayout();

  return (
    <View style={styles.root}>
      <Image
        source={backgroundImage}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.overlayHost} pointerEvents="none">
        <TerminalOverlay />
      </View>

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
              maxWidth: activeViewportWidth,
              gap,
            },
          ]}
        >
          {header ? (
            <View style={styles.headerSlot}>
              {header}
            </View>
          ) : null}
          <View
            style={[
              styles.columnsRow,
              isDesktop ? styles.columnsRowDesktop : null,
              { gap },
            ]}
          >
          <View
            style={[
              styles.column,
              isDesktop ? { width: columnWidth } : styles.mobileColumn,
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
              styles.column,
              isDesktop ? { width: columnWidth } : styles.mobileColumn,
            ]}
          >
            {children}
          </View>
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
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  safeHost: {
    flex: 1,
    minHeight: 0,
    alignItems: 'stretch',
    zIndex: 2,
  },
  masterContainer: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  headerSlot: {
    width: '100%',
    flexShrink: 0,
    zIndex: 3,
  },
  columnsRow: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    flexDirection: 'column',
  },
  columnsRowDesktop: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  mobileColumn: {
    width: '100%',
  },
});
