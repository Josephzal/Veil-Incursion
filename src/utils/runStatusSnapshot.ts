import { RESONANCE_SYSTEM_ACTIVE } from '../data/featureFlags';
import type { ActiveIncursionState, EnvironmentalModifiers } from '../types/game';
import type { RunState } from '../types/run';
import type { RunStatusEffect } from '../types/narrativeProcedural';
import { LEY_LINE_MUTATION_CATALOG } from '../data/leyLineMutations';
import { ENVOY_BOON_CATALOG } from '../data/envoyBoons';
import { HEX_SHOT_BOON_CATALOG } from '../data/hexShotBoons';
import type { ClassType } from '../types/game';
import { MACRO_BIOME_DISPLAY } from '../data/macroBiomeEngine';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import { buildKeepsakeRunStatusEntries } from '../data/expeditionKeepsakeRunUiEngine';
import { buildRunItemRunStatusEntries } from '../data/runItemRunUiEngine';

export type RunStatusCategory = 'BOON' | 'HAZARD' | 'MACRO' | 'ENVIRONMENT' | 'RESONANCE' | 'SECTOR';

export interface RunStatusEntry {
  id: string;
  label: string;
  description: string;
  category: RunStatusCategory;
}

function resourcePercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((current / max) * 100);
}

/** Operative vitals line — health and current run depth only. */
export function buildOperativeVitalsLine(
  runState: RunState,
  activeIncursion: ActiveIncursionState,
): string {
  const healthPct = resourcePercent(runState.soulAnchorIntegrity, runState.maxSoulAnchor);
  const depth = activeIncursion.currentDepth ?? 1;
  return `HEALTH: ${healthPct}% // DEPTH: ${depth}`;
}

const FLAG_LABELS: Record<string, { label: string; description: string }> = {
  breached_firewall: {
    label: 'Firewall Breached',
    description: 'Sector threat routing softened after a brute-force terminal breach.',
  },
  plasma_survivor: {
    label: 'Plasma Survivor',
    description: 'Withstood volatile plasma flare exposure during extraction.',
  },
  sealed_breach: {
    label: 'Sealed Breach',
    description: 'A localized veil breach was sealed — future hazard noise reduced.',
  },
  vault_breached: {
    label: 'Vault Breached',
    description: 'Faction vault brute-forced — hunter dispatch may be active.',
  },
};

function envModifierEntries(env: EnvironmentalModifiers): RunStatusEntry[] {
  const entries: RunStatusEntry[] = [];

  if (env.isEnemyPhaseShrouded) {
    entries.push({
      id: 'env-phase-shroud',
      label: 'Phase Shroud',
      description: 'Hostile phase transitions are obscured — enemy intent reads corrupted.',
      category: 'ENVIRONMENT',
    });
  }
  if (env.isPlayerBlinded) {
    entries.push({
      id: 'env-blinded',
      label: 'Sensor Blind',
      description: 'Operative sensors are jammed — resolver and combat readouts degraded.',
      category: 'HAZARD',
    });
  }
  if (env.hasTetanusGlitch) {
    entries.push({
      id: 'env-tetanus',
      label: 'Tetanus Glitch',
      description: 'Kinetic feedback loop active — parry timing window compressed.',
      category: 'HAZARD',
    });
  }
  if (env.startingStaminaPenalty > 0) {
    entries.push({
      id: 'env-stamina-penalty',
      label: `Stamina Penalty (−${env.startingStaminaPenalty})`,
      description: 'Residual fatigue from prior hazard exposure.',
      category: 'HAZARD',
    });
  }
  if (env.bloodFrenzyActive) {
    entries.push({
      id: 'env-blood-frenzy',
      label: 'Blood Frenzy',
      description: 'Occult saturation elevated — aggressive damage modifiers active.',
      category: 'ENVIRONMENT',
    });
  }
  if (env.enemyDamageReductionPct && env.enemyDamageReductionPct > 0) {
    entries.push({
      id: 'env-enemy-mitigation',
      label: `Threat Mitigation (−${env.enemyDamageReductionPct}% hostile dmg)`,
      description: 'Macro resolver reduced sector threat output.',
      category: 'MACRO',
    });
  }
  if (env.combatObjective) {
    entries.push({
      id: `env-objective-${env.combatObjective}`,
      label: `Combat Objective: ${env.combatObjective}`,
      description: 'Active encounter constraint from narrative or sector hazard.',
      category: 'ENVIRONMENT',
    });
  }
  if (env.eliteModifier) {
    entries.push({
      id: `env-elite-${env.eliteModifier}`,
      label: `Elite Modifier: ${env.eliteModifier}`,
      description: 'Elite combat anomaly modifier in effect.',
      category: 'HAZARD',
    });
  }

  return entries;
}

