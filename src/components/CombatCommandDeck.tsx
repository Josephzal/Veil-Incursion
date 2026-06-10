import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getAbilityDefinition } from '../data/aegisAbilities';
import type { AegisAbilityId } from '../types/aegisCombat';
import { PLAYER_ACTION_POINTS_PER_TURN } from '../types/aegisCombat';

const MONO = 'monospace';
const TILE_HEIGHT = 42;
const GRID_GAP = 6;
const AP_ROW_HEIGHT = 22;
const GRID_BODY_HEIGHT = TILE_HEIGHT * 2 + GRID_GAP;
const EVISCERATE_ACCENT = '#ff1744';
const EVISCERATE_GLOW = 'rgba(255, 23, 68, 0.22)';

export const COMMAND_DECK_MIN_HEIGHT = AP_ROW_HEIGHT + GRID_GAP + GRID_BODY_HEIGHT + 14;
export const COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE = COMMAND_DECK_MIN_HEIGHT;

interface CombatCommandDeckProps {
  loadout: readonly AegisAbilityId[];
  selectedAbility: AegisAbilityId | null;
  onSelectAbility: (ability: AegisAbilityId) => void;
  onConfirm: () => void;
  onAbort: () => void;
  onEndTurn: () => void;
  actionPoints: number;
  maxActionPoints?: number;
  isActionEnabled: (ability: AegisAbilityId) => boolean;
  canEndTurn: boolean;
  getStagedHeader: (ability: AegisAbilityId) => string;
  getStagedCostImpact: (ability: AegisAbilityId) => string;
  getActionAccent?: (ability: AegisAbilityId) => string | undefined;
  eviscerateReady?: boolean;
  onEviscerate?: () => void;
  eviscerateDisabled?: boolean;
  bloodForTimeAvailable?: boolean;
  bloodForTimeEnabled?: boolean;
  onBloodForTime?: () => void;
  borderColor: string;
  primaryColor: string;
  mutedColor: string;
  frameless?: boolean;
}

