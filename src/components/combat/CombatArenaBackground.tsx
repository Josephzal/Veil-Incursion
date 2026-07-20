import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type ImageLoadEventData,
} from 'react-native';

interface CombatArenaBackgroundProps {
  source: ImageSourcePropType;
  scrimColor?: string | null;
}

interface ContainerSize {
  width: number;
  height: number;
}

interface AssetSize {
  width: number;
  height: number;
}

const DEFAULT_ASSET_SIZE: AssetSize = { width: 16, height: 9 };

function resolveImageAssetSize(source: ImageSourcePropType): AssetSize {
  const resolveAssetSource = (
    Image as {
      resolveAssetSource?: (
        src: ImageSourcePropType,
      ) => { width?: number; height?: number } | undefined;
    }
  ).resolveAssetSource;

  if (typeof resolveAssetSource === 'function') {
    const resolved = resolveAssetSource(source);
    if (resolved?.width && resolved?.height) {
      return { width: resolved.width, height: resolved.height };
    }
  }

  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const { width, height } = source as { width?: number; height?: number };
    if (width && height) {
      return { width, height };
    }
  }

  return DEFAULT_ASSET_SIZE;
}

/** Cover-fit arena backdrop — fills the panel edge-to-edge, centered, uniform scale. */
export default function CombatArenaBackground({
  source,
  scrimColor = null,
}: CombatArenaBackgroundProps): React.JSX.Element {
  const [container, setContainer] = useState<ContainerSize>({ width: 0, height: 0 });
  const [assetSize, setAssetSize] = useState<AssetSize>(() => resolveImageAssetSize(source));

  useEffect(() => {
    setAssetSize(resolveImageAssetSize(source));
  }, [source]);

  const imageFrame = useMemo(() => {
    const { width: containerW, height: containerH } = container;
    const { width: assetW, height: assetH } = assetSize;
    if (containerW <= 0 || containerH <= 0 || assetW <= 0 || assetH <= 0) {
      return null;
    }

    const scale = Math.max(containerW / assetW, containerH / assetH);
    const width = assetW * scale;
    const height = assetH * scale;
    // Cover-fit, centered — fills the panel edge-to-edge with no top/bottom gaps.
    const left = (containerW - width) / 2;
    const top = (containerH - height) / 2;

    return { width, height, left, top };
  }, [assetSize, container]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainer((prev) => (
      prev.width === width && prev.height === height
        ? prev
        : { width, height }
    ));
  }, []);

  const handleImageLoad = useCallback((event: NativeSyntheticEvent<ImageLoadEventData>) => {
    const native = event.nativeEvent as ImageLoadEventData & {
      width?: number;
      height?: number;
      source?: { width?: number; height?: number };
    };
    const width = native.source?.width ?? native.width;
    const height = native.source?.height ?? native.height;
    if (!width || !height || width <= 0 || height <= 0) return;
    setAssetSize((prev) => (
      prev.width === width && prev.height === height
        ? prev
        : { width, height }
    ));
  }, []);

  return (
    <View style={[styles.host, styles.hostPointerLock]} onLayout={handleLayout}>
      {imageFrame ? (
        <Image
          source={source}
          onLoad={handleImageLoad}
          style={[
            styles.image,
            {
              width: imageFrame.width,
              height: imageFrame.height,
              left: imageFrame.left,
              top: imageFrame.top,
            },
          ]}
        />
      ) : null}
      {scrimColor ? (
        <View style={[styles.scrim, { backgroundColor: scrimColor }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#0a0a0c',
  },
  hostPointerLock: {
    pointerEvents: 'none',
  },
  image: {
    position: 'absolute',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
});
