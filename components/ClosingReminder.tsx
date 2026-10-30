'use client';

import React, { useState, useEffect } from 'react';
import { Clock, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ClosingReminder() {
  const [showReminder, setShowReminder] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Batalkan sepenuhnya jika user adalah tipe 'online'
    const isOnlineUser = () => {
      if (typeof window === 'undefined') return false;
      try {
        const cached = localStorage.getItem('user');
        if (cached) {
          const u = JSON.parse(cached);
          if (String(u?.tipe || '').toLowerCase() === 'online') {
            return true;
          }
        }
      } catch {}
      return false;
    };

    if (isOnlineUser()) {
      return;
    }

    const checkReminderTime = () => {
      if (isOnlineUser()) return;

      const now = new Date();
      const hours = now.getHours();

      // Format date YYYY-MM-DD
      const pad = (n: number) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const ackKey = `closing_reminder_ack_${todayStr}`;

      const alreadyAck = localStorage.getItem(ackKey);

      // Trigger at 15:00 WIB (hours === 15) if not already acknowledged today
      if (hours === 15 && !alreadyAck) {
        setShowReminder(true);
      }
    };

    // Check immediately on load
    checkReminderTime();

    // Check every 30 seconds
    const interval = setInterval(checkReminderTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClose = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    localStorage.setItem(`closing_reminder_ack_${todayStr}`, 'true');
    setShowReminder(false);
  };

  const handleGoToClosing = () => {
    handleClose();
    router.push('/barang-keluar');
  };

  if (!showReminder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center space-y-4 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[11px] font-bold border border-amber-200 mb-2">
            ⏰ Pengingat Jam 15:00 WIB
          </span>
          <h3 className="text-lg font-bold text-slate-900">Jangan Lupa Closing Hari Ini!</h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Halo Kasir, sudah pukul 15:00 WIB. Pastikan untuk melakukan proses <strong>Closing Harian</strong> agar seluruh data transaksi lokal terkirim dengan aman ke server online.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={handleClose}
            className="w-full py-2.5 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
          >
            Nanti Saja
          </button>
          <button
            onClick={handleGoToClosing}
            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
          >
            <span>Closing Sekarang</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
