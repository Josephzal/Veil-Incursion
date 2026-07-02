import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import HapticPressable from '../HapticPressable';
import { viewShadow } from '../../utils/adaptiveStyles';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

const CARD_ASPECT_RATIO = 0.65;

export interface RunEventChoiceCardProps {
  tierTag: string;
  name: string;
  tagline?: string;
  effectSummary: string;
  tradeoffSummary?: string;
  cardWidth: number | '100%';
  cardPadding: number;
  isDesktop: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  disabled: boolean;
  accentColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  fontScale: number;
  scaleFont: (base: number) => number;
  onPress: () => void;
}

export default function RunEventChoiceCard({
  tierTag,
  name,
  tagline,
  effectSummary,
  tradeoffSummary,
  cardWidth,
  cardPadding,
  isDesktop,
  isSelected,
  isDimmed,
  disabled,
  accentColor,
  borderColor,
  textColor,
  mutedColor,
  fontScale,
  scaleFont,
  onPress,
}: RunEventChoiceCardProps): React.JSX.Element {
  const selectedBorder = accentColor;

  const cardFrameStyle: ViewStyle = isDesktop && typeof cardWidth === 'number'
    ? { width: cardWidth, aspectRatio: CARD_ASPECT_RATIO }
    : { width: '100%', minHeight: scaleFont(220) };

  return (
    <HapticPressable
      onPress={() => !disabled && onPress()}
      disabled={disabled}
      style={(state) => {
        const hovered = readPressableHover(state);
        return [
          styles.choiceCard,
          cardFrameStyle,
          {
            padding: cardPadding,
            borderColor: isSelected ? selectedBorder : borderColor,
            borderWidth: isSelected ? 2 : 1,
            backgroundColor: isSelected
              ? 'rgba(8, 12, 20, 0.88)'
              : 'rgba(0, 0, 0, 0.6)',
            opacity: isDimmed ? 0.4 : 1,
            transform: isSelected ? [{ scale: 1.02 }] : undefined,
          },
          isSelected
            ? viewShadow({
              color: selectedBorder,
              opacity: 0.9,
              radius: 16,
              offset: { width: 0, height: 0 },
            })
            : null,
          isSelected
            ? { cursor: 'pointer' as const }
            : terminalHoverStyle(hovered, state.pressed),
        ];
      }}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[
            styles.tierTag,
            {
              color: mutedColor,
              fontSize: 6 * fontScale,
              lineHeight: 9 * fontScale,
            },
          ]}
          numberOfLines={1}
        >
          {tierTag}
        </Text>
        <Text
          style={[
            styles.choiceName,
            {
              color: isSelected ? selectedBorder : textColor,
              fontSize: 11 * fontScale,
              lineHeight: 14 * fontScale,
            },
          ]}
          numberOfLines={2}
        >
          {name}
        </Text>
        {tagline ? (
          <Text
            style={[
              styles.choiceTagline,
              {
                color: mutedColor,
                fontSize: 7 * fontScale,
                lineHeight: 10 * fontScale,
              },
            ]}
            numberOfLines={2}
          >
            {tagline}
          </Text>
        ) : null}
      </View>

      <View style={styles.visualAnchor} />

      <View style={styles.cardDescription}>
        <Text
          style={[
            styles.choiceEffect,
            {
              color: textColor,
              fontSize: 8 * fontScale,
              lineHeight: 12 * fontScale,
            },
          ]}
        >
          {effectSummary}
        </Text>
        {tradeoffSummary ? (
          <Text
            style={[
              styles.choiceTradeoff,
              {
                fontSize: 7 * fontScale,
                lineHeight: 11 * fontScale,
              },
            ]}
            numberOfLines={3}
          >
            {`TRADE-OFF: ${tradeoffSummary}`}
          </Text>
        ) : null}
      </View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  choiceCard: {
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardHeader: {
    flexShrink: 0,
    gap: 6,
  },
  tierTag: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  choiceName: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  choiceTagline: {
    fontFamily: 'monospace',
    letterSpacing: 0.35,
  },
  visualAnchor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 24,
  },
  cardDescription: {
    flexShrink: 0,
    gap: 8,
  },
  choiceEffect: {
    fontFamily: 'monospace',
    letterSpacing: 0.35,
  },
  choiceTradeoff: {
    fontFamily: 'monospace',
    color: '#f87171',
    letterSpacing: 0.3,
  },
});
