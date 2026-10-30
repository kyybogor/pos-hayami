'use client';

import { useEffect } from 'react';

const ONE_HOUR_MS = 60 * 60 * 1000; // 1 Jam (3.600.000 ms)
const CHECK_INTERVAL_MS = 60 * 1000; // Cek setiap 1 menit

export default function AutoClosingBackground() {
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

    const runSilentClosing = async () => {
      if (isOnlineUser()) return;

      // Batalkan jika komputer offline
      if (typeof window !== 'undefined' && !navigator.onLine) {
        return;
      }

      try {
        const res = await fetch('/api/closing-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const now = Date.now();
            localStorage.setItem('last_auto_closing_timestamp', String(now));
            console.log(
              `[AutoClosing Background] Closing otomatis berhasil pada ${new Date().toLocaleTimeString('id-ID')}`
            );
          }
        }
      } catch (err) {
        // Gagal secara senyap (silent error) - Tanpa popup / tanpa mengganggu user
        console.error('[AutoClosing Background] Auto closing gagal secara silent:', err);
      }
    };

    const checkAndRunAutoClosing = () => {
      const lastRunStr = localStorage.getItem('last_auto_closing_timestamp');
      const now = Date.now();

      if (!lastRunStr) {
        // Set titik acuan waktu awal saat aplikasi pertama kali dimuat
        localStorage.setItem('last_auto_closing_timestamp', String(now));
        return;
      }

      const lastRun = parseInt(lastRunStr, 10);
      if (!isNaN(lastRun) && now - lastRun >= ONE_HOUR_MS) {
        runSilentClosing();
      }
    };

    // Expose fungsi trigger manual di console browser khusus pengujian
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).triggerAutoClosingTest = () => {
        console.log('[AutoClosing Test] Memulai pengujian auto closing manual...');
        runSilentClosing();
      };
    }

    // Jalankan pemeriksaan saat komponen di-mount
    checkAndRunAutoClosing();

    // Jalankan pemeriksaan berkala setiap 1 menit
    const interval = setInterval(checkAndRunAutoClosing, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        delete (window as unknown as Record<string, unknown>).triggerAutoClosingTest;
      }
    };
  }, []);

  return null; // Komponen ini bekerja 100% di belakang layar tanpa tampilan UI
}
