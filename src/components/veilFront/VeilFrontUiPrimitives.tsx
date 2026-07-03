import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import TerminalText from '../TerminalText';
import { useHubLayout } from '../../context/HubLayoutContext';
import { formatBracketHeader } from '../../styles/hubTerminalUi';

interface StatusPillProps {
  label: string;
  value: string;
  pips?: number;
  maxPips?: number;
  accentColor: string;
  mutedColor: string;
  textColor: string;
  compact?: boolean;
}

export function StatusPill({
  label,
  value,
  pips = 0,
  maxPips = 4,
  accentColor,
  mutedColor,
  textColor,
  compact = false,
}: StatusPillProps): React.JSX.Element {
  const { scaleSpacing } = useHubLayout();

  return (
    <View
      style={[
        styles.statusPill,
        {
          paddingHorizontal: scaleSpacing(compact ? 6 : 10),
          paddingVertical: scaleSpacing(compact ? 5 : 10),
          borderColor: `${accentColor}44`,
        },
      ]}
    >
      <TerminalText size={compact ? 5.5 : undefined} variant={compact ? undefined : 'micro'} letterSpacing={0.8} style={{ color: mutedColor }}>
        {label.toUpperCase()}
      </TerminalText>
      <TerminalText
        size={compact ? 7 : undefined}
        variant={compact ? undefined : 'caption'}
        letterSpacing={0.4}
        style={{ color: textColor, marginTop: scaleSpacing(compact ? 1 : 3) }}
      >
        {value}
      </TerminalText>
      {pips > 0 ? (
        <View style={[styles.pipRow, { marginTop: scaleSpacing(compact ? 2 : 4), gap: scaleSpacing(compact ? 2 : 3) }]}>
          {Array.from({ length: maxPips }, (_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                compact ? styles.pipCompact : null,
                { backgroundColor: i < pips ? accentColor : `${mutedColor}33` },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface MapStatMeterProps {
  label: string;
  value: string;
  pips: number;
  maxPips?: number;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

/** Ultra-compact single-line stat readout for the map status overlay. */
export function MapStatMeter({
  label,
  value,
  pips,
  maxPips = 4,
  accentColor,
  mutedColor,
  textColor,
  mini = false,
}: MapStatMeterProps & { mini?: boolean }): React.JSX.Element {
  const { scaleSpacing, scaleFont } = useHubLayout();
  const labelSize = scaleFont(mini ? 5 : 6);
  const valueSize = scaleFont(mini ? 5.5 : 7);
  const labelWidth = scaleSpacing(mini ? 36 : 44);
  const pipSize = mini ? 3 : 4;

  return (
    <View style={[mapStatStyles.row, { gap: scaleSpacing(mini ? 4 : 6) }]}>
      <TerminalText
        size={labelSize}
        letterSpacing={0.6}
        style={{ color: mutedColor, minWidth: labelWidth }}
      >
        {label.toUpperCase()}
      </TerminalText>
      <TerminalText
        size={valueSize}
        letterSpacing={0.2}
        style={{ color: textColor, flex: 1 }}
        numberOfLines={1}
      >
        {value}
      </TerminalText>
      {pips > 0 ? (
        <View style={[mapStatStyles.pipRow, { gap: scaleSpacing(1.5) }]}>
          {Array.from({ length: maxPips }, (_, i) => (
            <View
              key={i}
              style={[
                mapStatStyles.pip,
                {
                  width: pipSize,
                  height: pipSize,
                  borderRadius: pipSize / 2,
                  backgroundColor: i < pips ? accentColor : `${mutedColor}33`,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const mapStatStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pip: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

interface ProgressBarProps {
  percent: number;
  accentColor: string;
  trackColor?: string;
  height?: number;
}

export function ProgressBar({
  percent,
  accentColor,
  trackColor = 'rgba(30, 41, 59, 0.9)',
  height = 8,
}: ProgressBarProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent));
  const widthAnim = useSharedValue(clamped);

  useEffect(() => {
    widthAnim.value = withTiming(clamped, { duration: 450 });
  }, [clamped, widthAnim]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value}%`,
  }));

  return (
    <View style={[styles.progressTrack, { height, backgroundColor: trackColor }]}>
      <Animated.View
        style={[
          styles.progressFill,
          { backgroundColor: accentColor, minWidth: clamped > 0 ? 4 : 0 },
          fillStyle,
        ]}
      />
    </View>
  );
}

interface InfoChipProps {
  label: string;
  accentColor?: string;
}

export function InfoChip({ label, accentColor = '#fbbf24' }: InfoChipProps): React.JSX.Element {
  const { scaleSpacing } = useHubLayout();
  return (
    <View style={[styles.chip, { borderColor: `${accentColor}66`, paddingHorizontal: scaleSpacing(8), paddingVertical: scaleSpacing(4) }]}>
      <TerminalText variant="micro" letterSpacing={0.6} style={{ color: accentColor }}>
        {label.toUpperCase()}
      </TerminalText>
    </View>
  );
}

interface SectionFrameProps {
  title: string;
  accentColor: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionFrame({
  title,
  accentColor,
  children,
  style,
}: SectionFrameProps): React.JSX.Element {
  const { scaleSpacing } = useHubLayout();
  return (
    <View style={[styles.sectionFrame, { padding: scaleSpacing(14), borderColor: `${accentColor}33` }, style]}>
      <TerminalText
        variant="caption"
        letterSpacing={0.9}
        style={{ color: accentColor, marginBottom: scaleSpacing(10), fontWeight: '700' }}
      >
        {formatBracketHeader(title)}
      </TerminalText>
      {children}
    </View>
  );
}

export function TerminalDivider({ color = 'rgba(100, 116, 139, 0.25)' }: { color?: string }): React.JSX.Element {
  const { scaleSpacing } = useHubLayout();
  return <View style={[styles.divider, { borderTopColor: color, marginVertical: scaleSpacing(14) }]} />;
}

export function IconBadge({
  icon,
  accentColor,
  size = 36,
}: {
  icon: string;
  accentColor: string;
  size?: number;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.iconBadge,
        {
          width: size,
          height: size,
          borderColor: `${accentColor}88`,
          backgroundColor: `${accentColor}18`,
        },
      ]}
    >
      <TerminalText size={size * 0.42} style={{ color: accentColor }}>
        {icon}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  statusPill: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pipCompact: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  progressTrack: {
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  chip: {
    borderWidth: 1,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  sectionFrame: {
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  divider: {
    borderTopWidth: 1,
  },
  iconBadge: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
