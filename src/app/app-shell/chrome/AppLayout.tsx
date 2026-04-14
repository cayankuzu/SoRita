import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '@/app/app-shell/auth/AuthSessionProvider';
import { Toaster } from '@/app/shared/components/ui/sonner';
import { useEffect } from 'react';
import { BottomNav } from '@/app/app-shell/chrome/BottomNav';
import { MobileHeader } from '@/app/app-shell/chrome/MobileHeader';

function LayoutInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user && location.pathname !== '/') {
      navigate('/');
    }
    if (user && location.pathname === '/') {
      navigate('/home');
    }
  }, [user, location.pathname, navigate]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {user && <MobileHeader />}
      <main className={`flex-1 overflow-y-auto ${user ? 'pb-16' : ''}`}>
        <Outlet />
      </main>
      {user && <BottomNav />}
      <Toaster position="top-center" />
    </div>
  );
}

export function Layout() {
  return <LayoutInner />;
}
