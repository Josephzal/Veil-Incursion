import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  type ImageSourcePropType,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import type { SchematicGlyphFamily } from './SchematicGlyph';
import { SchematicGlyphMark } from './SchematicGlyph';

export interface FabricationReceiptRecord {
  /** Distinguishes separate successful fabrication events. */
  receiptId: string;
  fabricatedRecordId: string;
  itemId: string;
  label: string;
  outcome: string;
  classCode: string;
  category: string;
  classification?: string;
  quantity?: number;
  artwork?: ImageSourcePropType | null;
  glyphFamily?: SchematicGlyphFamily;
  occult?: boolean;
}

interface FabricationReceiptProps {
  record: FabricationReceiptRecord | null;
  onDismiss: () => void;
  reducedMotion?: boolean;
  autoDismissMs?: number;
}

const BG = '#06100F';
const SURFACE = '#0A1715';
const BORDER = '#294F49';
const ACCENT = '#68DCC1';
const IMPACT = '#D8FFF4';
const TEXT = '#E8EFEC';
const MUTED = '#809995';
const DIM = '#506B67';
const OCCULT = '#A999C2';

/** Compact occult-terminal fabrication receipt — independent of Forge selection. */
export default function FabricationReceipt({
  record,
  onDismiss,
  reducedMotion = false,
  autoDismissMs = 2600,
}: FabricationReceiptProps): React.JSX.Element | null {
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelReveal = useRef(new Animated.Value(0)).current;
  const artOpacity = useRef(new Animated.Value(0)).current;
  const artOffset = useRef(new Animated.Value(6)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const qtyOpacity = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const rail = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!record) return undefined;

    const clearDismiss = () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    };

    clearDismiss();
    panelOpacity.setValue(0);
    panelReveal.setValue(reducedMotion ? 1 : 0);
    artOpacity.setValue(reducedMotion ? 1 : 0);
    artOffset.setValue(reducedMotion ? 0 : 6);
    copyOpacity.setValue(reducedMotion ? 1 : 0);
    qtyOpacity.setValue(reducedMotion ? 1 : 0);
    flash.setValue(0);
    rail.setValue(0);

    const beginHoldDismiss = () => {
      clearDismiss();
      dismissTimer.current = setTimeout(() => {
        Animated.timing(panelOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) onDismiss();
        });
      }, autoDismissMs);
    };

    if (reducedMotion) {
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) beginHoldDismiss();
      });
    } else {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rail, { toValue: 1, duration: 100, useNativeDriver: false }),
          Animated.timing(panelOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.timing(panelReveal, { toValue: 1, duration: 220, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(artOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(artOffset, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 120, useNativeDriver: true }),
        ]),
        Animated.timing(copyOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(qtyOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) beginHoldDismiss();
      });
    }

    return clearDismiss;
  }, [
    artOffset,
    artOpacity,
    autoDismissMs,
    copyOpacity,
    flash,
    onDismiss,
    panelOpacity,
    panelReveal,
    qtyOpacity,
    rail,
    record,
    reducedMotion,
  ]);

  useEffect(() => {
    if (!record || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss, record]);

  if (!record) return null;

  const recordCode = `FAB-${record.classCode}`;
  const announcement = `Fabrication complete. ${record.label}. ${record.outcome}.`;
  const categoryLine = [record.category, record.classification]
    .filter(Boolean)
    .join(' · ');
  const revealWidth = panelReveal.interpolate({
    inputRange: [0, 1],
    outputRange: ['8%', '100%'],
  });

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      accessibilityRole="text"
      {...(Platform.OS === 'web'
        ? ({
            role: 'status',
            'aria-live': 'polite',
            'aria-atomic': 'true',
          } as object)
        : { accessibilityLiveRegion: 'polite' as const })}
      accessibilityLabel={announcement}
    >
      <View
        pointerEvents="none"
        accessible={false}
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
        style={styles.dim}
      />

      <Animated.View style={[styles.receiptShell, { opacity: panelOpacity }]}>
      <Animated.View
        style={[
          styles.receiptReveal,
          { width: reducedMotion ? '100%' : revealWidth },
        ]}
      >
      <View style={styles.receipt}>
        <View
          pointerEvents="none"
          accessible={false}
          {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
          style={styles.mintEdge}
        />
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <View
              accessible={false}
              {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
              style={styles.signalNode}
            />
            <TerminalText size={8} letterSpacing={1.05} style={styles.statusText}>
              FABRICATION COMPLETE
            </TerminalText>
          </View>
          <TerminalText size={7} letterSpacing={0.85} style={styles.recordCode}>
            {recordCode}
          </TerminalText>
        </View>

        <View
          pointerEvents="none"
          accessible={false}
          {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
          style={styles.rail}
        >
          <View style={styles.railSegA} />
          <View style={styles.railNode} />
          <View style={styles.railSegB} />
          <Animated.View
            style={[
              styles.railActive,
              {
                width: rail.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 48],
                }),
              },
            ]}
          />
          <View style={styles.railSegC} />
        </View>

        <View style={styles.body}>
          <View style={[styles.mediaStage, record.occult && styles.mediaStageOccult]}>
            <View
              pointerEvents="none"
              accessible={false}
              {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
              style={styles.mediaGlow}
            />
            <View style={[styles.bracket, styles.bracketTL]} />
            <View style={[styles.bracket, styles.bracketTR]} />
            <View style={[styles.bracket, styles.bracketBL]} />
            <View style={[styles.bracket, styles.bracketBR]} />
            <View
              pointerEvents="none"
              accessible={false}
              {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
              style={styles.calLayer}
            >
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Circle cx="50" cy="50" r="34" stroke="rgba(104,220,193,0.14)" strokeWidth="1" fill="none" />
                <Line x1="50" y1="10" x2="50" y2="22" stroke="rgba(128,153,149,0.35)" strokeWidth="1" />
                <Line x1="50" y1="78" x2="50" y2="90" stroke="rgba(128,153,149,0.35)" strokeWidth="1" />
              </Svg>
            </View>
            <Animated.View
              style={{
                opacity: artOpacity,
                transform: [{ translateX: artOffset }],
              }}
            >
              {record.artwork ? (
                <Image source={record.artwork} style={styles.art} resizeMode="contain" />
              ) : (
                <SchematicGlyphMark
                  family={record.glyphFamily ?? 'generic'}
                  size={54}
                  sealed={record.occult}
                />
              )}
            </Animated.View>
            {!reducedMotion ? (
              <Animated.View
                pointerEvents="none"
                accessible={false}
                {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
                style={[
                  styles.sealFlash,
                  {
                    opacity: flash.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.22],
                    }),
                  },
                ]}
              />
            ) : null}
          </View>

          <View style={styles.info}>
            <Animated.View style={{ opacity: copyOpacity }}>
              <TerminalText size={15} letterSpacing={0.2} style={styles.itemName} numberOfLines={2}>
                {record.label.toUpperCase()}
              </TerminalText>
              {categoryLine ? (
                <TerminalText size={7.5} letterSpacing={0.85} style={styles.category} numberOfLines={2}>
                  {categoryLine.toUpperCase()}
                </TerminalText>
              ) : null}
              <TerminalText
                size={8.5}
                letterSpacing={0.7}
                style={[styles.outcome, record.occult && styles.outcomeOccult]}
              >
                {record.outcome}
              </TerminalText>
            </Animated.View>

            <View style={styles.footer}>
              <Animated.View style={{ opacity: qtyOpacity }}>
                {record.quantity != null ? (
                  <TerminalText size={8} letterSpacing={0.6} style={styles.quantity}>
                    {`+${record.quantity} UNIT${record.quantity === 1 ? '' : 'S'}`}
                  </TerminalText>
                ) : (
                  <View />
                )}
              </Animated.View>
              <HapticPressable
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Close fabrication receipt"
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                  styles.closeBtn,
                  (hovered || pressed) && styles.closeBtnHover,
                ])}
              >
                <TerminalText size={7.5} letterSpacing={0.9} style={styles.closeText}>
                  [ CLOSE ]
                </TerminalText>
              </HapticPressable>
            </View>
          </View>
        </View>
      </View>
      </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  receiptShell: {
    width: '100%',
    maxWidth: 660,
  },
  receiptReveal: {
    overflow: 'hidden',
    maxWidth: '100%',
  },
  receipt: {
    width: 660,
    maxWidth: '100%',
    minHeight: 220,
    maxHeight: 250,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      web: {
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)',
        boxShadow:
          '6px 6px 0 rgba(29, 82, 70, 0.32), 0 14px 42px rgba(0, 0, 0, 0.42), inset 0 0 30px rgba(76, 170, 145, 0.025)',
      } as object,
      default: {
        shadowColor: '#1d5246',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 4, height: 6 },
        elevation: 10,
      },
    }),
  },
  mintEdge: {
    position: 'absolute',
    top: 0,
    left: 18,
    width: 72,
    height: 2,
    backgroundColor: ACCENT,
    zIndex: 2,
  },
  header: {
    minHeight: 42,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: SURFACE,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  signalNode: {
    width: 6,
    height: 6,
    backgroundColor: ACCENT,
  },
  statusText: {
    color: ACCENT,
    fontWeight: '700',
  },
  recordCode: {
    color: DIM,
    fontWeight: '700',
    flexShrink: 0,
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 10,
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  railSegA: {
    width: 36,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(41, 79, 73, 0.9)',
  },
  railNode: {
    width: 4,
    height: 4,
    backgroundColor: ACCENT,
  },
  railSegB: {
    flex: 1,
    maxWidth: 120,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(41, 79, 73, 0.55)',
  },
  railActive: {
    height: 2,
    backgroundColor: ACCENT,
  },
  railSegC: {
    width: 28,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(41, 79, 73, 0.45)',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  mediaStage: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: SURFACE,
  },
  mediaStageOccult: {},
  mediaGlow: {
    ...StyleSheet.absoluteFill,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(circle at 50% 48%, rgba(104, 220, 193, 0.12), rgba(6, 16, 15, 0) 68%)',
      } as object,
      default: {
        backgroundColor: 'rgba(104, 220, 193, 0.05)',
      },
    }),
  },
  bracket: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderColor: 'rgba(104, 220, 193, 0.4)',
    zIndex: 2,
  },
  bracketTL: { top: 6, left: 6, borderTopWidth: 1, borderLeftWidth: 1 },
  bracketTR: { top: 6, right: 6, borderTopWidth: 1, borderRightWidth: 1 },
  bracketBL: { bottom: 6, left: 6, borderBottomWidth: 1, borderLeftWidth: 1 },
  bracketBR: { bottom: 6, right: 6, borderBottomWidth: 1, borderRightWidth: 1 },
  calLayer: {
    ...StyleSheet.absoluteFill,
    opacity: 0.85,
  },
  art: {
    width: 78,
    height: 78,
    zIndex: 1,
  },
  sealFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: IMPACT,
    zIndex: 3,
  },
  info: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  itemName: {
    color: TEXT,
    fontWeight: '700',
  },
  category: {
    marginTop: 7,
    color: MUTED,
    fontWeight: '700',
  },
  outcome: {
    marginTop: 8,
    color: ACCENT,
    fontWeight: '700',
  },
  outcomeOccult: {
    color: OCCULT,
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quantity: {
    color: TEXT,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    minWidth: 100,
    maxWidth: 116,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  closeBtnHover: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(104, 220, 193, 0.06)',
  },
  closeText: {
    color: ACCENT,
    fontWeight: '700',
  },
});
