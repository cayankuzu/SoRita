import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@/app/app-shell/auth/AuthSessionProvider';
import { queryClient } from '@/app/data/query/queryClient';

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
