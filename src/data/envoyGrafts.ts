import type { ClassGraftDefinition, EnvoyGraftId } from '../types/classGraft';

function env(
  id: EnvoyGraftId,
  name: string,
  cost: number,
  description: string,
  accentColor: string,
  extras: Partial<Omit<ClassGraftDefinition, 'id' | 'classId' | 'name' | 'cost' | 'description' | 'accentColor'>>,
): ClassGraftDefinition {
  return { id, classId: 'ENVOY', name, cost, description, accentColor, ...extras };
}

export const ENVOY_GRAFT_DATABASE: Record<EnvoyGraftId, ClassGraftDefinition> = {
  VOID_CONDUCTOR_GRAFT: env(
    'VOID_CONDUCTOR_GRAFT',
    'Void-Conductor Graft',
    20,
    'Damage ×2.0. +20 Flux generation.',
    '#a78bfa',
    { damageMultiplier: 2, addFluxGeneration: 20 },
  ),
  SPLINTER_RUNE_GRAFT: env(
    'SPLINTER_RUNE_GRAFT',
    'Splinter-Rune Graft',
    15,
    'Splits into 3 rapid hits. Raw damage ×0.4.',
    '#f472b6',
    { hitCount: 3, damageMultiplier: 0.4 },
  ),
  ECLIPSE_SIGIL_GRAFT: env(
    'ECLIPSE_SIGIL_GRAFT',
    'Eclipse-Sigil Graft',
    25,
    'Adds AoE tag. Base damage −30%.',
    '#818cf8',
    { addTag: 'AOE', reduceDamage: 0.3 },
  ),
  BLOOD_INK_GRAFT: env(
    'BLOOD_INK_GRAFT',
    'Blood-Ink Graft',
    20,
    'Converts damage to True. Operative takes 1 Bleed.',
    '#dc2626',
    { convertToTrueDamage: true, applySelfDebuff: 'BLEED_1' },
  ),
  AETHER_VALVE_GRAFT: env(
    'AETHER_VALVE_GRAFT',
    'Aether-Valve Graft',
    25,
    'Swaps FLUX_GEN → FLUX_DUMP. Vents 20 Flux. Damage ×0.8.',
    '#22d3ee',
    { modifyTagFrom: 'FLUX_GEN', modifyTagTo: 'FLUX_DUMP', setFluxCost: 20, damageMultiplier: 0.8 },
  ),
  SANGUINE_CHANNEL_GRAFT: env(
    'SANGUINE_CHANNEL_GRAFT',
    'Sanguine-Channel Graft',
    20,
    'Flux generation → 0. Drains 10% Max HP on cast.',
    '#f87171',
    { setFluxGen: 0, addHpCost: 0.1 },
  ),
  ECHO_WEAVE_GRAFT: env(
    'ECHO_WEAVE_GRAFT',
    'Echo-Weave Graft',
    30,
    'Kills refund 1 AP. +10 Flux generation.',
    '#c084fc',
    { refundApOnKill: true, addFluxGeneration: 10 },
  ),
  NULL_STATE_GRAFT: env(
    'NULL_STATE_GRAFT',
    'Null-State Graft',
    15,
    '0 AP cost. Generates 40 Flux on cast.',
    '#67e8f9',
    { setApCost: 0, setFluxGen: 40 },
  ),
  PARASITIC_SEAL_GRAFT: env(
    'PARASITIC_SEAL_GRAFT',
    'Parasitic-Seal Graft',
    25,
    'Heal 40% of damage dealt. −5% Max HP for the run.',
    '#f43f5e',
    { healPercentageOfDamage: 0.4, reduceMaxHp: 0.05 },
  ),
  WITHER_MARK_GRAFT: env(
    'WITHER_MARK_GRAFT',
    'Wither-Mark Graft',
    20,
    'Target loses 1 AP next turn. +15 Flux generation.',
    '#84cc16',
    { applyDebuffToTarget: 'AP_MINUS_1', addFluxGeneration: 15 },
  ),
  GHOST_THREAD_GRAFT: env(
    'GHOST_THREAD_GRAFT',
    'Ghost-Thread Graft',
    15,
    '+20% Evade until next turn. Removes FRACTURE tag.',
    '#2dd4bf',
    { addBuff: 'EVADE_20', removeTags: ['FRACTURE'] },
  ),
  CHRONO_LOCK_GRAFT: env(
    'CHRONO_LOCK_GRAFT',
    'Chrono-Lock Graft',
    25,
    'Applies ROOTED. Damage ×0.6.',
    '#38bdf8',
    { applyDebuffToTarget: 'ROOTED', damageMultiplier: 0.6 },
  ),
  ANOMALY_SPARK_GRAFT: env(
    'ANOMALY_SPARK_GRAFT',
    'Anomaly-Spark Graft',
    20,
    'Duplicates cast at full power to a random target.',
    '#e879f9',
    { randomTarget: true, duplicateCast: 1 },
  ),
  OVERLOAD_CATALYST_GRAFT: env(
    'OVERLOAD_CATALYST_GRAFT',
    'Overload-Catalyst Graft',
    30,
    'Damage scales with current Veil-Flux.',
    '#fbbf24',
    { damageScale: 'CURRENT_FLUX' },
  ),
  MARTYR_RUNE_GRAFT: env(
    'MARTYR_RUNE_GRAFT',
    'Martyr-Rune Graft',
    20,
    'Converts to AoE. Operative takes 15 self-damage.',
    '#fda4af',
    { convertToAoE: true, dealSelfDamage: 15 },
  ),
  APEX_CHANNEL_GRAFT: env(
    'APEX_CHANNEL_GRAFT',
    'Apex-Channel Graft',
    45,
    'Executes sub-20% HP non-bosses. Disables Ultimate this encounter.',
    '#fde047',
    { executeThreshold: 0.2, disableUltimate: true },
  ),
};

export const ALL_ENVOY_GRAFT_IDS = Object.keys(ENVOY_GRAFT_DATABASE) as EnvoyGraftId[];

export function getEnvoyGraftDefinition(id: EnvoyGraftId): ClassGraftDefinition {
  return ENVOY_GRAFT_DATABASE[id];
}

export function pickRandomEnvoyGraftOffers(count = 3): EnvoyGraftId[] {
  const pool = [...ALL_ENVOY_GRAFT_IDS];
  const offers: EnvoyGraftId[] = [];
  while (offers.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    offers.push(pool.splice(index, 1)[0]);
  }
  return offers;
}
