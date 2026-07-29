import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HEX_AMMO_META, type HexAmmoType } from '../../types/hexAmmo';

interface CombatMagazineGaugeProps {
  currentAmmo: number;
  maxAmmo: number;
  overchargeMultiplier?: number;
  /** Zero-Protocol / weapon ultimate gate open (Protocol Charges full). */
  markReady?: boolean;
  /** Player-facing ultimate name when markReady (defaults ZERO PROTOCOL). */
  readyUltimateLabel?: string | null;
  labelColor?: string;
  liveColor?: string;
  spentColor?: string;
  variant?: 'compact' | 'inline' | 'stacked';
  labelFontScale?: number;
  /** Loaded ammo type — drives the chip + pip color. */
  ammoType?: HexAmmoType;
  protocolCharges?: number;
  maxProtocolCharges?: number;
  nextShotOvercharged?: boolean;
}

export default function CombatMagazineGauge({
  currentAmmo,
  maxAmmo,
  overchargeMultiplier = 0,
  markReady = false,
  readyUltimateLabel = null,
  labelColor = '#fbbf24',
  liveColor = '#fbbf24',
  spentColor = 'rgba(148, 163, 184, 0.35)',
  variant = 'compact',
  labelFontScale = 1,
  ammoType,
  protocolCharges = 0,
  maxProtocolCharges = 0,
  nextShotOvercharged = false,
}: CombatMagazineGaugeProps): React.JSX.Element {
  const slots = Math.max(1, maxAmmo);
  const isStacked = variant === 'stacked';
  const isInline = variant === 'compact' || variant === 'inline';

  const ammoMeta = ammoType ? HEX_AMMO_META[ammoType] : null;
  const overchargeLabel = nextShotOvercharged || overchargeMultiplier > 0 ? ' // OC' : '';
  const readyName = readyUltimateLabel?.trim() || 'ZERO PROTOCOL';
  const markLabel = markReady ? ` // ${readyName}` : '';
  const labelText = `${ammoMeta ? `${ammoMeta.chip} ` : 'MAGAZINE // '}${currentAmmo}/${maxAmmo}${overchargeLabel}${markLabel}`;

  const protocolRow = maxProtocolCharges > 0 ? (
    <View style={styles.protocolRow}>
      {Array.from({ length: maxProtocolCharges }).map((_, index) => {
        const filled = index < protocolCharges;
        return (
          <View
            key={index}
            style={[
              styles.protocolPip,
              {
                backgroundColor: filled ? (ammoMeta?.color ?? '#fbbf24') : 'transparent',
                borderColor: filled ? (ammoMeta?.color ?? '#fbbf24') : 'rgba(148, 163, 184, 0.5)',
              },
            ]}
          />
        );
      })}
      <Text style={[styles.protocolLabel, markReady ? styles.protocolLabelReady : null]}>
        {markReady ? readyName : 'PROTOCOL'}
      </Text>
      {nextShotOvercharged ? <Text style={styles.overchargeTag}>⚡OC</Text> : null}
    </View>
  ) : null;

  const bulletRow = (
    <View style={[
      styles.bulletRow,
      isStacked ? styles.bulletRowStacked : null,
      isInline ? styles.bulletRowInline : null,
    ]}>
      {Array.from({ length: slots }).map((_, index) => {
        const live = index < currentAmmo;
        return (
          <View
            key={index}
            style={[
              styles.bullet,
              {
                backgroundColor: live ? liveColor : spentColor,
                borderColor: live ? liveColor : 'rgba(148, 163, 184, 0.5)',
                opacity: live ? 1 : 0.55,
              },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <View style={[styles.root, isStacked ? styles.rootStacked : null, isInline ? styles.rootInline : null]}>
      <Text
        style={[
          styles.label,
          isStacked ? styles.labelStacked : null,
          isInline ? styles.labelInline : null,
          labelFontScale !== 1 ? {
            fontSize: (isStacked ? 8 : 7) * labelFontScale,
            lineHeight: (isStacked ? 10 : 9) * labelFontScale,
          } : null,
          { color: ammoMeta?.color ?? labelColor },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {labelText}
      </Text>
      {bulletRow}
      {protocolRow}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 3,
    width: '100%',
  },
  rootInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingVertical: 1,
  },
  rootStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 3,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  labelInline: {
    width: 72,
    flexShrink: 0,
    flex: 0,
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 0.4,
  },
  labelStacked: {
    fontSize: 8,
    width: '100%',
    flex: 0,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 11,
    flexShrink: 1,
  },
  bulletRowStacked: {
    flex: 0,
    justifyContent: 'flex-start',
    width: '100%',
  },
  bulletRowInline: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  bullet: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  protocolPip: {
    width: 10,
    height: 10,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  protocolLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    color: 'rgba(148, 163, 184, 0.9)',
    marginLeft: 2,
  },
  protocolLabelReady: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  overchargeTag: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    color: '#38bdf8',
    marginLeft: 2,
  },
});
