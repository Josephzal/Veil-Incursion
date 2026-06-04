import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';


export type CombatDeckAction =
  | 'KINETIC_STRIKE'
  | 'AEGIS_PROTOCOL'
  | 'FLUID_VENT'
  | 'COUNTER_STANCE';

export const DECK_ACTION_LABELS: Record<CombatDeckAction, string> = {
  KINETIC_STRIKE: '[ KINETIC STRIKE ]',
  FLUID_VENT: '[ FLUID VENT ]',
  COUNTER_STANCE: '[ COUNTER STANCE ]',
  AEGIS_PROTOCOL: '[ AEGIS PROTOCOL ]',
};

/** 2×2 grid order: strike / vent on row 1, counter / aegis on row 2. */
export const COMMAND_DECK_GRID: CombatDeckAction[] = [
  'KINETIC_STRIKE',
  'FLUID_VENT',
  'COUNTER_STANCE',
  'AEGIS_PROTOCOL',
];

const MONO = 'monospace';
const TILE_HEIGHT = 52;
/** 2×2 grid: two tile rows + row gap + deck padding (matches minHeight safeguard). */
export const COMMAND_DECK_MIN_HEIGHT = TILE_HEIGHT * 2 + 8 + 12;

interface CombatCommandDeckProps {
  selectedAction: CombatDeckAction | null;
  onSelectAction: (action: CombatDeckAction) => void;
  onConfirm: () => void;
  onAbort: () => void;
  isActionEnabled: (action: CombatDeckAction) => boolean;
  getStagedHeader: (action: CombatDeckAction) => string;
  getStagedCostImpact: (action: CombatDeckAction) => string;
  getActionAccent?: (action: CombatDeckAction) => string | undefined;
  borderColor: string;
  primaryColor: string;
  mutedColor: string;
  frameless?: boolean;
}

export default function CombatCommandDeck({
  selectedAction,
  onSelectAction,
  onConfirm,
  onAbort,
  isActionEnabled,
  getStagedHeader,
  getStagedCostImpact,
  getActionAccent,
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

  const renderTile = (action: CombatDeckAction) => {
    const enabled = isActionEnabled(action);
    const accent = getActionAccent?.(action);
    return (
      <Pressable
        key={action}
        onPress={() => enabled && onSelectAction(action)}
        disabled={!enabled}
        style={[
          styles.deckTile,
          {
            borderColor: enabled && accent ? accent : borderColor,
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
          {DECK_ACTION_LABELS[action]}
        </Text>
      </Pressable>
    );
  };

  if (selectedAction) {
    const canExecute = isActionEnabled(selectedAction);
    return (
      <View style={deckShellStyle}>
        <View style={styles.executionModule}>
          <Text style={[styles.execHeader, { color: primaryColor }]} numberOfLines={1} ellipsizeMode="tail">
            {getStagedHeader(selectedAction)}
          </Text>
          <Text
            style={[styles.execDetail, { color: mutedColor }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {getStagedCostImpact(selectedAction)}
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
      <View style={styles.gridRow}>
        {renderTile(COMMAND_DECK_GRID[0])}
        {renderTile(COMMAND_DECK_GRID[1])}
      </View>
      <View style={styles.gridRow}>
        {renderTile(COMMAND_DECK_GRID[2])}
        {renderTile(COMMAND_DECK_GRID[3])}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  commandDeck: {
    flexShrink: 0,
    minHeight: COMMAND_DECK_MIN_HEIGHT,
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 1,
    gap: 8,
  },
  commandDeckFrameless: {
    borderTopWidth: 0,
    paddingTop: 4,
    paddingBottom: 2,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  deckTile: {
    flex: 1,
    height: TILE_HEIGHT,
    borderWidth: 1,
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
    gap: 8,
    width: '100%',
    paddingVertical: 4,
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
    gap: 8,
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
});
