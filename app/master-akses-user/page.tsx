'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Check,
  X,
  RotateCcw,
  Save,
  Globe,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  Info,
  CheckSquare,
  Square,
  Lock,
  LayoutDashboard,
  Database,
  Truck,
  ShoppingBag,
  Boxes,
  Calculator,
  FileText,
  UserCheck,
  CreditCard,
  Package,
  ArrowDownRight,
  ShoppingCart,
  Receipt,
  ClipboardList,
  ArrowRightLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
  MapPin,
  Tag,
  History,
} from 'lucide-react';
import { MENU_CATEGORIES, SYSTEM_MENUS, MenuItem, MenuCategoryKey } from '@/lib/menu-list';

// Map icon names to Lucide icon components
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Database,
  Truck,
  ShoppingBag,
  Boxes,
  Calculator,
  FileText,
  Users,
  UserCheck,
  CreditCard,
  Package,
  ArrowDownRight,
  ShoppingCart,
  Receipt,
  ClipboardList,
  RotateCcw,
  ArrowRightLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
  MapPin,
  Tag,
  Building2,
  History,
  Shield,
};

interface UserItem {
  id_karyawan: number;
  user_id: string;
  nama_lengkap: string;
  alamat?: string;
  no_telp?: string;
  role: string;
  cabang: string;
  tipe: string;
  hasCustomAccess: boolean;
  activeMenuCount: number;
  totalAvailableMenus: number;
}

interface CurrentUserSession {
  id_user: string;
  nm_user: string;
  role?: string;
  tipe?: string;
  branch?: string;
  isOnline: boolean;
}

