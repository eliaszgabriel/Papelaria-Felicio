import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { isSiteLockEnabled } from "@/lib/siteLock";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  if (isSiteLockEnabled()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      host: siteUrl,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/debug", "/api/admin"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
