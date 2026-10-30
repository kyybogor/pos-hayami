'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  User,
  UserCheck,
  CreditCard,
  X,
  Printer,
  Save,
  Edit3,
  FileText,
  Download,
  ArrowLeft,
  HelpCircle,
  ZoomIn,
  Eye,
  Barcode,
  Calendar,
  Layers,
  Tag,
} from 'lucide-react';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';

interface Variant {
  stock_id: string;
  ukuran: string;
  stock: number;
  harga_lusin: number;
  harga_pcs: number;
  uom: string;
}

interface ProductCardData {
  key: string;
  id_bahan: string;
  model: string;
  image: string;
  uom: string;
  total_stock: number;
  min_price: number;
  max_price: number;
  variants: Variant[];
}

interface Customer {
  id_customer: string;
  nama_customer: string;
  diskon_lusin: number;
  no_telp?: string;
  alamat_lengkap?: string;
  kota?: string;
  email?: string;
}

interface Akun {
  id_akun: string;
  tipe: string;
  bank: string;
  nama_akun: string;
  no_akun?: string;
}

interface CustType {
  id_cust_type: number;
  nm_type: string;
  percentage: number;
}

interface CartItem {
  id: string; // unique key in cart: id_bahan-model-ukuran
  id_bahan: string;
  model: string;
  ukuran: string;
  qty: number;
  max_stock: number;
  uom: string;
  harga_base: number;
  harga: number; // price per piece calculated based on customer type
  subtotal: number;
}

export interface PendingCartItem {
  id: string;
  timestamp: string;
  customerId: string;
  customerName: string;
  customerObj?: Customer | null;
  custType?: CustType | null;
  keterangan: string;
  discType: 'Rp' | '%';
  discInvoiceInput: number;
  cashAmount: number;
  cart: CartItem[];
  totalPcs: number;
  totalLusin: number;
  totalSubtotal: number;
  totalDiskonCustomer: number;
  discInvoiceCalculated: number;
  grandTotal: number;
  paymentMethod?: 'CASH' | 'HUTANG';
  selectedCashAccount?: string;
  topHari?: number;
}

// Function to calculate custom price based on customer type percentage and rounding rules
const calculateCustomPrice = (basePrice: number, percentage: number, typeName: string): number => {
  if (!basePrice || basePrice <= 0) return 0;
  if (!percentage || percentage <= 0) return basePrice;

  let rawPrice = basePrice;
  const isDistributor = typeName.toLowerCase().includes('distributor') || percentage === 100;

  if (isDistributor) {
    rawPrice = basePrice * (percentage / 100);
  } else {
    rawPrice = (basePrice / percentage) * 100;
  }

  const intPrice = Math.ceil(rawPrice);
  const rem = intPrice % 1000;
  if (rem === 0) return intPrice;
  if (rem <= 500) {
    return intPrice - rem + 500;
  } else {
    return intPrice - rem + 1000;
  }
};

