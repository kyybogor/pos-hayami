'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import ClosingReminder from '@/components/ClosingReminder';
import AutoClosingBackground from '@/components/AutoClosingBackground';
import UserActivityTracker from '@/components/UserActivityTracker';
import { UserSession } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Baca cache user di dalam useEffect agar SSR dan initial hydration cocok (menghindari error hydration)
    try {
      const cached = localStorage.getItem('user');
      if (cached) {
        setUser(JSON.parse(cached));
      }
    } catch {}

    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser(data.user);
            try {
              localStorage.setItem('user', JSON.stringify(data.user));
            } catch {}
          }
        }
      } catch (err) {
        console.error('Failed to fetch user session:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  const isOnlineUser = (user?.tipe || '').toLowerCase() === 'online';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <UserActivityTracker />
      {/* Auto Closing & Reminder hanya aktif untuk user OFFLINE (karena user Online datanya langsung masuk ke DB Online) */}
      {!isOnlineUser && (
        <>
          <AutoClosingBackground />
          <ClosingReminder />
        </>
      )}
      <Header
        user={user}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onMouseEnterSidebar={() => setSidebarOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Invisible Left Edge Hover Sensor (trigered when cursor moves towards the left sidebar area) */}
        {!sidebarOpen && (
          <div
            onMouseEnter={() => setSidebarOpen(true)}
            className="fixed left-0 top-16 bottom-0 w-4 z-30 cursor-pointer"
            title="Arahkan kursor ke sini untuk membuka menu sidebar"
          />
        )}

        <Sidebar
          isOpen={sidebarOpen}
          user={user}
          allowedMenus={(user as any)?.allowedMenus}
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => setSidebarOpen(false)}
        />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-100 transition-all duration-300">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

