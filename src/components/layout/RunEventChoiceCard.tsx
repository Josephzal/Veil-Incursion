import React from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import HapticPressable from '../HapticPressable';
import FieldPlate from '../runField/FieldPlate';
import { RUN_FIELD } from '../../theme/runFieldTokens';
import { readPressableHover } from '../../utils/terminalHoverStyle';

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
  borderColor: string;
  textColor: string;
  mutedColor: string;
  fontScale: number;
  scaleFont: (base: number) => number;
  onPress: () => void;
  /** Occult offer variant — magenta haze when selected. */
  occult?: boolean;
  lockReason?: string;
}

function offerNameStyle(scaleFont: (base: number) => number): object {
  // RN lineHeight is always px — never pass CSS unitless ratios.
  if (Platform.OS === 'web') {
    return {
      fontSize: `clamp(${RUN_FIELD.type.offerNameMin}px, 1.3vw, ${RUN_FIELD.type.offerNameMax}px)`,
      lineHeight: `${Math.round(RUN_FIELD.type.offerNameMax * 1.2)}px`,
    };
  }
  const size = scaleFont(RUN_FIELD.type.offerName);
  return { fontSize: size, lineHeight: Math.round(size * 1.2) };
}

/**
 * Shared offer / choice card for boons, requisitions, and similar selections.
 * Idle / hover / selected / locked share the field-plate interaction language.
 */
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
  isDimmed: _isDimmed,
  disabled,
  fontScale,
  scaleFont,
  onPress,
  occult = false,
  lockReason,
}: RunEventChoiceCardProps): React.JSX.Element {
  const cardFrameStyle: ViewStyle = {
    ...(isDesktop && typeof cardWidth === 'number' ? { width: cardWidth } : { width: '100%' }),
    flex: 1,
    alignSelf: 'stretch',
  };

  const classificationSize = scaleFont(Math.min(12, Math.max(11, RUN_FIELD.type.eyebrow)));
  const descriptorSize = scaleFont(RUN_FIELD.type.offerDescriptor);
  const effectSize = scaleFont(RUN_FIELD.type.offerEffect);
  const metaSize = scaleFont(Math.min(13, Math.max(11, RUN_FIELD.type.secondary)));
  const visualHeight = Math.min(120, Math.max(88, scaleFont(100)));

  /** Hover/selected title always reads mint — occult supplies haze only, never the accent text color. */
  const hotColor = RUN_FIELD.mint;

  return (
    <HapticPressable
      onPress={() => !disabled && onPress()}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled }}
      style={(pressState) => {
        const hovered = !disabled && (readPressableHover(pressState) || pressState.pressed);
        return [
          cardFrameStyle,
          styles.pressableFill,
          hovered && !isSelected ? styles.hoverLift : null,
        ];
      }}
    >
      {(pressState) => {
        const hovered = !disabled && !isSelected
          && (readPressableHover(pressState) || pressState.pressed);
        const plateState = disabled
          ? 'locked'
          : isSelected
            ? 'selected'
            : hovered
              ? 'hover'
              : 'idle';

        const resolvedTitleColor = isSelected || hovered ? hotColor : RUN_FIELD.text;

        return (
          <FieldPlate
            density="standard"
            tone={occult ? 'occult' : 'neutral'}
            state={plateState}
            showSelectedMark={isSelected}
            style={styles.plate}
            contentStyle={[styles.content, { padding: Math.min(cardPadding, 16) }]}
          >
            <View style={styles.tierRow}>
              <Text
                style={[
                  styles.tier,
                  { fontSize: classificationSize, color: RUN_FIELD.textSecondary },
                ]}
                numberOfLines={1}
              >
                {tierTag}
              </Text>
              {hovered ? (
                <Text style={[styles.selectHint, { fontSize: classificationSize }]}>
                  SELECT
                </Text>
              ) : null}
            </View>
            <Text
              style={[
                styles.name,
                offerNameStyle(scaleFont),
                { color: resolvedTitleColor },
              ]}
              numberOfLines={2}
            >
              {name}
            </Text>
            {tagline ? (
              <Text
                style={[
                  styles.tagline,
                  {
                    fontSize: descriptorSize,
                    lineHeight: Math.round(descriptorSize * 1.35),
                    color: RUN_FIELD.textSecondary,
                  },
                ]}
                numberOfLines={2}
              >
                {tagline}
              </Text>
            ) : null}

            <View style={[styles.visualWell, { height: visualHeight }]}>
              <View
                style={[
                  styles.sigil,
                  occult ? styles.sigilOccult : styles.sigilMint,
                  (isSelected || hovered) && !occult ? styles.sigilHot : null,
                  (isSelected || hovered) && occult ? styles.sigilOccultHot : null,
                ]}
              />
            </View>

            <View style={styles.effectSurface}>
              <Text
                style={[
                  styles.effect,
                  {
                    fontSize: effectSize,
                    lineHeight: Math.round(effectSize * 1.4),
                    color: RUN_FIELD.text,
                  },
                ]}
                numberOfLines={6}
              >
                {effectSummary}
              </Text>
              {tradeoffSummary ? (
                <Text
                  style={[
                    styles.tradeoff,
                    {
                      fontSize: metaSize,
                      lineHeight: Math.round(metaSize * 1.35),
                      color: RUN_FIELD.textSecondary,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {tradeoffSummary}
                </Text>
              ) : null}
            </View>
            {disabled && lockReason ? (
              <Text style={[styles.lockReason, { fontSize: metaSize }]} numberOfLines={2}>
                {lockReason}
              </Text>
            ) : null}
          </FieldPlate>
        );
      }}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  pressableFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  hoverLift: {
    transform: [{ translateY: -1 }],
  },
  plate: {
    width: '100%',
    flex: 1,
    overflow: 'visible',
  },
  content: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
  },
  tier: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  selectHint: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: RUN_FIELD.mint,
    flexShrink: 0,
  },
  name: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '800',
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  tagline: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '500',
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  visualWell: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RUN_FIELD.line,
    backgroundColor: 'rgba(5, 9, 10, 0.35)',
  },
  sigil: {
    width: 28,
    height: 28,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  sigilMint: {
    borderColor: 'rgba(99, 226, 177, 0.4)',
    backgroundColor: 'rgba(99, 226, 177, 0.07)',
  },
  sigilOccult: {
    borderColor: 'rgba(190, 82, 164, 0.45)',
    backgroundColor: 'rgba(190, 82, 164, 0.09)',
  },
  sigilHot: {
    borderColor: RUN_FIELD.mintBorderHot,
    backgroundColor: RUN_FIELD.mintSoft,
  },
  sigilOccultHot: {
    borderColor: 'rgba(190, 82, 164, 0.72)',
    backgroundColor: 'rgba(190, 82, 164, 0.16)',
  },
  effectSurface: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RUN_FIELD.line,
    backgroundColor: 'rgba(5, 9, 10, 0.28)',
  },
  effect: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  tradeoff: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '500',
  },
  lockReason: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: RUN_FIELD.danger,
    marginTop: 4,
    flexShrink: 0,
  },
});
