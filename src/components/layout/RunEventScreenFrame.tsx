import React from 'react';
import {
  Image,
  ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANDSCAPE_PANEL_PADDING } from '../../constants/landscapeLayout';
import {
  resolveImmersiveContentPadding,
  resolveImmersiveFooterInset,
  resolveImmersiveHorizontalInset,
} from '../../constants/immersiveLayout';
import { HIDDEN_SCROLLBAR_VIEW_STYLE, HIDDEN_SCROLLVIEW_PROPS } from '../../utils/hiddenScrollbarStyle';
import { VEIL } from '../../theme/veilTerminalTokens';

interface RunEventScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  borderColor?: string;
  eyebrowColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  align?: 'center' | 'left';
  children?: React.ReactNode;
}

export function RunEventScreenHeader({
  eyebrow,
  title,
  subtitle,
  borderColor = VEIL.line,
  eyebrowColor = VEIL.textMuted,
  titleColor = VEIL.bone,
  subtitleColor = VEIL.textSoft,
  align = 'center',
  children,
}: RunEventScreenHeaderProps): React.JSX.Element {
  const textAlign = align === 'center' ? 'center' : 'left';

  return (
    <View style={[styles.header, { borderBottomColor: borderColor }]}>
      {eyebrow ? (
        <Text style={[styles.headerEyebrow, { color: eyebrowColor, textAlign }]}>{eyebrow}</Text>
      ) : null}
      <Text style={[styles.headerTitle, { color: titleColor, textAlign }]}>{title}</Text>
      {subtitle != null ? (
        typeof subtitle === 'string' ? (
          <Text style={[styles.headerSubtitle, { color: subtitleColor, textAlign }]}>{subtitle}</Text>
        ) : (
          subtitle
        )
      ) : null}
      {children}
    </View>
  );
}

interface RunEventScreenFrameProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
  backgroundImage?: ImageSourcePropType;
  backgroundScrimOpacity?: number;
  overlay?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  scrollContentContainerStyle?: StyleProp<ViewStyle>;
  contentPadding?: number;
}

/**
 * Standard run event layout — header strip, flex/scroll body, pinned footer.
 * Full viewport height inside IncursionRunLayout (no macro log reservation).
 */
export default function RunEventScreenFrame({
  children,
  header,
  footer,
  scrollable = false,
  backgroundImage,
  backgroundScrimOpacity = 0.75,
  overlay,
  style,
  bodyStyle,
  scrollContentContainerStyle,
  contentPadding = LANDSCAPE_PANEL_PADDING,
}: RunEventScreenFrameProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const horizontal = resolveImmersiveHorizontalInset(insets.left, insets.right);
  const framePaddingTop = resolveImmersiveContentPadding(insets.top, contentPadding);
  const footerBottomInset = resolveImmersiveFooterInset(insets.bottom);
  const framePaddingBottom = footer
    ? contentPadding
    : Math.max(contentPadding, footerBottomInset);

  const body = scrollable ? (
    <ScrollView
      style={[styles.bodyScroll, HIDDEN_SCROLLBAR_VIEW_STYLE, bodyStyle]}
      contentContainerStyle={[styles.scrollContent, scrollContentContainerStyle]}
      {...HIDDEN_SCROLLVIEW_PROPS}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, bodyStyle]}>{children}</View>
  );

  return (
    <View style={[styles.root, style]}>
      {backgroundImage ? (
        <>
          <Image source={backgroundImage} style={styles.backgroundImage} resizeMode="cover" />
          <View
            style={[styles.backgroundScrim, { backgroundColor: `rgba(9, 9, 11, ${backgroundScrimOpacity})` }]}
            pointerEvents="none"
          />
        </>
      ) : null}

      <View
        style={[
          styles.frame,
          {
            paddingTop: framePaddingTop,
            paddingBottom: framePaddingBottom,
            paddingLeft: contentPadding + horizontal.paddingLeft,
            paddingRight: contentPadding + horizontal.paddingRight,
          },
        ]}
      >
        {header ? <View style={styles.headerSlot}>{header}</View> : null}
        {body}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: footerBottomInset }]}>
            {footer}
          </View>
        ) : null}
      </View>

      {overlay}
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
  backgroundScrim: {
    ...StyleSheet.absoluteFill,
  },
  frame: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  headerSlot: {
    flexShrink: 0,
    gap: 10,
  },
  header: {
    flexShrink: 0,
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 10,
    gap: 4,
  },
  headerEyebrow: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.4,
    marginTop: 4,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyScroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 10,
  },
  footer: {
    flexShrink: 0,
    paddingTop: 8,
    gap: 8,
  },
});
