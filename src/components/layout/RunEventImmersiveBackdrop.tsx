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
import { RUN_FIELD } from '../../theme/runFieldTokens';

/** Preferred field scrim — environment stays readable (~40–55%). */
export const RUN_EVENT_IMMERSIVE_SCRIM = `rgba(5, 9, 10, ${RUN_FIELD.environmentScrim})`;

interface RunEventImmersiveBackdropProps {
  backgroundImage: ImageSourcePropType;
  children: React.ReactNode;
  contentPadding?: number;
  contentStyle?: StyleProp<ViewStyle>;
  overlay?: React.ReactNode;
  /** Scrim darkness over background art — 0 shows art at full brightness. */
  scrimOpacity?: number;
}

export default function RunEventImmersiveBackdrop({
  backgroundImage,
  children,
  contentPadding = 16,
  contentStyle,
  overlay,
  scrimOpacity = RUN_FIELD.environmentScrim,
}: RunEventImmersiveBackdropProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const horizontal = resolveImmersiveHorizontalInset(insets.left, insets.right);
  const paddingTop = resolveImmersiveContentPadding(insets.top, contentPadding);
  const paddingBottom = Math.max(
    contentPadding,
    resolveImmersiveFooterInset(insets.bottom),
  );

  return (
    <View
      style={styles.root}
      {...({ [RUN_FIELD.scopeAttr]: RUN_FIELD.scopeValue } as object)}
    >
      <Image
        source={backgroundImage}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      {/* Localized vignette — not a uniform black crush */}
      <View
        style={[
          styles.scrim,
          { backgroundColor: `rgba(5, 9, 10, ${scrimOpacity})` },
        ]}
        pointerEvents="none"
      />
      <View style={styles.topWash} pointerEvents="none" />
      <View style={styles.bottomWash} pointerEvents="none" />
      {overlay ? (
        <View style={styles.overlayHost} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}
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
    backgroundColor: RUN_FIELD.black,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  topWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '22%',
    backgroundColor: 'rgba(5, 9, 10, 0.35)',
  },
  bottomWash: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '28%',
    backgroundColor: 'rgba(5, 9, 10, 0.45)',
  },
  overlayHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  contentShell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    zIndex: 2,
    alignItems: 'stretch',
  },
});
