import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * Helper to get the branch code directly from user session / tb_user's `grup` column.
 * Uses the exact `grup` value from tb_user (e.g. 'TKA-JATINEGARA-JAKARTA', 'JATINEGARA', 'BANDUNG', etc.)
 * sanitized for safe usage in transaction IDs.
 */
export function getBranchCode(idCabang?: string | null): string {
  if (!idCabang || typeof idCabang !== 'string' || idCabang.trim() === '') {
    return 'DEFAULT';
  }

  // Replace spaces and slashes with hyphens, keep letters, numbers, hyphens, and underscores
  const clean = idCabang
    .trim()
    .toUpperCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '');

  return clean || 'DEFAULT';
}

/**
 * Resolves a branch parameter (either ID or Nama Cabang) into all matching identifiers
 * (both id_cabang string and nama_cabang) to avoid collation mismatch errors in MySQL.
 */
export async function getBranchFilterNames(branchParam: string | null | undefined): Promise<string[]> {
  if (!branchParam || branchParam === 'ALL') return [];
  const trimmed = branchParam.trim();
  if (!trimmed) return [];

  const names = new Set<string>();
  names.add(trimmed);

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang WHERE id_cabang = ? OR nama_cabang = ?',
      [trimmed, trimmed]
    );
    for (const r of rows) {
      if (r.id_cabang !== undefined && r.id_cabang !== null) names.add(String(r.id_cabang));
      if (r.nama_cabang) names.add(String(r.nama_cabang));
    }
  } catch (err) {
    console.error('Error resolving branch names:', err);
  }

  return Array.from(names).filter(Boolean);
}
