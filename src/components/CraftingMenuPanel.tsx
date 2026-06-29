import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import {
  getRecipesByKind,
  isRecipeOutputOwned,
  type CraftingRecipe,
  type CraftingRecipeKind,
} from '../data/craftingRegistry';
import { canAffordRecipe, getStashCount } from '../data/resourceStashEngine';
import { RESOURCE_REGISTRY } from '../data/resourceRegistry';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
import { terminalHoverStyle, readPressableHover } from '../utils/terminalHoverStyle';
import type { ResourceItemId } from '../types/resourceItem';

interface CraftingMenuPanelProps {
  onClose?: () => void;
  embedded?: boolean;
}

const SECTION_LABELS: Record<CraftingRecipeKind, string> = {
  LOADOUT: 'LOADOUT SCHEMATICS',
  AUGMENT: 'PERMANENT AUGMENTS',
  CONSUMABLE: 'TACTICAL CONSUMABLES',
};

function RecipeCard({
  recipe,
  affordable,
  alreadyOwned,
  stash,
  onCraft,
  theme,
  isDesktop,
}: {
  recipe: CraftingRecipe;
  affordable: boolean;
  alreadyOwned: boolean;
  stash: ReturnType<typeof usePlayerAccount>['account']['resourceStash'];
  onCraft: (recipeId: string) => void;
  theme: ReturnType<typeof useTerminal>['theme'];
  isDesktop: boolean;
}): React.JSX.Element {
  const craftDisabled = !affordable || (recipe.kind !== 'CONSUMABLE' && alreadyOwned);
  const craftLabel = recipe.kind === 'CONSUMABLE'
    ? '[ CRAFT ]'
    : alreadyOwned
      ? '[ ALREADY FORGED ]'
      : '[ FABRICATE ]';

  return (
    <View
      style={[
        styles.recipeCard,
        isDesktop && styles.recipeCardDesktop,
        { borderColor: affordable ? theme.statusColor : theme.borderColor },
      ]}
    >
      <View style={styles.recipeCopy}>
        <Text style={[styles.recipeTitle, { color: theme.primaryColor }]}>{recipe.label.toUpperCase()}</Text>
        {recipe.effectSummary ? (
          <Text style={[styles.recipeBody, { color: theme.mutedColor }]}>{recipe.effectSummary}</Text>
        ) : null}
        {recipe.description ? (
          <Text style={[styles.recipeBody, { color: theme.mutedColor }]}>{recipe.description}</Text>
        ) : null}
        <View style={styles.reqBlock}>
          {recipe.requirements.map((req) => (
            <Text
              key={`${recipe.id}-${req.resourceId}`}
              style={[
                styles.reqLine,
                isDesktop && styles.reqLineDesktop,
                {
                  color: getStashCount(stash, req.resourceId) >= req.quantity
                    ? theme.textColor
                    : '#ef4444',
                },
              ]}
            >
              {`${req.quantity}x ${RESOURCE_REGISTRY[req.resourceId].name} (owned: ${getStashCount(stash, req.resourceId)})`}
            </Text>
          ))}
        </View>
      </View>
      <HapticPressable
        disabled={craftDisabled}
        onPress={() => onCraft(recipe.id)}
        style={(state) => [
          styles.craftBtn,
          isDesktop && styles.craftBtnDesktop,
          {
            borderColor: !craftDisabled ? theme.statusColor : '#1a2e22',
            opacity: craftDisabled ? 0.3 : state.pressed ? 0.75 : 1,
          },
          terminalHoverStyle(readPressableHover(state), state.pressed),
        ]}
      >
        <Text
          style={[
            styles.craftBtnText,
            { color: !craftDisabled ? theme.statusColor : '#2a4032' },
          ]}
        >
          {craftLabel}
        </Text>
      </HapticPressable>
    </View>
  );
}

function ResourceStashPanel({
  stash,
  theme,
  isDesktop,
}: {
  stash: ReturnType<typeof usePlayerAccount>['account']['resourceStash'];
  theme: ReturnType<typeof useTerminal>['theme'];
  isDesktop: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.stashPanel, isDesktop && styles.stashPanelDesktop, { borderColor: theme.borderColor }]}>
      <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>RESOURCE STASH</Text>
      {Object.keys(stash).length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.mutedColor }]}>
          No resources banked — extract salvage from incursions to craft.
        </Text>
      ) : (
        Object.entries(stash).map(([id, count]) => (
          <Text
            key={id}
            style={[
              styles.stashLine,
              isDesktop && styles.stashLineDesktop,
              { color: theme.textColor },
            ]}
          >
            {`${count}x ${RESOURCE_REGISTRY[id as ResourceItemId]?.name ?? id}`}
          </Text>
        ))
      )}
    </View>
  );
}

