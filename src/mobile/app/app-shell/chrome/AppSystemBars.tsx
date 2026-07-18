import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

export type SystemBarMode = 'darkOverlay' | 'default' | 'media' | 'modal';

type SystemBarEntry = {
  id: string;
  mode: SystemBarMode;
};

type AppSystemBarsContextValue = {
  popMode: (id: string) => void;
  pushMode: (mode: SystemBarMode) => string;
};

const AppSystemBarsContext = createContext<AppSystemBarsContextValue | null>(null);

function getStatusBarProps(mode: SystemBarMode) {
  if (mode === 'darkOverlay' || mode === 'media') {
    return {
      backgroundColor: colors.deepBackground,
      barStyle: 'light-content' as const,
    };
  }

  if (mode === 'modal') {
    return {
      backgroundColor: 'transparent',
      barStyle: 'light-content' as const,
    };
  }

  return {
    backgroundColor: colors.surface,
    barStyle: 'dark-content' as const,
  };
}

export function AppSystemBarsProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<SystemBarEntry[]>([]);
  const activeMode = stack[stack.length - 1]?.mode || 'default';
  const statusBarProps = getStatusBarProps(activeMode);

  const pushMode = useCallback((mode: SystemBarMode) => {
    const id = `${mode}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    setStack((current) => [...current, { id, mode }]);
    return id;
  }, []);

  const popMode = useCallback((id: string) => {
    setStack((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const value = useMemo(() => ({ popMode, pushMode }), [popMode, pushMode]);

  return (
    <AppSystemBarsContext.Provider value={value}>
      <StatusBar
        animated
        backgroundColor={statusBarProps.backgroundColor}
        barStyle={statusBarProps.barStyle}
        translucent={activeMode === 'modal' || activeMode === 'media'}
      />
      {children}
    </AppSystemBarsContext.Provider>
  );
}

export function useSystemBarMode(mode: SystemBarMode, active = true) {
  const context = useContext(AppSystemBarsContext);

  React.useEffect(() => {
    if (!context || !active) {
      return;
    }

    const id = context.pushMode(mode);

    return () => {
      context.popMode(id);
    };
  }, [active, context, mode]);
}
