import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import NarrativeFlavorPanel from './NarrativeFlavorPanel';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { resolveSplitLanes } from '../../utils/cargoGridLayout';
import {
  NARRATIVE_FIELD_LANE_RATIO,
  NARRATIVE_FIELD_PLATE_MAX_HEIGHT,
} from '../../constants/narrativeLayout';

interface NarrativeArtTerminalFrameProps {
  flavorText: string;
  flavorPrimaryColor?: string;
  flavorMutedColor?: string;
  children: React.ReactNode;
}

/**
 * Asymmetrical narrative body — environment-first.
 * Field-report plate and resolver stack share a top-aligned row so the
 * brief and choices read as one instrument instead of floating independently.
 */
export default function NarrativeArtTerminalFrame({
  flavorText,
  flavorPrimaryColor,
  flavorMutedColor,
  children,
}: NarrativeArtTerminalFrameProps): React.JSX.Element {
  const {
    isDesktop,
    activeViewportWidth,
    gap,
  } = useResponsiveLayout();

  const { leftWidth: fieldLaneWidth, rightWidth: resolverLaneWidth } = useMemo(
    () => resolveSplitLanes(activeViewportWidth, gap, NARRATIVE_FIELD_LANE_RATIO),
    [activeViewportWidth, gap],
  );

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
            styles.fieldLane,
            isDesktop
              ? { width: fieldLaneWidth, justifyContent: 'flex-start', alignSelf: 'flex-start' }
              : styles.mobileColumn,
          ]}
        >
          <View style={isDesktop ? styles.fieldPlateClamp : styles.mobileFieldClamp}>
            <NarrativeFlavorPanel
              flavorText={flavorText}
              primaryColor={flavorPrimaryColor}
              mutedColor={flavorMutedColor}
            />
          </View>
        </View>
        <View
          style={[
            styles.column,
            isDesktop ? { width: resolverLaneWidth } : styles.mobileColumn,
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
  fieldLane: {
    minWidth: 0,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  fieldPlateClamp: {
    width: '100%',
    flexGrow: 0,
    minHeight: 0,
    maxHeight: NARRATIVE_FIELD_PLATE_MAX_HEIGHT,
    alignSelf: 'stretch',
  },
  mobileFieldClamp: {
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  mobileColumn: {
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
});
