import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Heart, UserPlus, MapPin, MessageCircle, Star, ListPlus } from 'lucide-react';

const noScrollbar = { scrollbarWidth: 'none' as const, msOverflowStyle: 'none' as const };

type NotifCategory = 'all' | 'likes' | 'follows' | 'comments' | 'places';

interface Notification {
  id: string;
  type: 'like' | 'follow' | 'comment' | 'place_added' | 'list_liked';
  userName: string;
  userPhoto?: string;
  userId: string;
  message: string;
  timestamp: string;
  read: boolean;
  linkTo?: string;
}

const CATEGORIES: { key: NotifCategory; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'likes', label: 'Beğeniler' },
  { key: 'follows', label: 'Takip' },
  { key: 'comments', label: 'Yorumlar' },
  { key: 'places', label: 'Mekanlar' },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1', type: 'follow', userName: 'Selin Yıldız', userId: 'user-002',
    userPhoto: 'https://images.unsplash.com/photo-1759873821395-c29de82a5b99?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwc21pbGluZyUyMHBvcnRyYWl0JTIwbmF0dXJhbCUyMGxpZ2h0fGVufDF8fHx8MTc3NDIwNzQ0MXww&ixlib=rb-4.1.0&q=80&w=400',
    message: 'seni takip etmeye başladı', timestamp: '2 saat önce', read: false, linkTo: '/profile/user-002',
  },
  {
    id: 'n2', type: 'list_liked', userName: 'Can Öztürk', userId: 'user-003',
    userPhoto: 'https://images.unsplash.com/photo-1770024482715-1cb6065a17c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHlsaXNoJTIwbWFuJTIwcG9ydHJhaXQlMjB1cmJhbiUyMGNpdHl8ZW58MXx8fHwxNzc0MjA3NDQyfDA&ixlib=rb-4.1.0&q=80&w=400',
    message: '"Ankara Kültür Turu" listeni beğendi', timestamp: '3 saat önce', read: false, linkTo: '/list/list-005',
  },
  {
    id: 'n3', type: 'comment', userName: 'Elif Şahin', userId: 'user-004',
    userPhoto: 'https://images.unsplash.com/photo-1662892894338-a65a189ac1c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwc3VuZ2xhc3NlcyUyMHN1bW1lciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDIwNzQ0Mnww&ixlib=rb-4.1.0&q=80&w=400',
    message: '"Tarihi Çınaltı Köftecisi" mekanına yorum yaptı: "Burası efsane!"', timestamp: '5 saat önce', read: false,
  },
  {
    id: 'n4', type: 'place_added', userName: 'Deniz Korkmaz', userId: 'user-005',
    userPhoto: 'https://images.unsplash.com/photo-1747710016904-2b93d97ffb72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHBvcnRyYWl0JTIwd2FybSUyMHNtaWxlJTIwaGVhZHNob3R8ZW58MXx8fHwxNzc0MjA3NzUwfDA&ixlib=rb-4.1.0&q=80&w=400',
    message: '"Huzur & Doğal Yaşam" listesine yeni mekan ekledi', timestamp: '8 saat önce', read: true, linkTo: '/list/list-008',
  },
  {
    id: 'n5', type: 'like', userName: 'Burak Çelik', userId: 'user-006',
    userPhoto: 'https://images.unsplash.com/photo-1769072058450-ac7cc0d0a541?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBiZWFyZCUyMHBvcnRyYWl0JTIwY2FzdWFsJTIwb3V0ZG9vcnxlbnwxfHx8fDE3NzQyMDc3NTB8MA&ixlib=rb-4.1.0&q=80&w=400',
    message: '"Ankara Kalesi" mekanını beğendi', timestamp: '1 gün önce', read: true,
  },
  {
    id: 'n6', type: 'follow', userName: 'Can Öztürk', userId: 'user-003',
    userPhoto: 'https://images.unsplash.com/photo-1770024482715-1cb6065a17c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHlsaXNoJTIwbWFuJTIwcG9ydHJhaXQlMjB1cmJhbiUyMGNpdHl8ZW58MXx8fHwxNzc0MjA3NDQyfDA&ixlib=rb-4.1.0&q=80&w=400',
    message: 'seni takip etmeye başladı', timestamp: '2 gün önce', read: true, linkTo: '/profile/user-003',
  },
  {
    id: 'n7', type: 'list_liked', userName: 'Selin Yıldız', userId: 'user-002',
    userPhoto: 'https://images.unsplash.com/photo-1759873821395-c29de82a5b99?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwc21pbGluZyUyMHBvcnRyYWl0JTIwbmF0dXJhbCUyMGxpZ2h0fGVufDF8fHx8MTc3NDIwNzQ0MXww&ixlib=rb-4.1.0&q=80&w=400',
    message: '"Gizli Lezzetler" listeni beğendi', timestamp: '3 gün önce', read: true,
  },
  {
    id: 'n8', type: 'comment', userName: 'Deniz Korkmaz', userId: 'user-005',
    userPhoto: 'https://images.unsplash.com/photo-1747710016904-2b93d97ffb72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHBvcnRyYWl0JTIwd2FybSUyMHNtaWxlJTIwaGVhZHNob3R8ZW58MXx8fHwxNzc0MjA3NzUwfDA&ixlib=rb-4.1.0&q=80&w=400',
    message: '"Anıtkabir" mekanına yorum yaptı: "Her Türk vatandaşının gitmesi gereken yer"', timestamp: '4 gün önce', read: true,
  },
  {
    id: 'n9', type: 'place_added', userName: 'Elif Şahin', userId: 'user-004',
    userPhoto: 'https://images.unsplash.com/photo-1662892894338-a65a189ac1c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwc3VuZ2xhc3NlcyUyMHN1bW1lciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDIwNzQ0Mnww&ixlib=rb-4.1.0&q=80&w=400',
    message: '"Antalya Tatil Rehberi" listesine 2 yeni mekan ekledi', timestamp: '5 gün önce', read: true, linkTo: '/list/list-006',
  },
  {
    id: 'n10', type: 'like', userName: 'Selin Yıldız', userId: 'user-002',
    userPhoto: 'https://images.unsplash.com/photo-1759873821395-c29de82a5b99?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwc21pbGluZyUyMHBvcnRyYWl0JTIwbmF0dXJhbCUyMGxpZ2h0fGVufDF8fHx8MTc3NDIwNzQ0MXww&ixlib=rb-4.1.0&q=80&w=400',
    message: '"Hâfız Mustafa 1864" mekanını beğendi', timestamp: '1 hafta önce', read: true,
  },
];

