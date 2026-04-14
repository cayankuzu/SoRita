import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import type { Place, PlaceList } from '@/app/data/contracts/entities';
import { storage } from '@/app/data/repositories/mockStorage';
import { ListCard } from '@/app/features/lists/ui/components/ListCard';
import { PlaceCard } from '@/app/features/places/ui/components/PlaceCard';
import { MiniMap } from '@/app/shared/components/maps/MiniMap';
import { useNavigate } from 'react-router';
import {
  MapPin, Globe, Lock, LogOut, Plus, Trash2,
  Image, List, Camera, Star, ArrowLeft, X, Eye, Layers, Settings,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/shared/components/ui/dialog';
import { Input } from '@/app/shared/components/ui/input';
import { Label } from '@/app/shared/components/ui/label';
import { Textarea } from '@/app/shared/components/ui/textarea';
import { Switch } from '@/app/shared/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/app/shared/components/ui/alert-dialog';
import { toast } from 'sonner';
import { createUuid } from '@/shared/utils/id';

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

export function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState<PlaceList[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('lists');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListIsPublic, setNewListIsPublic] = useState(true);
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  // Feed mode for places/gallery (PlaceCard feed with scroll-to)
  const [placeFeed, setPlaceFeed] = useState<{ type: 'place' | 'photo'; startIndex: number } | null>(null);

  const loadLists = useCallback(() => {
    if (user) setLists(storage.getListsByUserId(user.id));
  }, [user]);

  useEffect(() => { loadLists(); }, [loadLists, refreshKey]);

  const freshUser = user ? storage.findUserById(user.id) || user : null;
  const totalPlaces = lists.reduce((sum, l) => sum + l.places.length, 0);

  const allPhotos: PhotoItem[] = lists.flatMap((list) =>
    list.places
      .filter((place) => (place.photos || []).length > 0)
      .map((place) => ({ photoUrl: place.photos![0], place, list }))
  );

  const allPlaces: PlaceItem[] = lists.flatMap((list) =>
    list.places.map((place) => ({ place, list }))
  );

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const newList: PlaceList = {
      id: createUuid(),
      userId: user.id,
      name: newListName,
      description: newListDescription || undefined,
      places: [],
      isPublic: newListIsPublic,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.createList(newList);
    setLists([...lists, newList]);
    setIsCreateDialogOpen(false);
    setNewListName('');
    setNewListDescription('');
    setNewListIsPublic(true);
    toast.success('Liste oluşturuldu!');
  };

  const handleDeleteList = () => {
    if (!deleteListId) return;
    storage.deleteList(deleteListId);
    setLists(lists.filter((l) => l.id !== deleteListId));
    setDeleteListId(null);
    toast.success('Liste silindi');
  };

  const handleLogout = () => { logout(); navigate('/'); };

  if (!user || !freshUser) return null;

  // ── PlaceCard Feed Mode (places & gallery) ──
  if (placeFeed) {
    const feedItems = placeFeed.type === 'photo'
      ? allPhotos.map(p => ({ place: p.place, list: p.list }))
      : allPlaces;

    return <ProfileFeedView
      items={feedItems}
      startIndex={placeFeed.startIndex}
      title={placeFeed.type === 'photo' ? 'Galeri' : 'Mekanlar'}
      onBack={() => setPlaceFeed(null)}
      onRefresh={() => setRefreshKey(k => k + 1)}
    />;
  }

  const PROFILE_TABS: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { key: 'lists', label: 'Listeler', icon: <List className="size-4" /> },
    { key: 'places', label: 'Mekanlar', icon: <MapPin className="size-4" /> },
    { key: 'gallery', label: 'Galeri', icon: <Image className="size-4" /> },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      {/* Profile header */}
      <div className="bg-white pb-4">
        <div className="h-28 bg-gradient-to-br from-blue-400 via-blue-500 to-emerald-400 relative">
          {freshUser.coverPhoto ? (
            <button onClick={() => setEnlargedPhoto(freshUser.coverPhoto!)} className="w-full h-full">
              <img src={freshUser.coverPhoto} alt="" className="w-full h-full object-cover" />
            </button>
          ) : null}
        </div>
        <div className="px-4 -mt-10 relative">
          <div className="flex items-end justify-between">
            {freshUser.profilePhoto ? (
              <button onClick={() => setEnlargedPhoto(freshUser.profilePhoto!)}>
                <img src={freshUser.profilePhoto} alt="" className="size-20 rounded-full border-4 border-white object-cover shadow-sm" />
              </button>
            ) : (
              <div className="size-20 rounded-full border-4 border-white bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-sm">
                <span className="text-white text-2xl" style={{ fontWeight: 700 }}>{freshUser.name[0]}</span>
              </div>
            )}
            <div className="flex gap-2 mb-1">
              <button onClick={() => navigate('/settings')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs active:scale-[0.97] transition-transform" style={{ fontWeight: 500 }}>
                <Settings className="size-3.5" /> Ayarlar
              </button>
            </div>
          </div>
          <div className="mt-3">
            <h1 className="text-lg" style={{ fontWeight: 700 }}>{freshUser.name}</h1>
            <p className="text-sm text-gray-400">@{freshUser.username}</p>
            {freshUser.bio && <p className="text-sm text-gray-600 mt-1.5">{freshUser.bio}</p>}
          </div>
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center"><p className="text-base" style={{ fontWeight: 700 }}>{lists.length}</p><p className="text-[11px] text-gray-400">Liste</p></div>
            <div className="text-center"><p className="text-base" style={{ fontWeight: 700 }}>{totalPlaces}</p><p className="text-[11px] text-gray-400">Mekan</p></div>
            <div className="text-center"><p className="text-base" style={{ fontWeight: 700 }}>{(freshUser.followers || []).length}</p><p className="text-[11px] text-gray-400">Takipçi</p></div>
            <div className="text-center"><p className="text-base" style={{ fontWeight: 700 }}>{(freshUser.following || []).length}</p><p className="text-[11px] text-gray-400">Takip</p></div>
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
        {/* ═══════ LISTELER TAB ═══════ */}
        {activeTab === 'lists' && (
          <>
            {lists.length === 0 ? (
              <EmptyState icon={<MapPin className="size-8 text-gray-300" />} title="Henüz listen yok" desc="Yeni liste oluştur ve mekan eklemeye başla" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {lists.map((list) => {
                  const coverPhoto = list.coverImage || list.places.flatMap(p => p.photos || [])[0];
                  return (
                    <div
                      key={list.id}
                      className="relative text-left bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
                    >
                      <button onClick={() => navigate(`/list/${list.id}`)} className="w-full text-left">
                        <div className="aspect-square relative bg-gray-100">
                          {coverPhoto ? (
                            <img src={coverPhoto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center">
                              <span className="text-2xl">{list.emoji || '📍'}</span>
                            </div>
                          )}
                          {/* Privacy badge */}
                          <div className="absolute top-1.5 left-1.5">
                            {list.isPublic ? (
                              <Globe className="size-3.5 text-white drop-shadow-md" />
                            ) : (
                              <Lock className="size-3.5 text-white drop-shadow-md" />
                            )}
                          </div>
                        </div>
                        <div className="p-2">
                          <p className="text-[12px] truncate" style={{ fontWeight: 600 }}>
                            {list.emoji && <span className="mr-0.5">{list.emoji}</span>}{list.name}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{list.places.length} mekan</p>
                        </div>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteListId(list.id); }}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/40 text-white active:bg-black/60"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════ MEKANLAR TAB ═══════ */}
        {activeTab === 'places' && (
          allPlaces.length === 0 ? (
            <EmptyState icon={<MapPin className="size-8 text-gray-300" />} title="Henüz mekan yok" desc="Haritadan mekan eklemeye başla" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {allPlaces.map((item, idx) => {
                const { place, list } = item;
                const photos = place.photos || [];
                const hasPhotos = photos.length > 0;
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

        {/* ═══════ GALERİ TAB ═══════ */}
        {activeTab === 'gallery' && (
          allPhotos.length === 0 ? (
            <EmptyState icon={<Image className="size-8 text-gray-300" />} title="Henüz fotoğraf yok" desc="Mekanlara fotoğraf eklediğinde burada görünecek" />
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

      {/* Create List Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Yeni Liste Oluştur</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateList} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="list-name" className="text-sm">Liste Adı *</Label>
              <Input id="list-name" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Örn: Favori Kafelerim" required className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-desc" className="text-sm">Açıklama</Label>
              <Textarea id="list-desc" value={newListDescription} onChange={(e) => setNewListDescription(e.target.value)} placeholder="Bu liste hakkında kısa bir açıklama..." rows={3} className="rounded-xl" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="space-y-0.5"><Label htmlFor="list-public" className="text-sm">Herkese Açık</Label><p className="text-xs text-gray-500">Diğer kullanıcılar bu listeyi görebilsin</p></div>
              <Switch id="list-public" checked={newListIsPublic} onCheckedChange={setNewListIsPublic} />
            </div>
            <button type="submit" className="w-full h-11 bg-blue-500 text-white rounded-xl text-sm active:scale-[0.98] transition-transform" style={{ fontWeight: 600 }}>Oluştur</button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteListId} onOpenChange={() => setDeleteListId(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Listeyi sil?</AlertDialogTitle>
            <AlertDialogDescription>Bu işlem geri alınamaz. Liste ve içindeki tüm mekanlar silinecektir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteList} className="rounded-xl bg-red-500 hover:bg-red-600">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function ProfileFeedView({ items, startIndex, title, onBack, onRefresh }: {
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
              showOwner={false}
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
