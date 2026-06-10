import { ImageSourcePropType } from 'react-native';
import SoulCoreImage from '../../assets/images/item images/soul-core.png';
import TargetFragmentImage from '../../assets/images/item images/target-fragment.png';
import VeilShardImage from '../../assets/images/item images/veil-shard.png';
import ResourceImage from '../../assets/images/resource images/resource1.png';
import type { CargoItemId } from '../types/cargoGrid';

const CARGO_ITEM_IMAGES: Partial<Record<CargoItemId, ImageSourcePropType>> = {
  'soul-core': SoulCoreImage,
  'veil-shard': VeilShardImage,
  'target-fragment': TargetFragmentImage,
  'spectral-salt': TargetFragmentImage,
};

/** Per-item cargo art when available; otherwise shared resource placeholder. */
export function resolveCargoItemIcon(itemId?: CargoItemId): ImageSourcePropType {
  if (itemId && CARGO_ITEM_IMAGES[itemId]) {
    return CARGO_ITEM_IMAGES[itemId]!;
  }
  return ResourceImage;
}
