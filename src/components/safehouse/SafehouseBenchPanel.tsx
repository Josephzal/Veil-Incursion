import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import HapticPressable from '../HapticPressable';
import { pointInWindowRect } from '../../utils/cargoGridLayout';
import { viewShadow } from '../../utils/adaptiveStyles';
import { HIDDEN_SCROLLBAR_VIEW_STYLE, HIDDEN_SCROLLVIEW_PROPS } from '../../utils/hiddenScrollbarStyle';
import { pulseCargoItemPickup } from '../../utils/hubButtonHaptics';

import { RUN_FIELD } from '../../theme/runFieldTokens';

const STARK_WHITE = RUN_FIELD.text;
const MUTED_SLATE = RUN_FIELD.textSecondary;
const CARD_BORDER = RUN_FIELD.line;
const CARD_BG = RUN_FIELD.panel;
const SLOT_BG = RUN_FIELD.panelLight;

export interface BenchSlotView {
  slotIndex: number;
  label: string;
  abilityId: string;
  editable: boolean;
  anchor?: boolean;
}

export interface BenchArsenalEntry {
  abilityId: string;
  label: string;
  description: string;
  unlocked: boolean;
  unlockHint?: string;
  assignedSlot: number | null;
}

interface SafehouseBenchPanelProps {
  fontScale: number;
  gap: number;
  isDesktop: boolean;
  slots: BenchSlotView[];
  arsenal: BenchArsenalEntry[];
  selectedSlot: number;
  onSelectSlot: (slotIndex: number) => void;
  onAssign: (abilityId: string, slotIndex: number) => void;
  onUnlock: (abilityId: string) => void;
  statusMessage?: string | null;
}

type WindowRect = { pageX: number; pageY: number; width: number; height: number };

