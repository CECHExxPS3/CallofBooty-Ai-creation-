// Cryptographic security helpers for admin validation without plaintext credentials

export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 Hash of Master Admin Username and Password (No plaintext in codebase)
const MASTER_USER_HASH = "e58f87c992e9c0cf18b8bf376cba3c35c3b2e76dc588ea326179292384807764";
const MASTER_PASS_HASH = "de429b81585f02a7913fa49732c2f73d92828c20e8bb2698976526d26a1bdcfd";

export async function isMasterAdminUsername(username: string): Promise<boolean> {
  if (!username) return false;
  const hash = await sha256(username.trim().toLowerCase());
  return hash === MASTER_USER_HASH;
}

export async function verifyMasterAdminCredentials(username: string, password: string): Promise<boolean> {
  if (!username || !password) return false;
  const uHash = await sha256(username.trim().toLowerCase());
  const pHash = await sha256(password);
  return uHash === MASTER_USER_HASH && pHash === MASTER_PASS_HASH;
}
