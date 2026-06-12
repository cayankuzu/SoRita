import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import type { Place, PlaceList, User } from '@/app/data/contracts/entities';
import { storage } from '@/app/data/repositories/mockStorage';
import { ListCard } from '@/app/features/lists/public/components';
import { PlaceCard } from '@/app/features/places/public/components';
import { MiniMap } from '@/app/shared/components/maps/MiniMap';
import { Input } from '@/app/shared/components/ui/input';
import {
  Search, Compass, Users, List, Image, MapPin,
  Heart, Star, UserPlus, Camera,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

const noScrollbar = { scrollbarWidth: 'none' as const, msOverflowStyle: 'none' as const };

type TabType = 'lists' | 'places' | 'photos' | 'people';

const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: 'lists', label: 'Listeler', icon: <List className="size-4" /> },
  { key: 'places', label: 'Mekanlar', icon: <MapPin className="size-4" /> },
  { key: 'photos', label: 'Fotoğraflar', icon: <Camera className="size-4" /> },
  { key: 'people', label: 'Kişiler', icon: <Users className="size-4" /> },
];

interface PhotoItem {
  photoUrl: string;
  place: Place;
  list: PlaceList;
  owner: User | undefined;
}

interface PlaceItem {
  place: Place;
  list: PlaceList;
  owner: User | undefined;
}

