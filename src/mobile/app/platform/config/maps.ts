import { env } from '@/mobile/app/platform/config/env';

export const mapConfig = {
  googleMapsApiKey: env.googleMapsApiKey,
};

export function buildExternalMapUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
