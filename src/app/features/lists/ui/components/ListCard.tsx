import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import type { Place, PlaceList } from '@/app/data/contracts/entities';
import { storage } from '@/app/data/repositories/mockStorage';
import { PlacePanel } from '@/app/features/map/public/components';
import { PhotoLightbox } from '@/app/shared/components/feedback/PhotoLightbox';
import { MiniMap } from '@/app/shared/components/maps/MiniMap';
import {
  Heart, MessageCircle, MapPin, Star, Clock,
  GraduationCap, Sparkles, Crosshair, ListPlus,
  Flag, Send, Copy, ExternalLink, X,
  AlertTriangle, Users,
} from 'lucide-react';
import { toast } from 'sonner';

interface ListCardProps {
  list: PlaceList;
  variant?: 'feed';
  showUser?: boolean;
  onLike?: () => void;
}

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

export function ListCard({ list, showUser = true, onLike }: ListCardProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const owner = storage.findUserById(list.userId);
  const isLiked = currentUser ? (list.likedBy || []).includes(currentUser.id) : false;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [addToListPlace, setAddToListPlace] = useState<Place | null>(null);
  const [commentText, setCommentText] = useState('');
  const [reportReason, setReportReason] = useState('');

  // Map ref for focus
  const mapRef = useRef<HTMLDivElement>(null);

  // Long press for likers
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLikeDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowLikers(true), 500);
  }, []);
  const handleLikeUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleLikeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (showLikers) return;
    if (!currentUser) return;
    storage.toggleLikeList(list.id, currentUser.id);
    onLike?.();
  }, [currentUser, list.id, onLike, showLikers]);

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (owner) navigate(`/profile/${owner.id}`);
  };

  const allMapPlaces = list.places.map(p => ({ lat: p.lat, lng: p.lng, name: p.name }));
  const allPhotos = list.places.flatMap(p => p.photos || []);

  const ratedPlaces = list.places.filter(p => p.rating);
  const avgRating = ratedPlaces.length > 0
    ? ratedPlaces.reduce((s, p) => s + (p.rating || 0), 0) / ratedPlaces.length
    : null;
  const priceRanges = list.places.map(p => p.priceRange).filter(Boolean) as number[];
  const avgPrice = priceRanges.length > 0
    ? Math.round(priceRanges.reduce((a, b) => a + b, 0) / priceRanges.length)
    : null;
  const minP = list.places.map(p => p.priceMin).filter(Boolean) as number[];
  const maxP = list.places.map(p => p.priceMax).filter(Boolean) as number[];
  const overallPriceMin = minP.length > 0 ? Math.min(...minP) : null;
  const overallPriceMax = maxP.length > 0 ? Math.max(...maxP) : null;
  const categories = [...new Set(list.places.map(p => p.category).filter(Boolean))];
  const allAtmosphere = [...new Set(list.places.flatMap(p => p.atmosphere || []))].slice(0, 5);
  const allFeatures = [...new Set(list.places.flatMap(p => p.specialFeatures || []))].slice(0, 5);
  const allBestTimes = [...new Set(list.places.flatMap(p =>
    p.bestTimes?.length ? p.bestTimes : p.bestTime ? [p.bestTime] : []
  ))].slice(0, 4);
  const hasStudentDiscount = list.places.some(p => p.studentDiscount);

  const handleFocus = () => {
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleReport = () => {
    if (!reportReason.trim()) return;
    toast.success('Bildiriminiz alındı');
    setShowReport(false);
    setReportReason('');
  };

  const handleAddFirstPlace = () => {
    if (list.places.length > 0) {
      setAddToListPlace(list.places[0]);
      setShowAddToList(true);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        {/* User Header */}
        {showUser && owner && (
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-1">
            <button onClick={handleUserClick} className="flex items-center gap-2.5 flex-1 min-w-0">
              {owner.profilePhoto ? (
                <img src={owner.profilePhoto} alt="" className="size-9 rounded-full object-cover ring-2 ring-gray-100" />
              ) : (
                <div className="size-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0 ring-2 ring-gray-100">
                  <span className="text-white text-xs" style={{ fontWeight: 600 }}>
                    {owner.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ fontWeight: 600 }}>{owner.name}</p>
                <p className="text-[11px] text-gray-400">@{owner.username}</p>
              </div>
            </button>
          </div>
        )}

        {/* "X listesini gör" bar - right after profile */}
        <button
          onClick={() => navigate(`/list/${list.id}`)}
          className="mx-4 mt-1 mb-1 flex items-center gap-2 px-3 py-2.5 bg-blue-50 rounded-xl text-xs text-blue-600 active:bg-blue-100 transition-colors w-[calc(100%-2rem)]"
        >
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate" style={{ fontWeight: 500 }}>
            {list.emoji} {list.name} listesini gör
          </span>
        </button>

        {/* Interactive Map */}
        <div ref={mapRef}>
          {list.places.length > 0 && (
            <div className="mx-4 mt-2">
              <MiniMap places={allMapPlaces.length > 0 ? [allMapPlaces[0]] : []} className="h-36" interactive />
            </div>
          )}
        </div>

        {/* Photo thumbnails */}
        {allPhotos.length > 0 && (
          <div className="px-4 mt-2">
            <div className="flex gap-2 overflow-x-auto" style={noScrollbar}>
              {allPhotos.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                  className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100 active:scale-95 transition-transform"
                >
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title & Description */}
        <div className="px-4 pt-3">
          <h3 className="text-base" style={{ fontWeight: 700 }}>
            {list.emoji && <span className="mr-1.5">{list.emoji}</span>}{list.name}
          </h3>
          {list.description && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{list.description}</p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">{list.places.length} mekan</p>
        </div>

        {/* Info rows */}
        <div className="px-4 pt-2.5 space-y-1.5">
          {avgRating && (
            <div className="flex items-center gap-2 overflow-x-auto" style={noScrollbar}>
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0" style={{ fontWeight: 500 }}>
                <Star className="size-3 fill-amber-400 text-amber-400" /> {avgRating.toFixed(1)}/5
              </span>
              {hasStudentDiscount && (
                <span className="text-[11px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0">
                  <GraduationCap className="size-3" /> Öğrenci İnd.
                </span>
              )}
            </div>
          )}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto" style={noScrollbar}>
              {categories.map(cat => {
                const info = CATEGORY_MAP[cat!] || { label: cat, emoji: '📍', color: 'bg-gray-100 text-gray-600' };
                return (
                  <span key={cat} className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${info.color}`} style={{ fontWeight: 500 }}>
                    {info.emoji} {info.label}
                  </span>
                );
              })}
            </div>
          )}
          {allAtmosphere.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto" style={noScrollbar}>
              <Sparkles className="size-3 text-purple-400 shrink-0" />
              {allAtmosphere.map(atm => (
                <span key={atm} className="text-[11px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{atm}</span>
              ))}
            </div>
          )}
          {allFeatures.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto" style={noScrollbar}>
              {allFeatures.map(feat => (
                <span key={feat} className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{feat}</span>
              ))}
            </div>
          )}
          {allBestTimes.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto" style={noScrollbar}>
              <Clock className="size-3 text-gray-400 shrink-0" />
              {allBestTimes.map(time => (
                <span key={time} className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{time}</span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-3 border-t border-gray-100">
          <div className="flex items-center overflow-x-auto px-2 py-1.5" style={noScrollbar}>
            {/* Like with long-press */}
            <button
              onClick={handleLikeClick}
              onPointerDown={handleLikeDown}
              onPointerUp={handleLikeUp}
              onPointerLeave={handleLikeUp}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors shrink-0 ${isLiked ? 'bg-red-50' : 'active:bg-gray-100'}`}
            >
              <Heart className={`size-[18px] ${isLiked ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
              {(list.likes || 0) > 0 && <span className={`text-xs ${isLiked ? 'text-red-500' : 'text-gray-400'}`}>{list.likes}</span>}
            </button>
            {/* Comment */}
            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors shrink-0 ${showComments ? 'bg-blue-50' : 'active:bg-gray-100'}`}
            >
              <MessageCircle className={`size-[18px] ${showComments ? 'text-blue-500' : 'text-gray-400'}`} />
            </button>
            {/* Focus on map */}
            <button onClick={handleFocus} className="flex items-center gap-1.5 px-3 py-2 rounded-xl active:bg-gray-100 transition-colors shrink-0">
              <Crosshair className="size-[18px] text-gray-400" />
            </button>
            {/* Add to list */}
            {currentUser && (
              <button onClick={handleAddFirstPlace} className="flex items-center gap-1.5 px-3 py-2 rounded-xl active:bg-gray-100 transition-colors shrink-0">
                <ListPlus className="size-[18px] text-gray-400" />
              </button>
            )}
            {/* Address */}
            <button
              onClick={() => setShowAddress(!showAddress)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors shrink-0 ${showAddress ? 'bg-emerald-50' : 'active:bg-gray-100'}`}
            >
              <MapPin className={`size-[18px] ${showAddress ? 'text-emerald-500' : 'text-gray-400'}`} />
            </button>
            {/* Report */}
            <button
              onClick={() => setShowReport(!showReport)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors shrink-0 ${showReport ? 'bg-orange-50' : 'active:bg-gray-100'}`}
            >
              <Flag className={`size-[18px] ${showReport ? 'text-orange-500' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>

        {/* ─── Expandable Panels ─── */}

        {/* Comments */}
        {showComments && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="text-center py-3"><p className="text-xs text-gray-400">Henüz yorum yok</p></div>
            <div className="flex items-center gap-2">
              <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Yorum yaz..." className="flex-1 text-sm px-3 py-2 bg-gray-50 rounded-xl outline-none" />
              <button
                onClick={() => { if (commentText.trim()) { toast.success('Yorum gönderildi'); setCommentText(''); } }}
                className="p-2 rounded-xl bg-blue-500 text-white active:bg-blue-600"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Address - only first place (matching the map) */}
        {showAddress && list.places.length > 0 && (() => {
          const p = list.places[0];
          return (
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-sm" style={{ fontWeight: 500 }}>{p.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(p.address || `${p.lat}, ${p.lng}`).catch(() => {});
                    toast.success('Adres kopyalandı');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-50 rounded-xl text-xs text-gray-600 active:bg-gray-100 transition-colors"
                >
                  <Copy className="size-3.5" /> Kopyala
                </button>
                <button
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, '_blank')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 rounded-xl text-xs text-blue-600 active:bg-blue-100 transition-colors"
                >
                  <ExternalLink className="size-3.5" /> Haritada Aç
                </button>
              </div>
            </div>
          );
        })()}

        {/* Report */}
        {showReport && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-orange-500" />
              <p className="text-sm" style={{ fontWeight: 600 }}>Bildir</p>
            </div>
            <div className="space-y-2">
              {['Yanlış konum', 'Uygunsuz içerik', 'Spam', 'Diğer'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors ${
                    reportReason === reason ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-600 active:bg-gray-100'
                  }`}
                  style={{ fontWeight: reportReason === reason ? 600 : 400 }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={handleReport}
              disabled={!reportReason}
              className="w-full mt-3 py-2.5 bg-orange-500 text-white rounded-xl text-xs active:bg-orange-600 disabled:opacity-40"
              style={{ fontWeight: 600 }}
            >
              Gönder
            </button>
          </div>
        )}

        {/* Likers panel */}
        {showLikers && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-red-400" />
                <p className="text-sm" style={{ fontWeight: 600 }}>Beğenenler ({list.likes || 0})</p>
              </div>
              <button onClick={() => setShowLikers(false)} className="p-1 rounded-full active:bg-gray-100">
                <X className="size-4 text-gray-400" />
              </button>
            </div>
            {(list.likedBy || []).length === 0 ? (
              <div className="text-center py-4"><p className="text-xs text-gray-400">Henüz beğeni yok</p></div>
            ) : (
              <div className="space-y-2">
                {(list.likedBy || []).map(uid => {
                  const u = storage.findUserById(uid);
                  if (!u) return null;
                  return (
                    <button key={uid} onClick={() => navigate(`/profile/${uid}`)} className="flex items-center gap-2 w-full active:bg-gray-50 rounded-xl p-1.5 transition-colors">
                      {u.profilePhoto ? (
                        <img src={u.profilePhoto} alt="" className="size-8 rounded-full object-cover" />
                      ) : (
                        <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <span className="text-white text-[10px]" style={{ fontWeight: 600 }}>{u.name[0]}</span>
                        </div>
                      )}
                      <div className="min-w-0 text-left">
                        <p className="text-xs truncate" style={{ fontWeight: 600 }}>{u.name}</p>
                        <p className="text-[10px] text-gray-400">@{u.username}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <PhotoLightbox photos={allPhotos} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      </div>

      {/* Add to list panel */}
      {currentUser && addToListPlace && showAddToList && (() => {
        const myLists = storage.getListsByUserId(currentUser.id);
        return (
          <div className="fixed inset-0 z-[1002]">
            <PlacePanel
              lat={addToListPlace.lat}
              lng={addToListPlace.lng}
              placeName={addToListPlace.name}
              placeAddress={addToListPlace.address}
              lists={myLists}
              onClose={() => { setShowAddToList(false); setAddToListPlace(null); }}
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
                  storage.updateList({
                    ...list,
                    places: [...list.places, newPlace],
                    updatedAt: new Date().toISOString(),
                  });
                });
                toast.success('Mekan listeye eklendi!');
                setShowAddToList(false);
                setAddToListPlace(null);
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
