import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-gesture-handler', () => ({
  Gesture: {},
  GestureDetector: () => null,
}));

import {
  MAX_ZOOM_SCALE,
  settleZoomTransform,
  zoomAroundPoint,
} from '@/mobile/app/shared/components/media/ZoomableView';

const size = { height: 800, width: 400 };

describe('zoomAroundPoint', () => {
  it('keeps the pinched spot under the fingers while the scale changes', () => {
    const point = { x: 100, y: -50 };
    const zoomed = zoomAroundPoint({ scale: 1, x: 0, y: 0 }, 2, point);

    // The content point under the fingers maps back to the same screen point.
    const contentX = (point.x - 0) / 1;
    const contentY = (point.y - 0) / 1;
    expect(contentX * zoomed.scale + zoomed.x).toBeCloseTo(point.x);
    expect(contentY * zoomed.scale + zoomed.y).toBeCloseTo(point.y);
  });

  it('continues from an already zoomed and panned picture', () => {
    const from = { scale: 2, x: -60, y: 30 };
    const point = { x: -40, y: 120 };
    const next = zoomAroundPoint(from, 3, point);
    const contentX = (point.x - from.x) / from.scale;

    expect(contentX * next.scale + next.x).toBeCloseTo(point.x);
  });
});

describe('settleZoomTransform', () => {
  it('returns to fit when released below or at fit size', () => {
    expect(settleZoomTransform({ scale: 0.85, x: 40, y: -20 }, size)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
  });

  it('caps the zoom and keeps the picture covering the frame', () => {
    const settled = settleZoomTransform({ scale: 6, x: 5000, y: -5000 }, size);

    expect(settled.scale).toBe(MAX_ZOOM_SCALE);
    expect(settled.x).toBe((size.width * (MAX_ZOOM_SCALE - 1)) / 2);
    expect(settled.y).toBe(-(size.height * (MAX_ZOOM_SCALE - 1)) / 2);
  });

  it('leaves a transform inside the bounds where it is', () => {
    expect(settleZoomTransform({ scale: 2, x: 50, y: -100 }, size)).toEqual({
      scale: 2,
      x: 50,
      y: -100,
    });
  });
});
