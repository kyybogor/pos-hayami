'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Search, ChevronDown, Check, X, Edit3 } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  icon?: ReactNode;
  disabled?: boolean;
  searchable?: boolean;
  allowCustom?: boolean;
  size?: 'sm' | 'md';
  onEdit?: () => void;
  clearable?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Ketik untuk mencari...',
  label,
  icon,
  disabled = false,
  searchable = true,
  allowCustom = false,
  size = 'md',
  onEdit,
  clearable = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens (if searchable)
  useEffect(() => {
    if (isOpen && searchable) {
      setSearchQuery('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) => {
    if (!searchable) return true;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  });

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const isSmall = size === 'sm';

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[11px] font-bold text-slate-600 flex items-center space-x-1">
            {icon}
            <span>{label}</span>
          </label>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/80 flex items-center space-x-1 cursor-pointer transition-all"
              title="Edit Customer"
            >
              <Edit3 className="w-2.5 h-2.5 text-emerald-600" />
              <span>Edit</span>
            </button>
          )}
        </div>
      )}

      {/* Select Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl transition-all duration-150 hover:border-slate-300 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
          isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''
        } ${isSmall ? 'px-2.5 py-1.5 text-xs font-medium' : 'px-3 py-2 text-xs font-semibold'} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
        }`}
      >
        <span className="truncate text-slate-800 pr-2">
          {selectedOption ? (
            <span className="flex items-center space-x-1.5 truncate">
              <span className="font-bold shrink-0">{selectedOption.label || selectedOption.value}</span>
              {selectedOption.subLabel && (
                <span className="text-slate-500 font-normal text-[11px] truncate">| {selectedOption.subLabel}</span>
              )}
            </span>
          ) : value ? (
            <span className="font-bold text-slate-800 truncate">{value}</span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </span>
        <div className="flex items-center space-x-1 shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-slate-100 transition-colors"
              title="Hapus pilihan"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-emerald-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[260px] sm:min-w-[320px] max-w-[90vw] sm:max-w-md w-max bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search Box - Only rendered if searchable is true */}
          {searchable && (
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/95 sticky top-0 z-10">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-8 pr-7 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto p-1.5 divide-y divide-slate-50 scrollbar-thin scrollbar-thumb-slate-200">
            {allowCustom && searchQuery.trim() && !options.some((o) => o.value.toLowerCase() === searchQuery.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => handleSelect(searchQuery.trim())}
                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold border border-emerald-200 my-1 text-left cursor-pointer transition-colors"
              >
                <span>+ Gunakan &quot;{searchQuery.trim()}&quot; (Baru)</span>
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-slate-400 text-xs font-medium">
                {allowCustom ? 'Tekan opsi di atas untuk memakai nilai baru' : 'Tidak ada data yang cocok'}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 truncate pr-2">
                      <span className={isSelected ? 'text-emerald-700 font-bold shrink-0' : 'font-semibold text-slate-800 shrink-0'}>
                        {opt.label || opt.value}
                      </span>
                      {opt.subLabel && (
                        <span className="text-slate-400 text-[11px] font-normal truncate">
                          | {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
