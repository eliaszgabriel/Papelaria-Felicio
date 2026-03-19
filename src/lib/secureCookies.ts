type SameSiteMode = "lax" | "strict";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function buildCookieOptions({
  sameSite,
  maxAge,
}: {
  sameSite: SameSiteMode;
  maxAge: number;
}) {
  return {
    httpOnly: true,
    sameSite,
    secure: isProduction(),
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

export function getUserSessionCookieOptions() {
  return buildCookieOptions({
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function getAdminSessionCookieOptions() {
  return buildCookieOptions({
    sameSite: "strict",
    maxAge: 60 * 60 * 8,
  });
}

export function getOrderLookupCookieOptions() {
  return buildCookieOptions({
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function getSiteLockCookieOptions() {
  return buildCookieOptions({
    sameSite: "strict",
    maxAge: 60 * 60 * 12,
  });
}

export function getExpiredCookieOptions(sameSite: SameSiteMode = "lax") {
  return buildCookieOptions({
    sameSite,
    maxAge: 0,
  });
}