export default function CombatCommandDeck({
  loadout,
  selectedAbility,
  onSelectAbility,
  onConfirm,
  onAbort,
  onEndTurn,
  actionPoints,
  maxActionPoints = PLAYER_ACTION_POINTS_PER_TURN,
  isActionEnabled,
  canEndTurn,
  getStagedHeader,
  getStagedCostImpact,
  getActionAccent,
  eviscerateReady = false,
  onEviscerate,
  eviscerateDisabled = false,
  bloodForTimeAvailable = false,
  bloodForTimeEnabled = false,
  onBloodForTime,
  borderColor,
  primaryColor,
  mutedColor,
  frameless = false,
}: CombatCommandDeckProps): React.JSX.Element {
  const eviscerateOpacity = useSharedValue(0);

  useEffect(() => {
    const show = eviscerateReady && !selectedAbility;
    eviscerateOpacity.value = withTiming(show ? 1 : 0, { duration: 280 });
  }, [eviscerateReady, selectedAbility, eviscerateOpacity]);

  const eviscerateAnimStyle = useAnimatedStyle(() => ({
    opacity: eviscerateOpacity.value,
  }));

  const deckShellStyle = [
    styles.commandDeck,
    frameless ? styles.commandDeckFrameless : null,
    !frameless ? { borderColor } : null,
  ];

  const labelFor = (ability: AegisAbilityId) => getAbilityDefinition(ability).label;

  const renderTile = (ability: AegisAbilityId) => {
    const enabled = isActionEnabled(ability);
    const accent = getActionAccent?.(ability);
    const tileBorderColor = enabled && accent ? accent : borderColor;
    const isSelected = selectedAbility === ability;

    return (
      <View
        key={ability}
        style={[
          styles.tileSlot,
          {
            borderColor: isSelected ? primaryColor : tileBorderColor,
            backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
          },
        ]}
      >
        <Pressable
          onPress={() => enabled && onSelectAbility(ability)}
          disabled={!enabled}
          style={[styles.deckTile, { opacity: enabled ? 1 : 0.4 }]}
        >
          <Text
            style={[styles.tileLabel, { color: enabled && accent ? accent : mutedColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {labelFor(ability)}
          </Text>
        </Pressable>
      </View>
    );
  };

  const canExecute = selectedAbility ? isActionEnabled(selectedAbility) : false;

  return (
    <View style={deckShellStyle}>
      <View style={styles.apRow}>
        <Text style={[styles.apLabel, { color: mutedColor }]}>
          {`ACTION PTS // ${actionPoints}/${maxActionPoints}`}
        </Text>
        <View style={styles.apActions}>
          {bloodForTimeAvailable ? (
            <Pressable
              onPress={onBloodForTime}
              disabled={!bloodForTimeEnabled}
              style={[
                styles.bloodForTimeBtn,
                {
                  borderColor: bloodForTimeEnabled ? '#c41e1e' : borderColor,
                  opacity: bloodForTimeEnabled ? 1 : 0.4,
                },
              ]}
            >
              <Text
                style={[styles.bloodForTimeLabel, { color: bloodForTimeEnabled ? '#f87171' : mutedColor }]}
                numberOfLines={1}
              >
                [ BLOOD FOR TIME ]
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onEndTurn}
            disabled={!canEndTurn}
            style={[
              styles.endTurnBtn,
              {
                borderColor: canEndTurn ? primaryColor : borderColor,
                opacity: canEndTurn ? 1 : 0.4,
              },
            ]}
          >
            <Text style={[styles.endTurnLabel, { color: canEndTurn ? primaryColor : mutedColor }]}>
              [ END TURN ]
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.deckBody}>
        <View style={styles.gridRow}>
          {renderTile(loadout[0])}
          {renderTile(loadout[1])}
        </View>
        <View style={styles.gridRow}>
          {renderTile(loadout[2])}
          {renderTile(loadout[3])}
        </View>

        {selectedAbility ? (
          <View style={styles.execOverlay}>
            <View style={styles.gridRow}>
              <View style={[styles.tileSlot, { borderColor: primaryColor }]}>
                <Pressable
                  onPress={onConfirm}
                  disabled={!canExecute}
                  style={[styles.deckTile, { opacity: canExecute ? 1 : 0.45 }]}
                >
                  <Text style={[styles.tileLabel, { color: primaryColor }]}>[ EXECUTE ]</Text>
                </Pressable>
              </View>
              <View style={[styles.tileSlot, { borderColor }]}>
                <Pressable onPress={onAbort} style={styles.deckTile}>
                  <Text style={[styles.tileLabel, { color: mutedColor }]}>[ ABORT ]</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.execMetaSlot}>
                <Text style={[styles.execHeader, { color: primaryColor }]} numberOfLines={1}>
                  {getStagedHeader(selectedAbility)}
                </Text>
                <Text style={[styles.execDetail, { color: mutedColor }]} numberOfLines={2}>
                  {getStagedCostImpact(selectedAbility)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <Animated.View
          style={[styles.eviscerateOverlay, eviscerateAnimStyle]}
          pointerEvents={eviscerateReady && !selectedAbility ? 'auto' : 'none'}
        >
          <Pressable
            onPress={onEviscerate}
            disabled={eviscerateDisabled || !eviscerateReady}
            style={[
              styles.eviscerateTile,
              {
                borderColor: EVISCERATE_ACCENT,
                backgroundColor: EVISCERATE_GLOW,
                opacity: eviscerateDisabled ? 0.4 : 1,
              },
            ]}
          >
            <Text style={[styles.eviscerateLabel, { color: EVISCERATE_ACCENT }]}>
              [ EVISCERATE ]
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  commandDeck: {
    flexShrink: 0,
    height: COMMAND_DECK_MIN_HEIGHT,
    minHeight: COMMAND_DECK_MIN_HEIGHT,
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 1,
    gap: GRID_GAP,
  },
  commandDeckFrameless: {
    borderTopWidth: 0,
    paddingTop: 3,
    paddingBottom: 2,
  },
  apRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: GRID_GAP,
    height: AP_ROW_HEIGHT,
    width: '100%',
  },
  apLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    flex: 1,
  },
  apActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID_GAP,
    flexShrink: 0,
  },
  bloodForTimeBtn: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 108,
    alignItems: 'center',
  },
  bloodForTimeLabel: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  endTurnBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 88,
    alignItems: 'center',
  },
  endTurnLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
  deckBody: {
    position: 'relative',
    width: '100%',
    height: GRID_BODY_HEIGHT,
    minHeight: GRID_BODY_HEIGHT,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GRID_GAP,
    width: '100%',
    height: TILE_HEIGHT,
  },
  tileSlot: {
    flex: 1,
    height: TILE_HEIGHT,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  deckTile: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tileLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  execOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#141414',
    gap: GRID_GAP,
    zIndex: 10,
    elevation: 10,
  },
  execMetaSlot: {
    flex: 1,
    height: TILE_HEIGHT,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#0d0d0d',
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: 'center',
    gap: 2,
  },
  execHeader: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    lineHeight: 10,
  },
  execDetail: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.4,
    lineHeight: 9,
  },
  eviscerateOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: '12%',
    zIndex: 20,
    elevation: 20,
  },
  eviscerateTile: {
    width: '100%',
    height: TILE_HEIGHT,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  eviscerateLabel: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
