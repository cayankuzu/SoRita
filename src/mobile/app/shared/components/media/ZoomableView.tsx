import React from 'react';
import {
  Animated,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { motion } from '@/mobile/app/shared/theme/tokens';

export const MAX_ZOOM_SCALE = 4;
export const DOUBLE_TAP_ZOOM_SCALE = 2.5;
// A pinch may overshoot a little either way and springs back on release.
const PINCH_UNDERSHOOT = 0.8;
const PINCH_OVERSHOOT = 1.25;

export type ZoomTransform = {
  scale: number;
  x: number;
  y: number;
};

const IDENTITY: ZoomTransform = { scale: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Where a transform settles once the fingers lift: back to fit below 1x,
 * at most `MAX_ZOOM_SCALE`, and never panned past the picture's edges.
 */
export function settleZoomTransform(
  transform: ZoomTransform,
  size: { height: number; width: number },
): ZoomTransform {
  if (transform.scale <= 1.01) {
    return IDENTITY;
  }

  const scale = clamp(transform.scale, 1, MAX_ZOOM_SCALE);
  const maxX = (size.width * (scale - 1)) / 2;
  const maxY = (size.height * (scale - 1)) / 2;

  return {
    scale,
    x: clamp(transform.x, -maxX, maxX),
    y: clamp(transform.y, -maxY, maxY),
  };
}

/**
 * The transform that keeps the content under a point still while the scale
 * changes, so a pinch or a double tap zooms toward the fingers. The point is
 * measured from the view's centre.
 */
export function zoomAroundPoint(
  from: ZoomTransform,
  nextScale: number,
  point: { x: number; y: number },
): ZoomTransform {
  const ratio = nextScale / from.scale;

  return {
    scale: nextScale,
    x: point.x - (point.x - from.x) * ratio,
    y: point.y - (point.y - from.y) * ratio,
  };
}

type ZoomableViewProps = {
  active?: boolean;
  children: React.ReactNode;
  onZoomChange?: (zoomed: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Two fingers zoom toward where they pinch, one finger moves around a zoomed
 * picture, and a double tap zooms in on the tapped spot or back out, as in
 * Instagram's photo viewer. Leaving the page returns it to fit.
 */
export function ZoomableView({
  active = true,
  children,
  onZoomChange,
  style,
}: ZoomableViewProps) {
  const sizeRef = React.useRef({ height: 0, width: 0 });
  const scale = React.useRef(new Animated.Value(1)).current;
  const translateX = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;
  const currentRef = React.useRef<ZoomTransform>(IDENTITY);
  const gestureStartRef = React.useRef<ZoomTransform & { focalX: number; focalY: number }>({
    ...IDENTITY,
    focalX: 0,
    focalY: 0,
  });
  const [zoomed, setZoomed] = React.useState(false);
  const zoomedRef = React.useRef(false);
  const onZoomChangeRef = React.useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const updateZoomed = React.useCallback((next: boolean) => {
    if (zoomedRef.current === next) return;
    zoomedRef.current = next;
    setZoomed(next);
    onZoomChangeRef.current?.(next);
  }, []);

  const apply = React.useCallback(
    (next: ZoomTransform) => {
      currentRef.current = next;
      scale.setValue(next.scale);
      translateX.setValue(next.x);
      translateY.setValue(next.y);
    },
    [scale, translateX, translateY],
  );

  const settle = React.useCallback(
    (target: ZoomTransform, animated = true) => {
      const next = settleZoomTransform(target, sizeRef.current);
      currentRef.current = next;
      updateZoomed(next.scale > 1);

      if (!animated) {
        apply(next);
        return;
      }

      Animated.parallel([
        Animated.timing(scale, { duration: motion.standard, toValue: next.scale, useNativeDriver: true }),
        Animated.timing(translateX, { duration: motion.standard, toValue: next.x, useNativeDriver: true }),
        Animated.timing(translateY, { duration: motion.standard, toValue: next.y, useNativeDriver: true }),
      ]).start();
    },
    [apply, scale, translateX, translateY, updateZoomed],
  );

  React.useEffect(() => {
    if (!active && currentRef.current.scale !== 1) {
      settle(IDENTITY, false);
    }
  }, [active, settle]);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    sizeRef.current = { height, width };
  }, []);

  const gesture = React.useMemo(() => {
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart((event) => {
        gestureStartRef.current = {
          ...currentRef.current,
          focalX: event.focalX - sizeRef.current.width / 2,
          focalY: event.focalY - sizeRef.current.height / 2,
        };
      })
      .onUpdate((event) => {
        const start = gestureStartRef.current;
        const nextScale = clamp(
          start.scale * event.scale,
          PINCH_UNDERSHOOT,
          MAX_ZOOM_SCALE * PINCH_OVERSHOOT,
        );
        apply(zoomAroundPoint(start, nextScale, { x: start.focalX, y: start.focalY }));
      })
      .onEnd(() => settle(currentRef.current));

    // One finger only moves a zoomed picture; at fit size the swipe belongs
    // to the pager so the next photo can slide in.
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(zoomed)
      .maxPointers(1)
      .onStart(() => {
        gestureStartRef.current = { ...gestureStartRef.current, ...currentRef.current };
      })
      .onUpdate((event) => {
        const start = gestureStartRef.current;
        apply({
          scale: currentRef.current.scale,
          x: start.x + event.translationX,
          y: start.y + event.translationY,
        });
      })
      .onEnd(() => settle(currentRef.current));

    const doubleTap = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .onEnd((event, success) => {
        if (!success) return;
        if (currentRef.current.scale > 1.01) {
          settle(IDENTITY);
          return;
        }
        settle(
          zoomAroundPoint(IDENTITY, DOUBLE_TAP_ZOOM_SCALE, {
            x: event.x - sizeRef.current.width / 2,
            y: event.y - sizeRef.current.height / 2,
          }),
        );
      });

    return Gesture.Simultaneous(pinch, pan, doubleTap);
  }, [apply, settle, zoomed]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        onLayout={handleLayout}
        style={[
          styles.frame,
          style,
          { transform: [{ translateX }, { translateY }, { scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
});
