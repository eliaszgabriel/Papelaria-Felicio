const SITE_LOCK_COOKIE = "pf_site_lock";
const SITE_LOCK_BYPASS_HEADER = "x-pf-site-lock-bypass";

function getSiteLockSecret() {
  return (
    process.env.SITE_LOCK_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SITE_LOCK_PASSWORD ||
    "pf-site-lock"
  );
}

export function getSiteLockBypassHeaderName() {
  return SITE_LOCK_BYPASS_HEADER;
}

export function getSiteLockBypassHeaderValue() {
  return getSiteLockSecret();
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function isSiteLockEnabled() {
  return process.env.SITE_LOCK_ENABLED === "1";
}

export function getSiteLockCookieName() {
  return SITE_LOCK_COOKIE;
}

export function getSiteLockPassword() {
  return process.env.SITE_LOCK_PASSWORD || "";
}

export async function createSiteLockToken(password: string) {
  return sha256(`pf-site-lock:${password}:${getSiteLockSecret()}`);
}

export async function verifySiteLockToken(token: string | undefined | null) {
  const password = getSiteLockPassword();
  if (!password || !token) return false;
  const expected = await createSiteLockToken(password);
  return token === expected;
}
