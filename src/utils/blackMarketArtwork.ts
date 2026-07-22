import type { ImageSourcePropType } from 'react-native';
import SoulCoreImage from '../../assets/images/item images/soul-core.png';
import TargetFragmentImage from '../../assets/images/item images/target-fragment.png';
import VeilShardImage from '../../assets/images/item images/veil-shard.png';
import CoagulationStitchImage from '../../assets/images/item images/coagulation_stitch.png';
import DeadDropTokenImage from '../../assets/images/item images/dead-drop_token.png';
import EclipseFlareImage from '../../assets/images/item images/eclipse_flare.png';
import GraveDustAmpouleImage from '../../assets/images/item images/grave-dust_ampoule.png';
import GridCrackerMagImage from '../../assets/images/item images/grid-cracker_mag.png';
import ResonanceBribeImage from '../../assets/images/item images/resonance_bribe.png';
import SpallWeaveVestImage from '../../assets/images/item images/spall-weave_vest.png';
import SpectralSaltImage from '../../assets/images/item images/spectral_salt.png';
import VoidSurgeCatalystImage from '../../assets/images/item images/void-surge_catalyst.png';
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

/**
 * Canonical Black Market artwork only — dedicated asset per stable ID.
 * Never falls back to a generic placeholder or another record's image.
 */
const CANONICAL_CARGO_ART: Partial<Record<CargoItemId, ImageSourcePropType>> = {
  'soul-core': SoulCoreImage,
  'veil-shard': VeilShardImage,
  'target-fragment': TargetFragmentImage,
  'spectral-salt': SpectralSaltImage,
  'coagulation-stitch': CoagulationStitchImage,
  'dead-drop-token': DeadDropTokenImage,
  'eclipse-flare': EclipseFlareImage,
  'grave-dust-ampoule': GraveDustAmpouleImage,
  'grid-cracker-mag': GridCrackerMagImage,
  'resonance-bribe': ResonanceBribeImage,
  'spall-weave-vest': SpallWeaveVestImage,
  'void-surge-catalyst': VoidSurgeCatalystImage,
};

const CANONICAL_RESOURCE_ART: Partial<Record<ResourceItemId, ImageSourcePropType>> = {
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

/** Augment / schematic output IDs with no dedicated raster in the asset tree. */
const KNOWN_NO_ART_AUGMENT_OUTPUTS = [
  'CHALK_LINE_WARD',
  'ADRENALINE_PRIMER',
  'BLOOD_PRICE',
  'SMUGGLERS_POCKETS',
  'KINETIC_BATTERY',
  'DEAD_DROP_TRACKER',
] as const;

export type BlackMarketArtworkRecordType =
  | 'CARGO'
  | 'RESOURCE'
  | 'AUGMENT'
  | 'SCHEMATIC'
  | 'SEALED';

export interface BlackMarketArtworkQuery {
  recordType: BlackMarketArtworkRecordType;
  recordId: string;
  /** Optional explicit key; when set, resolved before recordId. */
  artworkKey?: string;
}

export interface BlackMarketArtworkResult {
  source: ImageSourcePropType;
  recordId: string;
}

/** Stable-ID artwork for Black Market surfaces. Returns null when no real art exists. */
export function resolveBlackMarketArtwork(
  query: BlackMarketArtworkQuery,
): BlackMarketArtworkResult | null {
  const key = query.artworkKey ?? query.recordId;
  if (!key) return null;

  if (query.recordType === 'AUGMENT' || query.recordType === 'SCHEMATIC') {
    // Permanent augment outputs are not cargo IDs — never borrow resource art.
    return null;
  }

  if (query.recordType === 'CARGO' || query.recordType === 'SEALED') {
    const cargo = CANONICAL_CARGO_ART[key as CargoItemId];
    if (cargo) return { source: cargo, recordId: key };
    const asResource = CANONICAL_RESOURCE_ART[key as ResourceItemId];
    if (asResource) return { source: asResource, recordId: key };
    return null;
  }

  if (query.recordType === 'RESOURCE') {
    const resource = CANONICAL_RESOURCE_ART[key as ResourceItemId];
    if (resource) return { source: resource, recordId: key };
    return null;
  }

  return null;
}

/** Resource / cargo IDs that still lack dedicated Black Market artwork. */
export function listBlackMarketRecordsWithoutArtwork(): {
  resources: ResourceItemId[];
  augments: readonly string[];
} {
  const allResourceIds = Object.keys(CANONICAL_RESOURCE_ART) as ResourceItemId[];
  // Report known sellables that are intentionally unmapped (not every registry id).
  const knownMissingResources: ResourceItemId[] = [
    'tarnished-dog-tags',
    'combustion-cylinder',
    'nullcrete-shard',
    'mycelial-ichor',
    'cinder-wire',
    'rail-capacitor',
    'containment-seal',
    'resonant-filament',
    'anchor-marrow',
    'breach-thread',
    'blacksite-specimen-jar',
    'overgrowth-coordinate',
    'false-road-signal',
    'transit-cipher',
    'blackline-credentials',
  ];
  void allResourceIds;
  return {
    resources: knownMissingResources.filter((id) => !(id in CANONICAL_RESOURCE_ART)),
    augments: KNOWN_NO_ART_AUGMENT_OUTPUTS,
  };
}

export function formatCreditBalance(credits: number): string {
  return credits.toLocaleString('en-US');
}
