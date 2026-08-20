import { createContext, useContext } from 'react';

const noop = () => undefined;

export const StartupShellReadyContext = createContext<() => void>(noop);

export function useMarkStartupShellReady() {
  return useContext(StartupShellReadyContext);
}
