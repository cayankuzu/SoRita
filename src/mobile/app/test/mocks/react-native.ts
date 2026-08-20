import React from 'react';

function createHostComponent(name: string) {
  return React.forwardRef<unknown, Record<string, unknown>>((props, ref) =>
    React.createElement(name, { ...props, ref }, props.children as React.ReactNode),
  );
}

export const View = createHostComponent('View');
export const Text = createHostComponent('Text');
export const Image = createHostComponent('Image');
export const Pressable = createHostComponent('Pressable');
export const ScrollView = createHostComponent('ScrollView');
export const SafeAreaView = createHostComponent('SafeAreaView');
export const TouchableOpacity = createHostComponent('TouchableOpacity');
export const TouchableWithoutFeedback = createHostComponent('TouchableWithoutFeedback');
export const KeyboardAvoidingView = createHostComponent('KeyboardAvoidingView');
export const ActivityIndicator = createHostComponent('ActivityIndicator');
export const Switch = createHostComponent('Switch');
export const Modal = createHostComponent('Modal');

export const TextInput = Object.assign(createHostComponent('TextInput'), {
  State: {
    blurTextInput: () => undefined,
    currentlyFocusedInput: () => null,
    focusTextInput: () => undefined,
  },
});

export const FlatList = createHostComponent('FlatList');
export const SectionList = createHostComponent('SectionList');

export const StyleSheet = {
  absoluteFill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  absoluteFillObject: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  create: <T extends Record<string, unknown>>(styles: T) => styles,
  flatten: (style: unknown) => {
    if (Array.isArray(style)) {
      return style.filter(Boolean).reduce<Record<string, unknown>>(
        (accumulator, item) => Object.assign(accumulator, item),
        {},
      );
    }

    return style ?? {};
  },
  hairlineWidth: 1,
};

export const Platform = {
  OS: 'android',
  Version: 34,
  select: <T,>(options: { android?: T; default?: T; ios?: T }) =>
    options.android ?? options.default ?? options.ios,
};

export const Dimensions = {
  get: () => ({
    fontScale: 1,
    height: 640,
    scale: 1,
    width: 360,
  }),
};

export const PixelRatio = {
  get: () => 1,
  roundToNearestPixel: (value: number) => value,
};

export function useWindowDimensions() {
  return {
    fontScale: 1,
    height: 640,
    scale: 1,
    width: 360,
  };
}

export const AppState = {
  addEventListener: () => ({
    remove: () => undefined,
  }),
};

export const Alert = {
  alert: () => undefined,
};

export const ToastAndroid = {
  SHORT: 0,
  show: () => undefined,
};

export const StatusBar = {
  currentHeight: undefined as number | undefined,
  setBackgroundColor: () => undefined,
  setBarStyle: () => undefined,
  setTranslucent: () => undefined,
};

export const InteractionManager = {
  runAfterInteractions: (task?: () => void) => {
    task?.();

    return {
      cancel: () => undefined,
    };
  },
};

export const Keyboard = {
  addListener: () => ({ remove: () => undefined }),
  dismiss: () => undefined,
};

export const AccessibilityInfo = {
  addEventListener: () => ({
    remove: () => undefined,
  }),
  announceForAccessibility: () => undefined,
  isReduceMotionEnabled: async () => false,
  isScreenReaderEnabled: async () => false,
  setAccessibilityFocus: () => undefined,
};

export const NativeModules = {};

export const TurboModuleRegistry = {
  get: () => null,
};

export class NativeEventEmitter {
  addListener() {
    return { remove: () => undefined };
  }

  removeAllListeners() {
    return undefined;
  }
}

export const UIManager = {
  getViewManagerConfig: () => null,
  measure: () => undefined,
};

export function findNodeHandle() {
  return 1;
}

class AnimatedValue {
  private currentValue: number;

  constructor(initialValue: number) {
    this.currentValue = initialValue;
  }

  setValue(nextValue: number) {
    this.currentValue = nextValue;
  }

  valueOf() {
    return this.currentValue;
  }
}

function createAnimationController() {
  return {
    start: (callback?: (result: { finished: boolean }) => void) => {
      callback?.({ finished: true });
    },
    stop: () => undefined,
  };
}

export const Animated = {
  Image,
  Text,
  Value: AnimatedValue,
  View,
  createAnimatedComponent: <T,>(component: T) => component,
  loop: () => createAnimationController(),
  sequence: () => createAnimationController(),
  timing: () => createAnimationController(),
};

export default {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeEventEmitter,
  NativeModules,
  PixelRatio,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  StatusBar,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  TurboModuleRegistry,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
  findNodeHandle,
  useWindowDimensions,
};
