import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Papelaria Felicio",
    short_name: "Felicio",
    description: "Papelaria bonita, pratica e feita com carinho.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6ecef",
    theme_color: "#f29ab4",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
