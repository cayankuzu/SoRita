import { beforeEach, describe, expect, it } from 'vitest';

import { Platform } from 'react-native';

import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

describe('getModalSafeAreaPadding', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
    Platform.Version = 34;
  });

  it('adds base spacing on top of safe-area insets', () => {
    expect(
      getModalSafeAreaPadding({
        topInset: 24,
        bottomInset: 12,
        topSpacing: 20,
        bottomSpacing: 12,
      }),
    ).toEqual({
      paddingTop: 44,
      paddingBottom: 24,
    });
  });

  it('honors minimum top and bottom paddings', () => {
    expect(
      getModalSafeAreaPadding({
        topInset: 0,
        bottomInset: 0,
        topSpacing: 12,
        bottomSpacing: 8,
        minTopPadding: 20,
        minBottomPadding: 28,
      }),
    ).toEqual({
      paddingTop: 20,
      paddingBottom: 28,
    });
  });

  it('uses only the safe-area inset on Android', () => {
    Platform.OS = 'android';

    expect(
      getModalSafeAreaPadding({
        topInset: 18,
        bottomInset: 0,
        topSpacing: 12,
        bottomSpacing: 8,
        minTopPadding: 20,
        minBottomPadding: 20,
      }),
    ).toEqual({
      paddingTop: 30,
      paddingBottom: 20,
    });
  });
});

describe('getAndroidModalWindowProps', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('keeps translucent modal props below Android 15', () => {
    Platform.Version = 34;

    expect(
      getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      }),
    ).toEqual({
      navigationBarTranslucent: true,
      statusBarTranslucent: true,
    });
  });

  it('drops deprecated translucent modal props on Android 15+', () => {
    Platform.Version = 35;

    expect(
      getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      }),
    ).toEqual({});
  });
});

describe('getModalContentMaxHeight', () => {
  it('caps modal height to the available safe-area viewport space', () => {
    expect(
      getModalContentMaxHeight({
        viewportHeight: 900,
        paddingTop: 54,
        paddingBottom: 40,
        maxHeightRatio: 0.88,
      }),
    ).toBe(792);
  });

  it('honors reserved space and minimum height clamps', () => {
    expect(
      getModalContentMaxHeight({
        viewportHeight: 640,
        paddingTop: 48,
        paddingBottom: 32,
        maxHeightRatio: 1,
        minHeight: 360,
        reservedSpace: 180,
      }),
    ).toBe(380);
  });
});
