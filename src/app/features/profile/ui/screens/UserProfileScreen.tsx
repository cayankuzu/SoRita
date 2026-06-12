import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import type { Place, PlaceList, User } from '@/app/data/contracts/entities';
import { storage } from '@/app/data/repositories/mockStorage';
import { ListCard } from '@/app/features/lists/public/components';
import { PlaceCard } from '@/app/features/places/public/components';
import { MiniMap } from '@/app/shared/components/maps/MiniMap';
import {
  ArrowLeft, MapPin, UserPlus, UserMinus,
  Image, List, Star, Camera, Layers, X,
} from 'lucide-react';
import { toast } from 'sonner';

interface PhotoItem {
  photoUrl: string;
  place: Place;
  list: PlaceList;
}

interface PlaceItem {
  place: Place;
  list: PlaceList;
}

type ProfileTab = 'lists' | 'places' | 'gallery';

export function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [publicLists, setPublicLists] = useState<PlaceList[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('lists');
  const [refreshKey, setRefreshKey] = useState(0);
  const [placeFeed, setPlaceFeed] = useState<{ type: 'place' | 'photo'; startIndex: number } | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!userId) return;
    if (currentUser && userId === currentUser.id) {
      navigate('/profile', { replace: true });
      return;
    }
    const foundUser = storage.findUserById(userId);
    if (!foundUser) {
      toast.error('Kullanıcı bulunamadı');
      navigate('/explore');
      return;
    }
    setProfileUser(foundUser);
    setPublicLists(storage.getListsByUserId(userId).filter(l => l.isPublic));
  }, [userId, currentUser, navigate]);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const freshCurrentUser = currentUser ? storage.findUserById(currentUser.id) || currentUser : null;
  const isFollowing = freshCurrentUser ? (freshCurrentUser.following || []).includes(userId || '') : false;

  const handleFollow = () => {
    if (!currentUser || !userId) return;
    storage.followUser(currentUser.id, userId);
    setRefreshKey(k => k + 1);
    const updated = storage.findUserById(userId);
    if (updated) setProfileUser(updated);
  };

  const totalPlaces = publicLists.reduce((sum, l) => sum + l.places.length, 0);

  const allPhotos: PhotoItem[] = publicLists.flatMap(list =>
    list.places
      .filter(place => (place.photos || []).length > 0)
      .map(place => ({ photoUrl: place.photos![0], place, list }))
  );

  const allPlaces: PlaceItem[] = publicLists.flatMap(list =>
    list.places.map(place => ({ place, list }))
  );

  if (!profileUser) {
    return <div className="min-h-full flex items-center justify-center"><p className="text-gray-500">Yükleniyor...</p></div>;
  }

  // ── PlaceCard Feed Mode ──
  if (placeFeed) {
    const feedItems = placeFeed.type === 'photo'
      ? allPhotos.map(p => ({ place: p.place, list: p.list }))
      : allPlaces;

    return (
      <UserProfileFeedView
        items={feedItems}
        startIndex={placeFeed.startIndex}
        title={placeFeed.type === 'photo' ? 'Galeri' : 'Mekanlar'}
        onBack={() => setPlaceFeed(null)}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
    );
  }

  const PROFILE_TABS: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { key: 'lists', label: 'Listeler', icon: <List className="size-4" /> },
    { key: 'places', label: 'Mekanlar', icon: <MapPin className="size-4" /> },
    { key: 'gallery', label: 'Galeri', icon: <Image className="size-4" /> },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      {/* Cover */}
      <div className="h-28 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-300 relative">
        {profileUser.coverPhoto ? (
          <button onClick={() => setEnlargedPhoto(profileUser.coverPhoto!)} className="w-full h-full">
            <img src={profileUser.coverPhoto} alt="" className="w-full h-full object-cover" />
          </button>
        ) : null}
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 p-2 rounded-full bg-black/20 backdrop-blur-sm text-white active:bg-black/40">
          <ArrowLeft className="size-5" />
        </button>
      </div>

      {/* Profile info */}
      <div className="bg-white pb-4">
        <div className="px-4 -mt-10 relative">
          <div className="flex items-end justify-between">
            {profileUser.profilePhoto ? (
              <button onClick={() => setEnlargedPhoto(profileUser.profilePhoto!)}>
                <img src={profileUser.profilePhoto} alt="" className="size-20 rounded-full border-4 border-white object-cover shadow-sm" />
              </button>
            ) : (
              <div className="size-20 rounded-full border-4 border-white bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-sm">
                <span className="text-white text-2xl" style={{ fontWeight: 700 }}>{profileUser.name[0]}</span>
              </div>
            )}
            <button
              onClick={handleFollow}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm mb-1 active:scale-[0.97] transition-all ${
                isFollowing ? 'bg-gray-100 text-gray-700' : 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
              }`}
              style={{ fontWeight: 600 }}
            >
              {isFollowing ? <><UserMinus className="size-4" /> Takiptesin</> : <><UserPlus className="size-4" /> Takip Et</>}
            </button>
          </div>
          <div className="mt-3">
            <h1 className="text-lg" style={{ fontWeight: 700 }}>{profileUser.name}</h1>
            <p className="text-sm text-gray-400">@{profileUser.username}</p>
            {profileUser.bio && <p className="text-sm text-gray-600 mt-1.5">{profileUser.bio}</p>}
          </div>
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center"><p className="text-base" style={{ fontWeight: 700 }}>{publicLists.length}</p><p className="text-[11px] text-gray-400">Liste</p></div>
            <div className="text-center"><p className="text-base" style={{ fontWeight: 700 }}>{totalPlaces}</p><p className="text-[11px] text-gray-400">Mekan</p></div>
            <div className="text-center"><p className="text-base" style={{ fontWeight: 700 }}>{(profileUser.followers || []).length}</p><p className="text-[11px] text-gray-400">Takipçi</p></div>
            <div className="text-center"><p className="text-base" style={{ fontWeight: 700 }}>{(profileUser.following || []).length}</p><p className="text-[11px] text-gray-400">Takip</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 mt-1">
        <div className="flex">
          {PROFILE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm transition-colors border-b-2 ${
                activeTab === tab.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'
              }`}
              style={{ fontWeight: activeTab === tab.key ? 600 : 400 }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 max-w-lg mx-auto">
        {/* LISTELER */}
        {activeTab === 'lists' && (
          publicLists.length === 0 ? (
            <EmptyState icon={<MapPin className="size-8 text-gray-300" />} title="Henüz liste yok" desc="Bu kullanıcı henüz herkese açık liste paylaşmamış" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {publicLists.map((list) => {
                const coverPhoto = list.coverImage || list.places.flatMap(p => p.photos || [])[0];
                return (
                  <button
                    key={list.id}
                    onClick={() => navigate(`/list/${list.id}`)}
                    className="text-left bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
                  >
                    <div className="aspect-square relative bg-gray-100">
                      {coverPhoto ? (
                        <img src={coverPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center">
                          <span className="text-2xl">{list.emoji || '📍'}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>
                        {list.emoji && <span className="mr-0.5">{list.emoji}</span>}{list.name}
                      </p>
                      {list.description && <p className="text-[10px] text-gray-400 truncate mt-0.5">{list.description}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{list.places.length} mekan</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* MEKANLAR */}
        {activeTab === 'places' && (
          allPlaces.length === 0 ? (
            <EmptyState icon={<MapPin className="size-8 text-gray-300" />} title="Henüz mekan yok" desc="Bu kullanıcının mekanları burada görünecek" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {allPlaces.map((item, idx) => {
                const { place, list } = item;
                return (
                  <button
                    key={`${list.id}-${place.id}-${idx}`}
                    onClick={() => setPlaceFeed({ type: 'place', startIndex: idx })}
                    className="text-left bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
                  >
                    <div className="aspect-square relative bg-gray-100">
                      <MiniMap places={[{ lat: place.lat, lng: place.lng, name: place.name }]} className="h-full rounded-none" />
                    </div>
                    <div className="p-2">
                      <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>{place.name}</p>
                      {place.notes && <p className="text-[10px] text-gray-400 truncate mt-0.5">{place.notes}</p>}
                      {place.rating && (
                        <div className="flex items-center gap-0.5 mt-1">
                          <Star className="size-2.5 fill-amber-400 text-amber-400" />
                          <span className="text-[10px] text-amber-600">{place.rating}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* GALERİ */}
        {activeTab === 'gallery' && (
          allPhotos.length === 0 ? (
            <EmptyState icon={<Image className="size-8 text-gray-300" />} title="Henüz fotoğraf yok" desc="Bu kullanıcı henüz fotoğraf paylaşmamış" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {allPhotos.map((item, idx) => (
                <button
                  key={`${item.list.id}-${item.place.id}-${idx}`}
                  onClick={() => setPlaceFeed({ type: 'photo', startIndex: idx })}
                  className="text-left bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
                >
                  <div className="aspect-square relative bg-gray-100">
                    <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                    {(item.place.photos || []).length > 1 && (
                      <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
                        <Layers className="size-3 text-white" />
                        <span className="text-[10px] text-white" style={{ fontWeight: 600 }}>{(item.place.photos || []).length}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>{item.place.name}</p>
                    {item.place.notes && <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.place.notes}</p>}
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Enlarged photo overlay */}
      {enlargedPhoto && (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center" onClick={() => setEnlargedPhoto(null)}>
          <button onClick={() => setEnlargedPhoto(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white active:bg-white/30 z-10">
            <X className="size-6" />
          </button>
          <img src={enlargedPhoto} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

function UserProfileFeedView({ items, startIndex, title, onBack, onRefresh }: {
  items: PlaceItem[];
  startIndex: number;
  title: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const targetRef = React.useRef<HTMLDivElement>(null);
  const scrolledRef = React.useRef(false);

  React.useEffect(() => {
    if (targetRef.current && !scrolledRef.current) {
      scrolledRef.current = true;
      setTimeout(() => {
        targetRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, 50);
    }
  }, []);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-xl active:bg-gray-100">
          <ArrowLeft className="size-5 text-gray-600" />
        </button>
        <h1 className="text-base" style={{ fontWeight: 600 }}>{title}</h1>
      </div>
      <div className="px-4 py-3 max-w-lg mx-auto space-y-4">
        {items.map((item, idx) => (
          <div key={`${item.list.id}-${item.place.id}-${idx}`} ref={idx === startIndex ? targetRef : undefined}>
            <PlaceCard
              place={item.place}
              listName={item.list.name}
              listEmoji={item.list.emoji}
              listId={item.list.id}
              showOwner
              ownerId={item.list.userId}
              onRefresh={onRefresh}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">{icon}</div>
      <h2 className="text-base mb-1" style={{ fontWeight: 600 }}>{title}</h2>
      <p className="text-sm text-gray-500 text-center">{desc}</p>
    </div>
  );
}