export default function CraftingMenuPanel({
  onClose,
  embedded = false,
}: CraftingMenuPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, craftRecipe, appendHubLog } = usePlayerAccount();
  const { isDesktop } = useResponsiveScale();
  const useForgeDesktop = embedded && isDesktop;

  const recipesByKind = useMemo(
    () => ({
      LOADOUT: getRecipesByKind('LOADOUT'),
      AUGMENT: getRecipesByKind('AUGMENT'),
      CONSUMABLE: getRecipesByKind('CONSUMABLE'),
    }),
    [],
  );

  const handleCraft = (recipeId: string) => {
    const result = craftRecipe(recipeId);
    appendHubLog(result.logLine);
  };

  const stagedConsumableCount = Object.values(account.hubCraftedConsumables)
    .reduce((sum, count) => sum + (count ?? 0), 0);

  const renderRecipeSection = (kind: CraftingRecipeKind) => (
    <View key={kind} style={styles.recipeSection}>
      <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>
        {SECTION_LABELS[kind]}
      </Text>
      <View style={[styles.recipeGrid, useForgeDesktop && styles.recipeGridDesktop]}>
        {recipesByKind[kind].map((recipe) => {
          const affordable = canAffordRecipe(account.resourceStash, recipe);
          const alreadyOwned = isRecipeOutputOwned(
            recipe.outputId,
            account.unlockedBlueprints,
            account.craftedAugments,
          );
          return (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              affordable={affordable}
              alreadyOwned={alreadyOwned}
              stash={account.resourceStash}
              onCraft={handleCraft}
              theme={theme}
              isDesktop={useForgeDesktop}
            />
          );
        })}
      </View>
    </View>
  );

  const footerPanels = (
    <>
      {account.unlockedBlueprints.length > 0 ? (
        <View style={[styles.stashPanel, { borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>UNLOCKED LOADOUTS</Text>
          {account.unlockedBlueprints.map((blueprintId) => (
            <Text key={blueprintId} style={[styles.stashLine, { color: theme.statusColor }]}>
              {blueprintId.replace(/_/g, ' ').toUpperCase()}
            </Text>
          ))}
        </View>
      ) : null}

      {account.craftedAugments.length > 0 ? (
        <View style={[styles.stashPanel, { borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>FORGED AUGMENTS</Text>
          {account.craftedAugments.map((augmentId) => (
            <Text key={augmentId} style={[styles.stashLine, { color: theme.statusColor }]}>
              {augmentId.replace(/_/g, ' ')}
            </Text>
          ))}
        </View>
      ) : null}

      {stagedConsumableCount > 0 ? (
        <View style={[styles.stashPanel, { borderColor: theme.borderColor }]}>
          <Text style={[styles.sectionLabel, { color: theme.mutedColor }]}>STAGED CONSUMABLES</Text>
          {Object.entries(account.hubCraftedConsumables).map(([id, count]) => (
            count && count > 0 ? (
              <Text key={id} style={[styles.stashLine, { color: theme.textColor }]}>
                {`${count}x ${id.replace(/-/g, ' ').toUpperCase()}`}
              </Text>
            ) : null
          ))}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.root, embedded ? styles.rootEmbedded : null, { borderColor: theme.borderColor, backgroundColor: '#050608' }]}>
      {!embedded ? (
        <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
          <Text style={[styles.title, { color: theme.primaryColor }]}>FABRICATION BENCH // METRO HUB</Text>
          {onClose ? (
            <HapticPressable onPress={onClose} style={[styles.closeBtn, { borderColor: theme.statusColor }]}>
              <Text style={[styles.closeBtnText, { color: theme.statusColor }]}>[ CLOSE ]</Text>
            </HapticPressable>
          ) : null}
        </View>
      ) : null}

      {useForgeDesktop ? (
        <View style={styles.forgeDesktopRow}>
          <View style={styles.forgeStashColumn}>
            <ResourceStashPanel stash={account.resourceStash} theme={theme} isDesktop />
            {footerPanels}
          </View>
          <ScrollView style={styles.forgeRecipesColumn} contentContainerStyle={styles.forgeRecipesContent}>
            {(['AUGMENT', 'CONSUMABLE', 'LOADOUT'] as CraftingRecipeKind[]).map(renderRecipeSection)}
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <ResourceStashPanel stash={account.resourceStash} theme={theme} isDesktop={false} />
          {(['AUGMENT', 'CONSUMABLE', 'LOADOUT'] as CraftingRecipeKind[]).map(renderRecipeSection)}
          {footerPanels}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderWidth: 1,
    minHeight: 280,
  },
  rootEmbedded: {
    borderWidth: 0,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  closeBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
    gap: 10,
  },
  forgeDesktopRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    gap: 12,
    padding: 10,
  },
  forgeStashColumn: {
    flex: 0.3,
    minWidth: 0,
    gap: 10,
  },
  forgeRecipesColumn: {
    flex: 0.7,
    minWidth: 0,
  },
  forgeRecipesContent: {
    gap: 12,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    fontWeight: '700',
    marginBottom: 6,
  },
  stashPanel: {
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  stashPanelDesktop: {
    padding: 12,
    gap: 6,
  },
  stashLine: {
    fontFamily: 'monospace',
    fontSize: 8,
  },
  stashLineDesktop: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 14,
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
  },
  recipeSection: {
    gap: 6,
  },
  recipeGrid: {
    gap: 8,
  },
  recipeGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recipeCard: {
    borderWidth: 1,
    padding: 10,
    gap: 6,
    backgroundColor: '#0a0b0f',
    marginBottom: 8,
  },
  recipeCardDesktop: {
    flexBasis: '48%',
    flexGrow: 0,
    minWidth: 280,
    maxWidth: 420,
    marginBottom: 0,
    justifyContent: 'space-between',
  },
  recipeCopy: {
    gap: 6,
    flexShrink: 1,
  },
  recipeTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  recipeBody: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
  },
  reqBlock: {
    gap: 2,
  },
  reqLine: {
    fontFamily: 'monospace',
    fontSize: 7,
  },
  reqLineDesktop: {
    fontSize: 8,
    fontWeight: '600',
    lineHeight: 12,
  },
  craftBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  craftBtnDesktop: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  craftBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
