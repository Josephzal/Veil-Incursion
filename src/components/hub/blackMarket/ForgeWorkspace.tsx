import React, { useMemo, useState } from 'react';
import {
  Image,
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
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from '../../../data/resourceRegistry';
import { getStashCount } from '../../../data/resourceStashEngine';
import { buildResourceDiscoveryCard } from '../../../data/resourceDiscoveryEngine';
import { resolveCargoItemIcon } from '../../../utils/cargoItemIcon';
import {
  buildForgeSchematicPresentation,
  listVisibleForgePresentations,
  type ForgeSchematicPresentation,
} from './forgePresentation';

const TERMINAL = '#69c8ad';
const TERMINAL_BRIGHT = '#8ee0c6';
const MISSING = '#d88984';
const OCCULT = '#9988b3';

interface ForgeWorkspaceProps {
  selectedRecipeId: string | null;
  onSelectRecipe: (recipeId: string) => void;
  compact?: boolean;
  narrow?: boolean;
}

function stateColor(status: ForgeSchematicPresentation['status']): string {
  if (status === 'fabricable') return TERMINAL_BRIGHT;
  if (status === 'missing') return MISSING;
  if (status === 'rumored' || status === 'sealed') return OCCULT;
  return '#879b95';
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

  const ownedResources = useMemo(
    () => ALL_RESOURCE_ITEM_IDS.filter((id) => getStashCount(account.resourceStash, id) > 0),
    [account.resourceStash],
  );

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
    return (
      <View
        key={entry.recipe.id}
        style={[styles.signal, selected && styles.signalSelected]}
      >
        {selected ? <View style={styles.signalAccent} /> : null}
        <HapticPressable
          onPress={() => onSelectRecipe(entry.recipe.id)}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`Inspect ${entry.recipe.label}`}
          style={({ pressed }) => ([
            styles.signalSelect,
            compact && styles.signalSelectCompact,
            narrow && styles.signalSelectNarrow,
            pressed && { opacity: 0.92 },
          ])}
        >
          <View style={styles.signalMain}>
            <TerminalText size={7} letterSpacing={0.9} style={styles.signalStatus}>
              {entry.visibility === 'RUMORED' ? 'RUMORED SCHEMATIC' : 'PERMANENT AUGMENT'}
            </TerminalText>
            <TerminalText size={10.5} letterSpacing={0.3} style={styles.signalTitle} numberOfLines={2}>
              {entry.recipe.label.toUpperCase()}
            </TerminalText>
            <TerminalText size={8} style={styles.signalEffect} numberOfLines={2}>
              {entry.effectLine}
            </TerminalText>
            <TerminalText size={7} letterSpacing={0.4} style={styles.signalReqs} numberOfLines={2}>
              {entry.requirementsLine}
            </TerminalText>
          </View>
          <TerminalText
            size={7}
            letterSpacing={0.8}
            style={[styles.signalState, { color: stateColor(entry.status) }]}
          >
            {entry.stateLabel}
          </TerminalText>
        </HapticPressable>
      </View>
    );
  };

  return (
    <View style={[styles.catalog, narrow && styles.catalogNarrow]}>
      <View style={[styles.materials, narrow && styles.materialsNarrow]}>
        <View style={styles.catalogHeader}>
          <TerminalText size={7} letterSpacing={1} style={styles.catalogHeaderText}>
            MATERIAL HOLDINGS
          </TerminalText>
          <TerminalText size={7} letterSpacing={1} style={styles.catalogHeaderText}>
            {`${ownedResources.length} ${ownedResources.length === 1 ? 'TYPE' : 'TYPES'}`}
          </TerminalText>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: scaleSpacing(10) }}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web'
            ? ({
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(105, 200, 173, 0.22) transparent',
              } as object)
            : null)}
        >
          {ownedResources.length === 0 ? (
            <TerminalText size={8} style={styles.emptyCopy}>
              No resources in stash.
            </TerminalText>
          ) : (
            ownedResources.map((resourceId) => {
              const quantity = getStashCount(account.resourceStash, resourceId);
              const card = buildResourceDiscoveryCard(resourceId, account.resourceDiscovery);
              const def = RESOURCE_REGISTRY[resourceId];
              const image = resolveCargoItemIcon(resourceId);
              return (
                <View key={resourceId} style={styles.materialRow}>
                  {image ? (
                    <Image source={image} style={styles.materialImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.materialImage} />
                  )}
                  <View style={styles.materialIdentity}>
                    <TerminalText size={7.5} style={styles.materialName} numberOfLines={1}>
                      {(card.discovered ? card.title : def.shortName).toUpperCase()}
                    </TerminalText>
                    <TerminalText size={6.5} letterSpacing={0.4} style={styles.materialMeta} numberOfLines={1}>
                      {def.itemType.replace(/_/g, ' ').toUpperCase()}
                    </TerminalText>
                  </View>
                  <View style={styles.materialQty}>
                    <TerminalText size={8.5} style={styles.materialQtyValue}>
                      {quantity}
                    </TerminalText>
                    <TerminalText size={6} letterSpacing={0.7} style={styles.materialQtyLabel}>
                      HELD
                    </TerminalText>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      <View style={styles.feed}>
        <View style={styles.catalogHeader}>
          <TerminalText size={7} letterSpacing={1} style={styles.catalogHeaderText}>
            AUGMENT SCHEMATICS
          </TerminalText>
          <TerminalText size={7} letterSpacing={1} style={styles.catalogHeaderText}>
            {`${allRows.length} ${allRows.length === 1 ? 'RECORD' : 'RECORDS'}`}
          </TerminalText>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: scaleSpacing(12) }}
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
              <TerminalText size={7} letterSpacing={1} style={styles.sectionLabel}>
                PERMANENT AUGMENTS
              </TerminalText>
              {augmentRows.map(renderSchematic)}
            </>
          ) : null}

          {runItemRows.length > 0 ? (
            <>
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
                        color: runItemFilter === filter ? TERMINAL_BRIGHT : '#7f928c',
                        fontWeight: '700',
                      }}
                    >
                      {filter === 'ALL' ? 'ALL RUN ITEMS' : filter}
                    </TerminalText>
                  </HapticPressable>
                ))}
              </View>
              <TerminalText size={7} letterSpacing={1} style={styles.sectionLabel}>
                RUN ITEM SCHEMATICS
              </TerminalText>
              {runItemRows.map(renderSchematic)}
            </>
          ) : null}

          {consumableRows.length > 0 ? (
            <>
              <TerminalText size={7} letterSpacing={1} style={styles.sectionLabel}>
                TACTICAL CONSUMABLES
              </TerminalText>
              {consumableRows.map(renderSchematic)}
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

/** Resolve selected forge presentation for the shared dossier. */
export function resolveForgeSelection(
  account: ReturnType<typeof usePlayerAccount>['account'],
  recipeId: string | null,
): ForgeSchematicPresentation | null {
  if (!recipeId) return null;
  const profile = getAccountProgressionProfile(account);
  const pool: CraftingRecipe[] = [
    ...PERMANENT_AUGMENTS,
    ...buildRunItemCraftingRecipes(),
    ...getRecipesByKind('CONSUMABLE'),
  ];
  const recipe = pool.find((entry) => entry.id === recipeId);
  if (!recipe) return null;
  return buildForgeSchematicPresentation(profile, account, recipe);
}

const styles = StyleSheet.create({
  catalog: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  catalogNarrow: {},
  materials: {
    width: 260,
    maxWidth: 285,
    minWidth: 230,
    borderRightWidth: 1,
    borderRightColor: 'rgba(137, 170, 163, 0.14)',
    backgroundColor: 'rgba(4, 10, 9, 0.36)',
    overflow: 'hidden',
  },
  materialsNarrow: {
    width: 230,
    maxWidth: 230,
  },
  feed: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.11)',
    flexShrink: 0,
  },
  catalogHeaderText: {
    color: '#83948f',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  emptyCopy: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    color: '#91a39f',
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  materialImage: {
    width: 38,
    height: 38,
  },
  materialIdentity: {
    flex: 1,
    minWidth: 0,
  },
  materialName: {
    color: '#d5dfdc',
    fontWeight: '700',
  },
  materialMeta: {
    marginTop: 3,
    color: '#7f928c',
  },
  materialQty: {
    alignItems: 'flex-end',
  },
  materialQtyValue: {
    color: TERMINAL_BRIGHT,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  materialQtyLabel: {
    marginTop: 2,
    color: '#7f928c',
    fontWeight: '700',
  },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 20,
    color: '#7f928c',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: 'rgba(137, 170, 163, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterChipActive: {
    borderColor: 'rgba(105, 200, 173, 0.45)',
    backgroundColor: 'rgba(105, 200, 173, 0.06)',
  },
  signal: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.11)',
  },
  signalSelected: {
    backgroundColor: 'rgba(105, 200, 173, 0.05)',
  },
  signalAccent: {
    position: 'absolute',
    top: 13,
    bottom: 13,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
    zIndex: 1,
  },
  signalSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    minHeight: 108,
    paddingVertical: 15,
    paddingHorizontal: 20,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  signalSelectCompact: {
    minHeight: 96,
    paddingVertical: 12,
  },
  signalSelectNarrow: {
    gap: 18,
  },
  signalMain: {
    flex: 1,
    minWidth: 0,
  },
  signalStatus: {
    color: '#879b95',
    fontWeight: '700',
  },
  signalTitle: {
    marginTop: 5,
    color: '#e0e7e4',
    fontWeight: '700',
  },
  signalEffect: {
    marginTop: 5,
    color: '#a1b0ac',
    lineHeight: 18,
  },
  signalReqs: {
    marginTop: 8,
    color: '#82948f',
    fontWeight: '700',
  },
  signalState: {
    width: 150,
    textAlign: 'right',
    fontWeight: '700',
    flexShrink: 0,
  },
});
