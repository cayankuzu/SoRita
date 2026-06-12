import React, { useState, useEffect, useCallback } from 'react';
import type { PlaceList } from '@/app/data/contracts/entities';
import { storage } from '@/app/data/repositories/mockStorage';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import { ListCard } from '@/app/features/lists/public/components';
import { Users, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router';

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feedLists, setFeedLists] = useState<PlaceList[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadFeed = useCallback(() => {
    if (!user) return;
    // Re-read user from storage for latest following list
    const freshUser = storage.findUserById(user.id) || user;
    const following = freshUser.following || [];
    if (following.length === 0) {
      setFeedLists([]);
      return;
    }
    const allLists = storage.getLists();
    const feed = allLists
      .filter((l) => following.includes(l.userId) && l.isPublic)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setFeedLists(feed);
  }, [user]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed, refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  if (!user) return null;

  const freshUser = storage.findUserById(user.id) || user;
  const following = freshUser.following || [];

  return (
    <div className="min-h-full">
      <div className="px-4 py-4 max-w-lg mx-auto">
        {following.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-5">
              <Users className="size-10 text-blue-300" />
            </div>
            <h2 className="text-lg mb-2 text-center" style={{ fontWeight: 600 }}>
              Henüz kimseyi takip etmiyorsun
            </h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Keşfet sayfasından ilginç listeleri bul ve kullanıcıları takip et
            </p>
            <button
              onClick={() => navigate('/explore')}
              className="flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-xl text-sm shadow-sm shadow-blue-500/25 active:scale-[0.97] transition-transform"
              style={{ fontWeight: 600 }}
            >
              <MapPin className="size-4" />
              Keşfet
            </button>
          </div>
        ) : feedLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-5">
              <MapPin className="size-10 text-gray-300" />
            </div>
            <h2 className="text-lg mb-2 text-center" style={{ fontWeight: 600 }}>
              Henüz paylaşım yok
            </h2>
            <p className="text-sm text-gray-500 text-center">
              Takip ettiğin kişiler henüz herkese açık liste paylaşmadı
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedLists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                variant="feed"
                showUser={true}
                onLike={handleRefresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
