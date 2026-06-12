import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import type { Place } from '@/app/data/contracts/entities';
import { storage } from '@/app/data/repositories/mockStorage';
import { PlacePanel } from '@/app/features/map/public/components';
import { PhotoLightbox } from '@/app/shared/components/feedback/PhotoLightbox';
import { MiniMap, MiniMapHandle } from '@/app/shared/components/maps/MiniMap';
import {
  Heart, MessageCircle, MapPin, Star, Clock,
  GraduationCap, Sparkles, Crosshair, ListPlus,
  Flag, Trash2, Send, Copy, ExternalLink,
  X, AlertTriangle, Users, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_MAP: Record<string, { label: string; emoji: string; color: string }> = {
  cafe: { label: 'Kafe', emoji: '☕', color: 'bg-amber-100 text-amber-700' },
  restaurant: { label: 'Restoran', emoji: '🍽️', color: 'bg-orange-100 text-orange-700' },
  bar: { label: 'Bar', emoji: '🍸', color: 'bg-purple-100 text-purple-700' },
  park: { label: 'Park', emoji: '🌿', color: 'bg-green-100 text-green-700' },
  museum: { label: 'Müze/Tarihi', emoji: '🏛️', color: 'bg-blue-100 text-blue-700' },
  shopping: { label: 'Alışveriş', emoji: '🛍️', color: 'bg-pink-100 text-pink-700' },
  beach: { label: 'Plaj', emoji: '🏖️', color: 'bg-cyan-100 text-cyan-700' },
  nightlife: { label: 'Gece Hayatı', emoji: '🌙', color: 'bg-indigo-100 text-indigo-700' },
};

const noScrollbar = { scrollbarWidth: 'none' as const, msOverflowStyle: 'none' as const };

interface PlaceCardProps {
  place: Place;
  listId?: string;
  showOwner?: boolean;
  ownerId?: string;
  isOwner?: boolean;
  onDelete?: (placeId: string) => void;
  onRefresh?: () => void;
  listName?: string;
  listEmoji?: string;
}

export function PlaceCard({
  place, listId, showOwner = false, ownerId,
  isOwner = false, onDelete, onRefresh,
  listName, listEmoji,
}: PlaceCardProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const owner = ownerId ? storage.findUserById(ownerId) : null;
  const miniMapRef = useRef<MiniMapHandle>(null);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [reportReason, setReportReason] = useState('');

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLikeDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowLikers(true), 500);
  }, []);

  const handleLikeUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleLikeClick = () => {
    if (showLikers) return;
    setIsLiked(!isLiked);
  };

  const photos = place.photos || [];
  const cats = place.categories?.length ? place.categories : place.category ? [place.category] : [];

  const openInMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`, '_blank');
  };
  const copyAddress = () => {
    const addr = place.address || `${place.lat}, ${place.lng}`;
    navigator.clipboard.writeText(addr).catch(() => {});
    toast.success('Adres kopyalandı');
  };

  const handleFocusMap = () => {
    miniMapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      miniMapRef.current?.panTo(place.lat, place.lng);
    }, 300);
  };

  const handleReport = () => {
    if (!reportReason.trim()) return;
    toast.success('Bildiriminiz alındı');
    setShowReport(false);
    setReportReason('');
  };

  const placeLists = storage.getLists().filter(l =>
    l.places.some(p => p.lat === place.lat && p.lng === place.lng && p.name === place.name)
  );

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        {/* User header */}
        {showOwner && owner && (
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-1.5">
            <button onClick={() => navigate(`/profile/${owner.id}`)} className="flex items-center gap-2 flex-1 min-w-0">
              {owner.profilePhoto ? (
                <img src={owner.profilePhoto} alt="" className="size-8 rounded-full object-cover ring-2 ring-gray-100" />
              ) : (
                <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0 ring-2 ring-gray-100">
                  <span className="text-white text-[10px]" style={{ fontWeight: 600 }}>
                    {owner.name.split(' ').map((n: string) => n[0]).join('')}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ fontWeight: 600 }}>{owner.name}</p>
                <p className="text-[10px] text-gray-400">@{owner.username}</p>
              </div>
            </button>
            {isOwner && onDelete && (
              <button onClick={() => onDelete(place.id)} className="p-1.5 rounded-lg active:bg-red-50 text-gray-300 active:text-red-500 transition-colors">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        )}

        {/* "X listesine eklendi" bar - below profile info */}
        {listName && listId && (
          <button
            onClick={() => navigate(`/list/${listId}?placeId=${place.id}`)}
            className="mx-4 mt-1 mb-1 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl text-xs text-blue-600 active:bg-blue-100 transition-colors w-[calc(100%-2rem)]"
          >
            <MapPin className="size-3.5" />
            <span className="truncate">
              <span style={{ fontWeight: 600 }}>{listEmoji} {listName}</span> listesine eklendi
            </span>
          </button>
        )}

        {/* Interactive mini map - only THIS place */}
        <div className="mx-4 mt-2" ref={miniMapContainerRef}>
          <MiniMap
            ref={miniMapRef}
            places={[{ lat: place.lat, lng: place.lng, name: place.name }]}
            className="h-32"
            interactive
          />
        </div>

        {/* Photo thumbnails */}
        {photos.length > 0 && (
          <div className="px-4 mt-2">
            <div className="flex gap-2 overflow-x-auto" style={noScrollbar}>
              {photos.map((photo, pidx) => (
                <button
                  key={pidx}
                  onClick={() => { setLightboxIndex(pidx); setLightboxOpen(true); }}
                  className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100 active:scale-95 transition-transform"
                >
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-4 pt-3 pb-1">
          {place.title && (
            <p className="text-xs text-blue-600 mb-0.5" style={{ fontWeight: 600 }}>{place.title}</p>
          )}
          <h4 className="text-base" style={{ fontWeight: 700 }}>{place.name}</h4>
          {place.address && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <MapPin className="size-3 shrink-0 text-blue-500" />
              <span className="truncate">{place.address}</span>
            </p>
          )}
          {place.notes && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">{place.notes}</p>
          )}
        </div>

        {/* List badges (when not showing specific listName) */}
        {!listName && placeLists.length > 0 && (
          <div className="px-4 pt-2 flex gap-1.5 overflow-x-auto" style={noScrollbar}>
            {placeLists.map(l => (
              <button
                key={l.id}
                onClick={() => navigate(`/list/${l.id}`)}
                className="text-[10px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 active:bg-blue-100 transition-colors"
                style={{ fontWeight: 500 }}
              >
                {l.emoji} {l.name}
              </button>
            ))}
          </div>
        )}

        {/* Detail tags */}
        <div className="px-4 pt-2 pb-1 space-y-1.5">
          {(place.rating || place.studentDiscount || place.priceMin !== undefined) && (
            <div className="flex items-center gap-2 overflow-x-auto" style={noScrollbar}>
              {place.rating && (
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0" style={{ fontWeight: 500 }}>
                  <Star className="size-3 fill-amber-400 text-amber-400" /> {place.rating}/5
                </span>
              )}
              {place.studentDiscount && (
                <span className="text-[11px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0">
                  <GraduationCap className="size-3" /> Öğrenci İnd.
                </span>
              )}
              {place.priceMin !== undefined && place.priceMax !== undefined && (
                <span className="text-[11px] text-green-700 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0" style={{ fontWeight: 500 }}>
                  <DollarSign className="size-3" /> {place.priceMin === place.priceMax ? `${place.priceMin}₺` : `${place.priceMin}₺ - ${place.priceMax}₺`}
                </span>
              )}
            </div>
          )}
          {cats.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto" style={noScrollbar}>
              {cats.map(cat => {
                const info = CATEGORY_MAP[cat] || { label: cat, emoji: '📍', color: 'bg-gray-100 text-gray-600' };
                return (
                  <span key={cat} className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${info.color}`} style={{ fontWeight: 500 }}>
                    {info.emoji} {info.label}
                  </span>
                );
              })}
            </div>
          )}
          {place.atmosphere && place.atmosphere.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto" style={noScrollbar}>
              <Sparkles className="size-3 text-purple-400 shrink-0" />
              {place.atmosphere.map(atm => (
                <span key={atm} className="text-[11px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{atm}</span>
              ))}
            </div>
          )}
          {place.specialFeatures && place.specialFeatures.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto" style={noScrollbar}>
              {place.specialFeatures.map(feat => (
                <span key={feat} className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{feat}</span>
              ))}
            </div>
          )}
          {(place.bestTime || (place.bestTimes && place.bestTimes.length > 0)) && (
            <div className="flex items-center gap-1.5 overflow-x-auto" style={noScrollbar}>
              <Clock className="size-3 text-gray-400 shrink-0" />
              {(place.bestTimes || [place.bestTime!]).map(time => (
                <span key={time} className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{time}</span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-2 border-t border-gray-100">
          <div className="flex overflow-x-auto gap-1 px-2 py-2" style={noScrollbar}>
            <button
              onClick={handleLikeClick}
              onPointerDown={handleLikeDown}
              onPointerUp={handleLikeUp}
              onPointerLeave={handleLikeUp}
              className={`flex flex-col items-center justify-center min-w-[44px] h-10 rounded-xl transition-colors ${isLiked ? 'bg-red-50' : 'active:bg-gray-100'}`}
            >
              <Heart className={`size-5 ${isLiked ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex flex-col items-center justify-center min-w-[44px] h-10 rounded-xl transition-colors ${showComments ? 'bg-blue-50' : 'active:bg-gray-100'}`}
            >
              <MessageCircle className={`size-5 ${showComments ? 'text-blue-500' : 'text-gray-400'}`} />
            </button>
            {/* Focus on mini map */}
            <button
              onClick={handleFocusMap}
              className="flex flex-col items-center justify-center min-w-[44px] h-10 rounded-xl active:bg-gray-100 transition-colors"
            >
              <Crosshair className="size-5 text-gray-400" />
            </button>
            {currentUser && (
              <button
                onClick={() => setShowAddToList(true)}
                className="flex flex-col items-center justify-center min-w-[44px] h-10 rounded-xl active:bg-gray-100 transition-colors"
              >
                <ListPlus className="size-5 text-gray-400" />
              </button>
            )}
            <button
              onClick={() => setShowAddress(!showAddress)}
              className={`flex flex-col items-center justify-center min-w-[44px] h-10 rounded-xl transition-colors ${showAddress ? 'bg-emerald-50' : 'active:bg-gray-100'}`}
            >
              <MapPin className={`size-5 ${showAddress ? 'text-emerald-500' : 'text-gray-400'}`} />
            </button>
            <button
              onClick={() => setShowReport(!showReport)}
              className={`flex flex-col items-center justify-center min-w-[44px] h-10 rounded-xl transition-colors ${showReport ? 'bg-orange-50' : 'active:bg-gray-100'}`}
            >
              <Flag className={`size-5 ${showReport ? 'text-orange-500' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>

        {/* Comments panel */}
        {showComments && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="text-center py-3"><p className="text-xs text-gray-400">Henüz yorum yok</p></div>
            <div className="flex items-center gap-2">
              <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Yorum yaz..." className="flex-1 text-sm px-3 py-2 bg-gray-50 rounded-xl outline-none" />
              <button onClick={() => { if (commentText.trim()) { toast.success('Yorum gönderildi'); setCommentText(''); } }} className="p-2 rounded-xl bg-blue-500 text-white active:bg-blue-600">
                <Send className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Address panel */}
        {showAddress && (
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-sm" style={{ fontWeight: 500 }}>{place.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{place.address || `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={copyAddress} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-50 rounded-xl text-xs text-gray-600 active:bg-gray-100 transition-colors">
                <Copy className="size-3.5" /> Kopyala
              </button>
              <button onClick={openInMaps} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 rounded-xl text-xs text-blue-600 active:bg-blue-100 transition-colors">
                <ExternalLink className="size-3.5" /> Haritada Aç
              </button>
            </div>
          </div>
        )}

        {/* Report panel */}
        {showReport && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-orange-500" />
              <p className="text-sm" style={{ fontWeight: 600 }}>Bildir</p>
            </div>
            <div className="space-y-2">
              {['Yanlış konum', 'Uygunsuz içerik', 'Spam', 'Diğer'].map(reason => (
                <button key={reason} onClick={() => setReportReason(reason)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors ${reportReason === reason ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-600 active:bg-gray-100'}`}
                  style={{ fontWeight: reportReason === reason ? 600 : 400 }}
                >{reason}</button>
              ))}
            </div>
            <button onClick={handleReport} disabled={!reportReason} className="w-full mt-3 py-2.5 bg-orange-500 text-white rounded-xl text-xs active:bg-orange-600 disabled:opacity-40" style={{ fontWeight: 600 }}>Gönder</button>
          </div>
        )}

        {/* Likers panel */}
        {showLikers && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-red-400" />
                <p className="text-sm" style={{ fontWeight: 600 }}>Beğenenler</p>
              </div>
              <button onClick={() => setShowLikers(false)} className="p-1 rounded-full active:bg-gray-100">
                <X className="size-4 text-gray-400" />
              </button>
            </div>
            <div className="text-center py-4"><p className="text-xs text-gray-400">Henüz beğeni yok</p></div>
          </div>
        )}

        <PhotoLightbox photos={photos} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      </div>

      {currentUser && showAddToList && (() => {
        const myLists = storage.getListsByUserId(currentUser.id);
        return (
          <div className="fixed inset-0 z-[1002]">
            <PlacePanel
              lat={place.lat}
              lng={place.lng}
              placeName={place.name}
              placeAddress={place.address}
              lists={myLists}
              onClose={() => setShowAddToList(false)}
              onSave={(placeData, targetListIds) => {
                const newPlace: Place = {
                  ...placeData,
                  id: `p-${Date.now()}`,
                  addedAt: new Date().toISOString(),
                  addedBy: { userId: currentUser.id, userName: currentUser.name },
                };
                targetListIds.forEach((listId) => {
                  const list = storage.getListById(listId);
                  if (!list) return;
                  if (list.places.some(p => p.lat === place.lat && p.lng === place.lng)) {
                    toast.error('Bu mekan zaten listede');
                    return;
                  }
                  storage.updateList({
                    ...list,
                    places: [...list.places, newPlace],
                    updatedAt: new Date().toISOString(),
                  });
                });
                toast.success('Mekan listeye eklendi!');
                onRefresh?.();
                setShowAddToList(false);
              }}
              onCreateList={(newList) => {
                const listWithUser = { ...newList, userId: currentUser.id };
                storage.createList(listWithUser);
              }}
            />
          </div>
        );
      })()}
    </>
  );
}