function DraggableArsenalCard({
  entry,
  fontScale,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTap,
}: {
  entry: BenchArsenalEntry;
  fontScale: number;
  onDragStart: (abilityId: string) => void;
  onDragMove: (abilityId: string, x: number, y: number) => void;
  onDragEnd: (abilityId: string, x: number, y: number) => void;
  onTap: (abilityId: string) => void;
}): React.JSX.Element {
  const dragGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onStart((event) => {
      runOnJS(pulseCargoItemPickup)();
      runOnJS(onDragStart)(entry.abilityId);
      runOnJS(onDragMove)(entry.abilityId, event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      runOnJS(onDragMove)(entry.abilityId, event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(onDragEnd)(entry.abilityId, event.absoluteX, event.absoluteY);
    });

  const assigned = entry.assignedSlot != null;
  const cardBody = (
    <HapticPressable
      onPress={() => onTap(entry.abilityId)}
      style={({ pressed }) => [
        styles.arsenalCard,
        {
          borderColor: assigned ? RUN_FIELD.mintBorderHot : CARD_BORDER,
          backgroundColor: CARD_BG,
          opacity: entry.unlocked ? pressed ? 0.82 : 1 : 0.55,
          padding: 10 * fontScale,
          minHeight: 72 * fontScale,
        },
        assigned ? viewShadow({
          color: RUN_FIELD.mint,
          opacity: 0.35,
          radius: 8,
          offset: { width: 0, height: 0 },
        }) : null,
      ]}
    >
      <Text
        style={[
          styles.cardTitle,
          {
            color: assigned ? RUN_FIELD.mint : STARK_WHITE,
            fontSize: RUN_FIELD.type.secondary,
            lineHeight: RUN_FIELD.type.secondary * 1.25,
          },
        ]}
        numberOfLines={2}
      >
        {entry.label}
      </Text>
      {!entry.unlocked && entry.unlockHint ? (
        <Text style={[styles.cardMeta, { fontSize: RUN_FIELD.type.micro, color: '#f87171' }]}>
          {entry.unlockHint}
        </Text>
      ) : null}
      <Text
        style={[styles.cardMeta, { fontSize: RUN_FIELD.type.body, lineHeight: RUN_FIELD.type.body * 1.35, color: MUTED_SLATE }]}
        numberOfLines={3}
      >
        {entry.description}
      </Text>
      {assigned ? (
        <Text style={[styles.equippedTag, { fontSize: RUN_FIELD.type.micro, color: RUN_FIELD.mint }]}>
          {`EQUIPPED // S${entry.assignedSlot! + 1}`}
        </Text>
      ) : null}
    </HapticPressable>
  );

  if (!entry.unlocked) {
    return cardBody;
  }

  return (
    <GestureDetector gesture={dragGesture}>
      {cardBody}
    </GestureDetector>
  );
}

export default function SafehouseBenchPanel({
  fontScale,
  gap,
  isDesktop,
  slots,
  arsenal,
  selectedSlot,
  onSelectSlot,
  onAssign,
  onUnlock,
  statusMessage,
}: SafehouseBenchPanelProps): React.JSX.Element {
  const slotMetricsRef = useRef<Record<number, WindowRect>>({});
  const [dragGhost, setDragGhost] = useState<{ abilityId: string; label: string } | null>(null);

  const reportSlotMetrics = useCallback((slotIndex: number) => {
    return (ref: View | null) => {
      if (!ref) return;
      ref.measureInWindow((pageX, pageY, width, height) => {
        slotMetricsRef.current[slotIndex] = { pageX, pageY, width, height };
      });
    };
  }, []);

  const resolveDropSlot = useCallback((absoluteX: number, absoluteY: number): number | null => {
    for (const slot of slots) {
      if (!slot.editable) continue;
      const rect = slotMetricsRef.current[slot.slotIndex];
      if (rect && pointInWindowRect(absoluteX, absoluteY, rect, 10)) {
        return slot.slotIndex;
      }
    }
    return null;
  }, [slots]);

  const handleDragStart = useCallback((abilityId: string) => {
    const entry = arsenal.find((item) => item.abilityId === abilityId);
    setDragGhost({ abilityId, label: entry?.label ?? abilityId });
  }, [arsenal]);

  const handleDragMove = useCallback((_abilityId: string, _x: number, _y: number) => {
    // Ghost follows cursor via overlay positioning on end only for simplicity.
  }, []);

  const handleDragEnd = useCallback((abilityId: string, absoluteX: number, absoluteY: number) => {
    setDragGhost(null);
    const slotIndex = resolveDropSlot(absoluteX, absoluteY);
    if (slotIndex != null) {
      onAssign(abilityId, slotIndex);
    }
  }, [onAssign, resolveDropSlot]);

  const handleTap = useCallback((abilityId: string) => {
    const entry = arsenal.find((item) => item.abilityId === abilityId);
    if (!entry) return;
    if (!entry.unlocked) {
      onUnlock(abilityId);
      return;
    }
    onAssign(abilityId, selectedSlot);
  }, [arsenal, onAssign, onUnlock, selectedSlot]);

  const slotGap = 12 * fontScale;

  return (
    <View style={[
      styles.root,
      {
        marginHorizontal: 12 * fontScale,
        gap,
        flex: isDesktop ? 1.45 : 1,
        paddingTop: 14 * fontScale,
      },
    ]}>
      <Text style={[styles.header, { fontSize: 8 * fontScale, color: MUTED_SLATE, letterSpacing: 1.5 }]}>
        [ THE BENCH ]
      </Text>

      <View style={[styles.deckRow, { gap: slotGap }]}>
        {slots.map((slot) => {
          const isSelected = selectedSlot === slot.slotIndex;
          return (
            <View
              key={`bench-slot-${slot.slotIndex}`}
              ref={reportSlotMetrics(slot.slotIndex)}
              style={[
                styles.deckSlot,
                {
                  borderColor: isSelected ? RUN_FIELD.mintBorderHot : CARD_BORDER,
                  backgroundColor: SLOT_BG,
                  opacity: slot.anchor ? 0.92 : 1,
                },
                isSelected ? viewShadow({
                  color: RUN_FIELD.mint,
                  opacity: 0.75,
                  radius: 14,
                  offset: { width: 0, height: 0 },
                }) : null,
              ]}
            >
              <HapticPressable
                disabled={slot.anchor}
                onPress={() => !slot.anchor && onSelectSlot(slot.slotIndex)}
                style={styles.deckSlotPress}
              >
                <Text style={[styles.slotTag, { fontSize: 6 * fontScale, color: MUTED_SLATE }]}>
                  {slot.anchor ? 'ANCHOR' : `S${slot.slotIndex + 1}`}
                </Text>
                <Text
                  style={[
                    styles.slotLabel,
                    {
                      color: isSelected ? RUN_FIELD.mint : STARK_WHITE,
                      fontSize: 7 * fontScale,
                      lineHeight: 9 * fontScale,
                    },
                  ]}
                  numberOfLines={3}
                >
                  {slot.label}
                </Text>
              </HapticPressable>
            </View>
          );
        })}
      </View>

      <Text style={[styles.subheader, { fontSize: 7 * fontScale, color: MUTED_SLATE }]}>
        [ THE ARSENAL ] — DRAG TO DECK OR TAP TO ASSIGN
      </Text>

      <ScrollView
        style={[styles.arsenalScroll, HIDDEN_SCROLLBAR_VIEW_STYLE]}
        contentContainerStyle={[styles.arsenalGrid, { gap: 12 * fontScale }]}
        {...HIDDEN_SCROLLVIEW_PROPS}
        nestedScrollEnabled
      >
        {arsenal.map((entry) => (
          <View key={entry.abilityId} style={styles.arsenalCell}>
            <DraggableArsenalCard
              entry={entry}
              fontScale={fontScale}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTap={handleTap}
            />
          </View>
        ))}
      </ScrollView>

      {statusMessage ? (
        <Text style={[styles.status, { fontSize: 7 * fontScale, color: MUTED_SLATE }]}>
          {statusMessage}
        </Text>
      ) : null}

      {dragGhost ? (
        <View style={styles.dragGhost} pointerEvents="none">
          <View style={[styles.dragGhostCard, { borderColor: RUN_FIELD.mintBorderHot, backgroundColor: SLOT_BG }]}>
            <Text style={[styles.cardTitle, { color: RUN_FIELD.mint, fontSize: 8 * fontScale }]}>
              {dragGhost.label}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minWidth: 0,
    minHeight: 0,
    backgroundColor: 'transparent',
  },
  header: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  subheader: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  deckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexShrink: 0,
    width: '100%',
  },
  deckSlot: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: '23%',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckSlotPress: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
  },
  slotTag: {
    fontFamily: 'monospace',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  slotLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.35,
  },
  arsenalScroll: {
    flex: 1,
    minHeight: 0,
  },
  arsenalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 8,
  },
  arsenalCell: {
    width: '48%',
    minWidth: 140,
    flexGrow: 1,
  },
  arsenalCard: {
    borderWidth: 1,
    gap: 4,
    width: '100%',
  },
  cardTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  cardMeta: {
    fontFamily: 'monospace',
    letterSpacing: 0.3,
    lineHeight: 10,
  },
  equippedTag: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  status: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
    textAlign: 'center',
    flexShrink: 0,
  },
  dragGhost: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragGhostCard: {
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    opacity: 0.9,
  },
});
