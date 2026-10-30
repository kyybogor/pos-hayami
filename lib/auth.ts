import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pos_hayami_secret_key_2026_super_secure_jwt'
);

export interface UserSession {
  id_user: string;
  nm_user: string;
  branch: string;
  grup: string;
  group: string;
  id_cabang?: string;
  role?: string;
  tipe?: string;
  jenis_pajak: string;
  by_user_pajak: string;
  allowedMenus?: string[];
  [key: string]: any;
}

export function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

export async function createSessionToken(payload: UserSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}
