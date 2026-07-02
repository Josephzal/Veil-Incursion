import React from 'react';
import { StyleSheet, View } from 'react-native';
import NarrativeFlavorPanel from './NarrativeFlavorPanel';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

interface NarrativeArtTerminalFrameProps {
  flavorText: string;
  flavorPrimaryColor?: string;
  flavorMutedColor?: string;
  children: React.ReactNode;
}

/** Two-column narrative body — field report left, resolver terminal right. */
export default function NarrativeArtTerminalFrame({
  flavorText,
  flavorPrimaryColor,
  flavorMutedColor,
  children,
}: NarrativeArtTerminalFrameProps): React.JSX.Element {
  const {
    isDesktop,
    activeViewportWidth,
    columnWidth,
    gap,
  } = useResponsiveLayout();

  return (
    <View
      style={[
        styles.masterContainer,
        {
          maxWidth: activeViewportWidth,
          gap,
        },
      ]}
    >
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
  );
}

const styles = StyleSheet.create({
  masterContainer: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignSelf: 'center',
    alignItems: 'stretch',
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
