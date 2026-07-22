import React from 'react';
import {
  Image,
  type ImageSourcePropType,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import type { SchematicGlyphFamily } from './SchematicGlyph';
import { SchematicGlyphMark } from './SchematicGlyph';

export interface FabricationReceiptRecord {
  label: string;
  outcome: string;
  classCode: string;
  artwork?: ImageSourcePropType | null;
  glyphFamily?: SchematicGlyphFamily;
}

interface FabricationReceiptProps {
  record: FabricationReceiptRecord | null;
  onDismiss: () => void;
}

/** Centered fabrication completion receipt with dismiss control. */
export default function FabricationReceipt({
  record,
  onDismiss,
}: FabricationReceiptProps): React.JSX.Element | null {
  if (!record) return null;

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      accessibilityRole="text"
      {...(Platform.OS === 'web'
        ? ({ role: 'status', 'aria-live': 'polite' } as object)
        : { accessibilityLiveRegion: 'polite' as const })}
    >
      <View style={styles.glowOuter} pointerEvents="none" accessible={false} />
      <View style={styles.glowMid} pointerEvents="none" accessible={false} />
      <View style={styles.receipt}>
        <View
          pointerEvents="none"
          accessible={false}
          {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
          style={styles.signalLine}
        />
        <View style={styles.thumb}>
          {record.artwork ? (
            <Image source={record.artwork} style={styles.thumbImage} resizeMode="contain" />
          ) : (
            <SchematicGlyphMark family={record.glyphFamily ?? 'generic'} size={56} />
          )}
        </View>
        <View style={styles.copy}>
          <TerminalText size={9} letterSpacing={1.05} style={styles.eyebrow}>
            FABRICATION COMPLETE
          </TerminalText>
          <TerminalText size={18} letterSpacing={0.25} style={styles.title} numberOfLines={2}>
            {record.label.toUpperCase()}
          </TerminalText>
          <TerminalText size={9} letterSpacing={0.8} style={styles.meta} numberOfLines={2}>
            {`${record.outcome} // ${record.classCode}`}
          </TerminalText>
        </View>
        <HapticPressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss fabrication receipt"
          style={({ pressed }) => ([
            styles.dismissBtn,
            pressed && { opacity: 0.88 },
          ])}
        >
          <TerminalText size={9} letterSpacing={1} style={styles.dismissText}>
            [ DISMISS ]
          </TerminalText>
        </HapticPressable>
      </View>
    </View>
  );
}

const GOLD = 'rgba(212, 175, 95, 0.55)';
const GOLD_SOFT = 'rgba(212, 175, 95, 0.22)';
const GOLD_EDGE = 'rgba(232, 201, 120, 0.65)';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glowOuter: {
    position: 'absolute',
    width: 560,
    height: 280,
    borderRadius: 8,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(ellipse at center, rgba(212, 175, 95, 0.28) 0%, rgba(212, 175, 95, 0.08) 42%, transparent 70%)',
        filter: 'blur(2px)',
      } as object,
      default: {
        backgroundColor: GOLD_SOFT,
      },
    }),
  },
  glowMid: {
    position: 'absolute',
    width: 500,
    height: 220,
    ...Platform.select({
      web: {
        boxShadow: `0 0 48px ${GOLD}, 0 0 90px rgba(212, 175, 95, 0.35), 0 0 140px rgba(180, 140, 60, 0.18)`,
      } as object,
      default: {
        backgroundColor: 'rgba(212, 175, 95, 0.08)',
      },
    }),
  },
  receipt: {
    width: '100%',
    maxWidth: 560,
    minHeight: 168,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    paddingVertical: 28,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(6, 12, 10, 0.96)',
    borderWidth: 1,
    borderColor: GOLD_EDGE,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)',
        boxShadow: `0 0 0 1px rgba(212, 175, 95, 0.35), 0 0 36px ${GOLD}, 0 18px 48px rgba(0, 0, 0, 0.55)`,
      } as object,
      default: {
        shadowColor: '#d4af5f',
        shadowOpacity: 0.55,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
        elevation: 12,
      },
    }),
  },
  signalLine: {
    position: 'absolute',
    left: 28,
    right: 36,
    top: 0,
    height: 3,
    backgroundColor: GOLD_EDGE,
  },
  thumb: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: 68,
    height: 68,
  },
  copy: {
    flex: 1,
    minWidth: 180,
  },
  eyebrow: {
    color: '#e8c978',
    fontWeight: '700',
  },
  title: {
    marginTop: 8,
    color: '#f7f1e3',
    fontWeight: '700',
  },
  meta: {
    marginTop: 8,
    color: '#c4b48a',
    fontWeight: '700',
  },
  dismissBtn: {
    minWidth: 140,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GOLD_EDGE,
    backgroundColor: 'rgba(212, 175, 95, 0.1)',
    paddingHorizontal: 16,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  dismissText: {
    color: '#f0d78a',
    fontWeight: '800',
  },
});
