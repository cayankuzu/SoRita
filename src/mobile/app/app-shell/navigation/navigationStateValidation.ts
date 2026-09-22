import type { InitialState, PartialState, NavigationState } from '@react-navigation/native';

// AuthCallback and ResetPassword are deliberately absent from both sets. They
// are reachable only through a deep link and their params carry a single-use
// token, so restoring one replays a token that was already spent: launching the
// app from the home screen opened on "this link has been used or has expired"
// instead of the app.
const AUTHENTICATED_ROOT_ROUTE_NAMES = new Set([
  'ListDetail',
  'LocationPlaceCards',
  'MainTabs',
  'Notifications',
  'Settings',
  ...(__DEV__ ? ['UICatalog'] : []),
  'UserProfile',
]);
const UNAUTHENTICATED_ROOT_ROUTE_NAMES = new Set([
  'Auth',
]);
const MAIN_TAB_ROUTE_NAMES = new Set([
  'Explore',
  'Home',
  'Map',
  'Profile',
]);

type PersistedNavigationState = InitialState | PartialState<NavigationState>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isPersistedNavigationState(value: unknown): value is PersistedNavigationState {
  return (
    isObjectRecord(value) &&
    Array.isArray((value as PersistedNavigationState).routes)
  );
}

function isValidStateShape(
  state: PersistedNavigationState,
  allowedRouteNames: ReadonlySet<string>,
  nestedValidators: Readonly<Record<string, (state: PersistedNavigationState) => boolean>> = {},
) {
  if (!Array.isArray(state.routes) || state.routes.length === 0) {
    return false;
  }

  const maxIndex = state.routes.length - 1;

  if (
    typeof state.index === 'number' &&
    (state.index < 0 || state.index > maxIndex)
  ) {
    return false;
  }

  return state.routes.every((route) => {
    if (!route || typeof route.name !== 'string' || !allowedRouteNames.has(route.name)) {
      return false;
    }

    if (!('state' in route) || route.state == null) {
      return true;
    }

    const nestedState = route.state;
    const nestedValidator = nestedValidators[route.name];

    if (!nestedValidator || !isPersistedNavigationState(nestedState)) {
      return false;
    }

    return nestedValidator(nestedState);
  });
}

function isValidMainTabsState(state: PersistedNavigationState) {
  return isValidStateShape(state, MAIN_TAB_ROUTE_NAMES);
}

export function sanitizePersistedNavigationState(
  state: InitialState | undefined,
  isAuthenticated: boolean,
) {
  if (!state) {
    return undefined;
  }

  const isValidRootState = isValidStateShape(
    state,
    isAuthenticated ? AUTHENTICATED_ROOT_ROUTE_NAMES : UNAUTHENTICATED_ROOT_ROUTE_NAMES,
    {
      MainTabs: isValidMainTabsState,
    },
  );

  return isValidRootState ? state : undefined;
}
