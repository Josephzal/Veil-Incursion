import type { CargoItemId } from '../types/cargoGrid';
import { ALL_RUN_ITEM_IDS, type RunItemId } from '../types/runItem';

/** Snake_case design-doc ids → canonical kebab-case Supply ids. */
export const RUN_ITEM_ID_ALIASES: Record<string, RunItemId> = {
  standard_coagulant: 'standard-coagulant',
  trauma_patch: 'trauma-patch',
  grave_dust_ampoule: 'grave-dust-ampoule',
  spall_weave_vest: 'spall-weave-vest',
  grid_cracker_mag: 'grid-cracker-mag',
  eclipse_flare: 'eclipse-flare',
  veil_ash_grenade: 'veil-ash-grenade',
  rigged_combustion_cylinder: 'rigged-combustion-cylinder',
  mirror_salt_vial: 'mirror-salt-vial',
  bloodwire_tourniquet: 'bloodwire-tourniquet',
  null_space_injector: 'null-space-injector',
  black_iron_wedge: 'black-iron-wedge',
  razorwire_spool: 'razorwire-spool',
  voidglass_decoy: 'voidglass-decoy',
  broker_flashcard: 'broker-flashcard',
  relay_spike: 'relay-spike',
  sonar_ping: 'sonar-ping',
  null_lens_filter: 'null-lens-filter',
  dead_drop_token: 'dead-drop-token',
  ash_seal_canister: 'ash-seal-canister',
  containment_foam: 'containment-foam',
  ley_slag_splitter: 'ley-slag-splitter',
  echo_tuning_fork: 'echo-tuning-fork',
  anchor_needle: 'anchor-needle',
};

/**
 * Stage IV-A: mechanically distinct cargo supplies are not aliases merely
 * because their names overlap former Supply donors.
 */
export const RUN_ITEM_LEGACY_CATALOG_ALIASES: Record<string, RunItemId> = {};

const RUN_ITEM_ID_SET = new Set<string>(ALL_RUN_ITEM_IDS);

export function isRunItemId(id: string): id is RunItemId {
  return RUN_ITEM_ID_SET.has(id);
}

export function isRunItemCargoId(id: CargoItemId): boolean {
  return isRunItemId(id);
}

/**
 * Resolve a Supply id to its canonical kebab-case form.
 * Accepts exact kebab-case ids, snake_case aliases, and legacy catalog ids.
 */
export function normalizeRunItemId(id: string): RunItemId {
  if (isRunItemId(id)) {
    return id;
  }
  const snakeAlias = RUN_ITEM_ID_ALIASES[id];
  if (snakeAlias) {
    return snakeAlias;
  }
  const catalogAlias = RUN_ITEM_LEGACY_CATALOG_ALIASES[id];
  if (catalogAlias) {
    return catalogAlias;
  }
  throw new Error(`normalizeRunItemId: unknown Supply id '${id}'.`);
}

/** Non-throwing lookup — returns null when id cannot be normalized. */
export function tryNormalizeRunItemId(id: string): RunItemId | null {
  try {
    return normalizeRunItemId(id);
  } catch {
    return null;
  }
}
