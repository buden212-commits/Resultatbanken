import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ANMALAN_COOKIE = "anmalan_session";

/** Dev default — override with ANMALAN_PASSWORD when ready for production. */
const DEFAULT_PASSWORD = "KollPåAnmälan";

function getPassword(): string {
  return process.env.ANMALAN_PASSWORD?.trim() || DEFAULT_PASSWORD;
}

export function createAnmalanToken(): string {
  return createHmac("sha256", getPassword()).update("resultatbanken-anmalan").digest("hex");
}

export function verifyAnmalanToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = createAnmalanToken();
  try {
    const a = Buffer.from(token, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isAnmalanAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAnmalanToken(cookieStore.get(ANMALAN_COOKIE)?.value);
}

export function verifyAnmalanPassword(password: string): boolean {
  const expected = getPassword();
  try {
    const a = Buffer.from(password, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
