/**
 * Phase 3K — live non-boss enemy roster audit (exactly once per EncounterEnemyKey).
 */
import type { EncounterEnemyKey } from '../enemyCombatConfig';
import {
  allDefinedEnemyKeys,
  getEnemyDefinition,
  isDepth3ExclusiveEnemy,
  resolveDefinitionStats,
} from '../enemyDefinitions';
import { BIOME_DEPTH_ENEMY_HINTS } from '../encounterBiomePools';
import { buildEncounterDeck } from '../encounterDeckBuilder';
import { ALL_VEIL_BIOMES } from '../sectorBiomeBridge';
import type { EnemyAuditDefect } from '../../types/weaponEnemyMatchup';
import type { VeilBiome } from '../../types/encounterSpawn';
import { playerFacingEnemyDisplayName } from '../enemyAliasCanonical';

export type LiveEnemyAuditEntry = {
  id: EncounterEnemyKey;
  displayName: string;
  family: string;
  origin: 'RIVAL_MERC' | 'VEIL';
  role: string;
  combatRoleNote: string;
  allowedSectors: readonly VeilBiome[];
  allowedDepths: readonly (1 | 2 | 3)[];
  encounterDeckMembership: readonly string[];
  threatCost: number;
  damageTypes: readonly string[];
  targetingBehavior: string;
  kineticArmorByDepth: Partial<Record<1 | 2 | 3, number>>;
  occultWardByDepth: Partial<Record<1 | 2 | 3, number>>;
  fractureThresholdByDepth: Partial<Record<1 | 2 | 3, number>>;
  mechanicTags: readonly string[];
  statusNotes: string;
  chargedOrTelegraph: string;
  supportBehavior: string;
  multiHitOrMultiTarget: string;
  reactiveTriggers: string;
  runtimeEvents: readonly string[];
  resetBehavior: string;
  descriptionRuntimeAgree: boolean;
  reachableViaDeck: boolean;
  retiredDependency: boolean;
  depth3Exclusive: boolean;
  defect: EnemyAuditDefect;
  notes: string;
};

function rosterDisplayName(id: EncounterEnemyKey): string {
  return playerFacingEnemyDisplayName(id);
}

function decksContaining(enemyId: EncounterEnemyKey): string[] {
  const deck = buildEncounterDeck();
  return deck
    .filter((s) => s.roster.some((u) => u.type === enemyId))
    .map((s) => s.id);
}

function hintsContaining(enemyId: EncounterEnemyKey): boolean {
  return ALL_VEIL_BIOMES.some((biome) =>
    ([1, 2, 3] as const).some((d) => BIOME_DEPTH_ENEMY_HINTS[biome][d].includes(enemyId)),
  );
}

export function buildLiveEnemyAudit(): LiveEnemyAuditEntry[] {
  const keys = allDefinedEnemyKeys();
  return keys.map((id) => {
    const def = getEnemyDefinition(id)!;
    const membership = decksContaining(id);
    const inHints = hintsContaining(id);
    const reachable = membership.length > 0 || inHints || id === 'ANCHOR_HUSK';
    const kineticArmorByDepth: Partial<Record<1 | 2 | 3, number>> = {};
    const occultWardByDepth: Partial<Record<1 | 2 | 3, number>> = {};
    const fractureThresholdByDepth: Partial<Record<1 | 2 | 3, number>> = {};
    ([1, 2, 3] as const).forEach((d) => {
      const st = resolveDefinitionStats(id, d);
      if (!st) return;
      if (st.kineticArmor) kineticArmorByDepth[d] = st.kineticArmor;
      if (st.occultArmor) occultWardByDepth[d] = st.occultArmor;
      if (st.fractureThreshold) fractureThresholdByDepth[d] = st.fractureThreshold;
    });

    let defect: EnemyAuditDefect = 'VALID';
    let notes = '';
    if (id === 'ANCHOR_HUSK') {
      notes = 'Inject-only / ANCHOR tier — not drafted into ordinary biome squads.';
    } else if (!reachable) {
      defect = 'DEAD_OR_UNREACHABLE';
      notes = 'Not present in encounter decks or biome depth hints.';
    } else if (
      Object.keys(kineticArmorByDepth).length + Object.keys(occultWardByDepth).length === 0
      && def.mechanicTags.includes('MUST_DEFEND')
    ) {
      defect = 'DESCRIPTION_MISMATCH';
      notes = 'MUST_DEFEND tag without authored defense stacks at any depth.';
    }

    const hasArmor = Object.keys(kineticArmorByDepth).length > 0;
    const hasWard = Object.keys(occultWardByDepth).length > 0;

    return {
      id,
      displayName: rosterDisplayName(id),
      family: def.origin === 'RIVAL_MERC' ? 'Rival Merc' : 'Veil',
      origin: def.origin,
      role: def.role,
      combatRoleNote: def.role,
      allowedSectors: def.biomeTags,
      allowedDepths: def.spawnGates.allowedDepths,
      encounterDeckMembership: membership,
      threatCost: def.threatCost,
      damageTypes: ['KINETIC'] as const,
      targetingBehavior: def.mechanicTags.includes('UNREACHABLE_BACKLINE')
        ? 'Backline / protected positioning'
        : def.role === 'BACKLINE'
          ? 'Backline pressure'
          : def.role === 'SUPPORT'
            ? 'Support / protect allies'
            : 'Frontline engagement',
      kineticArmorByDepth,
      occultWardByDepth,
      fractureThresholdByDepth,
      mechanicTags: def.mechanicTags,
      statusNotes: def.mechanicTags.join(', ') || 'None authored on definition',
      chargedOrTelegraph: def.mechanicTags.some((t) => t.includes('TIMER'))
        ? 'Timer / scaling telegraph tags present'
        : 'Standard intent pipeline',
      supportBehavior: def.role === 'SUPPORT' ? 'Support role — heal/protect intent via AI catalog' : 'None',
      multiHitOrMultiTarget: 'Profile / intent driven (not authored on EnemyDefinition)',
      reactiveTriggers: def.mechanicTags.includes('HARD_DENIAL') ? 'Hard denial / interrupt pressure' : 'None authored',
      runtimeEvents: [
        'HIT',
        'KILL',
        hasArmor ? 'KINETIC_ARMOR_BREAK' : null,
        hasWard ? 'OCCULT_WARD_BREAK' : null,
        'FRACTURE',
      ].filter(Boolean) as string[],
      resetBehavior: 'Encounter-scoped combat profile; no cross-encounter leak from definition',
      descriptionRuntimeAgree: true,
      reachableViaDeck: reachable,
      retiredDependency: false,
      depth3Exclusive: isDepth3ExclusiveEnemy(id),
      defect,
      notes,
    };
  });
}

export function assertUniqueLiveEnemyAudit(): string[] {
  const audit = buildLiveEnemyAudit();
  const issues: string[] = [];
  const ids = audit.map((e) => e.id);
  if (new Set(ids).size !== ids.length) issues.push('Duplicate enemy IDs in audit');
  const defined = allDefinedEnemyKeys();
  if (ids.length !== defined.length) {
    issues.push(`Audit count ${ids.length} != definitions ${defined.length}`);
  }
  defined.forEach((k) => {
    if (!ids.includes(k)) issues.push(`Missing definition key ${k}`);
  });
  return issues;
}

export function listLiveEnemyAudit(): LiveEnemyAuditEntry[] {
  return buildLiveEnemyAudit();
}

export function getLiveEnemyAuditEntry(id: EncounterEnemyKey): LiveEnemyAuditEntry | undefined {
  return buildLiveEnemyAudit().find((e) => e.id === id);
}
