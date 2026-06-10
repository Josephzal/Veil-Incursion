import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAbilityDefinition } from '../data/aegisAbilities';
import type { AegisAbilityId } from '../types/aegisCombat';
import { PLAYER_ACTION_POINTS_PER_TURN } from '../types/aegisCombat';

const MONO = 'monospace';
const TILE_HEIGHT = 42;
const GRID_GAP = 6;
const AP_ROW_HEIGHT = 22;
const ULTIMATE_ROW_HEIGHT = 36;
const EVISCERATE_ACCENT = '#ff1744';
const EVISCERATE_GLOW = 'rgba(255, 23, 68, 0.18)';

export const COMMAND_DECK_MIN_HEIGHT = TILE_HEIGHT * 2 + GRID_GAP + AP_ROW_HEIGHT + 14;
export const COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE =
  COMMAND_DECK_MIN_HEIGHT + ULTIMATE_ROW_HEIGHT + GRID_GAP;

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
  /** Hidden ultimate — full-width glitch row when Abyssal Reserve is at cap. */
  eviscerateReady?: boolean;
  onEviscerate?: () => void;
  eviscerateDisabled?: boolean;
  /** Blood for Time mutation — optional AP trade in the AP row. */
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

    return (
      <View
        key={ability}
        style={[styles.tileSlot, { borderColor: tileBorderColor }]}
      >
        <Pressable
          onPress={() => enabled && onSelectAbility(ability)}
          disabled={!enabled}
          style={[
            styles.deckTile,
            {
              backgroundColor: 'transparent',
              opacity: enabled ? 1 : 0.4,
            },
          ]}
        >
          <Text
            style={[
              styles.tileLabel,
              { color: enabled && accent ? accent : mutedColor },
            ]}
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

  const apRow = (
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
              adjustsFontSizeToFit
              minimumFontScale={0.7}
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
          <Text
            style={[styles.endTurnLabel, { color: canEndTurn ? primaryColor : mutedColor }]}
            numberOfLines={1}
          >
            [ END TURN ]
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const eviscerateRow = eviscerateReady && !selectedAbility ? (
    <Pressable
      onPress={onEviscerate}
      disabled={eviscerateDisabled}
      style={[
        styles.eviscerateTile,
        {
          borderColor: EVISCERATE_ACCENT,
          backgroundColor: EVISCERATE_GLOW,
          opacity: eviscerateDisabled ? 0.4 : 1,
        },
      ]}
    >
      <Text
        style={[styles.eviscerateLabel, { color: EVISCERATE_ACCENT }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        [ EVISCERATE ]
      </Text>
    </Pressable>
  ) : null;

  if (selectedAbility) {
    const canExecute = isActionEnabled(selectedAbility);
    return (
      <View style={deckShellStyle}>
        {apRow}
        {eviscerateRow}
        <View style={styles.executionModule}>
          <Text style={[styles.execHeader, { color: primaryColor }]} numberOfLines={1} ellipsizeMode="tail">
            {getStagedHeader(selectedAbility)}
          </Text>
          <Text
            style={[styles.execDetail, { color: mutedColor }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {getStagedCostImpact(selectedAbility)}
          </Text>
          <View style={styles.executionRow}>
            <Pressable
              onPress={onConfirm}
              disabled={!canExecute}
              style={[
                styles.execTile,
                {
                  borderColor: primaryColor,
                  opacity: canExecute ? 1 : 0.45,
                },
              ]}
            >
              <Text
                style={[styles.execLabel, { color: primaryColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                [ EXECUTE ]
              </Text>
            </Pressable>
            <Pressable
              onPress={onAbort}
              style={[styles.execTile, { borderColor }]}
            >
              <Text
                style={[styles.execLabel, { color: mutedColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                [ ABORT ]
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={deckShellStyle}>
      {apRow}
      <View style={styles.gridRow}>
        {renderTile(loadout[0])}
        {renderTile(loadout[1])}
      </View>
      <View style={styles.gridRow}>
        {renderTile(loadout[2])}
        {renderTile(loadout[3])}
      </View>
      {eviscerateRow}
    </View>
  );
}

const styles = StyleSheet.create({
  commandDeck: {
    flexShrink: 0,
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
  executionModule: {
    gap: 6,
    width: '100%',
    paddingVertical: 2,
  },
  execHeader: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.6,
    lineHeight: 11,
  },
  execDetail: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.5,
    lineHeight: 11,
    minHeight: 22,
  },
  executionRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    width: '100%',
  },
  execTile: {
    flex: 1,
    height: TILE_HEIGHT,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  execLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  eviscerateTile: {
    width: '100%',
    height: ULTIMATE_ROW_HEIGHT,
    borderWidth: 1.5,
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
