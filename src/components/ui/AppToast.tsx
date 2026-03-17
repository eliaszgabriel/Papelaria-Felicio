"use client";

import { useEffect, useRef } from "react";

export type AppToastState = {
  open: boolean;
  title: string;
  message?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

const toneStyles: Record<NonNullable<AppToastState["tone"]>, string> = {
  default: "border-black/5 bg-white text-felicio-ink",
  success: "border-felicio-mint/25 bg-white text-felicio-ink",
  warning: "border-felicio-sun/25 bg-white text-felicio-ink",
  danger: "border-red-200 bg-white text-felicio-ink",
};

const badgeStyles: Record<NonNullable<AppToastState["tone"]>, string> = {
  default: "bg-felicio-lilac/15 text-felicio-ink/80",
  success: "bg-felicio-mint/18 text-felicio-ink/80",
  warning: "bg-felicio-sun/18 text-felicio-ink/80",
  danger: "bg-red-100 text-red-700",
};

const badgeLabels: Record<NonNullable<AppToastState["tone"]>, string> = {
  default: "Info",
  success: "OK",
  warning: "Aviso",
  danger: "Erro",
};

export default function AppToast({
  toast,
  onClose,
  duration = 2800,
}: {
  toast: AppToastState;
  onClose: () => void;
  duration?: number;
}) {
  const timerRef = useRef<number | null>(null);
  const tone = toast.tone ?? "default";

  useEffect(() => {
    if (!toast.open) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(onClose, duration);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [duration, onClose, toast.open, toast.title, toast.message]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[2147483647] flex items-start justify-center px-4 pt-32">
      <div
        className={[
          "pointer-events-auto w-[360px] max-w-[92vw] rounded-3xl border px-4 py-4",
          "shadow-[0_18px_60px_rgba(0,0,0,0.18)] transition-all duration-200",
          toneStyles[tone],
          toast.open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-[0.98] opacity-0",
        ].join(" ")}
        aria-hidden={!toast.open}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold">{toast.title}</div>
            {toast.message ? (
              <div className="mt-1 whitespace-pre-line text-xs leading-5 text-felicio-ink/70">
                {toast.message}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                badgeStyles[tone],
              ].join(" ")}
            >
              {badgeLabels[tone]}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/5 bg-white/85 px-2.5 py-1 text-[11px] font-bold text-felicio-ink/60 transition hover:text-felicio-ink/85"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
