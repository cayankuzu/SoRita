import React from 'react';

import { GoogleMapView } from '@/mobile/app/shared/components/maps/GoogleMapView';
import type { SharedMapProps } from '@/mobile/app/shared/components/maps/SharedMapTypes';

export function AppMapView(props: SharedMapProps) {
  return <GoogleMapView {...props} />;
}
