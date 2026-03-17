export function getSiteUrl() {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