export function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [publicLists, setPublicLists] = useState<PlaceList[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('lists');

  // Feed mode state - shows a place card feed
  const [feedMode, setFeedMode] = useState<{
    type: 'place' | 'photo';
    startIndex: number;
  } | null>(null);

  const loadData = useCallback(() => {
    if (!user) return;
    const lists = storage.getPublicLists()
      .filter((l) => l.userId !== user.id)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0));
    setPublicLists(lists);
    setAllUsers(storage.getUsers().filter(u => u.id !== user.id));
  }, [user]);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleFollow = (targetUserId: string) => {
    if (!user) return;
    storage.followUser(user.id, targetUserId);
    const updatedUser = storage.findUserById(user.id);
    if (updatedUser) storage.setCurrentUser(updatedUser);
    setRefreshKey(k => k + 1);
  };

  if (!user) return null;

  const freshUser = storage.findUserById(user.id) || user;
  const following = freshUser.following || [];
  const q = searchQuery.toLowerCase();

  const filteredLists = publicLists.filter(list =>
    !q || list.name.toLowerCase().includes(q) || list.description?.toLowerCase().includes(q)
  );

  const allPlaces: PlaceItem[] = publicLists.flatMap(list =>
    list.places.map(place => ({ place, list, owner: storage.findUserById(list.userId) }))
  );
  const filteredPlaces = allPlaces.filter(item =>
    !q || item.place.name.toLowerCase().includes(q) || item.place.address?.toLowerCase().includes(q)
  );

  const allPhotos: PhotoItem[] = publicLists.flatMap(list =>
    list.places
      .filter(place => (place.photos || []).length > 0)
      .map(place => ({
        photoUrl: place.photos![0], place, list, owner: storage.findUserById(list.userId),
      }))
  );
  const filteredPhotos = allPhotos.filter(item =>
    !q || item.place.name.toLowerCase().includes(q)
  );

  const filteredUsers = allUsers.filter(u =>
    !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.bio?.toLowerCase().includes(q)
  );

  // ── Feed Mode ──
  if (feedMode) {
    const sourceItems: PlaceItem[] = feedMode.type === 'photo'
      ? filteredPhotos.map(p => ({ place: p.place, list: p.list, owner: p.owner }))
      : filteredPlaces;

    return <FeedView items={sourceItems} startIndex={feedMode.startIndex} onBack={() => setFeedMode(null)} onRefresh={handleRefresh} />;
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="px-4 pt-4 pb-2 max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-xl" style={{ fontWeight: 700 }}>Keşfet</h1>
          <p className="text-sm text-gray-500 mt-0.5">Yeni mekanlar ve listeler keşfet</p>
        </div>

        {/* Search - hidden for photos tab */}
        {activeTab !== 'photos' && (
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder={
                activeTab === 'lists' ? 'Liste ara...' :
                activeTab === 'places' ? 'Mekan veya adres ara...' :
                activeTab === 'people' ? 'Kişi ara...' :
                'Ara...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-white border-gray-200"
            />
          </div>
        )}

        {/* Tabs - horizontally scrollable pills */}
        <div className="flex gap-2 overflow-x-auto mb-4 -mx-4 px-4" style={noScrollbar}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs whitespace-nowrap transition-all shrink-0 ${
                activeTab === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
              style={{ fontWeight: activeTab === tab.key ? 600 : 400 }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6 max-w-lg mx-auto">
        {/* ═══════ LISTELER ═══════ */}
        {activeTab === 'lists' && (
          filteredLists.length === 0 ? (
            <EmptyState icon={<Compass className="size-8 text-gray-300" />} title={q ? 'Sonuç bulunamadı' : 'Henüz liste yok'} desc={q ? 'Farklı bir arama deneyin' : 'Herkese açık listeler burada görünecek'} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredLists.map((list) => {
                const coverPhoto = list.coverImage || list.places.flatMap(p => p.photos || [])[0];
                const listOwner = storage.findUserById(list.userId);
                return (
                  <button
                    key={list.id}
                    onClick={() => navigate(`/list/${list.id}`)}
                    className="text-left bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
                  >
                    {/* Owner bar */}
                    {listOwner && (
                      <div className="flex items-center gap-1.5 px-2.5 py-2">
                        {listOwner.profilePhoto ? (
                          <img src={listOwner.profilePhoto} alt="" className="size-5 rounded-full object-cover" />
                        ) : (
                          <div className="size-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                            <span className="text-white text-[8px]" style={{ fontWeight: 600 }}>{listOwner.name[0]}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] truncate" style={{ fontWeight: 600 }}>{listOwner.name}</p>
                          <p className="text-[9px] text-gray-400 truncate">@{listOwner.username}</p>
                        </div>
                      </div>
                    )}
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
                      {list.description && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{list.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-gray-400">{list.places.length} mekan</span>
                        {(list.likes || 0) > 0 && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Heart className="size-2.5" /> {list.likes}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* ═══════ MEKANLAR ═══════ */}
        {activeTab === 'places' && (
          filteredPlaces.length === 0 ? (
            <EmptyState icon={<MapPin className="size-8 text-gray-300" />} title={q ? 'Sonuç bulunamadı' : 'Henüz mekan yok'} desc="Paylaşılan mekanlar burada görünecek" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredPlaces.map((item, idx) => {
                const { place, list } = item;
                const placeOwner = storage.findUserById(list.userId);
                return (
                  <button
                    key={`${list.id}-${place.id}-${idx}`}
                    onClick={() => setFeedMode({ type: 'place', startIndex: idx })}
                    className="text-left bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
                  >
                    {/* Owner bar */}
                    {placeOwner && (
                      <div className="flex items-center gap-1.5 px-2.5 py-2">
                        {placeOwner.profilePhoto ? (
                          <img src={placeOwner.profilePhoto} alt="" className="size-5 rounded-full object-cover" />
                        ) : (
                          <div className="size-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                            <span className="text-white text-[8px]" style={{ fontWeight: 600 }}>{placeOwner.name[0]}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] truncate" style={{ fontWeight: 600 }}>{placeOwner.name}</p>
                          <p className="text-[9px] text-gray-400 truncate">@{placeOwner.username}</p>
                        </div>
                      </div>
                    )}
                    <div className="aspect-square relative bg-gray-100">
                      <MiniMap places={[{ lat: place.lat, lng: place.lng, name: place.name }]} className="h-full rounded-none" />
                    </div>
                    <div className="p-2">
                      <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>{place.name}</p>
                      {place.notes && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{place.notes}</p>
                      )}
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

        {/* ═══════ FOTOĞRAFLAR ═══════ */}
        {activeTab === 'photos' && (
          filteredPhotos.length === 0 ? (
            <EmptyState icon={<Image className="size-8 text-gray-300" />} title="Henüz fotoğraf yok" desc="Paylaşılan fotoğraflar burada görünecek" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredPhotos.map((item, idx) => {
                const placePhotos = item.place.photos || [];
                const photoOwner = item.owner;
                return (
                  <button
                    key={`${item.list.id}-${item.place.id}-${idx}`}
                    onClick={() => setFeedMode({ type: 'photo', startIndex: idx })}
                    className="text-left bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
                  >
                    {/* Owner bar */}
                    {photoOwner && (
                      <div className="flex items-center gap-1.5 px-2.5 py-2">
                        {photoOwner.profilePhoto ? (
                          <img src={photoOwner.profilePhoto} alt="" className="size-5 rounded-full object-cover" />
                        ) : (
                          <div className="size-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                            <span className="text-white text-[8px]" style={{ fontWeight: 600 }}>{photoOwner.name[0]}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] truncate" style={{ fontWeight: 600 }}>{photoOwner.name}</p>
                          <p className="text-[9px] text-gray-400 truncate">@{photoOwner.username}</p>
                        </div>
                      </div>
                    )}
                    <div className="aspect-square relative bg-gray-100">
                      <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                      {placePhotos.length > 1 && (
                        <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ fontWeight: 600 }}>
                          <Camera className="size-2.5" /> {placePhotos.length}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>{item.place.name}</p>
                      {item.place.notes && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.place.notes}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* ═══════ KİŞİLER ═══════ */}
        {activeTab === 'people' && (
          filteredUsers.length === 0 ? (
            <EmptyState icon={<Users className="size-8 text-gray-300" />} title={q ? 'Kullanıcı bulunamadı' : 'Henüz kullanıcı yok'} desc="Kullanıcılar burada görünecek" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredUsers.map((u) => {
                const isFollowing = following.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => navigate(`/profile/${u.id}`)}
                    className="text-left bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
                  >
                    {/* Cover */}
                    <div className="h-14 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-300 relative">
                      {u.coverPhoto && <img src={u.coverPhoto} alt="" className="w-full h-full object-cover" />}
                    </div>
                    {/* Profile photo overlapping */}
                    <div className="px-2 -mt-5 relative">
                      {u.profilePhoto ? (
                        <img src={u.profilePhoto} alt="" className="size-10 rounded-full border-2 border-white object-cover" />
                      ) : (
                        <div className="size-10 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <span className="text-white text-sm" style={{ fontWeight: 700 }}>{u.name[0]}</span>
                        </div>
                      )}
                    </div>
                    <div className="px-2 pt-1 pb-2.5">
                      <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>{u.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">@{u.username}</p>
                      {u.bio && (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{u.bio}</p>
                      )}
                      <div className="mt-2">
                        <div
                          onClick={(e) => { e.stopPropagation(); handleFollow(u.id); }}
                          className={`w-full text-center py-1.5 rounded-lg text-[11px] active:scale-[0.97] transition-transform ${
                            isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-blue-500 text-white'
                          }`}
                          style={{ fontWeight: 600 }}
                        >
                          {isFollowing ? 'Takiptesin' : 'Takip Et'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}
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

function FeedView({ items, startIndex, onBack, onRefresh }: { items: PlaceItem[]; startIndex: number; onBack: () => void; onRefresh: () => void }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
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
        <h1 className="text-base" style={{ fontWeight: 600 }}>Keşfet</h1>
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
