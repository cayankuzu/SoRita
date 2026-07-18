import type { InitialState } from '@react-navigation/native';
import { describe, expect, it } from 'vitest';

import { sanitizePersistedNavigationState } from '@/mobile/app/app-shell/navigation/navigationStateValidation';

describe('sanitizePersistedNavigationState', () => {
  it('preserves a signed-out auth state', () => {
    const state: InitialState = {
      index: 0,
      routes: [{ name: 'Auth' }],
    };

    expect(sanitizePersistedNavigationState(state, false)).toEqual(state);
  });

  it('drops a signed-out persisted state that points to authenticated routes', () => {
    const state: InitialState = {
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: {
            index: 0,
            routes: [{ name: 'Home' }],
          },
        },
      ],
    };

    expect(sanitizePersistedNavigationState(state, false)).toBeUndefined();
  });

  it('preserves an authenticated main-tabs state', () => {
    const state: InitialState = {
      index: 1,
      routes: [
        {
          name: 'MainTabs',
          state: {
            index: 2,
            routes: [{ name: 'Home' }, { name: 'Explore' }, { name: 'Map' }],
          },
        },
        { name: 'ListDetail', params: { listId: 'list-1' } },
      ],
    };

    expect(sanitizePersistedNavigationState(state, true)).toEqual(state);
  });

  it('drops an authenticated state with an invalid nested tab route', () => {
    const state: InitialState = {
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: {
            index: 0,
            routes: [{ name: 'UnknownTab' }],
          },
        },
      ],
    };

    expect(sanitizePersistedNavigationState(state, true)).toBeUndefined();
  });
});
