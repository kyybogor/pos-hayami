import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { SYSTEM_MENUS } from '@/lib/menu-list';

let tableChecked = false;

/**
 * Ensures the `tb_user_akses` table exists in the database.
 */
export async function ensureUserAksesTable(): Promise<void> {
  if (tableChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tb_user_akses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        menu_key VARCHAR(100) NOT NULL,
        status TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_menu (user_id, menu_key),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tableChecked = true;
  } catch (err) {
    console.warn('ensureUserAksesTable warning:', err);
  }
}

/**
 * Get allowed menus for a given user.
 * - Superadmin always gets all menus.
 * - If user has custom permissions saved, returns allowed menu keys.
 * - If user has never been configured yet, returns ['*'] (default full access except superadmin-only menus).
 */
export async function getUserAllowedMenus(
  userId: string,
  role?: string
): Promise<{ hasCustomAccess: boolean; allowedMenus: string[] }> {
  await ensureUserAksesTable();

  const isSuperAdmin =
    (role || '').toLowerCase() === 'superadmin' || (role || '').toLowerCase() === 'super';

  if (isSuperAdmin) {
    return {
      hasCustomAccess: true,
      allowedMenus: SYSTEM_MENUS.map((m) => m.path),
    };
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT menu_key, status FROM tb_user_akses WHERE user_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      // Default: full access to standard menus (excluding superadmin-only)
      return {
        hasCustomAccess: false,
        allowedMenus: SYSTEM_MENUS.filter((m) => !m.superadminOnly).map((m) => m.path),
      };
    }

    const allowed = rows
      .filter((r) => Number(r.status) === 1)
      .map((r) => r.menu_key);

    return {
      hasCustomAccess: true,
      allowedMenus: allowed,
    };
  } catch (err) {
    console.error('Error in getUserAllowedMenus:', err);
    return {
      hasCustomAccess: false,
      allowedMenus: SYSTEM_MENUS.filter((m) => !m.superadminOnly).map((m) => m.path),
    };
  }
}

/**
 * Save / Update allowed menus for a user.
 */
export async function saveUserAllowedMenus(
  userId: string,
  allowedMenuPaths: string[]
): Promise<void> {
  await ensureUserAksesTable();

  // Normalize allowed set
  const allowedSet = new Set(allowedMenuPaths);

  // We record status for all system menus (excluding superadmin-only unless superadmin)
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete existing
    await connection.query('DELETE FROM tb_user_akses WHERE user_id = ?', [userId]);

    // Insert records
    for (const menu of SYSTEM_MENUS) {
      const isAllowed = allowedSet.has(menu.path) ? 1 : 0;
      await connection.query(
        `INSERT INTO tb_user_akses (user_id, menu_key, status) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [userId, menu.path, isAllowed]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Reset user access to default.
 */
export async function resetUserAllowedMenus(userId: string): Promise<void> {
  await ensureUserAksesTable();
  await pool.query('DELETE FROM tb_user_akses WHERE user_id = ?', [userId]);
}
