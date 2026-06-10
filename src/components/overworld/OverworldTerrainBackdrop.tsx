import React from 'react';
import { Image, useImage, type DataSourceParam } from '@shopify/react-native-skia';

import OverworldTerrain from '../../../assets/images/environment images/overworld.png';

const TERRAIN_SOURCE = OverworldTerrain as DataSourceParam;

interface OverworldTerrainBackdropProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
}

/** World-space terrain tile that pans with the operative via the parent transform group. */
export default function OverworldTerrainBackdrop({
  viewBoxWidth,
  viewBoxHeight,
}: OverworldTerrainBackdropProps): React.JSX.Element | null {
  const terrain = useImage(TERRAIN_SOURCE);

  if (!terrain || viewBoxWidth <= 0 || viewBoxHeight <= 0) {
    return null;
  }

  return (
    <Image
      image={terrain}
      x={0}
      y={0}
      width={viewBoxWidth}
      height={viewBoxHeight}
      fit="cover"
    />
  );
}
