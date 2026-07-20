import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '@/mobile/app/app-shell/navigation/types';

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();
