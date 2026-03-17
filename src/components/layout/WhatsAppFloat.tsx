"use client";

const WHATSAPP_NUMBER = "5541989015752";
const WHATSAPP_TEXT =
  "Oi! Vim pelo site da Papelaria Felicio e queria ajuda com meu pedido.";

const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_TEXT,
)}`;

export default function WhatsAppFloat() {
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-4 right-4 z-[90] inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-[#25D366] text-white shadow-[0_18px_34px_rgba(37,211,102,0.35)] transition hover:scale-[1.02] hover:brightness-105 sm:bottom-5 sm:right-5"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0"
        aria-hidden="true"
      >
        <path
          d="M12 3.25A8.74 8.74 0 0 0 4.5 16.1L3.25 20.75l4.78-1.2A8.75 8.75 0 1 0 12 3.25Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.2 8.9c.15-.33.3-.34.44-.35h.38c.12 0 .3.04.45.38.16.34.55 1.33.6 1.43.05.1.09.23.02.37-.07.14-.1.22-.2.33-.1.11-.2.24-.28.32-.1.1-.2.2-.08.4.1.2.47.77 1.02 1.25.7.62 1.28.81 1.46.9.18.1.29.08.4-.05.11-.12.46-.54.58-.73.12-.18.25-.15.42-.09.18.06 1.12.53 1.31.63.19.09.31.13.35.21.05.08.05.5-.12.97-.17.47-.95.92-1.3.98-.35.06-.8.09-2.58-.7-2.14-.95-3.52-3.3-3.63-3.45-.11-.15-.87-1.15-.87-2.2 0-1.05.56-1.56.76-1.78Z"
          fill="currentColor"
        />
      </svg>
    </a>
  );
}
