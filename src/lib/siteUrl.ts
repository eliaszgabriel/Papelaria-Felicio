export function getSiteUrl() {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function getInternalSiteUrl() {
  const internalSiteUrl =
    process.env.INTERNAL_SITE_URL ||
    process.env.NEXT_PRIVATE_SITE_URL ||
    (process.env.NODE_ENV === "production"
      ? "http://127.0.0.1:3000"
      : process.env.SITE_URL || "http://localhost:3000");

  return internalSiteUrl.replace(/\/+$/, "");
}
