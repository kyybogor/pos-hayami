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