export default function MasterAksesUserPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUserSession | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // User list state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCabang, setSelectedCabang] = useState('ALL');
  const [cabangList, setCabangList] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Selected target user for permissions
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);
  const [initialAllowedMenus, setInitialAllowedMenus] = useState<string[]>([]);
  const [hasCustomAccess, setHasCustomAccess] = useState(false);
  const [menuSearchFilter, setMenuSearchFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Check auth session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            const roleLower = (data.user.role || '').toLowerCase();
            const isSuper = roleLower === 'superadmin' || roleLower === 'super';
            const isOnline = (data.user.tipe || '').toLowerCase() === 'online';

            setCurrentUser({
              id_user: data.user.id_user,
              nm_user: data.user.nm_user,
              role: data.user.role,
              tipe: data.user.tipe,
              branch: data.user.branch || data.user.grup,
              isOnline,
            });
            setIsSuperAdmin(isSuper);
          } else {
            setIsSuperAdmin(false);
          }
        } else {
          setIsSuperAdmin(false);
        }
      } catch (err) {
        console.error('Error fetching auth session:', err);
        setIsSuperAdmin(false);
      } finally {
        setPageLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    if (isSuperAdmin === false) return;
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCabang && selectedCabang !== 'ALL') params.append('cabang', selectedCabang);

      const res = await fetch(`/api/master-akses-user?${params.toString()}`);
      const result = await res.json();

      if (res.ok && result.success) {
        setUsers(result.data || []);
        setCabangList(result.cabangList || []);
        setTotalPages(result.pagination?.totalPages || 1);
        setTotalUsers(result.pagination?.total || 0);

        // Auto select first user if none selected
        if (!selectedUser && result.data && result.data.length > 0) {
          setSelectedUser(result.data[0]);
        }
      } else {
        showToast('error', result.message || 'Gagal memuat daftar user.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat memuat daftar user.');
    } finally {
      setLoadingUsers(false);
    }
  }, [page, limit, searchQuery, selectedCabang, isSuperAdmin, selectedUser, showToast]);

  useEffect(() => {
    if (isSuperAdmin) {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [fetchUsers, isSuperAdmin]);

  // Fetch target user's permissions
  const fetchUserPermissions = useCallback(
    async (userId: string) => {
      setLoadingPermissions(true);
      try {
        const res = await fetch(`/api/master-akses-user/${encodeURIComponent(userId)}`);
        const result = await res.json();

        if (res.ok && result.success) {
          const allowed = result.allowedMenus || [];
          setAllowedMenus(allowed);
          setInitialAllowedMenus(allowed);
          setHasCustomAccess(result.hasCustomAccess);
        } else {
          showToast('error', result.message || 'Gagal memuat hak akses user.');
        }
      } catch {
        showToast('error', 'Terjadi kesalahan saat memuat hak akses.');
      } finally {
        setLoadingPermissions(false);
      }
    },
    [showToast]
  );

  // When selected user changes, load their permissions
  useEffect(() => {
    if (selectedUser?.user_id) {
      fetchUserPermissions(selectedUser.user_id);
    }
  }, [selectedUser?.user_id, fetchUserPermissions]);

  // Check if permissions have unsaved changes
  const hasChanges = useMemo(() => {
    if (allowedMenus.length !== initialAllowedMenus.length) return true;
    const initialSet = new Set(initialAllowedMenus);
    return allowedMenus.some((p) => !initialSet.has(p));
  }, [allowedMenus, initialAllowedMenus]);

  // Toggle single menu permission
  const handleToggleMenu = (path: string) => {
    setAllowedMenus((prev) => {
      if (prev.includes(path)) {
        return prev.filter((p) => p !== path);
      } else {
        return [...prev, path];
      }
    });
  };

  // Toggle all menus in a category
  const handleToggleCategory = (categoryKey: MenuCategoryKey) => {
    const categoryMenus = SYSTEM_MENUS.filter((m) => m.category === categoryKey);
    const categoryPaths = categoryMenus.map((m) => m.path);
    const allCategoryEnabled = categoryPaths.every((p) => allowedMenus.includes(p));

    setAllowedMenus((prev) => {
      if (allCategoryEnabled) {
        // Deselect all in category
        return prev.filter((p) => !categoryPaths.includes(p));
      } else {
        // Select all in category
        const newSet = new Set([...prev, ...categoryPaths]);
        return Array.from(newSet);
      }
    });
  };

  // Select all menus
  const handleSelectAll = () => {
    const allPaths = SYSTEM_MENUS.map((m) => m.path);
    setAllowedMenus(allPaths);
  };

  // Deselect all menus
  const handleDeselectAll = () => {
    setAllowedMenus([]);
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/master-akses-user/${encodeURIComponent(selectedUser.user_id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedMenus }),
      });
      const result = await res.json();

      if (res.ok && result.success) {
        showToast('success', result.message || 'Hak akses berhasil disimpan!');
        setInitialAllowedMenus([...allowedMenus]);
        setHasCustomAccess(true);
        // Refresh users list counters
        fetchUsers();
      } else {
        showToast('error', result.message || 'Gagal menyimpan hak akses.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  // Reset permissions to default
  const handleResetToDefault = async () => {
    if (!selectedUser) return;
    const confirmReset = window.confirm(
      `Apakah Anda yakin ingin me-reset hak akses user "${selectedUser.nama_lengkap}" ke default (akses penuh ke semua menu standar)?`
    );
    if (!confirmReset) return;

    setResetting(true);
    try {
      const res = await fetch(`/api/master-akses-user/${encodeURIComponent(selectedUser.user_id)}`, {
        method: 'DELETE',
      });
      const result = await res.json();

      if (res.ok && result.success) {
        showToast('success', result.message || 'Hak akses berhasil di-reset ke default.');
        await fetchUserPermissions(selectedUser.user_id);
        fetchUsers();
      } else {
        showToast('error', result.message || 'Gagal me-reset hak akses.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat me-reset hak akses.');
    } finally {
      setResetting(false);
    }
  };

  // Filtered menus by search input
  const filteredMenusByCategory = useMemo(() => {
    const query = menuSearchFilter.trim().toLowerCase();
    const map: Record<MenuCategoryKey, MenuItem[]> = {
      dashboard: [],
      master: [],
      inbound: [],
      sales: [],
      inventory: [],
      finance: [],
      report: [],
    };

    SYSTEM_MENUS.forEach((menu) => {
      const matchSearch =
        !query ||
        menu.name.toLowerCase().includes(query) ||
        menu.path.toLowerCase().includes(query) ||
        menu.description.toLowerCase().includes(query);

      if (matchSearch) {
        map[menu.category].push(menu);
      }
    });

    return map;
  }, [menuSearchFilter]);

  // Loading screen
  if (pageLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Memverifikasi otorisasi pengguna...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Access Denied screen for non-superadmin
  if (isSuperAdmin === false) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto my-12 bg-white rounded-2xl border border-rose-200 shadow-xl overflow-hidden p-8 text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Akses Ditolak: Khusus Superadmin</h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-lg mx-auto mb-6">
            Menu <strong>Master Akses User</strong> merupakan menu proteksi tingkat tinggi yang hanya
            dapat dibuka dan dikelola oleh pengguna dengan role <strong>Superadmin</strong>. Akun Anda
            saat ini memiliki role:{' '}
            <span className="font-semibold text-rose-700 uppercase">
              {currentUser?.role || 'User'}
            </span>
            .
          </p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 mb-6 text-left">
            <div className="flex items-start space-x-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Jika Anda memerlukan akses ke menu ini, silakan hubungi Administrator Sistem atau
                Superadmin pusat untuk memperbarui hak akses akun Anda.
              </span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-500/10'
              : 'bg-rose-50 border-rose-300 text-rose-900 shadow-rose-500/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
              <span>Master</span>
              <span>/</span>
              <span className="text-emerald-700 font-semibold">Master Akses User</span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Khusus Superadmin
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-3">
              <Shield className="w-7 h-7 text-emerald-600" />
              <span>Master Akses User</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Atur dan batasi menu apa saja yang dapat dilihat dan diakses oleh masing-masing pengguna
              kasir dan staf toko.
            </p>
          </div>

          {/* Online / Offline Scope Badge */}
          <div className="flex items-center space-x-3">
            {currentUser?.isOnline ? (
              <div className="px-4 py-2 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-xl flex items-center space-x-2.5 text-xs text-sky-900 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Globe className="w-4 h-4 animate-spin-slow" />
                </div>
                <div>
                  <div className="font-bold flex items-center space-x-1">
                    <span>Akun Online</span>
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                  </div>
                  <div className="text-[11px] text-sky-700">Dapat mengelola akun seluruh cabang</div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center space-x-2.5 text-xs text-amber-900 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold">Mode Offline</div>
                  <div className="text-[11px] text-amber-700">
                    Cabang:{' '}
                    <strong>{currentUser?.branch || 'Kantor Cabang'}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ================= LEFT COLUMN: USER SELECTION LIST ================= */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[780px]">
            {/* Header List */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-sm text-slate-800">Pilih Pengguna</span>
                </div>
                <span className="text-xs bg-slate-200/80 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
                  {totalUsers} User
                </span>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari user ID, nama, telepon..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Cabang Filter dropdown (enabled for Online superadmins) */}
              {currentUser?.isOnline && cabangList.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedCabang}
                    onChange={(e) => {
                      setSelectedCabang(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="ALL">Semua Cabang ({cabangList.length} Cabang)</option>
                    {cabangList.map((cabang) => (
                      <option key={cabang} value={cabang}>
                        {cabang}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* User List scroll area */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
              {loadingUsers ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
                  <span className="text-xs text-slate-400">Memuat pengguna...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>Tidak ada pengguna yang cocok dengan kriteria pencarian.</p>
                </div>
              ) : (
                users.map((item) => {
                  const isSelected = selectedUser?.user_id === item.user_id;
                  const isSuper = (item.role || '').toLowerCase() === 'superadmin';

                  return (
                    <button
                      key={item.user_id}
                      onClick={() => setSelectedUser(item)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-start space-x-3 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/80 border border-emerald-300/80 shadow-xs ring-2 ring-emerald-500/10'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-transform ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                            : isSuper
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {item.nama_lengkap ? item.nama_lengkap.charAt(0).toUpperCase() : 'U'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span
                            className={`text-xs font-bold truncate ${
                              isSelected ? 'text-emerald-900' : 'text-slate-800'
                            }`}
                          >
                            {item.nama_lengkap || item.user_id}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                              isSuper
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {item.role}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 truncate mb-1.5">
                          ID: <strong className="text-slate-700">{item.user_id}</strong>
                        </div>

                        <div className="flex items-center flex-wrap gap-1 text-[10px]">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded flex items-center space-x-1 truncate max-w-[150px]">
                            <Building2 className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{item.cabang}</span>
                          </span>

                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              item.hasCustomAccess
                                ? 'bg-emerald-100/70 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.hasCustomAccess
                              ? `${item.activeMenuCount} Menu Aktif`
                              : 'Akses Penuh (Default)'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Hal {page} dari {totalPages}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ================= RIGHT COLUMN: PERMISSIONS EDITOR ================= */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[780px]">
            {selectedUser ? (
              <>
                {/* Active User Card Banner */}
                <div className="p-4 md:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-emerald-600/30">
                      {selectedUser.nama_lengkap.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-base font-bold text-slate-900 leading-tight">
                          {selectedUser.nama_lengkap}
                        </h2>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase tracking-wider">
                          {selectedUser.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                        <span>Username: <strong>{selectedUser.user_id}</strong></span>
                        <span>&bull;</span>
                        <span>Cabang: <strong>{selectedUser.cabang}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
                      title="Pilih seluruh menu sistem"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Pilih Semua</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
                      title="Batalkan centang seluruh menu"
                    >
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      <span>Kosongkan</span>
                    </button>

                    <button
                      type="button"
                      disabled={resetting}
                      onClick={handleResetToDefault}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                      title="Kembalikan hak akses ke pengaturan bawaan sistem"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                      <span>Reset Default</span>
                    </button>
                  </div>
                </div>

                {/* Sub-header Filter & Counter */}
                <div className="px-4 py-2.5 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={menuSearchFilter}
                      onChange={(e) => setMenuSearchFilter(e.target.value)}
                      placeholder="Cari menu tertentu di bawah..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="text-xs text-slate-600 font-medium">
                    <strong className="text-emerald-700 font-bold">{allowedMenus.length}</strong> dari{' '}
                    <strong>{SYSTEM_MENUS.length}</strong> menu diizinkan
                  </div>
                </div>

                {/* Permissions Category List scroll area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 bg-slate-50/40">
                  {loadingPermissions ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-2">
                      <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
                      <p className="text-xs text-slate-500">Memuat matriks hak akses user...</p>
                    </div>
                  ) : (
                    MENU_CATEGORIES.map((category) => {
                      const categoryMenus = filteredMenusByCategory[category.key] || [];
                      if (categoryMenus.length === 0) return null;

                      const CategoryIcon = ICON_MAP[category.icon] || Database;
                      const allCategorySelected = categoryMenus.every((m) =>
                        allowedMenus.includes(m.path)
                      );
                      const someCategorySelected =
                        !allCategorySelected &&
                        categoryMenus.some((m) => allowedMenus.includes(m.path));
                      const activeCount = categoryMenus.filter((m) =>
                        allowedMenus.includes(m.path)
                      ).length;

                      return (
                        <div
                          key={category.key}
                          className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3"
                        >
                          {/* Category Header with Toggle */}
                          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                                <CategoryIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-xs md:text-sm font-bold text-slate-900 leading-tight">
                                  {category.name}
                                </h3>
                                <p className="text-[11px] text-slate-500 hidden sm:block">
                                  {category.description}
                                </p>
                              </div>
                            </div>

                            {/* Category Batch Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleCategory(category.key)}
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                allCategorySelected
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : someCategorySelected
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              {allCategorySelected ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : someCategorySelected ? (
                                <span className="w-2 h-2 rounded-full bg-emerald-700" />
                              ) : null}
                              <span>
                                {allCategorySelected
                                  ? 'Semua Aktif'
                                  : someCategorySelected
                                  ? `${activeCount}/${categoryMenus.length} Aktif`
                                  : 'Pilih Kategori'}
                              </span>
                            </button>
                          </div>

                          {/* Menus Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                            {categoryMenus.map((menu) => {
                              const isChecked = allowedMenus.includes(menu.path);
                              const MenuIcon = ICON_MAP[menu.icon] || Database;
                              const isSuperOnly = !!menu.superadminOnly;

                              return (
                                <div
                                  key={menu.id}
                                  onClick={() => handleToggleMenu(menu.path)}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 select-none ${
                                    isChecked
                                      ? 'bg-emerald-50/50 border-emerald-300/80 shadow-xs ring-1 ring-emerald-500/20'
                                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                  }`}
                                >
                                  {/* Custom Checkbox */}
                                  <div
                                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                      isChecked
                                        ? 'bg-emerald-600 text-white'
                                        : 'border-2 border-slate-300 bg-white'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </div>

                                  {/* Menu Details */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-1.5 mb-0.5">
                                      <MenuIcon
                                        className={`w-3.5 h-3.5 shrink-0 ${
                                          isChecked ? 'text-emerald-700' : 'text-slate-400'
                                        }`}
                                      />
                                      <span
                                        className={`text-xs font-bold truncate ${
                                          isChecked ? 'text-slate-900' : 'text-slate-700'
                                        }`}
                                      >
                                        {menu.name}
                                      </span>
                                      {isSuperOnly && (
                                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                                          SUPER
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-[11px] text-slate-500 line-clamp-1">
                                      {menu.description}
                                    </p>

                                    <div className="mt-1 text-[10px] text-slate-400 font-mono">
                                      {menu.path}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sticky Bottom Footer Actions */}
                <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center space-x-2 text-xs">
                    {hasChanges ? (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-semibold flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        <span>Ada perubahan hak akses belum disimpan</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">
                        Hak akses tersinkronisasi dengan database
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2.5">
                    {hasChanges && (
                      <button
                        type="button"
                        onClick={() => setAllowedMenus([...initialAllowedMenus])}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                      >
                        Batal
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={saving || !hasChanges}
                      onClick={handleSavePermissions}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs md:text-sm font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                      <span>{saving ? 'Menyimpan...' : 'Simpan Hak Akses'}</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3 text-slate-400">
                <SlidersHorizontal className="w-12 h-12 text-slate-300" />
                <h3 className="font-bold text-slate-700 text-base">Pilih Pengguna</h3>
                <p className="text-xs max-w-sm">
                  Silakan klik salah satu pengguna pada daftar di sebelah kiri untuk mengatur hak
                  akses menu mereka.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
