import { ImageSourcePropType } from 'react-native';
import SoulCoreImage from '../../assets/images/item images/soul-core.png';
import TargetFragmentImage from '../../assets/images/item images/target-fragment.png';
import VeilShardImage from '../../assets/images/item images/veil-shard.png';
import ResourceImage from '../../assets/images/resource images/resource1.png';
import LeySlagImage from '../../assets/images/resource images/ley-slag.png';
import SanguineAmpouleImage from '../../assets/images/resource images/sanguine-ampoule.png';
import EncryptedGridDriveImage from '../../assets/images/resource images/encrypted-grid-drive.png';
import BloodIronImage from '../../assets/images/resource images/blood-iron.png';
import AnomalousCoreImage from '../../assets/images/resource images/anomalous-core.png';
import EchoGlassShardImage from '../../assets/images/resource images/echo-glass-shard.png';
import VeilAshCanisterImage from '../../assets/images/resource images/veil-ash-canister.png';
import SmugglersLedgerImage from "../../assets/images/resource images/smuggler's-ledger.png";
import OssifiedLeyKnotImage from '../../assets/images/resource images/ossified-ley-knot.png';
import SealedContainmentCasketImage from '../../assets/images/resource images/sealed-containment-casket.png';
import type { CargoItemId } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';

const CARGO_ITEM_IMAGES: Partial<Record<CargoItemId, ImageSourcePropType>> = {
  'soul-core': SoulCoreImage,
  'veil-shard': VeilShardImage,
  'target-fragment': TargetFragmentImage,
  'spectral-salt': TargetFragmentImage,
  'sanguine-coagulant': SanguineAmpouleImage,
  'veil-ash-grenade': VeilAshCanisterImage,
};

const RESOURCE_ITEM_IMAGES: Record<ResourceItemId, ImageSourcePropType> = {
  'ley-slag': LeySlagImage,
  'sanguine-ampoule': SanguineAmpouleImage,
  'encrypted-grid-drive': EncryptedGridDriveImage,
  'legion-blood-iron': BloodIronImage,
  'anomalous-core': AnomalousCoreImage,
  'echo-glass-shard': EchoGlassShardImage,
  'veil-ash-canister': VeilAshCanisterImage,
  'smugglers-ledger': SmugglersLedgerImage,
  'ossified-ley-knot': OssifiedLeyKnotImage,
  'sealed-containment-casket': SealedContainmentCasketImage,
};

/** Per-item cargo art when available; otherwise shared resource placeholder. */
export function resolveCargoItemIcon(itemId?: CargoItemId): ImageSourcePropType {
  if (itemId && CARGO_ITEM_IMAGES[itemId]) {
    return CARGO_ITEM_IMAGES[itemId]!;
  }
  if (itemId && itemId in RESOURCE_ITEM_IMAGES) {
    return RESOURCE_ITEM_IMAGES[itemId as ResourceItemId];
  }
  return ResourceImage;
}
