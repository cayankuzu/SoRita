import { Platform } from 'react-native';

type ModalSafeAreaPaddingOptions = {
  topInset: number;
  bottomInset: number;
  topSpacing?: number;
  bottomSpacing?: number;
  minTopPadding?: number;
  minBottomPadding?: number;
};

type ModalContentMaxHeightOptions = {
  viewportHeight: number;
  paddingTop: number;
  paddingBottom: number;
  maxHeightRatio?: number;
  minHeight?: number;
  reservedSpace?: number;
};

type AndroidModalWindowProps = {
  navigationBarTranslucent?: boolean;
  statusBarTranslucent?: boolean;
};

export function getAndroidModalWindowProps(
  props: AndroidModalWindowProps,
): AndroidModalWindowProps {
  if (Platform.OS !== 'android') {
    return {};
  }

  const androidVersion =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);

  if (Number.isFinite(androidVersion) && androidVersion >= 35) {
    return {};
  }

  return props;
}

export function getModalSafeAreaPadding({
  topInset,
  bottomInset,
  topSpacing = 16,
  bottomSpacing = 16,
  minTopPadding = topSpacing,
  minBottomPadding = bottomSpacing,
}: ModalSafeAreaPaddingOptions) {
  return {
    paddingTop: Math.max(topInset + topSpacing, minTopPadding),
    paddingBottom: Math.max(bottomInset + bottomSpacing, minBottomPadding),
  };
}

export function getModalContentMaxHeight({
  viewportHeight,
  paddingTop,
  paddingBottom,
  maxHeightRatio = 1,
  minHeight = 0,
  reservedSpace = 0,
}: ModalContentMaxHeightOptions) {
  const availableHeight = Math.max(
    viewportHeight - paddingTop - paddingBottom - reservedSpace,
    0,
  );
  const ratioBoundHeight = viewportHeight * maxHeightRatio;
  const preferredHeight = Math.max(Math.min(ratioBoundHeight, availableHeight), minHeight);

  return Math.min(availableHeight, preferredHeight);
}