export default function PosPage() {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [totalCatalogCount, setTotalCatalogCount] = useState<number>(0);

  // Product Images Mapping State (with offline localStorage caching)
  const [productImagesMap, setProductImagesMap] = useState<Record<string, string>>({});

  // Load cached product images from localStorage for instant offline access
  useEffect(() => {
    try {
      const cached = localStorage.getItem('pos_product_images_cache');
      if (cached) {
        setProductImagesMap(JSON.parse(cached));
      }
    } catch (e) {
      console.error('Failed to parse cached product images from localStorage', e);
    }
  }, []);

  const getProductImageUrl = useCallback(
    (idBahan: string, model: string, existingImg?: string) => {
      // 1. Jika gambar diupload lokal di folder sendiri (/uploads/ atau /images/), gunakan langsung
      if (existingImg && (existingImg.startsWith('/uploads/') || existingImg.startsWith('/images/'))) {
        return existingImg;
      }

      // 2. Cek API online jika ada
      if (idBahan && model) {
        const key = `${idBahan.trim().toLowerCase()}|||${model.trim().toLowerCase()}`;
        if (productImagesMap[key]) {
          return productImagesMap[key];
        }
      }

      // 3. Fallback jika ada existingImg lainnya (misal URL http atau path relatif)
      if (existingImg && existingImg.trim() !== '') {
        if (existingImg.startsWith('http') || existingImg.startsWith('/')) {
          return existingImg;
        }
        return `/${existingImg}`;
      }

      return '';
    },
    [productImagesMap]
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [akuns, setAkuns] = useState<Akun[]>([]);
  const [custTypes, setCustTypes] = useState<CustType[]>([]);
  const [selectedCustType, setSelectedCustType] = useState<CustType | null>(null);
  const [loading, setLoading] = useState(true);

  // Pagination & Infinite Scroll State via Refs to avoid stale closures
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageRef = useRef(page);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const loadingRef = useRef(loading);
  const catalogScrollRef = useRef<HTMLDivElement>(null);

  pageRef.current = page;
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;
  loadingRef.current = loading;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipeFilter, setSelectedTipeFilter] = useState<string>('');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('');
  const [tipeList, setTipeList] = useState<string[]>([]);
  const [modelList, setModelList] = useState<string[]>([]);
  const tipeFilterRef = useRef(selectedTipeFilter);
  const modelFilterRef = useRef(selectedModelFilter);
  tipeFilterRef.current = selectedTipeFilter;
  modelFilterRef.current = selectedModelFilter;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('CASH');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'HUTANG'>('CASH');
  const [selectedCashAccount, setSelectedCashAccount] = useState<string>('CASH');
  const [selectedAkun, setSelectedAkun] = useState<string>('CASH');
  const [topHari, setTopHari] = useState<number>(30);
  const [keterangan, setKeterangan] = useState<string>('');
  const [discType, setDiscType] = useState<'Rp' | '%'>('Rp');
  const [discInvoiceInput, setDiscInvoiceInput] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<number>(0);

  // Helper to calculate and format Jatuh Tempo date based on TOP days
  const getJatuhTempoDate = useCallback((days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + (Number(days) || 0));
    return d;
  }, []);

  const formatJatuhTempoStr = useCallback(
    (days: number) => {
      const d = getJatuhTempoDate(days);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    },
    [getJatuhTempoDate]
  );

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<ProductCardData | null>(null);
  const [modalQtyDict, setModalQtyDict] = useState<Record<string, number>>({});
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Customer Modal State
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [editCustomerForm, setEditCustomerForm] = useState({
    id_customer: '',
    nama_customer: '',
    diskon_lusin: 0,
    kota: '',
    no_telp: '',
    alamat_lengkap: '',
    email: '',
  });

  // Transaction Detail Summary & Proforma Preview States
  const [isDetailSummaryOpen, setIsDetailSummaryOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isProformaPreviewOpen, setIsProformaPreviewOpen] = useState(false);

  // Pending Carts state (Draft transactions held in localStorage)
  const [pendingCarts, setPendingCarts] = useState<PendingCartItem[]>([]);
  const [isPendingCartsModalOpen, setIsPendingCartsModalOpen] = useState(false);
  const [pendingCartSearch, setPendingCartSearch] = useState('');

  // Image Lightbox / Zoom Modal State
  const [previewImageModal, setPreviewImageModal] = useState<{
    url: string;
    title: string;
    model: string;
  } | null>(null);

  const handleDownloadImage = (url: string, filename: string) => {
    if (!url) return;
    const downloadUrl = `/api/download-image?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Gambar berhasil di-download!');
  };

  // Load pending carts from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_pending_carts');
      if (saved) {
        setPendingCarts(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse pending carts from localStorage', e);
    }
  }, []);

  const savePendingCartsToStorage = (updatedCarts: PendingCartItem[]) => {
    setPendingCarts(updatedCarts);
    try {
      localStorage.setItem('pos_pending_carts', JSON.stringify(updatedCarts));
    } catch (e) {
      console.error('Failed to save pending carts to localStorage', e);
    }
  };

  // Active POS Transaction Draft State (Autosave to localStorage cache)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  // Helper to reset active draft form back to initial clean state
  const clearActiveDraft = useCallback(() => {
    setCart([]);
    setSelectedCustomerId('CASH');
    setKeterangan('');
    setDiscInvoiceInput(0);
    setCashAmount(0);
    setPaymentMethod('CASH');
    setSelectedCashAccount('CASH');
    setSelectedAkun('CASH');
    setTopHari(30);
    try {
      localStorage.removeItem('pos_active_draft');
    } catch (e) {
      console.error('Failed to clear pos_active_draft from localStorage', e);
    }
  }, []);

  // 1. Load active draft from localStorage on initial mount
  useEffect(() => {
    try {
      const savedDraftStr = localStorage.getItem('pos_active_draft');
      if (savedDraftStr) {
        const draft = JSON.parse(savedDraftStr);
        if (Array.isArray(draft.cart) && draft.cart.length > 0) {
          setCart(draft.cart);
        }
        if (draft.selectedCustomerId) {
          setSelectedCustomerId(draft.selectedCustomerId);
        }
        if (draft.selectedCustType) {
          setSelectedCustType(draft.selectedCustType);
        }
        if (draft.paymentMethod === 'CASH' || draft.paymentMethod === 'HUTANG') {
          setPaymentMethod(draft.paymentMethod);
        }
        if (draft.selectedCashAccount) {
          setSelectedCashAccount(draft.selectedCashAccount);
        }
        if (draft.selectedAkun) {
          setSelectedAkun(draft.selectedAkun);
        }
        if (typeof draft.topHari === 'number' && draft.topHari > 0) {
          setTopHari(draft.topHari);
        }
        if (typeof draft.keterangan === 'string') {
          setKeterangan(draft.keterangan);
        }
        if (draft.discType === 'Rp' || draft.discType === '%') {
          setDiscType(draft.discType);
        }
        if (typeof draft.discInvoiceInput === 'number') {
          setDiscInvoiceInput(draft.discInvoiceInput);
        }
        if (typeof draft.cashAmount === 'number') {
          setCashAmount(draft.cashAmount);
        }
      }
    } catch (e) {
      console.error('Failed to parse active POS draft from localStorage', e);
    } finally {
      setIsDraftLoaded(true);
    }
  }, []);

  // 2. Persist active draft whenever inputs or cart change (after initial draft load)
  useEffect(() => {
    if (!isDraftLoaded) return;

    try {
      const isDefaultState =
        cart.length === 0 &&
        selectedCustomerId === 'CASH' &&
        (!keterangan || keterangan.trim() === '') &&
        discInvoiceInput === 0 &&
        cashAmount === 0 &&
        paymentMethod === 'CASH' &&
        selectedCashAccount === 'CASH';

      if (isDefaultState) {
        localStorage.removeItem('pos_active_draft');
      } else {
        const draft = {
          cart,
          selectedCustomerId,
          selectedCustType,
          paymentMethod,
          selectedCashAccount,
          selectedAkun,
          topHari,
          keterangan,
          discType,
          discInvoiceInput,
          cashAmount,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem('pos_active_draft', JSON.stringify(draft));
      }
    } catch (e) {
      console.error('Failed to save pos_active_draft to localStorage', e);
    }
  }, [
    isDraftLoaded,
    cart,
    selectedCustomerId,
    selectedCustType,
    paymentMethod,
    selectedCashAccount,
    selectedAkun,
    topHari,
    keterangan,
    discType,
    discInvoiceInput,
    cashAmount,
  ]);

  const handleResetCart = () => {
    if (cart.length === 0 && selectedCustomerId === 'CASH' && !keterangan && discInvoiceInput === 0) return;
    if (window.confirm('Kosongkan keranjang belanja dan reset formulir transaksi?')) {
      clearActiveDraft();
      showToast('success', 'Keranjang belanja dan formulir telah direset.');
    }
  };

  // Barcode Scanner Handler State & Audio Beep Feedback
  const [isScanning, setIsScanning] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const playBeep = (isSuccess: boolean = true) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 880 : 300, ctx.currentTime);
      if (!isSuccess) {
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
      }
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isSuccess ? 0.12 : 0.25));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (isSuccess ? 0.12 : 0.25));
    } catch (e) {
      // Audio feedback suppressed if AudioContext blocked
    }
  };

  const handleBarcodeScan = useCallback(
    async (codeToScan?: string) => {
      const code = (codeToScan || searchQuery).trim();
      if (!code) return;

      setIsScanning(true);
      try {
        const res = await fetch(`/api/pos/scan?code=${encodeURIComponent(code)}`);
        const data = await res.json();

        if (res.ok && data.success && data.data) {
          const item = data.data;
          const qtyToAdd = item.scanned_qty || 1;

          if (item.stock <= 0) {
            playBeep(false);
            showToast('error', `Stok ${item.id_bahan} ${item.model} (Size: ${item.ukuran}) habis! (0 pcs)`);
            setIsScanning(false);
            return;
          }

          const percentage = selectedCustType?.percentage || 100;
          const typeName = selectedCustType?.nm_type || 'Distributor/Grosir';
          const calcPrice = calculateCustomPrice(item.harga_pcs, percentage, typeName);

          const cartId = `${item.id_bahan}|||${item.model}|||${item.ukuran}`;

          setCart((prevCart) => {
            const existingIdx = prevCart.findIndex((i) => i.id === cartId);
            if (existingIdx > -1) {
              const currentQty = prevCart[existingIdx].qty;
              const newTotalQty = currentQty + qtyToAdd;
              if (newTotalQty > item.stock) {
                playBeep(false);
                showToast(
                  'error',
                  `Stok ${item.ukuran} tidak mencukupi! Maksimal stok: ${item.stock} pcs (di keranjang: ${currentQty} pcs).`
                );
                return prevCart;
              }
              const updated = [...prevCart];
              updated[existingIdx] = {
                ...updated[existingIdx],
                qty: newTotalQty,
                harga_base: item.harga_pcs,
                harga: calcPrice,
                subtotal: newTotalQty * calcPrice,
              };
              playBeep(true);
              showToast(
                'success',
                `[SCAN] Qty +${qtyToAdd} (${newTotalQty} pcs) ${item.id_bahan} ${item.model} (Size: ${item.ukuran})`
              );
              return updated;
            } else {
              if (qtyToAdd > item.stock) {
                playBeep(false);
                showToast(
                  'error',
                  `Stok ${item.ukuran} tidak mencukupi! Maksimal stok: ${item.stock} pcs.`
                );
                return prevCart;
              }
              playBeep(true);
              showToast(
                'success',
                `[SCAN] Berhasil menambah ${qtyToAdd} pcs ${item.id_bahan} ${item.model} (Size: ${item.ukuran})`
              );
              return [
                ...prevCart,
                {
                  id: cartId,
                  id_bahan: item.id_bahan,
                  model: item.model,
                  ukuran: item.ukuran,
                  qty: qtyToAdd,
                  max_stock: item.stock,
                  uom: item.uom,
                  harga_base: item.harga_pcs,
                  harga: calcPrice,
                  subtotal: qtyToAdd * calcPrice,
                },
              ];
            }
          });

          setSearchQuery('');
        } else {
          playBeep(false);
          showToast('error', data.message || `Barcode "${code}" tidak ditemukan.`);
        }
      } catch (err) {
        playBeep(false);
        showToast('error', 'Terjadi kesalahan koneksi saat scan barcode.');
      } finally {
        setIsScanning(false);
      }
    },
    [searchQuery, selectedCustType]
  );

  // Selected customer details
  const selectedCustomerObj = useMemo(() => {
    return customers.find((c) => c.id_customer === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const handleOpenEditCustomerModal = (customerIdToEdit?: string) => {
    const targetId = customerIdToEdit || selectedCustomerId;
    const targetCust = customers.find((c) => c.id_customer === targetId) || selectedCustomerObj;

    if (!targetCust) {
      showToast('error', 'Pilih customer terlebih dahulu untuk mengedit data.');
      return;
    }

    setEditCustomerForm({ 
      id_customer: targetCust.id_customer,
      nama_customer: targetCust.nama_customer || '',
      diskon_lusin: Number(targetCust.diskon_lusin || 0),
      kota: targetCust.kota || '',
      no_telp: targetCust.no_telp || '',
      alamat_lengkap: targetCust.alamat_lengkap || '',
      email: targetCust.email || '',
    });
    setIsEditCustomerModalOpen(true);
  };

  const handleSaveCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomerForm.nama_customer.trim()) {
      showToast('error', 'Nama Customer wajib diisi!');
      return;
    }

    setIsSavingCustomer(true);
    try {
      const res = await fetch(
        `/api/master-customer/${encodeURIComponent(editCustomerForm.id_customer)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editCustomerForm),
        }
      );

      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', 'Ubah Data Customer Berhasil!');
        setIsEditCustomerModalOpen(false);

        // Re-fetch customers metadata so POS immediately updates customer list & discounts!
        const custRes = await fetch('/api/pos/customers');
        const custData = await custRes.json();
        if (custData.success) {
          setCustomers(custData.data || []);
        }
      } else {
        showToast('error', data.message || 'Gagal mengubah data customer.');
      }
    } catch (err) {
      showToast('error', 'Terjadi kesalahan sistem saat menyimpan customer.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Checkout State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuccessTxId, setCheckoutSuccessTxId] = useState<string | null>(null);
  const [checkoutSuccessIsHutang, setCheckoutSuccessIsHutang] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Formatted options for Select2 Header Filters (Tipe & Model)
  const tipeFilterOptions: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: '-- Semua Tipe / Bahan --' },
      ...tipeList.map((t) => ({ value: t, label: t })),
    ];
  }, [tipeList]);

  const modelFilterOptions: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: '-- Semua Model --' },
      ...modelList.map((m) => ({ value: m, label: m })),
    ];
  }, [modelList]);

  // Formatted options for SearchableSelect
  const customerOptions: SelectOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: c.id_customer,
      label: `${c.id_customer} ${c.nama_customer}`,
      subLabel: c.nama_customer,
    }));
  }, [customers]);

  // 1. Pilihan Metode Pembayaran: Hanya CASH atau HUTANG
  const paymentMethodOptions: SelectOption[] = useMemo(
    () => [
      { value: 'CASH', label: 'CASH' },
      { value: 'HUTANG', label: 'HUTANG' },
    ],
    []
  );

  // 2. Pilihan Akun Pembayaran jika metode CASH (BCA, Mandiri, BRI, Kas Tunai, dll.)
  const cashAccountOptions: SelectOption[] = useMemo(() => {
    return akuns
      .filter((a) => {
        const t = a.tipe.trim().toUpperCase();
        return t !== 'HUTANG' && t !== 'SPLIT';
      })
      .map((a) => {
        const isCash = a.tipe.trim().toUpperCase() === 'CASH';
        const val = isCash
          ? 'CASH'
          : a.bank && a.bank.trim() !== a.tipe.trim()
          ? `${a.tipe.trim()} - ${a.bank.trim()}`
          : a.tipe.trim();
        const label = isCash
          ? 'CASH - Kas / Tunai'
          : a.bank && a.bank.trim() !== a.tipe.trim()
          ? `${a.tipe.trim()} - ${a.bank.trim()}`
          : a.tipe.trim();
        const subLabel =
          a.nama_akun && a.nama_akun.trim() !== 'CASH'
            ? `${a.nama_akun.trim()}${a.no_akun ? ` (${a.no_akun.trim()})` : ''}`
            : undefined;

        return {
          value: val,
          label,
          subLabel,
        };
      });
  }, [akuns]);

  const custTypeOptions: SelectOption[] = useMemo(() => {
    return custTypes.map((t) => ({
      value: String(t.id_cust_type),
      label: t.nm_type,
    }));
  }, [custTypes]);

  const handleCustTypeChange = (custTypeIdStr: string) => {
    const found = custTypes.find((t) => String(t.id_cust_type) === custTypeIdStr);
    if (found) {
      setSelectedCustType(found);
      setCart((prevCart) =>
        prevCart.map((item) => {
          const basePrice = item.harga_base || item.harga;
          const newPrice = calculateCustomPrice(basePrice, found.percentage, found.nm_type);
          return {
            ...item,
            harga_base: basePrice,
            harga: newPrice,
            subtotal: item.qty * newPrice,
          };
        })
      );
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch initial metadata (customers, akuns, custTypes, & product images API)
  useEffect(() => {
    async function fetchMeta() {
      try {
        const [custRes, akunRes, custTypeRes, imgRes] = await Promise.all([
          fetch('/api/pos/customers'),
          fetch('/api/pos/akuns'),
          fetch('/api/cust-type'),
          fetch('https://new-program.hayami.id/api/product-images').catch(() => null),
        ]);
        const [custData, akunData, custTypeData] = await Promise.all([
          custRes.json(),
          akunRes.json(),
          custTypeRes.json(),
        ]);

        if (custData.success) setCustomers(custData.data || []);
        if (akunData.success) setAkuns(akunData.data || []);
        if (custTypeData.success && custTypeData.data?.length > 0) {
          const types: CustType[] = custTypeData.data;
          setCustTypes(types);
          setSelectedCustType((prev) => {
            if (prev) {
              const matched = types.find((t) => t.id_cust_type === prev.id_cust_type);
              return matched || prev;
            }
            return (
              types.find((t) => t.nm_type.toLowerCase().includes('distributor')) || types[0]
            );
          });
        }

        if (imgRes && imgRes.ok) {
          const imgData = await imgRes.json();
          if (Array.isArray(imgData)) {
            const imgMap: Record<string, string> = {};
            imgData.forEach((item: { tipe?: string; gambar?: string; url?: string }) => {
              if (item.tipe && item.gambar && item.url) {
                const key = `${item.tipe.trim().toLowerCase()}|||${item.gambar.trim().toLowerCase()}`;
                imgMap[key] = item.url;
              }
            });
            setProductImagesMap(imgMap);
            try {
              localStorage.setItem('pos_product_images_cache', JSON.stringify(imgMap));
            } catch (e) {
              console.warn('LocalStorage limit or error saving product images cache', e);
            }
          }
        }
      } catch (err) {
        console.error('Error loading metadata:', err);
      }
    }
    fetchMeta();
  }, []);

  // Fetch available Tipe & Model filter options on mount
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const res = await fetch('/api/pos/products?options=true');
        const json = await res.json();
        if (json.success && json.options) {
          setTipeList(json.options.tipes || []);
          setModelList(json.options.models || []);
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    fetchFilterOptions();
  }, []);

  // Update available models when selectedTipeFilter changes
  useEffect(() => {
    async function updateModels() {
      try {
        const url = selectedTipeFilter
          ? `/api/pos/products?options=true&tipe=${encodeURIComponent(selectedTipeFilter)}`
          : '/api/pos/products?options=true';
        const res = await fetch(url);
        const json = await res.json();
        if (json.success && json.options) {
          setModelList(json.options.models || []);
          // Clear model selection if it does not belong to the newly selected Tipe
          if (selectedModelFilter && json.options.models && !json.options.models.includes(selectedModelFilter)) {
            setSelectedModelFilter('');
          }
        }
      } catch (err) {
        console.error('Failed to update models:', err);
      }
    }
    updateModels();
  }, [selectedTipeFilter]);

  // Fetch product catalog page with search and filters
  const fetchProducts = useCallback(
    async (
      targetPage: number,
      querySearch: string,
      isNewSearch: boolean = false,
      tipeFilter: string = '',
      modelFilter: string = ''
    ) => {
      if (isNewSearch) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams();
        params.append('page', String(targetPage));
        params.append('limit', '24');
        if (querySearch.trim()) params.append('q', querySearch.trim());
        if (tipeFilter.trim()) params.append('tipe', tipeFilter.trim());
        if (modelFilter.trim()) params.append('model', modelFilter.trim());

        const res = await fetch(`/api/pos/products?${params.toString()}`);
        const data = await res.json();

        if (res.ok && data.success) {
          const newItems: ProductCardData[] = data.data || [];
          if (isNewSearch) {
            setProducts(newItems);
          } else {
            setProducts((prev) => [...prev, ...newItems]);
          }
          setHasMore(data.hasMore);
          setPage(targetPage);
          setTotalCatalogCount(data.total || 0);
        } else {
          showToast('error', data.message || 'Gagal memuat catalog produk.');
        }
      } catch {
        showToast('error', 'Terjadi kesalahan saat memuat produk.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Initial load and search / filter trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(1, searchQuery, true, selectedTipeFilter, selectedModelFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedTipeFilter, selectedModelFilter, fetchProducts]);

  // Auto-scan trigger if searchQuery matches scanned barcode pattern (e.g., length >= 5 and ends with 2 numeric digits)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 5 && /^\d{2}$/.test(trimmed.slice(-2))) {
      const timer = setTimeout(() => {
        handleBarcodeScan(trimmed);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, handleBarcodeScan]);

  // Infinite Scroll Handler when user reaches bottom of catalog
  const handleCatalogScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el || loadingRef.current || loadingMoreRef.current || !hasMoreRef.current) return;

    const threshold = 150;
    if (el.scrollHeight - (el.scrollTop + el.clientHeight) <= threshold) {
      const nextPage = pageRef.current + 1;
      fetchProducts(
        nextPage,
        searchQuery,
        false,
        tipeFilterRef.current,
        modelFilterRef.current
      );
    }
  };

  const diskonLusinVal = Number(selectedCustomerObj?.diskon_lusin || 0);

  // Cart Calculations
  const totalSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const totalPcs = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.qty, 0);
  }, [cart]);

  const totalLusin = useMemo(() => {
    return parseFloat((totalPcs / 12).toFixed(2));
  }, [totalPcs]);

  // Customer discount calculated per piece: diskon_lusin / 12
  const totalDiskonCustomer = useMemo(() => {
    if (diskonLusinVal <= 0 || totalPcs <= 0) return 0;
    const perPcsDisc = diskonLusinVal / 12;
    return Math.round(totalPcs * perPcsDisc);
  }, [totalPcs, diskonLusinVal]);

  const subtotalAfterCustDisc = useMemo(() => {
    return Math.max(0, totalSubtotal - totalDiskonCustomer);
  }, [totalSubtotal, totalDiskonCustomer]);

  // Additional Invoice Discount (Rp or %)
  const discInvoiceCalculated = useMemo(() => {
    if (discInvoiceInput <= 0) return 0;
    if (discType === '%') {
      const pct = Math.min(100, Math.max(0, discInvoiceInput));
      return Math.round((subtotalAfterCustDisc * pct) / 100);
    }
    return Math.min(subtotalAfterCustDisc, discInvoiceInput);
  }, [discType, discInvoiceInput, subtotalAfterCustDisc]);

  const grandTotal = useMemo(() => {
    const calc = subtotalAfterCustDisc - discInvoiceCalculated;
    return Math.max(0, calc);
  }, [subtotalAfterCustDisc, discInvoiceCalculated]);

  // Handle clicking product card -> Open Modal (matching Image 2)
  const handleOpenProductModal = (product: ProductCardData) => {
    setSelectedProduct(product);
    setModalError(null);

    // Reset qty dictionary for all size variants to 0
    const initialDict: Record<string, number> = {};
    product.variants.forEach((v) => {
      initialDict[v.ukuran] = 0;
    });
    setModalQtyDict(initialDict);
  };

  // Handle updating quantity for a size variant inside modal
  const handleUpdateModalQty = (ukuran: string, maxStock: number, newQty: number) => {
    const qty = Math.max(0, Math.min(maxStock, newQty));
    setModalQtyDict((prev) => ({
      ...prev,
      [ukuran]: qty,
    }));
  };

  // Modal Summary Calculations
  const modalSummary = useMemo(() => {
    if (!selectedProduct) return { totalQty: 0, totalPrice: 0 };
    let totalQty = 0;
    let totalPrice = 0;

    const percentage = selectedCustType?.percentage || 100;
    const typeName = selectedCustType?.nm_type || 'Distributor/Grosir';

    selectedProduct.variants.forEach((v) => {
      const q = modalQtyDict[v.ukuran] || 0;
      totalQty += q;
      const calcPrice = calculateCustomPrice(v.harga_pcs, percentage, typeName);
      totalPrice += q * calcPrice;
    });

    return { totalQty, totalPrice };
  }, [selectedProduct, modalQtyDict, selectedCustType]);

  // Add ALL selected sizes from Modal into Cart at once
  const handleAddMultipleToCart = () => {
    if (!selectedProduct) return;

    const countAdded = modalSummary.totalQty;
    if (countAdded === 0) {
      setModalError('Masukkan jumlah Qty minimal pada salah satu ukuran.');
      return;
    }

    setCart((prevCart) => {
      let updatedCart = [...prevCart];

      selectedProduct.variants.forEach((v) => {
        const qtyToAdd = modalQtyDict[v.ukuran] || 0;
        if (qtyToAdd > 0) {
          const cartId = `${selectedProduct.id_bahan}|||${selectedProduct.model}|||${v.ukuran}`;
          const existingIdx = updatedCart.findIndex((i) => i.id === cartId);

          const percentage = selectedCustType?.percentage || 100;
          const typeName = selectedCustType?.nm_type || 'Distributor/Grosir';
          const calcPrice = calculateCustomPrice(v.harga_pcs, percentage, typeName);

          if (existingIdx > -1) {
            const currentQty = updatedCart[existingIdx].qty;
            const newTotalQty = currentQty + qtyToAdd;
            if (newTotalQty <= v.stock) {
              updatedCart[existingIdx] = {
                ...updatedCart[existingIdx],
                qty: newTotalQty,
                harga_base: v.harga_pcs,
                harga: calcPrice,
                subtotal: newTotalQty * calcPrice,
              };
            } else {
              showToast('error', `Stok ${v.ukuran} terbatas. Maksimal stok: ${v.stock} pcs.`);
            }
          } else {
            updatedCart.push({
              id: cartId,
              id_bahan: selectedProduct.id_bahan,
              model: selectedProduct.model,
              ukuran: v.ukuran,
              qty: qtyToAdd,
              max_stock: v.stock,
              uom: v.uom,
              harga_base: v.harga_pcs,
              harga: calcPrice,
              subtotal: qtyToAdd * calcPrice,
            });
          }
        }
      });

      return updatedCart;
    });

    showToast('success', `Berhasil menambah ${countAdded} pcs barang ke keranjang!`);
    setSelectedProduct(null);
  };

  // Update Qty directly in Cart
  const handleUpdateCartQty = (cartId: string, newQty: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === cartId) {
            if (newQty <= 0) return null; // remove
            if (newQty > item.max_stock) {
              showToast('error', `Stock tidak mencukupi! Stok tersedia: ${item.max_stock} pcs.`);
              return item;
            }
            return {
              ...item,
              qty: newQty,
              subtotal: newQty * item.harga,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Remove item from cart
  const handleRemoveFromCart = (cartId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== cartId));
  };

  // Open Detail Summary Modal before final confirmation
  const handleOpenDetailSummary = () => {
    if (cart.length === 0) {
      showToast('error', 'Keranjang belanja masih kosong!');
      return;
    }
    setIsDetailSummaryOpen(true);
  };

  // Helper: call stock-reserve API
  const updateStockReserve = async (action: 'hold' | 'release', cartItems: typeof cart) => {
    try {
      await fetch('/api/pos/stock-reserve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          items: cartItems.map((i) => ({
            id_bahan: i.id_bahan,
            model: i.model,
            ukuran: i.ukuran,
            qty: i.qty,
          })),
        }),
      });
    } catch (e) {
      console.error('Failed to update stock_reserve:', e);
    }
  };

  // Save active transaction draft to Pending Carts (Hold Transaction)
  const handleSaveToPendingCart = async () => {
    if (cart.length === 0) {
      showToast('error', 'Keranjang belanja masih kosong!');
      return;
    }

    const newPending: PendingCartItem = {
      id: `CART-${Date.now()}`,
      timestamp: new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      customerId: selectedCustomerId,
      customerName: selectedCustomerObj?.nama_customer || 'CASH',
      customerObj: selectedCustomerObj,
      custType: selectedCustType,
      keterangan,
      discType,
      discInvoiceInput,
      cashAmount,
      cart: [...cart],
      totalPcs,
      totalLusin,
      totalSubtotal,
      totalDiskonCustomer,
      discInvoiceCalculated,
      grandTotal,
      paymentMethod,
      selectedCashAccount,
      topHari,
    };

    const updated = [newPending, ...pendingCarts];
    savePendingCartsToStorage(updated);

    // Hold stock_reserve for items in this pending cart
    await updateStockReserve('hold', cart);

    // Clear current active POS workspace and draft cache
    clearActiveDraft();
    setIsDetailSummaryOpen(false);

    showToast('success', 'Transaksi berhasil disimpan ke Cart Pending!');
  };

  // Restore a pending cart into active POS workspace
  const handleRestorePendingCart = async (item: PendingCartItem) => {
    setCart(item.cart);
    setSelectedCustomerId(item.customerId);
    if (item.custType) {
      setSelectedCustType(item.custType);
    }
    if (item.paymentMethod) {
      setPaymentMethod(item.paymentMethod);
      setSelectedAkun(item.paymentMethod === 'HUTANG' ? 'HUTANG' : (item.selectedCashAccount || 'CASH'));
    }
    if (item.selectedCashAccount) {
      setSelectedCashAccount(item.selectedCashAccount);
    }
    if (item.topHari !== undefined) {
      setTopHari(item.topHari);
    }
    setKeterangan(item.keterangan || '');
    setDiscType(item.discType || 'Rp');
    setDiscInvoiceInput(item.discInvoiceInput || 0);
    setCashAmount(item.cashAmount || 0);

    // Remove restored cart from pending list
    const updated = pendingCarts.filter((c) => c.id !== item.id);
    savePendingCartsToStorage(updated);

    // Release stock_reserve (items go back to active cart, no longer need to be reserved)
    await updateStockReserve('release', item.cart);

    setIsPendingCartsModalOpen(false);
    showToast('success', `Transaksi Cart (${item.customerName}) dimuat kembali!`);
  };

  // Delete a pending cart from list
  const handleDeletePendingCart = async (id: string) => {
    const deletedItem = pendingCarts.find((c) => c.id === id);
    const updated = pendingCarts.filter((c) => c.id !== id);
    savePendingCartsToStorage(updated);

    // Release stock_reserve for deleted cart items
    if (deletedItem) {
      await updateStockReserve('release', deletedItem.cart);
    }

    showToast('success', 'Transaksi cart pending dihapus.');
  };

  // Helper to trigger proforma print popup
  const handlePrintProforma = () => {
    const elem = document.getElementById('proforma-printable');
    if (!elem) {
      showToast('error', 'Dokumen proforma tidak ditemukan');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quotation - ${selectedCustomerObj?.nama_customer || 'CASH'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; font-family: 'Poppins', Arial, sans-serif; }
            body { margin: 0; padding: 20px; background: #ffffff; color: #000000; font-size: 12.5px; }
            .header { display: grid; grid-template-columns: 185px 1fr 285px; column-gap: 25px; align-items: start; margin-top: 14px; margin-bottom: 25px; }
            .logo img { width: 125px; display: block; margin-top: 4px; }
            .logo small { display: block; margin-top: 15px; letter-spacing: 2px; color: #666; font-size: 9px; font-weight: 700; white-space: nowrap; }
            .address { line-height: 1.55; font-size: 13px; }
            .address .date { display: block; margin-bottom: 3px; font-size: 15px; font-weight: 700; }
            .address .customer { font-weight: 500; }
            .invoice-info { text-align: right; line-height: 1.55; font-size: 13px; }
            .invoice-info h2 { margin: 0 0 7px 0; font-size: 19px; font-weight: 700; }
            .item-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 6px; }
            .item-table th { border: 1px solid #222; padding: 10px 8px; font-size: 13px; font-weight: 700; text-align: center; }
            .item-table td { border: 1px solid #222; padding: 9px 12px; font-size: 13px; vertical-align: middle; }
            .item-table .no-col { width: 8%; text-align: center; }
            .item-table .desc-col { width: 38%; }
            .item-table .qty-col { width: 12%; text-align: center; }
            .item-table .price-col { width: 15%; text-align: right; }
            .item-table .amount-col { width: 15%; text-align: right; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .summary-area { display: grid; grid-template-columns: 1fr 280px; column-gap: 10px; margin-top: 16px; align-items: start; }
            .note { font-size: 11.5px; line-height: 1.6; white-space: nowrap; }
            .note strong { font-size: 14px; font-weight: 700; }
            .totals { width: 100%; font-size: 14px; }
            .total-row { display: grid; grid-template-columns: 1fr 120px; align-items: baseline; margin-bottom: 10px; }
            .total-label { text-align: right; padding-right: 8px; }
            .total-value { text-align: right; font-weight: 700; }
            .total-line { border-top: 1px solid #d5d5d5; width: 100%; margin: 10px 0 14px 0; }
            .grand-row { display: grid; grid-template-columns: 1fr 120px; align-items: baseline; }
            .grand-label { font-size: 14px; font-weight: 700; text-align: right; padding-right: 8px; }
            .grand-value { font-size: 16px; font-weight: 700; text-align: right; letter-spacing: -0.3px; }
            .footer { margin-top: 52px; display: flex; justify-content: space-between; font-size: 13px; }
            .signature { width: 47%; }
            .signature.right { text-align: right; }
            .signature-line { border-top: 1px solid #222; width: 50mm; margin-top: 55px; padding-top: 9px; font-weight: 700; }
            .signature.right .signature-line { margin-left: auto; }
            .bottom-brand { margin-top: 36px; padding-top: 17px; border-top: 1px dashed #ccc; text-align: center; font-size: 14px; letter-spacing: 3px; color: #888; font-weight: 700; }
          </style>
        </head>
        <body>
          ${elem.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Process POS Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('error', 'Keranjang belanja masih kosong!');
      return;
    }

    setIsSubmitting(true);
    try {
      const isHutangTx = paymentMethod === 'HUTANG';
      const payload = {
        cart: cart.map((i) => ({
          id_bahan: i.id_bahan,
          model: i.model,
          ukuran: i.ukuran,
          qty: i.qty,
          uom: i.uom,
          harga: i.harga,
          subtotal: i.subtotal,
        })),
        id_customer: selectedCustomerId,
        sales: selectedCustType?.nm_type || 'Distributor/Grosir',
        keterangan,
        akun: isHutangTx ? 'HUTANG' : (selectedCashAccount || 'CASH'),
        top_hari: isHutangTx ? (Number(topHari) || 30) : 0,
        disc_invoice: discInvoiceCalculated,
        diskon_lusin_total: totalDiskonCustomer,
        cash_amount: isHutangTx ? 0 : (cashAmount || grandTotal),
      };

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', 'Transaksi POS Berhasil!');
        setCheckoutSuccessTxId(data.id_transaksi);
        setCheckoutSuccessIsHutang(isHutangTx);
        clearActiveDraft();
        // Reload products
        fetchProducts(1, searchQuery, true, selectedTipeFilter, selectedModelFilter);
      } else {
        showToast('error', data.message || 'Gagal memproses checkout POS.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan sistem saat transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-3 text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
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

        {/* POS Header Control Bar: 1 Single Compact Horizontal Row */}
        <div className="relative z-30 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5">
          {/* Filters & Search - All in 1 Row */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Filter Tipe / ID Bahan */}
            <div className="w-40 sm:w-44 md:w-48 shrink-0">
              <SearchableSelect
                size="sm"
                options={tipeFilterOptions}
                value={selectedTipeFilter}
                onChange={setSelectedTipeFilter}
                placeholder="-- Tipe / Bahan --"
                searchPlaceholder="Cari Tipe..."
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Filter Model */}
            <div className="w-40 sm:w-44 md:w-48 shrink-0">
              <SearchableSelect
                size="sm"
                options={modelFilterOptions}
                value={selectedModelFilter}
                onChange={setSelectedModelFilter}
                placeholder="-- Model Barang --"
                searchPlaceholder="Cari Model..."
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Reset Button if any filter active */}
            {(selectedTipeFilter || selectedModelFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTipeFilter('');
                  setSelectedModelFilter('');
                }}
                className="px-2 py-1.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold border border-rose-200/80 flex items-center space-x-1 transition-all cursor-pointer shadow-2xs shrink-0"
                title="Reset Filter"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* Fast Scan / Search Bar - Compact & 1 Baris */}
            <div className="relative w-44 sm:w-52 md:w-60 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Scan / Cari Produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan();
                  }
                }}
                className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-16 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <div className="absolute right-1 top-0.5 flex items-center space-x-0.5">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleBarcodeScan()}
                  disabled={isScanning || !searchQuery.trim()}
                  title="Scan Barcode & Tambah ke Keranjang"
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg flex items-center space-x-0.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Barcode className="w-3 h-3" />
                  <span>{isScanning ? '..' : 'Scan'}</span>
                </button>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchProducts(1, searchQuery, true, selectedTipeFilter, selectedModelFilter)}
              title="Refresh Catalog"
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Right: Cart Pending Button */}
          <div className="shrink-0 flex items-center">
            <button
              onClick={() => setIsPendingCartsModalOpen(true)}
              title="Lihat Cart Pending"
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 text-xs font-bold shadow-2xs"
            >
              <ShoppingCart className="w-4 h-4 text-amber-600" />
              <span>Cart</span>
              {pendingCarts.length > 0 && (
                <span className="bg-amber-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                  {pendingCarts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main POS 2-Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Product Catalog Grid with Infinite Scroll (7 Cols on desktop) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs min-h-[600px] flex flex-col">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Katalog Produk ({products.length} dari {totalCatalogCount})</span>
                  </span>
                  {selectedTipeFilter && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span>Tipe: {selectedTipeFilter}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTipeFilter('')}
                        className="hover:text-emerald-900 cursor-pointer"
                        title="Hapus filter tipe"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedModelFilter && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <span>Model: {selectedModelFilter}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedModelFilter('')}
                        className="hover:text-blue-900 cursor-pointer"
                        title="Hapus filter model"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Scroll kebawah mentok untuk memuat lebih banyak
                </span>
              </div>

              {loading && products.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                  <span className="text-xs font-semibold">Memuat katalog produk...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                  <Package className="w-12 h-12 text-slate-300 mb-2" />
                  <span className="text-xs font-semibold text-slate-600">Produk tidak ditemukan.</span>
                  <span className="text-[11px] text-slate-400 mt-1">Coba kata kunci pencarian lain.</span>
                </div>
              ) : (
                /* Infinite Scroll Catalog Container */
                <div
                  ref={catalogScrollRef}
                  onScroll={handleCatalogScroll}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[650px] pr-1.5"
                >
                  {products.map((p) => {
                    const imgUrl = getProductImageUrl(p.id_bahan, p.model, p.image);
                    return (
                      <div
                        key={p.key}
                        onClick={() => handleOpenProductModal(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleOpenProductModal(p);
                        }}
                        className="group flex flex-col text-left bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-emerald-500 rounded-2xl p-3.5 transition-all duration-150 shadow-2xs hover:shadow-md cursor-pointer relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        {/* Product Thumbnail / Image Placeholder */}
                        <div
                          onClick={(e) => {
                            if (imgUrl) {
                              e.stopPropagation(); // prevent opening product size modal
                              setPreviewImageModal({
                                url: imgUrl,
                                title: p.id_bahan,
                                model: p.model,
                              });
                            }
                          }}
                          className="w-full aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden mb-3 flex items-center justify-center relative border border-slate-100 group/img cursor-zoom-in"
                        >
                          {imgUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgUrl}
                                alt={`${p.id_bahan} ${p.model}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              {/* Hover Zoom Icon Badge */}
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/img:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                                <div className="p-2 bg-white/90 text-slate-800 rounded-xl shadow-md flex items-center space-x-1 text-[11px] font-bold">
                                  <ZoomIn className="w-4 h-4 text-emerald-600" />
                                  <span>Perbesar</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300">
                              <Package className="w-9 h-9 mb-1 text-slate-300" />
                              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                                Hayami
                              </span>
                            </div>
                          )}

                          {/* Tombol Download Gambar di Pojok Kanan Atas Card */}
                          {imgUrl && (
                            <button
                              type="button"
                              title="Download Gambar"
                              aria-label="Download Gambar"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadImage(
                                  imgUrl,
                                  `${p.id_bahan}_${p.model}.jpg`
                                );
                              }}
                              className="absolute top-2 right-2 z-20 w-8 h-8 rounded-lg bg-white/90 hover:bg-emerald-600 text-slate-700 hover:text-white shadow-md border border-slate-200/80 backdrop-blur-xs transition-all duration-150 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 group/dl"
                            >
                              <Download className="w-4 h-4 transition-transform group-hover/dl:scale-110" />
                            </button>
                          )}
                        </div>

                        {/* Title & Model Code (matching Image 1) */}
                        <div className="mb-3">
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 line-clamp-1">
                            {p.id_bahan}
                          </h4>
                          <p className="text-xs font-semibold text-blue-600 line-clamp-1 mt-0.5">
                            {p.model}
                          </p>
                        </div>

                        {/* Horizontal Scrollable Size Badges Row (uniform card height) */}
                        <div className="w-full mt-auto pt-2.5 border-t border-slate-100 overflow-hidden">
                          <div className="flex flex-row items-center gap-1.5 overflow-x-auto pb-1.5 max-w-full scrollbar-thin scrollbar-thumb-slate-200">
                            {p.variants.map((v) => (
                              <div
                                key={v.ukuran}
                                className={`shrink-0 min-w-[54px] px-2 py-1 rounded-xl border text-center flex flex-col justify-center ${
                                  v.stock > 0
                                    ? 'bg-slate-50/90 border-slate-200/90'
                                    : 'bg-rose-50/50 border-rose-200 opacity-60'
                                }`}
                              >
                                <span className="text-xs font-bold text-slate-800 line-clamp-1">
                                  {v.ukuran}
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">
                                  Stock:
                                </span>
                                <span
                                  className={`text-[10px] font-bold leading-tight ${
                                    v.stock > 0 ? 'text-emerald-700' : 'text-rose-600'
                                  }`}
                                >
                                  {v.stock}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Infinite Scroll Loader at Bottom */}
                  {loadingMore && (
                    <div className="col-span-full py-4 text-center text-slate-500 text-xs font-medium flex items-center justify-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Memuat produk berikutnya...</span>
                    </div>
                  )}

                  {!hasMore && products.length > 0 && (
                    <div className="col-span-full py-4 text-center text-slate-400 text-[11px] font-semibold">
                      Semua produk ({totalCatalogCount}) telah ditampilkan.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: POS Cart & Checkout Panel (5 Cols on desktop) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative z-20 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
              {/* Customer & Transaction Meta Selectors */}
              <div className="p-4 bg-slate-50/80 border-b border-slate-200 space-y-3 rounded-t-2xl">
                <div className="grid grid-cols-2 gap-3">
                  {/* Customer Select */}
                  <SearchableSelect
                    label="Customer"
                    icon={<User className="w-3 h-3 text-emerald-600" />}
                    options={customerOptions}
                    value={selectedCustomerId}
                    onChange={(val) => setSelectedCustomerId(val)}
                    searchPlaceholder="Ketik nama/ID..."
                    onEdit={() => handleOpenEditCustomerModal(selectedCustomerId)}
                  />

                  {/* Payment Method Select: CASH or HUTANG */}
                  <SearchableSelect
                    label="Metode / Akun"
                    icon={<CreditCard className="w-3 h-3 text-emerald-600" />}
                    options={paymentMethodOptions}
                    value={paymentMethod}
                    onChange={(val) => {
                      const method = val as 'CASH' | 'HUTANG';
                      setPaymentMethod(method);
                      if (method === 'HUTANG') {
                        setSelectedAkun('HUTANG');
                      } else {
                        setSelectedAkun(selectedCashAccount || 'CASH');
                      }
                    }}
                    searchable={false}
                  />
                </div>

                {/* Additional Info Row: Cash Destination or TOP (Hari) & Customer Classification */}
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethod === 'CASH' ? (
                    <SearchableSelect
                      label="Pilihan Pembayaran"
                      icon={<CreditCard className="w-3 h-3 text-emerald-600" />}
                      options={cashAccountOptions}
                      value={selectedCashAccount}
                      onChange={(val) => {
                        setSelectedCashAccount(val);
                        setSelectedAkun(val);
                      }}
                      searchable={false}
                    />
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-amber-800 flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-amber-600" />
                          <span>TOP (Hari)</span>
                        </label>
                        <span className="text-[10px] text-amber-700 font-semibold truncate max-w-[130px]">
                          Tempo: {formatJatuhTempoStr(topHari)}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          value={topHari || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setTopHari(isNaN(val) ? 0 : Math.max(1, val));
                          }}
                          placeholder="30"
                          className="w-full text-xs font-bold text-amber-950 bg-amber-50/70 border border-amber-300 rounded-xl px-3 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-amber-600 pointer-events-none">
                          Hari
                        </span>
                      </div>
                    </div>
                  )}

                  <SearchableSelect
                    label="Klasifikasi Customer"
                    icon={<UserCheck className="w-3 h-3 text-emerald-600" />}
                    options={custTypeOptions}
                    value={selectedCustType ? String(selectedCustType.id_cust_type) : ''}
                    onChange={(val) => handleCustTypeChange(val)}
                    searchable={false}
                  />
                </div>

                {/* Keterangan */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Keterangan
                  </label>
                  <input
                    type="text"
                    placeholder="Catatan..."
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Cart Header if items exist */}
              {cart.length > 0 && (
                <div className="px-4 pt-3 pb-2 flex items-center justify-between text-xs border-b border-slate-100">
                  <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Daftar Belanja ({cart.length} item)</span>
                    <span className="ml-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                      Tersimpan di Cache
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetCart}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
                    title="Kosongkan keranjang belanja"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Kosongkan</span>
                  </button>
                </div>
              )}

              {/* Cart Items List */}
              <div className="p-4 flex-1 min-h-[220px] max-h-[320px] overflow-y-auto space-y-2.5">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-1">
                    <ShoppingCart className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-medium">Keranjang belanja kosong</p>
                    <p className="text-[11px] text-slate-400">Pilih barang dari katalog di sebelah kiri</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex-1 pr-2">
                        <h5 className="font-bold text-slate-800 line-clamp-1">{item.id_bahan}</h5>
                        <p className="text-[11px] text-slate-500">
                          Model: {item.model} | <span className="font-bold text-slate-700">Size: {item.ukuran}</span>
                        </p>
                        <span className="text-[11px] font-semibold text-emerald-700">
                          {formatCurrency(item.harga)} / pcs
                        </span>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center space-x-2 shrink-0">
                        <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            onClick={() => handleUpdateCartQty(item.id, item.qty - 1)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) =>
                              handleUpdateCartQty(item.id, parseInt(e.target.value, 10) || 0)
                            }
                            className="w-10 text-center text-xs font-bold text-slate-800 focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdateCartQty(item.id, item.qty + 1)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-bold text-slate-900 w-16 text-right">
                          {formatCurrency(item.subtotal)}
                        </span>

                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Summary & Checkout Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 rounded-b-2xl">
                <div className="space-y-2 text-xs text-slate-600">
                  {/* Total Subtotal Label: (6 pcs / 0.5 ls) */}
                  <div className="flex justify-between items-center">
                    <span>Total Subtotal ({totalPcs} pcs / {totalLusin} ls)</span>
                    <span className="font-bold text-slate-800">{formatCurrency(totalSubtotal)}</span>
                  </div>

                  {/* Diskon Customer (tampil jika diskonLusinVal > 0) */}
                  {diskonLusinVal > 0 && totalPcs > 0 && (
                    <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                      <div>
                        <span className="font-bold block">Diskon Customer ({selectedCustomerObj?.nama_customer || ''})</span>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          {totalLusin} ls &times; {formatCurrency(diskonLusinVal)}/ls ({formatCurrency(diskonLusinVal / 12)}/pcs)
                        </span>
                      </div>
                      <span className="font-bold text-sm text-emerald-700">- {formatCurrency(totalDiskonCustomer)}</span>
                    </div>
                  )}

                  {/* Diskon Invoice Tambahan (Clean Single Line Layout) */}
                  <div className="pt-1 border-t border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700 shrink-0">Diskon Invoice Tambahan</span>
                      
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {/* Toggle Rp vs % */}
                        <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 border border-slate-300/80">
                          <button
                            type="button"
                            onClick={() => setDiscType('Rp')}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              discType === 'Rp'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Rp
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscType('%')}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              discType === '%'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            %
                          </button>
                        </div>

                        {/* Input Box */}
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={discType === '%' ? 100 : undefined}
                            value={discInvoiceInput || ''}
                            onChange={(e) => setDiscInvoiceInput(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="0"
                            className="w-24 text-right text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>
                    </div>

                    {discType === '%' && discInvoiceInput > 0 && (
                      <div className="flex justify-between text-[10px] text-emerald-700 font-bold">
                        <span>Potongan ({discInvoiceInput}%)</span>
                        <span>- {formatCurrency(discInvoiceCalculated)}</span>
                      </div>
                    )}
                  </div>

                  {/* Grand Total */}
                  <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                    <span>GRAND TOTAL</span>
                    <span className="text-emerald-700 text-base font-black">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={handleOpenDetailSummary}
                  disabled={isSubmitting || cart.length === 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses Checkout...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>PROSES TRANSAKSI (BAYAR)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PRODUCT DETAIL & MULTI-SIZE BATCH SELECTION MODAL (matching Image 2) */}
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedProduct.id_bahan}</h3>
                  <p className="text-xs font-semibold text-blue-600">{selectedProduct.model}</p>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4">
                {/* Thumbnail Preview */}
                {(() => {
                  const modalImgUrl = selectedProduct
                    ? getProductImageUrl(selectedProduct.id_bahan, selectedProduct.model, selectedProduct.image)
                    : '';
                  return modalImgUrl ? (
                    <div
                      onClick={() => {
                        if (modalImgUrl && selectedProduct) {
                          setPreviewImageModal({
                            url: modalImgUrl,
                            title: selectedProduct.id_bahan,
                            model: selectedProduct.model,
                          });
                        }
                      }}
                      className="w-full max-h-48 overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 cursor-zoom-in relative group/modalimg"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={modalImgUrl}
                        alt={selectedProduct?.id_bahan}
                        className="max-h-48 object-contain group-hover/modalimg:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/modalimg:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                        <div className="p-2 bg-white/90 text-slate-800 rounded-xl shadow-md flex items-center space-x-1 text-[11px] font-bold">
                          <ZoomIn className="w-4 h-4 text-emerald-600" />
                          <span>Perbesar Gambar</span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Table of Size Variants with Multi-Size Qty Input (Matching Image 2) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-4 text-center">Stock</th>
                        <th className="py-3 px-4 text-center w-32">Qty Pcs</th>
                        <th className="py-3 px-4 text-right">Price</th>
                        <th className="py-3 px-4 text-right">Total Price</th>
                        <th className="py-3 px-4 text-center">Order Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {selectedProduct.variants.map((v) => {
                        const currentQty = modalQtyDict[v.ukuran] || 0;
                        const percentage = selectedCustType?.percentage || 100;
                        const typeName = selectedCustType?.nm_type || 'Distributor/Grosir';
                        const calcPrice = calculateCustomPrice(v.harga_pcs, percentage, typeName);
                        const rowTotalPrice = currentQty * calcPrice;
                        const isOutOfStock = v.stock <= 0;

                        return (
                          <tr
                            key={v.ukuran}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isOutOfStock ? 'bg-rose-50/30' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-slate-900">{v.ukuran}</td>
                            <td className="py-3 px-4 text-center font-bold text-slate-600">
                              {v.stock}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateModalQty(v.ukuran, v.stock, currentQty - 1)
                                  }
                                  disabled={currentQty <= 0 || isOutOfStock}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-xs disabled:opacity-40"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={v.stock}
                                  value={currentQty}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    handleUpdateModalQty(v.ukuran, v.stock, val);
                                  }}
                                  disabled={isOutOfStock}
                                  className="w-14 text-center text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateModalQty(v.ukuran, v.stock, currentQty + 1)
                                  }
                                  disabled={currentQty >= v.stock || isOutOfStock}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-xs disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-800">
                              {formatCurrency(calcPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-700">
                              {formatCurrency(rowTotalPrice)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                Normal
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}
              </div>

              {/* Modal Footer Summary Bar (Matching Image 2) */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5 text-xs">
                  <span className="block text-slate-500 font-semibold">
                    Total Qty: <strong className="text-slate-900">{modalSummary.totalQty} pcs</strong>
                  </span>
                  <span className="block text-slate-500 font-semibold">
                    Total Price: <strong className="text-emerald-700 font-extrabold text-sm">{formatCurrency(modalSummary.totalPrice)}</strong>
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={handleAddMultipleToCart}
                    disabled={modalSummary.totalQty === 0}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah ke Cart</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHECKOUT SUCCESS MODAL */}
        {checkoutSuccessTxId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Transaksi POS Berhasil!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  No. Invoice Transaksi: <strong className="text-slate-800">{checkoutSuccessTxId}</strong>
                </p>
                {checkoutSuccessIsHutang && (
                  <p className="text-xs font-semibold text-rose-600 mt-1">
                    Metode Pembayaran: HUTANG (Tempo)
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutSuccessTxId(null);
                    setCheckoutSuccessIsHutang(false);
                    clearActiveDraft();
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Transaksi Baru
                </button>
                <a
                  href={`/print/invoice?id_transaksi=${encodeURIComponent(checkoutSuccessTxId)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setCheckoutSuccessTxId(null);
                    setCheckoutSuccessIsHutang(false);
                    clearActiveDraft();
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{checkoutSuccessIsHutang ? 'Create Invoice' : 'Cetak Struk Transaksi'}</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* EDIT CUSTOMER MODAL (Matching Image 2) */}
        {isEditCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-900">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold">Ubah Data Customer</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditCustomerModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveCustomerSubmit} className="p-6 space-y-4">
                {/* Row 1: ID Customer & Diskon / Lusin */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ID Customer
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={editCustomerForm.id_customer}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 cursor-not-allowed focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Diskon / Lusin
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editCustomerForm.diskon_lusin}
                      onChange={(e) =>
                        setEditCustomerForm((prev) => ({
                          ...prev,
                          diskon_lusin: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0.00"
                      className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Row 2: Nama Customer * */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Customer <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerForm.nama_customer}
                    onChange={(e) =>
                      setEditCustomerForm((prev) => ({
                        ...prev,
                        nama_customer: e.target.value,
                      }))
                    }
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Row 3: Kota & No. Telepon */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kota
                    </label>
                    <input
                      type="text"
                      value={editCustomerForm.kota}
                      onChange={(e) =>
                        setEditCustomerForm((prev) => ({
                          ...prev,
                          kota: e.target.value,
                        }))
                      }
                      placeholder="Jakarta"
                      className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      No. Telepon
                    </label>
                    <input
                      type="text"
                      value={editCustomerForm.no_telp}
                      onChange={(e) =>
                        setEditCustomerForm((prev) => ({
                          ...prev,
                          no_telp: e.target.value,
                        }))
                      }
                      placeholder="0812xxxxxxxx"
                      className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Row 4: Alamat Lengkap */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Lengkap
                  </label>
                  <textarea
                    rows={3}
                    value={editCustomerForm.alamat_lengkap}
                    onChange={(e) =>
                      setEditCustomerForm((prev) => ({
                        ...prev,
                        alamat_lengkap: e.target.value,
                      }))
                    }
                    placeholder="Masukkan Alamat Lengkap"
                    className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Row 5: Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editCustomerForm.email}
                    onChange={(e) =>
                      setEditCustomerForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="email@example.com"
                    className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Modal Footer Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsEditCustomerModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCustomer}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    {isSavingCustomer ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Simpan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 1. DETAIL RINGKASAN TRANSAKSI MODAL (Popup Detail Barang) */}
        {isDetailSummaryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Detail Ringkasan Transaksi</h3>
                    <p className="text-xs text-slate-500">Periksa kembali barang & rincian pembayaran sebelum checkout</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailSummaryOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Content */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* Customer & Address Card */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">Customer:</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedCustomerObj?.nama_customer || 'CASH'}</span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      ID: {selectedCustomerId} | {selectedCustType?.nm_type || 'Distributor/Grosir'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Kota & Alamat:</span>
                    <span className="font-semibold text-slate-800 line-clamp-1">
                      {[selectedCustomerObj?.kota, selectedCustomerObj?.alamat_lengkap].filter(Boolean).join(', ') || '-'}
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      No. Telp: {selectedCustomerObj?.no_telp || '-'}
                    </span>
                  </div>
                </div>

                {/* Metode & Pilihan Pembayaran Kemana (Interactive in Popup) */}
                <div className="bg-white rounded-xl p-4 border border-emerald-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 uppercase tracking-wide">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span>Metode &amp; Pilihan Pembayaran</span>
                    </span>
                    {paymentMethod === 'HUTANG' ? (
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 font-extrabold text-[10px] rounded-md border border-rose-300 uppercase">
                        HUTANG (Belum Lunas)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-md border border-emerald-300 uppercase">
                        LUNAS (CASH)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                    {/* 1. Pilih Metode Pembayaran (CASH atau HUTANG) */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Pilih Metode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod('CASH');
                            setSelectedAkun(selectedCashAccount || 'CASH');
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                            paymentMethod === 'CASH'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${paymentMethod === 'CASH' ? 'text-white' : 'text-slate-400'}`} />
                          <span>CASH</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod('HUTANG');
                            setSelectedAkun('HUTANG');
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                            paymentMethod === 'HUTANG'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <AlertCircle className={`w-3.5 h-3.5 ${paymentMethod === 'HUTANG' ? 'text-white' : 'text-slate-400'}`} />
                          <span>HUTANG</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. Pilihan Pembayaran Kemana (BCA, Mandiri, BRI, Kas Tunai) jika CASH, atau Input TOP jika HUTANG */}
                    <div>
                      {paymentMethod === 'CASH' ? (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                            <span>Pembayaran Kemana (Akun)</span>
                          </label>
                          <SearchableSelect
                            options={cashAccountOptions}
                            value={selectedCashAccount}
                            onChange={(val) => {
                              setSelectedCashAccount(val);
                              setSelectedAkun(val);
                            }}
                            searchable={false}
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-rose-800 flex items-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-rose-600" />
                              <span>TOP / Tempo (Hari)</span>
                            </label>
                            <span className="text-[11px] text-rose-700 font-bold truncate max-w-[140px]">
                              Tempo: {formatJatuhTempoStr(topHari)}
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min={1}
                              value={topHari || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setTopHari(isNaN(val) ? 0 : Math.max(1, val));
                              }}
                              placeholder="30"
                              className="w-full text-xs font-bold text-rose-950 bg-rose-50/70 border border-rose-300 rounded-xl px-3 py-2 pr-14 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                            />
                            <span className="absolute right-3 top-2 text-xs font-bold text-rose-600 pointer-events-none">
                              Hari
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Purchased Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Daftar Barang yang Dibeli ({cart.length} Jenis Produk)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5 text-center w-12">No</th>
                          <th className="px-4 py-2.5">Nama Barang (Full & Size)</th>
                          <th className="px-4 py-2.5 text-center">Qty</th>
                          <th className="px-4 py-2.5 text-right">Harga Satuan</th>
                          <th className="px-4 py-2.5 text-right">Total Harga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cart.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              <span>{item.id_bahan} {item.model}</span>
                              <span className="inline-block ml-2 px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                                {item.ukuran}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-slate-800">{item.qty} pcs</span>
                              <span className="text-slate-400 text-[11px] block">({(item.qty / 12).toFixed(2)} ls)</span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600 font-medium">{formatCurrency(item.harga)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Breakdown Box */}
                <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Total Subtotal ({totalPcs} pcs / {totalLusin} ls)</span>
                    <span className="font-bold text-slate-900">{formatCurrency(totalSubtotal)}</span>
                  </div>

                  {diskonLusinVal > 0 && totalPcs > 0 && (
                    <div className="flex justify-between items-center text-emerald-800 font-medium">
                      <span>Diskon Customer ({selectedCustomerObj?.nama_customer || ''})</span>
                      <span className="font-bold text-emerald-700">- {formatCurrency(totalDiskonCustomer)}</span>
                    </div>
                  )}

                  {discInvoiceCalculated > 0 && (
                    <div className="flex justify-between items-center text-emerald-800 font-medium">
                      <span>Diskon Invoice Tambahan ({discType === '%' ? `${discInvoiceInput}%` : 'Nominal'})</span>
                      <span className="font-bold text-emerald-700">- {formatCurrency(discInvoiceCalculated)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-emerald-200/80 flex justify-between items-center">
                    <span className="font-extrabold text-slate-900 text-sm uppercase">GRAND TOTAL</span>
                    <span className="font-black text-emerald-700 text-lg">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProformaPreviewOpen(true)}
                  className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Proforma Invoice</span>
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsDetailSummaryOpen(false)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToPendingCart}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Tambah ke Cart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit (Proses Bayar)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. PROFORMA INVOICE OVERLAY PREVIEW (matching invoice_preview.blade.php) */}
        {isProformaPreviewOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 p-4 sm:p-8 flex justify-center items-start animate-in fade-in duration-150">
            <div className="w-[210mm] max-w-full bg-white p-[15mm] shadow-2xl rounded-sm text-slate-900 font-sans my-4">
              {/* Printable Wrapper */}
              <div id="proforma-printable" className="w-[180mm] max-w-full mx-auto bg-white text-slate-900 text-[12.5px] leading-normal font-['Poppins',sans-serif]">
                {/* HEADER */}
                <div className="grid grid-cols-[185px_1fr_285px] gap-6 items-start mt-3 mb-6">
                  <div className="logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/hayami.png" alt="Hayami Logo" className="w-[125px] block mt-1" />
                    <small className="block mt-3.5 tracking-[2px] text-[#666] font-bold text-[9px] whitespace-nowrap">WEAR · GROW · PLAY</small>
                  </div>

                  <div className="address leading-relaxed text-[13px]">
                    <span className="date block font-bold text-[15px] mb-1">
                      Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    Kepada Yth.<br />
                    <span className="customer font-medium">{selectedCustomerObj?.nama_customer || 'CASH'}</span><br />
                    <span>{[selectedCustomerObj?.alamat_lengkap, selectedCustomerObj?.kota].filter(Boolean).join(', ') || '-'}</span>
                  </div>

                  <div className="invoice-info text-right leading-relaxed text-[13px]">
                    <h2 className="text-[19px] font-bold m-0 mb-1.5 text-slate-900">
                      Quotation
                    </h2>
                    Invoice No: PREVIEW INVOICE<br />
                    Tanggal Jatuh Tempo: {paymentMethod === 'HUTANG' ? formatJatuhTempoStr(topHari) : '-'}<br />
                    TOP: {paymentMethod === 'HUTANG' ? `${topHari} Hari` : '-'}
                  </div>
                </div>

                {/* TABLE */}
                <table className="w-full border-collapse border border-slate-900 text-[13px] my-2">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-900 p-2 text-center w-[8%] font-bold">No</th>
                      <th className="border border-slate-900 p-2 text-left w-[38%] font-bold">Description</th>
                      <th className="border border-slate-900 p-2 text-center w-[12%] font-bold">Qty</th>
                      <th className="border border-slate-900 p-2 text-center w-[12%] font-bold">Qty LS</th>
                      <th className="border border-slate-900 p-2 text-right w-[15%] font-bold">Unit Price</th>
                      <th className="border border-slate-900 p-2 text-right w-[15%] font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-900 p-2">{item.id_bahan} {item.model} ({item.ukuran})</td>
                        <td className="border border-slate-900 p-2 text-center">{item.qty} PCS</td>
                        <td className="border border-slate-900 p-2 text-center">{(item.qty / 12).toFixed(2)}</td>
                        <td className="border border-slate-900 p-2 text-right">{new Intl.NumberFormat('id-ID').format(item.harga)}</td>
                        <td className="border border-slate-900 p-2 text-right">{new Intl.NumberFormat('id-ID').format(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* SUMMARY AREA */}
                <div className="grid grid-cols-[1fr_280px] gap-3 mt-4 items-start text-[14px]">
                  <div className="note text-[11.5px] leading-relaxed">
                    <strong className="text-[14px] font-bold block">Total PCS : {totalPcs} PCS</strong>
                    <strong className="text-[14px] font-bold block">Total Lusin : {totalLusin}</strong>
                    <span className="text-slate-600 block mt-1">NB: Barang yang sudah dibeli tidak dapat dikembalikan / ditukar.<br />Terima kasih.</span>
                  </div>

                  <div className="totals text-right space-y-2">
                    {(totalDiskonCustomer > 0 || discInvoiceCalculated > 0) && (
                      <>
                        <div className="grid grid-cols-[1fr_120px] items-baseline">
                          <div className="text-right pr-2">Subtotal</div>
                          <div className="font-bold text-right">{new Intl.NumberFormat('id-ID').format(totalSubtotal)}</div>
                        </div>
                        <div className="grid grid-cols-[1fr_120px] items-baseline">
                          <div className="text-right pr-2">Diskon</div>
                          <div className="font-bold text-right">{new Intl.NumberFormat('id-ID').format(totalDiskonCustomer + discInvoiceCalculated)}</div>
                        </div>
                      </>
                    )}

                    <div className="border-t border-slate-300 my-2 pt-2"></div>

                    <div className="grid grid-cols-[1fr_120px] items-baseline font-bold text-[16px]">
                      <div className="text-right pr-2 text-[14px]">Grand Total</div>
                      <div className="text-right">{new Intl.NumberFormat('id-ID').format(grandTotal)}</div>
                    </div>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="mt-12 flex justify-between text-[13px]">
                  <div className="w-[47%]">
                    Tanda terima,
                    <div className="border-t border-slate-900 w-[50mm] mt-14 pt-2 font-bold">
                      {selectedCustomerObj?.nama_customer || 'CASH'}
                    </div>
                  </div>

                  <div className="w-[47%] text-right">
                    Hormat kami,
                    <div className="border-t border-slate-900 w-[50mm] mt-14 pt-2 font-bold ml-auto">
                      Hayami
                    </div>
                  </div>
                </div>

                {/* BOTTOM BRAND */}
                <div className="mt-9 pt-4 border-t border-dashed border-slate-300 text-center text-[14px] tracking-[3px] text-slate-400 font-bold">
                  HAYAMI — WEAR · GROW · PLAY
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handlePrintProforma}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsProformaPreviewOpen(false)}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintProforma}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Invoice</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. KONFIRMASI CHECKOUT POPUP */}
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Konfirmasi Transaksi</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Apakah Anda yakin ingin memproses transaksi ini?
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-left space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-800">{selectedCustomerObj?.nama_customer || 'CASH'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Pembayaran:</span>
                  <span className="font-bold">
                    {paymentMethod === 'HUTANG' ? (
                      <span className="text-rose-600 font-extrabold">HUTANG (Tempo {topHari} Hari)</span>
                    ) : (
                      <span className="text-emerald-700">CASH ({selectedCashAccount})</span>
                    )}
                  </span>
                </div>
                {paymentMethod === 'HUTANG' && (
                  <div className="flex justify-between text-rose-600">
                    <span>Jatuh Tempo:</span>
                    <span className="font-bold">{formatJatuhTempoStr(topHari)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Items:</span>
                  <span className="font-bold text-slate-800">{totalPcs} pcs ({totalLusin} ls)</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 mt-1 text-sm">
                  <span className="font-bold text-slate-900">Total Tagihan:</span>
                  <span className="font-black text-emerald-700">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="w-1/2 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    setIsConfirmModalOpen(false);
                    setIsDetailSummaryOpen(false);
                    await handleCheckout();
                  }}
                  className="w-1/2 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Ya, Proses Transaksi</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 4. MODAL LIST TRANSAKSI CART PENDING */}
        {isPendingCartsModalOpen && (() => {
          const lcSearch = pendingCartSearch.toLowerCase().trim();
          const filteredCarts = lcSearch
            ? pendingCarts.filter(
                (item) =>
                  item.customerName.toLowerCase().includes(lcSearch) ||
                  item.customerId.toLowerCase().includes(lcSearch)
              )
            : pendingCarts;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 bg-amber-50/70 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">Daftar Transaksi Cart (Pending)</h3>
                      <p className="text-xs text-slate-500">
                        {pendingCarts.length} cart tersimpan
                        {lcSearch && ` · ${filteredCarts.length} hasil`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPendingCartsModalOpen(false);
                      setPendingCartSearch('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Bar */}
                {pendingCarts.length > 0 && (
                  <div className="px-6 pt-4 pb-0 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Cari nama atau ID customer..."
                        value={pendingCartSearch}
                        onChange={(e) => setPendingCartSearch(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 placeholder:text-slate-400 transition-all"
                        autoFocus
                      />
                      {pendingCartSearch && (
                        <button
                          type="button"
                          onClick={() => setPendingCartSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-4">
                  {pendingCarts.length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-600">Belum ada transaksi di Cart Pending</p>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        Gunakan tombol &quot;Tambah ke Cart&quot; pada detail transaksi untuk menyimpan draft sementara tanpa mengurangi stok.
                      </p>
                    </div>
                  ) : filteredCarts.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                        <Search className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-600">Tidak ditemukan untuk &quot;{pendingCartSearch}&quot;</p>
                      <p className="text-xs text-slate-400">Coba kata kunci lain atau hapus filter pencarian.</p>
                    </div>
                  ) : (
                    filteredCarts.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-4 shadow-xs transition-all space-y-3"
                      >
                        {/* Top Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                          <div>
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{item.customerName}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                                ID: {item.customerId}
                              </span>
                              {item.paymentMethod === 'HUTANG' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md border border-rose-200">
                                  HUTANG
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Disimpan pada: {item.timestamp}
                            </span>
                          </div>

                          <div className="text-left sm:text-right shrink-0">
                            <span className="text-xs text-slate-500 block">Total Transaksi:</span>
                            <span className="font-black text-emerald-700 text-base">{formatCurrency(item.grandTotal)}</span>
                          </div>
                        </div>

                        {/* Item Preview Pills */}
                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-1 text-xs">
                          <span className="text-[11px] font-bold text-slate-500 block mb-1">
                            Ringkasan Barang ({item.totalPcs} pcs / {item.totalLusin} ls):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.cart.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center px-2 py-1 bg-white text-slate-700 font-medium text-[11px] rounded-lg border border-slate-200"
                              >
                                {c.id_bahan} {c.model} ({c.ukuran}) &times; {c.qty} pcs
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action Row */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => handleDeletePendingCart(item.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus Cart</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRestorePendingCart(item)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Lanjutkan Transaksi</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/90 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPendingCartsModalOpen(false);
                      setPendingCartSearch('');
                    }}
                    className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        {/* 5. POPUP PERBESAR GAMBAR & DOWNLOAD (IMAGE LIGHTBOX) */}
        {previewImageModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setPreviewImageModal(null)}
          >
            <div
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{previewImageModal.title}</h3>
                  <p className="text-xs font-semibold text-blue-600">{previewImageModal.model}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadImage(
                        previewImageModal.url,
                        `${previewImageModal.title}_${previewImageModal.model}.jpg`
                      )
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Gambar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewImageModal(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Image Preview Area */}
              <div className="p-4 bg-slate-900 flex-1 flex items-center justify-center overflow-hidden min-h-[350px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImageModal.url}
                  alt={`${previewImageModal.title} ${previewImageModal.model}`}
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
                />
              </div>

              {/* Footer info bar */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
                <span>Klik tombol &quot;Download Gambar&quot; untuk menyimpan gambar ke perangkat Anda.</span>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(null)}
                  className="px-4 py-1.5 font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
