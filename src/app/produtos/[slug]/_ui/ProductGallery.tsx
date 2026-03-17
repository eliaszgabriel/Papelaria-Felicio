"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export default function ProductGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const safeImages = useMemo(() => {
    const cleaned = (images || []).filter(Boolean);
    return cleaned.length ? cleaned : ["/logo.png"];
  }, [images]);

  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const activeIndex = Math.min(active, safeImages.length - 1);

  return (
    <>
      <div className="rounded-[2.2rem] border border-white/60 bg-white/50 p-4 shadow-soft backdrop-blur sm:p-5">
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="w-full rounded-[1.9rem] border border-white/60 bg-gradient-to-br from-white/70 via-felicio-pink/10 to-felicio-lilac/10 text-left shadow-[0_24px_60px_rgba(0,0,0,0.06)]"
          aria-label="Abrir imagem maior"
        >
          <div className="flex h-[320px] w-full items-center justify-center sm:h-[360px] lg:h-[390px]">
            <Image
              src={safeImages[activeIndex]}
              alt={title}
              width={900}
              height={900}
              className="h-[280px] w-full object-contain transition-transform duration-300 sm:h-[320px] lg:h-[350px]"
              unoptimized
            />
          </div>
        </button>

        <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1">
          {safeImages.map((src, idx) => {
            const isActive = idx === activeIndex;

            return (
              <button
                key={`${src}-${idx}`}
                onClick={() => setActive(idx)}
                className={[
                  "shrink-0 rounded-2xl border p-1 transition-all",
                  "hover:-translate-y-0.5 hover:shadow-soft",
                  isActive
                    ? "border-felicio-pink bg-white/80 shadow-soft"
                    : "border-white/60 bg-white/60 hover:bg-white/80",
                ].join(" ")}
                aria-label={`Imagem ${idx + 1}`}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-white/70 to-white/40 sm:h-20 sm:w-20">
                  <Image
                    src={src}
                    alt=""
                    width={80}
                    height={80}
                    className="h-12 w-12 object-contain sm:h-16 sm:w-16"
                    unoptimized
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/40 bg-white/95 shadow-[0_30px_120px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoom(false)}
              className="absolute right-4 top-4 rounded-full border border-black/10 bg-white/90 px-3 py-2 text-sm font-semibold text-felicio-ink/70 hover:bg-white"
            >
              Fechar
            </button>

            <div className="p-6">
              <div className="flex h-[75vh] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-white via-felicio-pink/10 to-felicio-lilac/10">
                <Image
                  src={safeImages[activeIndex]}
                  alt={title}
                  width={1400}
                  height={1400}
                  className="max-h-[70vh] w-full object-contain"
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
