import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Home, Map, Search, User } from 'lucide-react';

const navItems = [
  { path: '/home', label: 'Ana Sayfa', icon: Home },
  { path: '/map', label: 'Harita', icon: Map },
  { path: '/explore', label: 'Keşfet', icon: Search },
  { path: '/profile', label: 'Profil', icon: User },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === '/profile' && location.pathname.startsWith('/profile'));
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive
                  ? 'text-blue-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className={`size-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[10px]" style={{ fontWeight: isActive ? 600 : 400 }}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-12 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
