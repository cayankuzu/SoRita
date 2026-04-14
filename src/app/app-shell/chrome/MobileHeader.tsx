import React from 'react';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import { SoRitaLogo } from '@/app/shared/components/brand/SoRitaLogo';
import { useNavigate, useLocation } from 'react-router';
import { Bell } from 'lucide-react';

export function MobileHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const isHome = location.pathname === '/home';

  return (
    <header className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between sticky top-0 z-50">
      <SoRitaLogo size="sm" />
      {isHome && (
        <button
          onClick={() => navigate('/notifications')}
          className="p-2 rounded-full active:bg-gray-100 text-gray-400 transition-colors relative"
        >
          <Bell className="size-5" />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      )}
    </header>
  );
}
