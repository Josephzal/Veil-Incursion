import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import type { ResourceBundle } from '../types/resourceItem';
import { addLootToContainment } from './cargoGridEngine';

/** Harvest / field packs — each unit is a separate physical containment instance. */
const HARVEST_FIELD_SPAWN = { asSeparatePhysicalUnits: true } as const;

export function applyResourceBundleToCargo(
  cargo: CargoRunState,
  bundle: ResourceBundle,
  stagedInstanceIds?: string[],
): CargoRunState {
  return bundle.items.reduce(
    (next, entry) => addLootToContainment(
      next,
      entry.id as CargoItemId,
      entry.quantity,
      stagedInstanceIds,
      HARVEST_FIELD_SPAWN,
    ),
    cargo,
  );
}
