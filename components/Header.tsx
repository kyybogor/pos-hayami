'use client';

import React, { useState } from 'react';
import { ShoppingCart, LogOut, User, Building2, ShieldCheck, Menu } from 'lucide-react';
import { UserSession } from '@/lib/auth';

interface HeaderProps {
  user: UserSession | null;
  onToggleSidebar?: () => void;
  onMouseEnterSidebar?: () => void;
}

export default function Header({ user, onToggleSidebar, onMouseEnterSidebar }: HeaderProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left side logo & sidebar toggle */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          onMouseEnter={onMouseEnterSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Buka Menu Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-800 tracking-wide text-base hidden sm:inline-block">
              POS HAYAMI
            </span>
            <span className="text-[10px] text-emerald-600 block font-semibold -mt-1 hidden sm:block">
              Point of Sales
            </span>
          </div>
        </div>
      </div>

      {/* Right side user profile & branch & logout */}
      <div className="flex items-center space-x-3 sm:space-x-5">
        {/* Branch Badge */}
        {user?.branch && (
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-800 font-medium">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cabang: <strong className="text-emerald-950">{user.branch}</strong></span>
          </div>
        )}

        {/* User Tipe (Online / Offline) Badge */}
        {user?.tipe && (
          <div
            className={`hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              user.tipe.toLowerCase() === 'online'
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={user.tipe.toLowerCase() === 'online' ? 'Mode Online: Tersambung langsung ke database server online' : 'Mode Offline: Memerlukan kirim data closing ke server'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                user.tipe.toLowerCase() === 'online' ? 'bg-sky-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="uppercase tracking-wider text-[10px]">{user.tipe}</span>
          </div>
        )}

        <div className="h-6 w-[1px] bg-slate-200" />

        {/* User Card & Logout */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm">
              {user?.nm_user ? user.nm_user.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-800 capitalize leading-tight">
                {user?.nm_user || 'User'}
              </div>
              <div className="flex items-center space-x-1 text-[10px] text-emerald-600 font-semibold">
                <ShieldCheck className="w-3 h-3" />
                <span className="uppercase">{user?.grup || 'Guest'}</span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
            title="Keluar / Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
