import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  resolveImmersiveContentPadding,
  resolveImmersiveFooterInset,
  resolveImmersiveHorizontalInset,
} from '../../constants/immersiveLayout';

/** Matches ExtractionReviewScreen scrim — background art stays visible. */
export const RUN_EVENT_IMMERSIVE_SCRIM = 'rgba(9, 9, 11, 0.75)';

interface RunEventImmersiveBackdropProps {
  backgroundImage: ImageSourcePropType;
  children: React.ReactNode;
  contentPadding?: number;
  contentStyle?: StyleProp<ViewStyle>;
  overlay?: React.ReactNode;
}

export default function RunEventImmersiveBackdrop({
  backgroundImage,
  children,
  contentPadding = 16,
  contentStyle,
  overlay,
}: RunEventImmersiveBackdropProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const horizontal = resolveImmersiveHorizontalInset(insets.left, insets.right);
  const paddingTop = resolveImmersiveContentPadding(insets.top, contentPadding);
  const paddingBottom = Math.max(
    contentPadding,
    resolveImmersiveFooterInset(insets.bottom),
  );

  return (
    <View style={styles.root}>
      <Image
        source={backgroundImage}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View
        style={[styles.scrim, { backgroundColor: RUN_EVENT_IMMERSIVE_SCRIM }]}
        pointerEvents="none"
      >
        {overlay}
      </View>
      <View
        style={[
          styles.contentShell,
          {
            paddingTop,
            paddingBottom,
            paddingLeft: contentPadding + horizontal.paddingLeft,
            paddingRight: contentPadding + horizontal.paddingRight,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  contentShell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    zIndex: 2,
    alignItems: 'stretch',
  },
});