const ICON_MAP: Record<Notification['type'], { icon: React.ReactNode; color: string }> = {
  like: { icon: <Heart className="size-4 text-white fill-white" />, color: 'bg-red-500' },
  follow: { icon: <UserPlus className="size-4 text-white" />, color: 'bg-blue-500' },
  comment: { icon: <MessageCircle className="size-4 text-white" />, color: 'bg-green-500' },
  place_added: { icon: <MapPin className="size-4 text-white" />, color: 'bg-purple-500' },
  list_liked: { icon: <Star className="size-4 text-white fill-white" />, color: 'bg-amber-500' },
};

function getCategoryForType(type: Notification['type']): NotifCategory {
  if (type === 'like' || type === 'list_liked') return 'likes';
  if (type === 'follow') return 'follows';
  if (type === 'comment') return 'comments';
  if (type === 'place_added') return 'places';
  return 'all';
}

export function Notifications() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<NotifCategory>('all');

  const filtered = category === 'all'
    ? MOCK_NOTIFICATIONS
    : MOCK_NOTIFICATIONS.filter(n => getCategoryForType(n.type) === category);

  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-xl active:bg-gray-100">
            <ArrowLeft className="size-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base" style={{ fontWeight: 600 }}>Bildirimler</h1>
            {unreadCount > 0 && (
              <p className="text-[11px] text-blue-500">{unreadCount} yeni bildirim</p>
            )}
          </div>
        </div>

        {/* Category bar */}
        <div className="flex gap-2 overflow-x-auto mt-3 -mx-4 px-4" style={noScrollbar}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`px-4 py-2 rounded-full text-xs whitespace-nowrap transition-all shrink-0 ${
                category === cat.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
              style={{ fontWeight: category === cat.key ? 600 : 400 }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications list */}
      <div className="max-w-lg mx-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Heart className="size-8 text-gray-300" />
            </div>
            <h2 className="text-base mb-1" style={{ fontWeight: 600 }}>Bildirim yok</h2>
            <p className="text-sm text-gray-500">Bu kategoride bildirim bulunmuyor</p>
          </div>
        ) : (
          <div>
            {filtered.map(notif => {
              const iconInfo = ICON_MAP[notif.type];
              return (
                <button
                  key={notif.id}
                  onClick={() => notif.linkTo ? navigate(notif.linkTo) : navigate(`/profile/${notif.userId}`)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-gray-100 active:bg-gray-50 transition-colors text-left ${
                    !notif.read ? 'bg-blue-50/50' : 'bg-white'
                  }`}
                >
                  {/* Avatar with type icon */}
                  <div className="relative shrink-0">
                    {notif.userPhoto ? (
                      <img src={notif.userPhoto} alt="" className="size-11 rounded-full object-cover" />
                    ) : (
                      <div className="size-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white text-sm" style={{ fontWeight: 700 }}>{notif.userName[0]}</span>
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 size-5 rounded-full flex items-center justify-center ${iconInfo.color} ring-2 ring-white`}>
                      {iconInfo.icon}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span style={{ fontWeight: 600 }}>{notif.userName}</span>{' '}
                      <span className="text-gray-600">{notif.message}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">{notif.timestamp}</p>
                  </div>
                  {!notif.read && (
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
