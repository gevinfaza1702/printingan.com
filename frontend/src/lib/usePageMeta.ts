// frontend/src/lib/usePageMeta.ts
import { useEffect } from "react";
import brandLogo from "@/src/assets/brand-logo.png";

type Opts = {
  title?: string;
  brand?: string; // kosongkan utk tanpa suffix
  separator?: string; // default " | "
  faviconHref?: string;
};

export default function usePageMeta(opts: Opts = {}) {
  const {
    title,
    brand = "Invoice Management System", // default brand
    separator = " | ",
    faviconHref = brandLogo,
  } = opts;

  useEffect(() => {
    // Rakit title hanya dari bagian yang ada (biar gak ada " | " nyangkut)
    const parts = [title, brand].filter(Boolean) as string[];
    document.title = parts.join(separator);

    let link =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ||
      document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = faviconHref;
    if (!link.parentNode) document.head.appendChild(link);
  }, [title, brand, separator, faviconHref]);
}
