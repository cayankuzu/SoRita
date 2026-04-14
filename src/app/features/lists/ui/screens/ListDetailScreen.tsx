import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import type { Place, PlaceList } from '@/app/data/contracts/entities';
import { storage } from '@/app/data/repositories/mockStorage';
import { PlaceCard } from '@/app/features/places/ui/components/PlaceCard';
import { MiniMap } from '@/app/shared/components/maps/MiniMap';
import {
  Globe, Lock, MapPin, ArrowLeft, Heart,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/app/shared/components/ui/alert-dialog';

export function ListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusPlaceId = searchParams.get('placeId');
  const [list, setList] = useState<PlaceList | null>(null);
  const [deletePlaceId, setDeletePlaceId] = useState<string | null>(null);
  const placeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightedPlaceId, setHighlightedPlaceId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (listId) {
      const foundList = storage.getListById(listId);
      if (foundList) {
        if (foundList.userId === user?.id || foundList.isPublic) {
          setList(foundList);
        } else {
          toast.error('Bu listeye erişim yetkiniz yok');
          navigate('/home', { replace: true });
        }
      } else {
        toast.error('Liste bulunamadı');
        navigate('/home', { replace: true });
      }
    }
  }, [listId, user, navigate, refreshKey]);

  const handleDeletePlace = () => {
    if (!deletePlaceId || !list || !user || list.userId !== user.id) return;
    const updatedList = {
      ...list,
      places: list.places.filter((p) => p.id !== deletePlaceId),
      updatedAt: new Date().toISOString(),
    };
    storage.updateList(updatedList);
    setList(updatedList);
    setDeletePlaceId(null);
    toast.success('Mekan silindi');
  };

  const scrollToPlace = (index: number) => {
    const place = list?.places[index];
    if (!place) return;
    setHighlightedPlaceId(place.id);
    const el = placeRefs.current[place.id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightedPlaceId(null), 2500);
  };

  if (!list) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-gray-500">Yükleniyor...</p>
      </div>
    );
  }

  const isOwner = user?.id === list.userId;
  const owner = storage.findUserById(list.userId);
  const mapPlaces = list.places.map((p) => ({ lat: p.lat, lng: p.lng, name: p.name }));
  const displayPlaces = focusPlaceId
    ? list.places.filter(p => p.id === focusPlaceId)
    : list.places;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg active:bg-gray-100">
            <ArrowLeft className="size-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base truncate" style={{ fontWeight: 600 }}>
              {list.emoji && <span className="mr-1">{list.emoji}</span>}
              {list.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {list.isPublic ? (
                <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                  <Globe className="size-3" /> Herkese Açık
                </span>
              ) : (
                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                  <Lock className="size-3" /> Özel
                </span>
              )}
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400">{list.places.length} mekan</span>
              {(list.likes || 0) > 0 && (
                <>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <Heart className="size-3" /> {list.likes}
                  </span>
                </>
              )}
            </div>
          </div>
          {owner && (
            <button onClick={() => navigate(`/profile/${owner.id}`)} className="flex items-center gap-1.5">
              {owner.profilePhoto ? (
                <img src={owner.profilePhoto} alt="" className="size-8 rounded-full object-cover" />
              ) : (
                <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <span className="text-white text-[10px]" style={{ fontWeight: 600 }}>
                    {owner.name.split(' ').map((n: string) => n[0]).join('')}
                  </span>
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* General map with all places */}
      {mapPlaces.length > 0 && (
        <div className="mx-4 mt-3">
          <MiniMap
            places={focusPlaceId ? displayPlaces.map(p => ({ lat: p.lat, lng: p.lng, name: p.name })) : mapPlaces}
            className="h-48"
            interactive
            onMarkerClick={scrollToPlace}
            highlightIndex={highlightedPlaceId ? list.places.findIndex(p => p.id === highlightedPlaceId) : null}
          />
          <p className="text-[10px] text-gray-400 text-center mt-1.5">Haritadaki işarete tıklayarak mekana git</p>
        </div>
      )}

      {/* Description */}
      {list.description && (
        <div className="px-4 py-3 bg-white mx-4 mt-3 rounded-xl border border-gray-100">
          <p className="text-sm text-gray-600">{list.description}</p>
        </div>
      )}

      {/* Places feed - using shared PlaceCard */}
      <div className="px-4 py-3">
        {list.places.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
              <MapPin className="size-7 text-gray-300" />
            </div>
            <p className="text-sm text-gray-500 mb-3">Henüz mekan eklenmemiş</p>
            {isOwner && (
              <button onClick={() => navigate('/map')} className="text-sm text-blue-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                <MapPin className="size-4" /> Haritadan Mekan Ekle
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayPlaces.map((place) => (
              <div
                key={place.id}
                ref={(el) => { placeRefs.current[place.id] = el; }}
                className={`transition-all duration-300 ${highlightedPlaceId === place.id ? 'ring-2 ring-blue-400 rounded-2xl' : ''}`}
              >
                <PlaceCard
                  place={place}
                  listId={list.id}
                  showOwner={true}
                  ownerId={list.userId}
                  isOwner={isOwner}
                  onDelete={setDeletePlaceId}
                  onRefresh={() => setRefreshKey(k => k + 1)}
                />
              </div>
            ))}
            {focusPlaceId && list.places.length > 1 && (
              <button
                onClick={() => navigate(`/list/${list.id}`, { replace: true })}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm active:bg-gray-200 transition-colors"
                style={{ fontWeight: 600 }}
              >
                Listenin tamamını gör ({list.places.length} mekan)
              </button>
            )}
          </div>
        )}

        {isOwner && list.places.length > 0 && (
          <button
            onClick={() => navigate('/map')}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl text-sm shadow-sm shadow-blue-500/25 active:scale-[0.98] transition-transform"
            style={{ fontWeight: 600 }}
          >
            <MapPin className="size-4" /> Haritadan Mekan Ekle
          </button>
        )}
      </div>

      {/* Delete Place Confirmation */}
      <AlertDialog open={!!deletePlaceId} onOpenChange={() => setDeletePlaceId(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Mekanı sil?</AlertDialogTitle>
            <AlertDialogDescription>Bu mekan listeden kalıcı olarak silinecektir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlace} className="rounded-xl bg-red-500 hover:bg-red-600">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
