'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle, ShoppingCart, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !pass) {
      setError('Username dan Password wajib diisi.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pass }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Maaf, Login Gagal.');
        setLoading(false);
        return;
      }

      if (data.user) {
        try {
          localStorage.setItem('user', JSON.stringify(data.user));
        } catch {}
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Gagal terhubung ke server database.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Left Hero Section (Light & Friendly POS Theme) */}
      <div className="relative md:w-1/2 lg:w-7/12 bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-8 md:p-12 lg:p-16 flex flex-col justify-between text-white overflow-hidden">
        {/* Subtle Decorative Circles */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-md">
            <ShoppingCart className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              POS HAYAMI
            </h1>
            <p className="text-xs text-emerald-100 font-medium">Sistem Penjualan & Kasir POS</p>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 my-auto py-10 space-y-6">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
            Sistem Kasir POS Terpadu <br />
            <span className="text-emerald-200">Mudah, Cepat & Akurat</span>
          </h2> 
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-emerald-200/80 flex justify-between items-center border-t border-white/10 pt-4">
          <span>&copy; {new Date().getFullYear()} Stevsoft</span>
          <span>Helpdesk & Support</span>
        </div>
      </div>

      {/* Right Login Card (Light, Clean White Theme) */}
      <div className="md:w-1/2 lg:w-5/12 bg-slate-50 p-8 md:p-12 flex items-center justify-center">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-200/80 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto border border-emerald-100">
              <User className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Masuk Akun Kasir</h3>
            <p className="text-xs text-slate-500">
              Silakan masukkan Username dan Password anda
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Login Gagal</p>
                <p className="text-xs text-rose-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Username / ID User
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan Username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="pass_user"
                  name="pass"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Masukkan Password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses Login...</span>
                </>
              ) : (
                <>
                  <span>Login Sistem</span>
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
