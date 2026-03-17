"use client";

import { useState } from "react";

export default function CopyPix({ value }: { value: string }) {
  const [ok, setOk] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        onClick={copy}
        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-felicio-pink to-felicio-lilac px-5 py-3 text-sm font-extrabold text-white shadow-soft transition hover:brightness-105"
      >
        {ok ? "Pix copiado" : "Copiar Pix"}
      </button>

      <span className="text-xs text-felicio-ink/58 sm:self-center">
        Cole no app do banco para pagar.
      </span>
    </div>
  );
}
