import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';

interface CombatArenaBackgroundProps {
  source: ImageSourcePropType;
  scrimColor?: string | null;
}

interface ContainerSize {
  width: number;
  height: number;
}

/** Cover-fit arena backdrop — fills the panel edge-to-edge, bottom-anchored, uniform scale. */
export default function CombatArenaBackground({
  source,
  scrimColor = null,
}: CombatArenaBackgroundProps): React.JSX.Element {
  const [container, setContainer] = useState<ContainerSize>({ width: 0, height: 0 });

  const assetSize = useMemo(() => {
    const resolved = Image.resolveAssetSource(source);
    return {
      width: resolved?.width ?? 16,
      height: resolved?.height ?? 9,
    };
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
    const left = (containerW - width) / 2;
    const top = containerH - height + 100;

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

  return (
    <View style={styles.host} pointerEvents="none" onLayout={handleLayout}>
      {imageFrame ? (
        <Image
          source={source}
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
  image: {
    position: 'absolute',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
});
