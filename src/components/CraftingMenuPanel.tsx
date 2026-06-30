import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import TerminalText from './TerminalText';
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
import { useHubLayout } from '../context/HubLayoutContext';
import { useSafehouseTypography } from '../hooks/useSafehouseTypography';
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
  const { bodySize, captionSize } = useSafehouseTypography();
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
        <Text style={[styles.recipeTitle, { color: theme.primaryColor, fontSize: bodySize(9) }]}>
          {recipe.label.toUpperCase()}
        </Text>
        {recipe.effectSummary ? (
          <Text style={[styles.recipeBody, { color: theme.mutedColor, fontSize: bodySize(8), lineHeight: bodySize(12) }]}>
            {recipe.effectSummary}
          </Text>
        ) : null}
        {recipe.description ? (
          <Text style={[styles.recipeBody, { color: theme.mutedColor, fontSize: bodySize(8), lineHeight: bodySize(12) }]}>
            {recipe.description}
          </Text>
        ) : null}
        <View style={styles.reqBlock}>
          {recipe.requirements.map((req) => (
            <Text
              key={`${recipe.id}-${req.resourceId}`}
              style={[
                styles.reqLine,
                {
                  fontSize: captionSize(7),
                  lineHeight: captionSize(10),
                  fontWeight: isDesktop ? '600' : '400',
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

function StashSummaryPanel({
  title,
  theme,
  isDesktop,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useTerminal>['theme'];
  isDesktop: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={[styles.stashPanel, isDesktop && styles.stashPanelDesktop, { borderColor: theme.borderColor }]}>
      <TerminalText variant="section" style={{ color: theme.mutedColor, fontWeight: '700' }}>
        {title}
      </TerminalText>
      {children}
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
    <StashSummaryPanel title="RESOURCE STASH" theme={theme} isDesktop={isDesktop}>
      {Object.keys(stash).length === 0 ? (
        <TerminalText variant="caption" style={{ color: theme.mutedColor }}>
          No resources banked — extract salvage from incursions to craft.
        </TerminalText>
      ) : (
        Object.entries(stash).map(([id, count]) => (
          <TerminalText
            key={id}
            variant="body"
            style={[
              styles.stashLine,
              { color: theme.textColor, fontWeight: isDesktop ? '700' : '400' },
            ]}
          >
            {`${count}x ${RESOURCE_REGISTRY[id as ResourceItemId]?.name ?? id}`}
          </TerminalText>
        ))
      )}
    </StashSummaryPanel>
  );
}

export default function CraftingMenuPanel({
  onClose,
  embedded = false,
}: CraftingMenuPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, craftRecipe, appendHubLog } = usePlayerAccount();
  const { isDesktop, forgeStashWidth } = useHubLayout();
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
      <TerminalText variant="section" style={[styles.sectionLabel, { color: theme.mutedColor }]}>
        {SECTION_LABELS[kind]}
      </TerminalText>
      <View style={styles.recipeStack}>
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
        <StashSummaryPanel title="UNLOCKED LOADOUTS" theme={theme} isDesktop={useForgeDesktop}>
          {account.unlockedBlueprints.map((blueprintId) => (
            <TerminalText key={blueprintId} variant="body" style={{ color: theme.statusColor, fontWeight: '700' }}>
              {blueprintId.replace(/_/g, ' ').toUpperCase()}
            </TerminalText>
          ))}
        </StashSummaryPanel>
      ) : null}

      {account.craftedAugments.length > 0 ? (
        <StashSummaryPanel title="FORGED AUGMENTS" theme={theme} isDesktop={useForgeDesktop}>
          {account.craftedAugments.map((augmentId) => (
            <TerminalText key={augmentId} variant="body" style={{ color: theme.statusColor, fontWeight: '700' }}>
              {augmentId.replace(/_/g, ' ')}
            </TerminalText>
          ))}
        </StashSummaryPanel>
      ) : null}

      {stagedConsumableCount > 0 ? (
        <StashSummaryPanel title="STAGED CONSUMABLES" theme={theme} isDesktop={useForgeDesktop}>
          {Object.entries(account.hubCraftedConsumables).map(([id, count]) => (
            count && count > 0 ? (
              <TerminalText key={id} variant="body" style={{ color: theme.textColor, fontWeight: useForgeDesktop ? '700' : '400' }}>
                {`${count}x ${id.replace(/-/g, ' ').toUpperCase()}`}
              </TerminalText>
            ) : null
          ))}
        </StashSummaryPanel>
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
          <View style={[styles.forgeStashColumn, { width: forgeStashWidth }]}>
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
    flexShrink: 0,
    flexGrow: 0,
    gap: 10,
    alignSelf: 'flex-start',
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
  recipeStack: {
    gap: 8,
  },
  recipeGrid: {
    gap: 8,
  },
  recipeCard: {
    borderWidth: 1,
    padding: 10,
    gap: 6,
    backgroundColor: '#0a0b0f',
    width: '100%',
  },
  recipeCardDesktop: {
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
    width: 'auto',
    maxWidth: '100%',
  },
  craftBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
