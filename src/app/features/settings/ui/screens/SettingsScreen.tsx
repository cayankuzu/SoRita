import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import { storage } from '@/app/data/repositories/mockStorage';
import {
  ArrowLeft, User, Lock, Eye, EyeOff, Shield, Ban, LogOut,
  Trash2, ChevronRight, Camera, Globe, LockKeyhole,
} from 'lucide-react';
import { toast } from 'sonner';

type SettingsView = 'main' | 'editProfile' | 'privacy' | 'password' | 'blocked';

export function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [view, setView] = useState<SettingsView>('main');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit profile state
  const freshUser = user ? storage.findUserById(user.id) || user : null;
  const [editName, setEditName] = useState(freshUser?.name || '');
  const [editUsername, setEditUsername] = useState(freshUser?.username || '');
  const [editBio, setEditBio] = useState(freshUser?.bio || '');

  // Privacy
  const [isPublicAccount, setIsPublicAccount] = useState(true);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!user || !freshUser) return null;

  const handleSaveProfile = () => {
    if (!editName.trim() || !editUsername.trim()) {
      toast.error('İsim ve kullanıcı adı boş olamaz');
      return;
    }
    storage.updateUser({
      ...freshUser,
      name: editName.trim(),
      username: editUsername.trim(),
      bio: editBio.trim() || undefined,
    });
    storage.setCurrentUser({
      ...freshUser,
      name: editName.trim(),
      username: editUsername.trim(),
      bio: editBio.trim() || undefined,
    });
    toast.success('Profil güncellendi');
    setView('main');
  };

  const handleSavePassword = () => {
    if (!currentPassword || !newPassword) {
      toast.error('Tüm alanları doldurun');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalı');
      return;
    }
    toast.success('Şifre güncellendi');
    setCurrentPassword('');
    setNewPassword('');
    setView('main');
  };

  const handleDeleteAccount = () => {
    logout();
    toast.success('Hesabınız silindi');
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // ═══════ Edit Profile ═══════
  if (view === 'editProfile') {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40 flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-1.5 -ml-1.5 rounded-xl active:bg-gray-100">
            <ArrowLeft className="size-5 text-gray-600" />
          </button>
          <h1 className="text-base flex-1" style={{ fontWeight: 600 }}>Profili Düzenle</h1>
          <button onClick={handleSaveProfile} className="px-4 py-1.5 bg-blue-500 text-white rounded-xl text-sm active:bg-blue-600" style={{ fontWeight: 600 }}>
            Kaydet
          </button>
        </div>
        <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              {freshUser.profilePhoto ? (
                <img src={freshUser.profilePhoto} alt="" className="size-24 rounded-full object-cover" />
              ) : (
                <div className="size-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <span className="text-white text-3xl" style={{ fontWeight: 700 }}>{freshUser.name[0]}</span>
                </div>
              )}
              <button className="absolute bottom-0 right-0 size-8 bg-blue-500 rounded-full flex items-center justify-center text-white ring-3 ring-white active:bg-blue-600">
                <Camera className="size-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block" style={{ fontWeight: 500 }}>Ad Soyad</label>
            <input
              type="text" value={editName} onChange={e => setEditName(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block" style={{ fontWeight: 500 }}>Kullanıcı Adı</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
              <input
                type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block" style={{ fontWeight: 500 }}>Biyografi</label>
            <textarea
              value={editBio} onChange={e => setEditBio(e.target.value)}
              rows={3} maxLength={150}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors resize-none"
              placeholder="Kendinden kısaca bahset..."
            />
            <p className="text-[11px] text-gray-400 text-right mt-1">{editBio.length}/150</p>
          </div>
        </div>
      </div>
    );
  }

  // ═══════ Privacy ═══════
  if (view === 'privacy') {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40 flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-1.5 -ml-1.5 rounded-xl active:bg-gray-100">
            <ArrowLeft className="size-5 text-gray-600" />
          </button>
          <h1 className="text-base" style={{ fontWeight: 600 }}>Gizlilik</h1>
        </div>
        <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
          <button
            onClick={() => { setIsPublicAccount(true); toast.success('Hesap herkese açık yapıldı'); }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-colors ${isPublicAccount ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}
          >
            <div className={`size-10 rounded-full flex items-center justify-center ${isPublicAccount ? 'bg-blue-500' : 'bg-gray-200'}`}>
              <Globe className={`size-5 ${isPublicAccount ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm" style={{ fontWeight: 600 }}>Herkese Açık</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Herkes profilini ve listelerini görebilir</p>
            </div>
            {isPublicAccount && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
          </button>
          <button
            onClick={() => { setIsPublicAccount(false); toast.success('Hesap gizli yapıldı'); }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-colors ${!isPublicAccount ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}
          >
            <div className={`size-10 rounded-full flex items-center justify-center ${!isPublicAccount ? 'bg-blue-500' : 'bg-gray-200'}`}>
              <LockKeyhole className={`size-5 ${!isPublicAccount ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm" style={{ fontWeight: 600 }}>Gizli Hesap</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Sadece takipçilerin profilini görebilir</p>
            </div>
            {!isPublicAccount && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
          </button>
        </div>
      </div>
    );
  }

  // ═══════ Password ═══════
  if (view === 'password') {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40 flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-1.5 -ml-1.5 rounded-xl active:bg-gray-100">
            <ArrowLeft className="size-5 text-gray-600" />
          </button>
          <h1 className="text-base" style={{ fontWeight: 600 }}>Şifre Güncelle</h1>
        </div>
        <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block" style={{ fontWeight: 500 }}>Mevcut Şifre</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
                {showPassword ? <EyeOff className="size-4 text-gray-400" /> : <Eye className="size-4 text-gray-400" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block" style={{ fontWeight: 500 }}>Yeni Şifre</label>
            <input
              type={showPassword ? 'text' : 'password'} value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              placeholder="En az 6 karakter"
            />
          </div>
          <button onClick={handleSavePassword} className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm active:bg-blue-600" style={{ fontWeight: 600 }}>
            Şifreyi Güncelle
          </button>
        </div>
      </div>
    );
  }

  // ═══════ Blocked Users ═══════
  if (view === 'blocked') {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40 flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-1.5 -ml-1.5 rounded-xl active:bg-gray-100">
            <ArrowLeft className="size-5 text-gray-600" />
          </button>
          <h1 className="text-base" style={{ fontWeight: 600 }}>Engellenen Kişiler</h1>
        </div>
        <div className="flex flex-col items-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <Ban className="size-8 text-gray-300" />
          </div>
          <h2 className="text-base mb-1" style={{ fontWeight: 600 }}>Engellenen yok</h2>
          <p className="text-sm text-gray-500 text-center">Engellediğin kişiler burada görünecek</p>
        </div>
      </div>
    );
  }

  // ═══════ Main Settings ═══════
  const SECTIONS = [
    {
      title: 'Hesap',
      items: [
        { icon: <User className="size-5" />, label: 'Profili Düzenle', color: 'bg-blue-500', action: () => setView('editProfile') },
        { icon: <Shield className="size-5" />, label: 'Gizlilik', color: 'bg-emerald-500', action: () => setView('privacy') },
        { icon: <Lock className="size-5" />, label: 'Şifre Güncelle', color: 'bg-amber-500', action: () => setView('password') },
      ],
    },
    {
      title: 'Diğer',
      items: [
        { icon: <Ban className="size-5" />, label: 'Engellenen Kişiler', color: 'bg-gray-500', action: () => setView('blocked') },
        { icon: <LogOut className="size-5" />, label: 'Çıkış Yap', color: 'bg-orange-500', action: handleLogout },
        { icon: <Trash2 className="size-5" />, label: 'Hesabı Sil', color: 'bg-red-500', action: () => setShowDeleteConfirm(true), danger: true },
      ],
    },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-xl active:bg-gray-100">
          <ArrowLeft className="size-5 text-gray-600" />
        </button>
        <h1 className="text-base" style={{ fontWeight: 600 }}>Ayarlar</h1>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-6">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <p className="text-xs text-gray-400 mb-2 px-1" style={{ fontWeight: 600 }}>{section.title}</p>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              {section.items.map((item, idx) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-colors text-left ${
                    idx < section.items.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className={`size-8 rounded-lg flex items-center justify-center text-white ${item.color}`}>
                    {item.icon}
                  </div>
                  <span className={`flex-1 text-sm ${(item as any).danger ? 'text-red-600' : ''}`} style={{ fontWeight: 500 }}>
                    {item.label}
                  </span>
                  <ChevronRight className="size-4 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Delete account confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl mx-6 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="size-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base" style={{ fontWeight: 600 }}>Hesabı Sil</h3>
                <p className="text-xs text-gray-500">Bu işlem geri alınamaz</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Hesabını silmek istediğine emin misin? Tüm listelerin, mekanların ve veriler kalıcı olarak silinecek.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm active:bg-gray-200" style={{ fontWeight: 600 }}>
                İptal
              </button>
              <button onClick={handleDeleteAccount} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm active:bg-red-600" style={{ fontWeight: 600 }}>
                Hesabı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
