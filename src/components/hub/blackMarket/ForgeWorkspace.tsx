import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import { useHubLayout } from '../../../context/HubLayoutContext';
import { getAccountProgressionProfile } from '../../../data/progressionDebugEngine';
import {
  getRecipesByKind,
  PERMANENT_AUGMENTS,
  type CraftingRecipe,
} from '../../../data/craftingRegistry';
import {
  buildRunItemCraftingRecipes,
  filterRunItemCraftingRecipes,
  isRunItemCraftOutput,
  type RunItemCraftFilter,
} from '../../../data/runItemCraftingBridge';
import {
  buildForgeSchematicPresentation,
  listVisibleForgePresentations,
  type ForgeSchematicPresentation,
} from './forgePresentation';
import {
  resolveSchematicGlyphFamily,
  SchematicGlyphMark,
} from './SchematicGlyph';
import { VEIL } from '../../../theme/veilTerminalTokens';
import { OccultNeonRail } from '../veilChrome';
import {
  HUB_BROWSER_CONTENT_PADDING_H,
  HUB_BROWSER_FEED_PAD_TOP,
  hubBrowserSectionLabelStyle,
  HUB_CARD_BORDER,
  HUB_CARD_BORDER_HOVER,
  HUB_CARD_BORDER_SELECTED,
  HUB_CARD_SURFACE,
  HUB_CARD_SURFACE_HOVER,
  HUB_META,
  HUB_SELECT_SURFACE,
} from '../../../theme/hubPanelSurfaces';

const TERMINAL_BRIGHT = VEIL.mintBright;
const MISSING = VEIL.blood;
const META = HUB_META;

interface ForgeWorkspaceProps {
  selectedRecipeId: string | null;
  onSelectRecipe: (recipeId: string) => void;
  compact?: boolean;
  narrow?: boolean;
  /** Retained for fabrication feedback wiring; materials column removed. */
  pulseResourceIds?: readonly string[];
}

function stateColor(status: ForgeSchematicPresentation['status']): string {
  if (status === 'fabricable') return TERMINAL_BRIGHT;
  if (status === 'missing' || status === 'sealed') return MISSING;
  if (status === 'rumored') return META;
  return META;
}

