import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import type { Place, PlaceList } from '@/app/data/contracts/entities';
import { storage } from '@/app/data/repositories/mockStorage';
import { GoogleMapPicker } from '@/app/features/map/ui/components/GoogleMapPicker';
import { PlacePanel } from '@/app/features/map/ui/components/PlacePanel';
import { toast } from 'sonner';
import { createUuid } from '@/shared/utils/id';

interface PanelData {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  existingPlace?: Place | null;
  existingPlaceListName?: string;
}

export function MapView() {
  const { user } = useAuth();
  const [lists, setLists] = useState<PlaceList[]>([]);
  const [panelData, setPanelData] = useState<PanelData | null>(null);

  useEffect(() => {
    if (user) {
      setLists(storage.getListsByUserId(user.id));
    }
  }, [user]);

  const handleMapClick = (lat: number, lng: number) => {
    if (panelData) {
      setPanelData(null);
      return;
    }
    setPanelData({ lat, lng });
  };

  const handlePlaceSelect = (placeData: { name: string; lat: number; lng: number; address?: string }) => {
    setPanelData({
      lat: placeData.lat,
      lng: placeData.lng,
      name: placeData.name,
      address: placeData.address,
    });
  };

  const handlePlaceClick = (place: Place) => {
    const parentList = lists.find((list) =>
      list.places.some((p) => p.id === place.id)
    );
    setPanelData({
      lat: place.lat,
      lng: place.lng,
      name: place.name,
      address: place.address,
      existingPlace: place,
      existingPlaceListName: parentList?.name,
    });
  };

  const handleSavePlace = (placeData: Omit<Place, 'id' | 'addedAt'>, targetListIds: string[]) => {
    const newPlace: Place = {
      ...placeData,
      id: createUuid(),
      addedAt: new Date().toISOString(),
      addedBy: user ? { userId: user.id, userName: user.name } : undefined,
    };

    const updatedLists = lists.map((list) => {
      if (targetListIds.includes(list.id)) {
        return {
          ...list,
          places: [...list.places, newPlace],
          updatedAt: new Date().toISOString(),
        };
      }
      return list;
    });

    updatedLists.forEach((list) => storage.updateList(list));
    setLists(updatedLists);
    setPanelData(null);
    toast.success('Mekan listeye eklendi!');
  };

  const handleDeletePlace = (placeId: string) => {
    const updatedLists = lists.map((list) => ({
      ...list,
      places: list.places.filter((p) => p.id !== placeId),
      updatedAt: new Date().toISOString(),
    }));

    updatedLists.forEach((list) => storage.updateList(list));
    setLists(updatedLists);
    setPanelData(null);
    toast.success('Mekan silindi');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-104px)] relative">
      <div className="flex-1 relative">
        <GoogleMapPicker
          places={[]}
          onMapClick={handleMapClick}
          onPlaceSelect={handlePlaceSelect}
          onPlaceClick={handlePlaceClick}
        />
      </div>

      {panelData && (
        <PlacePanel
          key={`${panelData.lat}-${panelData.lng}-${panelData.name || ''}`}
          lat={panelData.lat}
          lng={panelData.lng}
          placeName={panelData.name}
          placeAddress={panelData.address}
          existingPlace={panelData.existingPlace}
          existingPlaceListName={panelData.existingPlaceListName}
          lists={lists}
          onClose={() => setPanelData(null)}
          onSave={handleSavePlace}
          onDelete={handleDeletePlace}
          onCreateList={(newList) => {
            const listWithUser = { ...newList, userId: user!.id };
            storage.createList(listWithUser);
            setLists(storage.getListsByUserId(user!.id));
          }}
        />
      )}
    </div>
  );
}