function escalationEntries(inc: ActiveIncursionState): RunStatusEntry[] {
  if (!RESONANCE_SYSTEM_ACTIVE) return [];
  const esc = inc.resonanceEscalations;
  const entries: RunStatusEntry[] = [];

  if (esc.terminalBlindNodesRemaining > 0) {
    entries.push({
      id: 'esc-terminal-blind',
      label: 'Terminal Blind',
      description: `Scanner readout corrupted for ${esc.terminalBlindNodesRemaining} more node(s).`,
      category: 'RESONANCE',
    });
  }
  if (esc.veilStalkerHuntActive) {
    entries.push({
      id: 'esc-veil-stalker',
      label: 'Veil Stalker Hunt',
      description: 'Apex predator tracking the operative — sanctuary and market nodes compromised.',
      category: 'RESONANCE',
    });
  }
  if (esc.vectorSeveredTriggered) {
    entries.push({
      id: 'esc-vector-severed',
      label: 'Vector Severed',
      description: 'Extraction conduit severed — emergency links may be hostile decoys.',
      category: 'RESONANCE',
    });
  }
  if (esc.extractionDecoyPending) {
    entries.push({
      id: 'esc-extraction-decoy',
      label: 'Extraction Decoy Armed',
      description: 'Next emergency extraction vector may be an elite ambush trap.',
      category: 'RESONANCE',
    });
  }
  if (inc.overworldSession.gridHound?.active && !inc.overworldSession.gridHound.caught) {
    entries.push({
      id: 'esc-grid-hound',
      label: 'Grid-Hound Active',
      description: 'Apex predator patrolling the overworld — avoid its vision cone.',
      category: 'RESONANCE',
    });
  }
  if (inc.cargo.dataBleedActive) {
    entries.push({
      id: 'esc-data-bleed',
      label: 'Data Bleed',
      description: 'Cargo market value erodes each cleared node until stabilized.',
      category: 'HAZARD',
    });
  }
  if (inc.resonance.percent >= 41) {
    entries.push({
      id: 'esc-hostile-band',
      label: `Resonance ${inc.resonance.percent}% — Hostile Band`,
      description: 'Veil bleed elevated — patrol contact and data bleed risk increased.',
      category: 'RESONANCE',
    });
  }

  return entries;
}

function flagEntries(flags: readonly string[]): RunStatusEntry[] {
  return flags.map((flag) => {
    const known = FLAG_LABELS[flag];
    return {
      id: `flag-${flag}`,
      label: known?.label ?? flag.replace(/_/g, ' ').toUpperCase(),
      description: known?.description ?? 'Narrative expedition flag acquired this run.',
      category: 'MACRO' as const,
    };
  });
}

function mutationEntries(mutationIds: readonly string[]): RunStatusEntry[] {
  return mutationIds.map((id) => {
    const def = LEY_LINE_MUTATION_CATALOG[id as keyof typeof LEY_LINE_MUTATION_CATALOG];
    return {
      id: `mutation-${id}`,
      label: def?.name ?? id,
      description: def?.description ?? def?.effect ?? 'Ley-Line mutation active.',
      category: 'BOON' as const,
    };
  });
}

function statusEffectEntries(effects: readonly RunStatusEffect[]): RunStatusEntry[] {
  return effects.map((effect) => ({
    id: effect.id,
    label: effect.label,
    description: effect.description,
    category: effect.source === 'BOON'
      ? 'BOON'
      : effect.source === 'HAZARD'
        ? 'HAZARD'
        : effect.source === 'ENVIRONMENT'
          ? 'ENVIRONMENT'
          : 'MACRO',
  }));
}

function sectorEntry(family: MacroBiomeFamily | null): RunStatusEntry | null {
  if (!family) return null;
  return {
    id: 'sector-macro-biome',
    label: MACRO_BIOME_DISPLAY[family],
    description: 'Active sector biome shaping encounter flavor and vector pressure.',
    category: 'SECTOR',
  };
}

function classBoonEntries(
  classId: ClassType,
  inc: ActiveIncursionState,
): RunStatusEntry[] {
  if (classId === 'HEX_SHOT') {
    return inc.hexShotBoons.map((id) => {
      const def = HEX_SHOT_BOON_CATALOG[id];
      return {
        id: `hex-boon-${id}`,
        label: def?.name ?? id,
        description: def?.description ?? def?.effect ?? 'Hex-Shot boon active.',
        category: 'BOON' as const,
      };
    });
  }
  if (classId === 'ENVOY') {
    return inc.envoyBoons.map((id) => {
      const def = ENVOY_BOON_CATALOG[id];
      return {
        id: `envoy-boon-${id}`,
        label: def?.name ?? id,
        description: def?.description ?? def?.effect ?? 'Envoy boon active.',
        category: 'BOON' as const,
      };
    });
  }
  return mutationEntries(inc.leyLineMutations);
}

export function buildRunStatusSnapshot(inc: ActiveIncursionState): RunStatusEntry[] {
  const entries: RunStatusEntry[] = [];

  const sector = sectorEntry(inc.currentMacroBiomeFamily);
  if (sector) entries.push(sector);

  entries.push(...classBoonEntries(inc.activeClass ?? 'AEGIS', inc));
  entries.push(...buildKeepsakeRunStatusEntries(inc.keepsakeRuntime));
  entries.push(...buildRunItemRunStatusEntries(inc.itemRuntime, inc.runItems));
  entries.push(...statusEffectEntries(inc.runStatusEffects));
  entries.push(...flagEntries(inc.progress.collectedFlags));
  entries.push(...envModifierEntries(inc.environmentalModifiers));
  entries.push(...escalationEntries(inc));

  return entries;
}

export const RUN_STATUS_CATEGORY_LABELS: Record<RunStatusCategory, string> = {
  SECTOR: 'Sector',
  BOON: 'Boons',
  HAZARD: 'Hazards',
  MACRO: 'Macro Effects',
  ENVIRONMENT: 'Environment',
  RESONANCE: 'Resonance',
};

export function groupRunStatusEntries(
  entries: RunStatusEntry[],
): Record<RunStatusCategory, RunStatusEntry[]> {
  const grouped: Record<RunStatusCategory, RunStatusEntry[]> = {
    SECTOR: [],
    BOON: [],
    HAZARD: [],
    MACRO: [],
    ENVIRONMENT: [],
    RESONANCE: [],
  };
  for (const entry of entries) {
    grouped[entry.category].push(entry);
  }
  return grouped;
}
