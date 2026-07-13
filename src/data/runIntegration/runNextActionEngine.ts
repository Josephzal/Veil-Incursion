import type { PlayerAccount } from '../../types/game';
import type { OperationDebriefPayload } from '../runDebriefEngine';
import type { WorldStatePersistedState, SectorState } from '../../types/worldState';
import { operationProgressPercent } from '../worldStateHelpers';
import { formatCraftingOpportunityLines } from './runCraftingOpportunityEngine';
import { formatRunOutcomeDetailLabel } from './runOutcomeDetailEngine';

/** Rule-based post-debrief suggestions — max 2 lines, no AI. */
export function buildNextActionSuggestions(
  debrief: OperationDebriefPayload,
  account: PlayerAccount,
  world: {
    persisted: WorldStatePersistedState;
    sectors: SectorState[];
    selectedSectorId: string | null;
  },
): string[] {
  const suggestions: string[] = [];
  const push = (line: string) => {
    if (suggestions.length >= 2) return;
    if (!suggestions.includes(line)) suggestions.push(line);
  };

  const contract = debrief.contractResult;
  const sector = world.sectors.find((s) => s.id === world.selectedSectorId)
    ?? world.sectors.find((s) => s.displayName === debrief.sectorName);

  if (contract.status === 'SUCCESS') {
    push('Select a harder sponsor contract or check sponsor reputation unlocks.');
  }

  if (contract.status === 'FAILED') {
    const progressLower = contract.progressText.toLowerCase();
    if (progressLower.includes('lost') || progressLower.includes('cargo')) {
      push('Try banking cargo at the safehouse before pushing deeper.');
      push('Craft a Dead-Drop Token or equip Cargo Seal for risky hauls.');
    } else {
      push('Review contract objectives on the Contract Board before redeploying.');
    }
  }

  if (contract.status === 'NONE') {
    push('Choose a sponsor contract for bonus credits and reputation.');
  }

  if (debrief.runOutcome === 'FAILED') {
    push('You lost unbanked cargo — consider extracting earlier or banking at the next safehouse.');
  }

  if (sector?.activeOperation) {
    const op = sector.activeOperation;
    const pct = operationProgressPercent(op.progressCurrent, op.progressRequired);
    if (pct >= 75 && pct < 100) {
      push(`Run ${sector.displayName} again to complete the active operation (${pct}% complete).`);
    }
  }

  const craftingLines = formatCraftingOpportunityLines(debrief.craftingOpportunities);
  const craftNow = craftingLines.find((line) => line.startsWith('CRAFT NOW:'));
  if (craftNow) {
    push(craftNow.replace('CRAFT NOW: ', 'You can craft ').replace(/\.$/, '') + ' at the Fabrication Matrix.');
  }

  const unstableInStash = Object.keys(account.resourceStash).some((id) =>
    id.includes('veil-ash') || id.includes('ossified') || id.includes('anomalous'),
  );
  if (unstableInStash) {
    push('Unstable cargo in stash unlocks high-tier crafting and Solaris contracts.');
  }

  if (debrief.echoSummary && debrief.echoSummary.hostileEchoesDefeated > 0) {
    push('Echo rewards were secured — check stash for Echo-Glass and bonus salvage.');
  }

  if (suggestions.length === 0) {
    push(`Operation "${debrief.operationTitle}" awaits more contribution — deploy when ready.`);
  }

  return suggestions.slice(0, 2);
}

export function formatNextActionBlock(suggestions: readonly string[]): string {
  if (suggestions.length === 0) return 'NEXT STEPS — none';
  return ['NEXT STEPS', ...suggestions.map((line, i) => `${i + 1}. ${line}`)].join('\n');
}

export function buildHubNextActionHints(
  account: PlayerAccount,
  sectors: SectorState[],
  hasSelectedContract: boolean,
): string[] {
  const hints: string[] = [];
  if (!hasSelectedContract) {
    hints.push('Choose a sponsor contract for better rewards.');
  }
  const nearComplete = sectors.find((sector) => {
    const op = sector.activeOperation;
    const pct = operationProgressPercent(op.progressCurrent, op.progressRequired);
    return pct >= 70 && pct < 100;
  });
  if (nearComplete) {
    const op = nearComplete.activeOperation;
    hints.push(`${nearComplete.displayName} operation is ${operationProgressPercent(op.progressCurrent, op.progressRequired)}% complete.`);
  }
  if (account.equippedKeepsakeId == null) {
    hints.push('Equip an Expedition Relic before descent for run-long bonuses.');
  }
  return hints.slice(0, 2);
}
