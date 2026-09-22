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

  // The reported defect: launching the app from the home screen icon opened on
  // "this link has been used or has expired". A reset link leaves a single-use
  // token in the route params, the state was persisted with it, and every plain
  // launch restored that route and spent the token again.
  it('drops a persisted state pointing at a one-shot deep-link route', () => {
    const state: InitialState = {
      index: 0,
      routes: [{ name: 'ResetPassword', params: { state: 'already-spent' } }],
    };

    expect(sanitizePersistedNavigationState(state, true)).toBeUndefined();
    expect(sanitizePersistedNavigationState(state, false)).toBeUndefined();
  });

  it('drops a persisted signup callback for the same reason', () => {
    const state: InitialState = {
      index: 0,
      routes: [{ name: 'AuthCallback', params: { code: 'already-spent' } }],
    };

    expect(sanitizePersistedNavigationState(state, true)).toBeUndefined();
    expect(sanitizePersistedNavigationState(state, false)).toBeUndefined();
  });

  it('drops the whole stack when a one-shot route sits above a valid one', () => {
    const state: InitialState = {
      index: 1,
      routes: [
        { name: 'MainTabs', state: { index: 0, routes: [{ name: 'Home' }] } },
        { name: 'ResetPassword', params: { state: 'already-spent' } },
      ],
    };

    expect(sanitizePersistedNavigationState(state, true)).toBeUndefined();
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
