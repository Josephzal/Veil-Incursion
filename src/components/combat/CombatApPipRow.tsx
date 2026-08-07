import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';

interface CombatApPipRowProps {
  current: number;
  max: number;
  accent: string;
  mutedColor?: string;
  queued?: boolean;
  compact?: boolean;
  fontScale?: number;
  centered?: boolean;
  /** Overrides label/counter size — matches ability tile typography when set. */
  labelFontSize?: number;
  hexSize?: number;
  /** Concept deck band — large cyan pips with soft glow above ability cards. */
  conceptBand?: boolean;
}

/** Glowing diamond AP pip row for the command deck header. */
export default function CombatApPipRow({
  current,
  max,
  accent,
  mutedColor = '#94a3b8',
  queued = false,
  compact = false,
  centered = false,
  fontScale = 1,
  labelFontSize,
  hexSize,
  conceptBand = false,
}: CombatApPipRowProps): React.JSX.Element {
  const bandAccent = conceptBand ? OTT.cyanSelect : accent;
  const resolvedLabelSize = labelFontSize ?? (conceptBand ? COMBAT_HUD_TYPE.label : COMBAT_HUD_TYPE.caption * fontScale);
  const resolvedHexSize = hexSize ?? (conceptBand ? 12 : HEX_SIZE * fontScale);

  return (
    <View style={[
      styles.host,
      compact && styles.hostCompact,
      centered && styles.hostCentered,
      conceptBand && styles.hostConceptBand,
    ]}>
      <Text style={[
        styles.label,
        {
          color: conceptBand ? OTT.cyanSelect : mutedColor,
          fontSize: resolvedLabelSize,
        },
        conceptBand && styles.labelConcept,
      ]}>
        {conceptBand ? `${current} AP` : 'AP'}
      </Text>
      <View style={[styles.pipRow, conceptBand && styles.pipRowConcept]}>
        {Array.from({ length: max }, (_, index) => {
          const filled = index < current;
          const fillColor = filled
            ? (queued ? 'rgba(186, 230, 253, 0.95)' : bandAccent)
            : 'transparent';
          const borderColor = filled
            ? bandAccent
            : conceptBand
              ? 'rgba(98, 220, 229, 0.55)'
              : 'rgba(148, 163, 184, 0.45)';

          return (
            <View
              key={`ap-pip-${index}`}
              style={[
                styles.pipCell,
                { width: resolvedHexSize, height: resolvedHexSize },
              ]}
            >
              <View
                style={[
                  styles.hexCore,
                  {
                    width: resolvedHexSize * 0.86,
                    height: resolvedHexSize * 0.86,
                    borderColor,
                    backgroundColor: fillColor,
                  },
                  filled && {
                    shadowColor: bandAccent,
                    shadowOpacity: conceptBand ? 0.45 : 0.75,
                    shadowRadius: conceptBand ? 3 : 5,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: conceptBand ? 1 : 2,
                  },
                  filled && conceptBand && Platform.OS === 'web'
                    ? { boxShadow: `0 0 3px ${bandAccent}` } as object
                    : null,
                ]}
              />
            </View>
          );
        })}
      </View>
      {conceptBand ? null : (
        <Text style={[styles.counter, { color: mutedColor, fontSize: resolvedLabelSize }]}>
          {`${current}/${max}`}
        </Text>
      )}
    </View>
  );
}

const HEX_SIZE = 7;

const styles = StyleSheet.create({
  host: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  hostCompact: {
    flex: 0,
    alignSelf: 'stretch',
  },
  hostCentered: {
    flex: 0,
    alignSelf: 'center',
  },
  hostConceptBand: {
    flex: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 0,
    minHeight: 24,
    maxHeight: 28,
  },
  label: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  labelConcept: {
    fontWeight: '800',
    letterSpacing: 0.9,
    fontSize: COMBAT_HUD_TYPE.label,
  },
  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pipRowConcept: {
    gap: 4,
  },
  /** Transparent cell — avoids square shadow/bg around the rotated diamond. */
  pipCell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  hexCore: {
    borderWidth: 1.25,
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  counter: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
});
