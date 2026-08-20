import type { ModalProps } from 'react-native';

import { useReduceMotion } from '@/mobile/app/shared/hooks/useReduceMotion';

type ModalAnimationType = NonNullable<ModalProps['animationType']>;

export function useModalAnimationType(
  preferredAnimation: Exclude<ModalAnimationType, 'none'>,
): ModalAnimationType {
  return useReduceMotion() ? 'none' : preferredAnimation;
}
