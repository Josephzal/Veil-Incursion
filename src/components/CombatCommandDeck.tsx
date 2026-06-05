import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';


export type CombatDeckAction =
  | 'STRIKE'
  | 'ABYSSAL_WARD'
  | 'BREATHING_TECHNIQUE'
  | 'COUNTER_STANCE';

export const STRIKE_DECK_LABEL = '[ STRIKE ]';
export const ABYSSAL_STRIKE_PRIMED_LABEL = '[ ABYSSAL STRIKE ]';

export function strikeDeckLabel(wardPrimed: boolean): string {
  return wardPrimed ? ABYSSAL_STRIKE_PRIMED_LABEL : STRIKE_DECK_LABEL;
}

export const DECK_ACTION_LABELS: Record<CombatDeckAction, string> = {
  STRIKE: STRIKE_DECK_LABEL,
  BREATHING_TECHNIQUE: '[ BREATHING TECHNIQUE ]',
  COUNTER_STANCE: '[ COUNTER STANCE ]',
  ABYSSAL_WARD: '[ ABYSSAL WARD ]',
};

/** 2×2 grid order: strike / breathing on row 1, counter / abyssal ward on row 2. */
export const COMMAND_DECK_GRID: CombatDeckAction[] = [
  'STRIKE',
  'BREATHING_TECHNIQUE',
  'COUNTER_STANCE',
  'ABYSSAL_WARD',
];

const MONO = 'monospace';
const TILE_HEIGHT = 52;
const DECK_TILE_FILL = '#000000';
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
  getActionLabel?: (action: CombatDeckAction) => string;
  getActionGlow?: (action: CombatDeckAction) => boolean;
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
  getActionLabel,
  getActionGlow,
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

  const labelFor = (action: CombatDeckAction) =>
    getActionLabel?.(action) ?? DECK_ACTION_LABELS[action];

  const renderTile = (action: CombatDeckAction) => {
    const enabled = isActionEnabled(action);
    const accent = getActionAccent?.(action);
    const glow = Boolean(enabled && accent && getActionGlow?.(action));
    const tileBorderColor = enabled && accent ? accent : borderColor;

    return (
      <View
        key={action}
        style={[styles.tileSlot, { borderColor: tileBorderColor }]}
      >
        {glow && accent ? (
          <View
            pointerEvents="none"
            style={[
              styles.tileGlowOverlay,
              { borderColor: accent, shadowColor: accent },
            ]}
          />
        ) : null}
        <Pressable
          onPress={() => enabled && onSelectAction(action)}
          disabled={!enabled}
          style={[
            styles.deckTile,
            {
              backgroundColor: glow ? DECK_TILE_FILL : 'transparent',
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
            {labelFor(action)}
          </Text>
        </Pressable>
      </View>
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
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
    height: TILE_HEIGHT,
  },
  tileSlot: {
    flex: 1,
    height: TILE_HEIGHT,
    borderWidth: 1,
    position: 'relative',
    overflow: 'visible',
  },
  tileGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.88,
    shadowRadius: 11,
    elevation: 8,
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
