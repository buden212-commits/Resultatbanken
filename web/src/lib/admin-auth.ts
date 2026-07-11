import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";

function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

export function createAdminToken(): string | null {
  const password = getAdminPassword();
  if (!password) {
    return null;
  }

  return createHmac("sha256", password).update("resultatbanken-admin").digest("hex");
}

export function verifyAdminToken(token: string | undefined): boolean {
  const expected = createAdminToken();
  if (!expected || !token) {
    return false;
  }

  try {
    const a = Buffer.from(token, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);
}

export function verifyPassword(password: string): boolean {
  const expected = getAdminPassword();
  if (!expected) {
    return false;
  }

  try {
    const a = Buffer.from(password, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isAdminConfigured(): boolean {
  return !!getAdminPassword();
}
