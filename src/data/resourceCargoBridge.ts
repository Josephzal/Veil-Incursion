import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import type { ResourceBundle } from '../types/resourceItem';
import { addLootToContainment } from './cargoGridEngine';

export function applyResourceBundleToCargo(
  cargo: CargoRunState,
  bundle: ResourceBundle,
  stagedInstanceIds?: string[],
): CargoRunState {
  return bundle.items.reduce(
    (next, entry) => addLootToContainment(next, entry.id as CargoItemId, entry.quantity, stagedInstanceIds),
    cargo,
  );
}
