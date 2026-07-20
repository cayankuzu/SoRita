import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

import type { MapViewport } from '@/mobile/app/features/map/application/mapScreenTypes';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';

const LOCATION_REQUEST_TIMEOUT_MS = 10_000;

async function getCurrentLocationWithTimeout() {
  return new Promise<Location.LocationObject>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Location request timed out'));
    }, LOCATION_REQUEST_TIMEOUT_MS);

    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((location) => {
        clearTimeout(timeout);
        resolve(location);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

export function useMapLocation() {
  const [userViewport, setUserViewport] = useState<MapViewport | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

  const locate = useCallback(
    async (options?: {
      onLocated?: (viewport: MapViewport) => void;
      showToastOnError?: boolean;
    }) => {
      setIsLocating(true);
      setLocationErrorMessage(null);

      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          setLocationPermissionDenied(true);
          setLocationErrorMessage(tr.map.locationPermissionRequired);
          if (options?.showToastOnError) {
            showToast(tr.map.locationPermissionRequired, 'error');
          }
          return;
        }

        setLocationPermissionDenied(false);
        const location = await getCurrentLocationWithTimeout();
        const viewport = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          zoom: 13.5,
        };
        setUserViewport(viewport);
        options?.onLocated?.(viewport);
      } catch (error) {
        const message = getUserFacingErrorMessage(
          error,
          tr.map.locationRetryDescription,
        );
        setLocationErrorMessage(message);
        if (options?.showToastOnError) {
          showToast(message, 'error');
        }
      } finally {
        setIsLocating(false);
      }
    },
    [],
  );

  const resolveAddress = useCallback(async (latitude: number, longitude: number) => {
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (!address) {
        return undefined;
      }

      return [
        [address.street, address.streetNumber].filter(Boolean).join(' '),
        address.district,
        address.city,
      ]
        .filter(Boolean)
        .join(', ');
    } catch {
      return undefined;
    }
  }, []);

  return {
    isLocating,
    locate,
    locationErrorMessage,
    locationPermissionDenied,
    resolveAddress,
    setUserViewport,
    userViewport,
  };
}

export const mapLocationInternals = {
  getCurrentLocationWithTimeout,
  LOCATION_REQUEST_TIMEOUT_MS,
};
