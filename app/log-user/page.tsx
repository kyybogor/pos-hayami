'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect from '@/components/SearchableSelect';
import {
  History,
  Search,
  RefreshCw,
  User,
  Calendar,
  Filter,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Activity,
  Monitor,
  Users,
  Clock,
  Layers,
} from 'lucide-react';

interface LogUserItem {
  id: number;
  id_user: string;
  nm_user: string;
  grup: string;
  menu: string;
  aktivitas: string;
  ip_address: string;
  created_at: string;
}

export default function LogUserPage() {
  const [logs, setLogs] = useState<LogUserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Dropdown Options
  const [userOptions, setUserOptions] = useState<{ id_user: string; label: string }[]>([]);
  const [menuOptions, setMenuOptions] = useState<string[]>([]);

  // Selected Filters
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedMenu, setSelectedMenu] = useState('');
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Summary
  const [summary, setSummary] = useState({
    total_logs: 0,
    today_logs: 0,
    active_users_today: 0,
  });

  // Fetch Dropdown Options on Mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const res = await fetch('/api/log-user?options=true');
        const data = await res.json();
        if (res.ok && data.success && data.options) {
          setUserOptions(data.options.users || []);
          setMenuOptions(data.options.menus || []);
        }
      } catch (err) {
        console.error('Failed to fetch log user options:', err);
      }
    }
    fetchOptions();
  }, []);

  // Fetch Main Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUser) params.append('user', selectedUser);
      if (selectedMenu) params.append('menu', selectedMenu);
      if (tglFrom) params.append('tgl_from', tglFrom);
      if (tglTo) params.append('tgl_to', tglTo);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await fetch(`/api/log-user?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setLogs(data.data.items || []);
        if (data.data.pagination) {
          setTotalPages(data.data.pagination.total_pages || 1);
          setTotalItems(data.data.pagination.total_items || 0);
        }
        if (data.data.summary) {
          setSummary(data.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch log user data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUser, selectedMenu, tglFrom, tglTo, page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetFilter = () => {
    setSelectedUser('');
    setSelectedMenu('');
    setTglFrom('');
    setTglTo('');
    setPage(1);
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return dateStr;
    }
  };

  const getMenuBadgeStyle = (menuName: string) => {
    switch (menuName) {
      case 'POS Penjualan':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Inventory List':
      case 'Stock Card Detail':
      case 'Stock Card General':
      case 'Stock Opname':
      case 'Move Location':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Master Barang':
      case 'Master Customer':
      case 'Master User Login':
      case 'Master Account':
      case 'Master Location':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Log User':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <History className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Log User & Activity Trail</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Riwayat aktivitas pengguna, audit trail akses menu, dan riwayat aksi sistem per akun
              </p>
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl border border-purple-200/80 text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start md:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Log</span>
          </button>
        </div>

        {/* Filter Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-purple-600" />
            <span>Filter Pencarian Log</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* User / Akun */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                User / Akun
              </label>
              <SearchableSelect
                options={userOptions.map((u) => ({ value: u.id_user, label: u.label }))}
                value={selectedUser}
                onChange={(val) => {
                  setSelectedUser(val);
                  setPage(1);
                }}
                placeholder="-- Semua User --"
              />
            </div>

            {/* Menu */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Menu Dituju
              </label>
              <SearchableSelect
                options={menuOptions.map((m) => ({ value: m, label: m }))}
                value={selectedMenu}
                onChange={(val) => {
                  setSelectedMenu(val);
                  setPage(1);
                }}
                placeholder="-- Semua Menu --"
              />
            </div>

            {/* Dari Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={tglFrom}
                onChange={(e) => {
                  setTglFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Sampai Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={tglTo}
                onChange={(e) => {
                  setTglTo(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleResetFilter}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Cari Data</span>
            </button>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Log Terdaftar
              </p>
              <p className="text-xl font-extrabold text-slate-800 mt-0.5">
                {summary.total_logs.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Aktivitas Hari Ini
              </p>
              <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
                {summary.today_logs.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                User Aktif Hari Ini
              </p>
              <p className="text-xl font-extrabold text-blue-600 mt-0.5">
                {summary.active_users_today.toLocaleString('id-ID')} <span className="text-xs font-medium text-slate-400">akun</span>
              </p>
            </div>
          </div>
        </div>

        {/* Main Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 text-center">Waktu & Tanggal</th>
                  <th className="py-3.5 px-4">User / ID Akun</th>
                  <th className="py-3.5 px-4 text-center">Cabang / Grup</th>
                  <th className="py-3.5 px-4">Menu Dituju</th>
                  <th className="py-3.5 px-4">Aktivitas / Detail Action</th>
                  <th className="py-3.5 px-4 text-center">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                      <span>Memuat data log aktivitas user...</span>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-slate-600">Belum ada data log ditemukan</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Coba atur ulang filter pencarian user, menu, atau tanggal
                      </p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Waktu & Tanggal */}
                      <td className="py-3 px-4 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>

                      {/* User / ID Akun */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-xs shrink-0">
                            {log.id_user.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {log.id_user}
                            </span>
                            {log.nm_user && log.nm_user !== log.id_user && (
                              <span className="text-[11px] text-slate-400 font-normal">
                                {log.nm_user}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cabang / Grup */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <ShieldCheck className="w-3 h-3 text-slate-500" />
                          <span>{log.grup || 'General'}</span>
                        </span>
                      </td>

                      {/* Menu Dituju */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${getMenuBadgeStyle(
                            log.menu
                          )}`}
                        >
                          {log.menu}
                        </span>
                      </td>

                      {/* Aktivitas */}
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {log.aktivitas}
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">
                        <span className="inline-flex items-center space-x-1 text-slate-500">
                          <Monitor className="w-3 h-3 text-slate-400" />
                          <span>{log.ip_address || '127.0.0.1'}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Menampilkan <strong>{logs.length}</strong> dari <strong>{totalItems}</strong> log aktivitas
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="font-semibold text-slate-700 px-2">
                  Halaman {page} dari {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