export default function ForgeWorkspace({
  selectedRecipeId,
  onSelectRecipe,
  compact = false,
  narrow = false,
}: ForgeWorkspaceProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const { scaleSpacing } = useHubLayout();
  const [runItemFilter, setRunItemFilter] = useState<RunItemCraftFilter>('ALL');

  const profile = useMemo(() => getAccountProgressionProfile(account), [account]);

  const augmentRows = useMemo(
    () => listVisibleForgePresentations(profile, account, PERMANENT_AUGMENTS),
    [profile, account],
  );

  const runItemRecipes = useMemo(
    () => filterRunItemCraftingRecipes(buildRunItemCraftingRecipes(), runItemFilter),
    [runItemFilter],
  );
  const runItemRows = useMemo(
    () => listVisibleForgePresentations(profile, account, runItemRecipes),
    [profile, account, runItemRecipes],
  );

  const consumableRecipes = useMemo(
    () => getRecipesByKind('CONSUMABLE').filter((recipe) => !isRunItemCraftOutput(recipe.outputId)),
    [],
  );
  const consumableRows = useMemo(
    () => listVisibleForgePresentations(profile, account, consumableRecipes),
    [profile, account, consumableRecipes],
  );

  const allRows = useMemo(
    () => [...augmentRows, ...runItemRows, ...consumableRows],
    [augmentRows, runItemRows, consumableRows],
  );

  const renderSchematic = (entry: ForgeSchematicPresentation) => {
    const selected = selectedRecipeId === entry.recipe.id;
    const sealed = entry.status === 'rumored' || entry.status === 'sealed';
    const family = isRunItemCraftOutput(entry.recipe.outputId) && entry.recipe.kind !== 'AUGMENT'
      ? 'run' as const
      : resolveSchematicGlyphFamily(entry.recipe.id, entry.recipe.kind, sealed);

    return (
      <View
        key={entry.recipe.id}
        style={[styles.signal, narrow && styles.signalNarrow, selected && styles.signalSelected]}
        {...(Platform.OS === 'web' ? ({ 'data-selected': selected ? 'true' : 'false' } as object) : null)}
      >
        {selected ? <OccultNeonRail style={styles.signalAccent} /> : null}
        <HapticPressable
          onPress={() => onSelectRecipe(entry.recipe.id)}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`Inspect ${entry.recipe.label}`}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
            styles.signalSelect,
            compact && styles.signalSelectCompact,
            selected && styles.signalSelectSelected,
            ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
            pressed && { opacity: 0.92 },
          ])}
        >
          <View style={styles.glyphSlot}>
            <SchematicGlyphMark family={family} size={compact ? 24 : 28} sealed={sealed} />
          </View>
          <View style={styles.signalMain}>
            <TerminalText
              size={11}
              letterSpacing={0.15}
              style={styles.signalTitle}
              numberOfLines={1}
            >
              {entry.recipe.label.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} style={styles.signalEffect} numberOfLines={2}>
              {entry.effectLine}
            </TerminalText>
            <TerminalText size={6.5} letterSpacing={0.2} style={styles.signalReqs} numberOfLines={1}>
              {entry.requirementsLine}
            </TerminalText>
          </View>
          <View style={styles.signalStamp}>
            <TerminalText
              size={7}
              letterSpacing={0.7}
              style={[styles.signalState, { color: stateColor(entry.status) }]}
              numberOfLines={1}
            >
              {entry.stateLabel}
            </TerminalText>
          </View>
        </HapticPressable>
      </View>
    );
  };

  const renderSectionGrid = (rows: ForgeSchematicPresentation[]) => (
    <View style={styles.signalGrid}>
      {rows.map(renderSchematic)}
    </View>
  );

  return (
    <View style={styles.catalog}>
      <View style={styles.feed}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingTop: HUB_BROWSER_FEED_PAD_TOP, paddingBottom: scaleSpacing(12) }}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web'
            ? ({
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(105, 200, 173, 0.22) transparent',
              } as object)
            : null)}
        >
          {augmentRows.length > 0 ? (
            <>
              <TerminalText size={11} letterSpacing={1.05} style={styles.sectionLabel}>
                PERMANENT AUGMENTS
              </TerminalText>
              {renderSectionGrid(augmentRows)}
            </>
          ) : null}

          {runItemRows.length > 0 || runItemFilter !== 'ALL' ? (
            <>
              <TerminalText size={11} letterSpacing={1.05} style={styles.sectionLabel}>
                RUN ITEM SCHEMATICS
              </TerminalText>
              <View style={styles.filterRow}>
                {(['ALL', 'COMBAT', 'FIELD'] as const).map((filter) => (
                  <HapticPressable
                    key={filter}
                    onPress={() => setRunItemFilter(filter)}
                    style={[
                      styles.filterChip,
                      runItemFilter === filter && styles.filterChipActive,
                    ]}
                  >
                    <TerminalText
                      size={7}
                      letterSpacing={0.6}
                      style={{
                        color: runItemFilter === filter ? VEIL.text : META,
                        fontWeight: '700',
                      }}
                    >
                      {filter === 'ALL' ? 'ALL RUN ITEMS' : filter}
                    </TerminalText>
                  </HapticPressable>
                ))}
              </View>
              {runItemRows.length > 0 ? renderSectionGrid(runItemRows) : null}
            </>
          ) : null}

          {consumableRows.length > 0 ? (
            <>
              <TerminalText size={11} letterSpacing={1.05} style={styles.sectionLabel}>
                TACTICAL CONSUMABLES
              </TerminalText>
              {renderSectionGrid(consumableRows)}
            </>
          ) : null}

          {allRows.length === 0 ? (
            <TerminalText size={8} style={styles.emptyCopy}>
              No schematics available in the current forge cycle.
            </TerminalText>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function forgeRecipePool(): CraftingRecipe[] {
  return [
    ...PERMANENT_AUGMENTS,
    ...buildRunItemCraftingRecipes(),
    ...getRecipesByKind('CONSUMABLE'),
  ];
}

/** Resolve selected forge presentation for the shared dossier. */
export function resolveForgeSelection(
  account: ReturnType<typeof usePlayerAccount>['account'],
  recipeId: string | null,
): ForgeSchematicPresentation | null {
  if (!recipeId) return null;
  const profile = getAccountProgressionProfile(account);
  const recipe = forgeRecipePool().find((entry) => entry.id === recipeId);
  if (!recipe) return null;
  const presentation = buildForgeSchematicPresentation(profile, account, recipe);
  if (presentation.visibility !== 'KNOWN' && presentation.visibility !== 'RUMORED') {
    return null;
  }
  return presentation;
}

/**
 * Default forge selection: first fabricable schematic, else first available record.
 * Does not purchase or craft — selection only.
 */
export function resolveInitialForgeRecipeId(
  account: ReturnType<typeof usePlayerAccount>['account'],
): string | null {
  const profile = getAccountProgressionProfile(account);
  const rows = listVisibleForgePresentations(profile, account, forgeRecipePool());
  if (rows.length === 0) return null;
  const fabricable = rows.find((row) => row.canFabricate || row.status === 'fabricable');
  if (fabricable) return fabricable.recipe.id;
  const known = rows.find((row) => row.visibility === 'KNOWN');
  return (known ?? rows[0]).recipe.id;
}

const styles = StyleSheet.create({
  catalog: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  feed: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  emptyCopy: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    color: '#91a39f',
  },
  sectionLabel: {
    ...hubBrowserSectionLabelStyle(),
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: HUB_BROWSER_CONTENT_PADDING_H,
    paddingBottom: 10,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    backgroundColor: VEIL.surface1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChipActive: {
    borderColor: HUB_CARD_BORDER_SELECTED,
    backgroundColor: HUB_SELECT_SURFACE,
  },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  signal: {
    position: 'relative',
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 10,
    overflow: 'hidden',
  },
  signalNarrow: {
    width: '100%',
  },
  signalSelected: {
    backgroundColor: 'transparent',
  },
  signalAccent: {
    top: 14,
    bottom: 14,
    left: 6,
  },
  signalSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Fixed height so fabricable / clearance / rumored rows share one footprint
    // (effect line is always reserved for 2 lines).
    height: 88,
    minHeight: 88,
    maxHeight: 88,
    paddingVertical: 11,
    paddingLeft: 14,
    paddingRight: 12,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        outlineStyle: 'none',
      } as object,
      default: {},
    }),
  },
  signalSelectHover: {
    backgroundColor: HUB_CARD_SURFACE_HOVER,
    borderColor: HUB_CARD_BORDER_HOVER,
  },
  signalSelectSelected: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  signalSelectCompact: {
    height: 80,
    minHeight: 80,
    maxHeight: 80,
    paddingVertical: 9,
  },
  glyphSlot: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.88,
    flexShrink: 0,
  },
  signalMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  signalTitle: {
    color: VEIL.text,
    fontWeight: '700',
  },
  signalEffect: {
    marginTop: 3,
    color: META,
    letterSpacing: 0,
    lineHeight: 12,
  },
  signalReqs: {
    marginTop: 4,
    color: META,
    fontWeight: '600',
  },
  signalStamp: {
    width: 96,
    alignItems: 'stretch',
    justifyContent: 'center',
    flexShrink: 0,
  },
  signalState: {
    width: '100%',
    fontWeight: '700',
    textAlign: 'right',
  },
});
