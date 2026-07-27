import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import FieldPlate from './FieldPlate';
import { RUN_FIELD } from '../../theme/runFieldTokens';

interface RunOverlayProps {
  visible: boolean;
  title: string;
  /** Location / vitals / manifest sub-line — mixed case preferred. */
  contextLine?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Caps panel width — plate stays centered and never exceeds the viewport. */
  maxWidth?: number;
  /** Exact panel width when callers need pixel-precise inner layout (e.g. cargo grid). */
  width?: DimensionValue;
  /** Hot mint frame + slightly larger header for combat readability. */
  combatMode?: boolean;
  /** Header title / close glyph accent — defaults to RUN_FIELD.mint. */
  accentColor?: string;
  /** Extra header content between the title block and the close control (e.g. credits HUD). */
  headerAccessory?: React.ReactNode;
  contentPadding?: number;
  bodyStyle?: StyleProp<ViewStyle>;
  closeAccessibilityLabel?: string;
}

/**
 * Shared chrome for in-run field modals (status dossier, cargo manifest, etc).
 * Dim backdrop keeps the arena legible; scanner surfaces are untouched.
 */
export default function RunOverlay({
  visible,
  title,
  contextLine,
  onClose,
  children,
  maxWidth = 480,
  width = '92%',
  combatMode = false,
  accentColor = RUN_FIELD.mint,
  headerAccessory,
  contentPadding = 18,
  bodyStyle,
  closeAccessibilityLabel,
}: RunOverlayProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={styles.backdrop}
        {...({ [RUN_FIELD.scopeAttr]: RUN_FIELD.scopeValue } as object)}
      >
        <HapticPressable
          style={styles.backdropTap}
          onPress={onClose}
          accessibilityLabel={closeAccessibilityLabel ?? `Close ${title}`}
        />

        <View style={styles.host} pointerEvents="box-none">
          <FieldPlate
            density="strong"
            tone={combatMode ? 'mint' : 'neutral'}
            state={combatMode ? 'selected' : 'idle'}
            style={[styles.plate, { width, maxWidth }]}
            contentStyle={[styles.plateContent, { padding: contentPadding }]}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text
                  style={[
                    styles.title,
                    combatMode ? styles.titleCombat : null,
                    { color: accentColor },
                  ]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                {contextLine ? (
                  <Text style={styles.contextLine} numberOfLines={2}>
                    {contextLine}
                  </Text>
                ) : null}
              </View>
              {headerAccessory ? (
                <View style={styles.headerAccessory}>{headerAccessory}</View>
              ) : null}
              <HapticPressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { borderColor: accentColor, opacity: pressed ? 0.7 : 1 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={[styles.closeGlyph, { color: accentColor }]}>✕</Text>
              </HapticPressable>
            </View>
            <View style={styles.headerBaseline} />

            <View style={[styles.body, bodyStyle]}>{children}</View>
          </FieldPlate>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    width: '100%',
    backgroundColor: `rgba(5, 9, 10, ${RUN_FIELD.environmentScrimDense})`,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  backdropTap: {
    ...StyleSheet.absoluteFill,
  },
  host: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plate: {
    maxHeight: '92%',
  },
  plateContent: {
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.title,
    fontWeight: '800',
    letterSpacing: 1,
  },
  titleCombat: {
    fontSize: RUN_FIELD.type.title + 2,
  },
  contextLine: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: RUN_FIELD.textSecondary,
  },
  headerAccessory: {
    flexShrink: 0,
    paddingTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 14, 15, 0.55)',
    flexShrink: 0,
  },
  closeGlyph: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 17,
  },
  headerBaseline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    backgroundColor: RUN_FIELD.line,
    marginTop: 12,
    marginBottom: 12,
  },
  body: {
    minWidth: 0,
  },
});
