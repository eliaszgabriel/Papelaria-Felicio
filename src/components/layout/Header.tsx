"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import MiniCart from "@/components/cart/MiniCart";
import { useCart } from "@/components/cart/CartContext";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/authEvents";
import { apiMe, type MeUser } from "@/lib/clientAuth";
import { WISHLIST_UPDATED_EVENT } from "@/lib/wishlistEvents";
import Icon from "../ui/Icon";
import Container from "./Container";

const WISHLIST_KEY = "pf_wishlist";

const navItems = [
  {
    label: "Inicio",
    href: "/",
    isActive: (pathname: string) => pathname === "/",
  },
  {
    label: "Ofertas",
    href: "/produtos?sort=new&deal=1&page=1",
    isActive: (pathname: string, params: URLSearchParams) =>
      pathname === "/produtos" && params.get("deal") === "1",
  },
  {
    label: "Produtos",
    href: "/produtos",
    isActive: (pathname: string, params: URLSearchParams) =>
      pathname === "/produtos" &&
      !params.get("category") &&
      !params.get("deal") &&
      !params.get("featured") &&
      !params.get("q"),
  },
  {
    label: "Presentes",
    href: "/produtos?category=presentes",
    isActive: (pathname: string, params: URLSearchParams) =>
      pathname === "/produtos" && params.get("category") === "presentes",
  },
  {
    label: "Minha conta",
    href: "/conta",
    isActive: (pathname: string) => pathname.startsWith("/conta"),
  },
];

const mobileMenuItems = [
  {
    label: "Minha conta",
    href: "/conta",
    isActive: (pathname: string) => pathname.startsWith("/conta"),
  },
  {
    label: "Favoritos",
    href: "/conta?tab=wishlist",
    isActive: (pathname: string, params: URLSearchParams) =>
      pathname.startsWith("/conta") && params.get("tab") === "wishlist",
  },
  ...navItems.filter((item) => item.href !== "/conta"),
];

function subscribeToLocationSearch(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const notify = () => onStoreChange();
  const historyRef = window.history as History & {
    __pfHeaderPatched?: boolean;
  };

  if (!historyRef.__pfHeaderPatched) {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function pushState(...args) {
      const result = originalPushState(...args);
      window.dispatchEvent(new Event("pf:locationchange"));
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState(...args);
      window.dispatchEvent(new Event("pf:locationchange"));
      return result;
    };

    historyRef.__pfHeaderPatched = true;
  }

  window.addEventListener("popstate", notify);
  window.addEventListener("pf:locationchange", notify);

  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("pf:locationchange", notify);
  };
}

function getLocationSearchSnapshot() {
  if (typeof window === "undefined") return "";
  return window.location.search || "";
}

type SharedHeaderProps = {
  pathname: string;
  searchParams: URLSearchParams;
  hydrated: boolean;
  cartCount: number;
  wishlistCount: number;
  wishlistPulse: boolean;
  badgeClass: string;
  accountUser: MeUser | null;
  firstName: string;
};

type MobileHeaderProps = SharedHeaderProps & {
  currentSearch: string;
  mobileMenuOpen: boolean;
  mobileSearchOpen: boolean;
  mobileCartOpen: boolean;
  mobileMenuPanelRef: React.RefObject<HTMLDivElement | null>;
  mobileSearchPanelRef: React.RefObject<HTMLDivElement | null>;
  mobileCartPanelRef: React.RefObject<HTMLDivElement | null>;
  cartItems: ReturnType<typeof useCart>["items"];
  cartSubtotal: number;
  clearCart: () => void;
  removeCartItem: (id: string) => void;
  setCartQty: (id: string, qty: number) => void;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function getLocalWishlistCount() {
  if (typeof window === "undefined") return 0;

  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.length : 0;
  } catch {
    return 0;
  }
}

function getFirstName(name?: string | null) {
  if (!name) return "cliente";
  return name.trim().split(/\s+/)[0] || "cliente";
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function MobileHeader({
  pathname,
  searchParams,
  hydrated,
  cartCount,
  badgeClass,
  currentSearch,
  mobileMenuOpen,
  mobileSearchOpen,
  mobileCartOpen,
  mobileMenuPanelRef,
  mobileSearchPanelRef,
  mobileCartPanelRef,
  cartItems,
  cartSubtotal,
  clearCart,
  removeCartItem,
  setCartQty,
  setMobileMenuOpen,
  setMobileSearchOpen,
  setMobileCartOpen,
}: MobileHeaderProps) {
  const isCartEmpty = cartItems.length === 0;

  return (
    <div className="lg:hidden">
      <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-2 py-2.5">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((current) => !current)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/90 text-felicio-ink/80 shadow-soft transition hover:bg-white"
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="stroke-current"
            >
              <path d="M6 6l12 12" strokeWidth="2" strokeLinecap="round" />
              <path d="M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="stroke-current"
            >
              <path d="M4 7h16" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 12h16" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 17h16" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        <Link
          href="/"
          className="inline-flex items-center justify-center"
          aria-label="Voltar para a home"
        >
          <Image
            src="/logo.svg"
            alt="Papelaria Felicio"
            width={392}
            height={196}
            className="h-[2.85rem] w-auto scale-210 select-none"
            priority
            unoptimized
          />
        </Link>

        <div className="min-w-0" />

        <button
          type="button"
          onClick={() => setMobileSearchOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/90 text-felicio-ink/80 shadow-soft transition hover:bg-white"
          aria-label="Abrir busca"
        >
          <Icon name="search" />
        </button>

        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/90 text-felicio-ink/80 shadow-soft transition hover:bg-white"
          aria-label="Abrir carrinho"
        >
          <Icon name="cart" />
          {hydrated && cartCount > 0 && (
            <span className={badgeClass}>
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-felicio-ink/20 backdrop-blur-[2px]"
            aria-label="Fechar menu"
          />

          <div
            ref={mobileMenuPanelRef}
            className="absolute left-3 right-3 top-[72px] rounded-[2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,248,250,0.95))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.14)]"
          >
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
              Navegacao
            </div>

            <nav className="grid gap-2">
              {mobileMenuItems.map((item) => {
                const isActive = item.isActive(pathname, searchParams);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={[
                      "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-felicio-pink text-white shadow-soft"
                        : "border border-white/70 bg-white/82 text-felicio-ink/80",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[96] lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(false)}
            className="absolute inset-0 bg-felicio-ink/20 backdrop-blur-[2px]"
            aria-label="Fechar busca"
          />

          <div
            ref={mobileSearchPanelRef}
            className="absolute left-3 right-3 top-[72px] rounded-[2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,248,250,0.95))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.14)]"
          >
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
              Buscar produtos
            </div>

            <form action="/produtos" method="GET" className="grid gap-3">
              <label className="sr-only" htmlFor="mobile-search-panel">
                Buscar produtos
              </label>
              <div className="flex h-12 items-center gap-2 rounded-full border border-white/75 bg-white px-4 shadow-soft">
                <Icon
                  name="search"
                  className="h-[18px] w-[18px] shrink-0 text-felicio-ink/55"
                />
                <input
                  id="mobile-search-panel"
                  name="q"
                  defaultValue={currentSearch}
                  placeholder="O que voce procura?"
                  className="w-full min-w-0 bg-transparent text-sm font-medium text-felicio-ink outline-none placeholder:text-felicio-ink/45"
                />
              </div>

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-extrabold text-white shadow-soft transition hover:bg-zinc-800"
              >
                Buscar
              </button>
            </form>
          </div>
        </div>
      )}

      {mobileCartOpen && (
        <div className="fixed inset-0 z-[97] lg:hidden">
          <button
            type="button"
            onClick={() => setMobileCartOpen(false)}
            className="absolute inset-0 bg-felicio-ink/20 backdrop-blur-[2px]"
            aria-label="Fechar carrinho"
          />

          <div
            ref={mobileCartPanelRef}
            className="absolute inset-x-3 top-[72px] rounded-[2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,248,250,0.96))] shadow-[0_24px_60px_rgba(0,0,0,0.14)]"
          >
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-4">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                  Carrinho
                </div>
                <div className="mt-1 text-sm font-semibold text-felicio-ink">
                  {cartCount === 0
                    ? "Seu carrinho esta vazio"
                    : cartCount === 1
                      ? "1 item no carrinho"
                      : `${cartCount} itens no carrinho`}
                </div>
              </div>

              {!isCartEmpty && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs font-semibold text-felicio-ink/65 underline underline-offset-4"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="max-h-[58vh] overflow-y-auto px-4 py-4">
              {isCartEmpty ? (
                <div className="rounded-2xl border border-white/75 bg-white/80 p-5 shadow-soft">
                  <p className="text-sm text-felicio-ink/75">
                    Escolha algo fofo para colocar aqui.
                  </p>
                  <Link
                    href="/"
                    onClick={() => setMobileCartOpen(false)}
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-felicio-pink/25 bg-white px-4 text-sm font-semibold text-felicio-ink/90 shadow-soft transition hover:bg-felicio-pink/10"
                  >
                    Ver produtos
                  </Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cartItems.map((item) => (
                    <li
                      key={`${item.id}-${item.slug}`}
                      className="rounded-2xl border border-white/75 bg-white/88 p-4 shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/produtos/${item.slug}`}
                            onClick={() => setMobileCartOpen(false)}
                            className="block truncate text-sm font-extrabold text-felicio-ink"
                          >
                            {item.title}
                          </Link>
                          <div className="mt-1 text-sm font-semibold text-felicio-ink/75">
                            {formatBRL(item.price)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="text-xs font-semibold text-felicio-ink/60 underline underline-offset-4"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCartQty(item.id, item.qty - 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white"
                            aria-label="Diminuir"
                          >
                            -
                          </button>
                          <div className="w-6 text-center text-sm font-extrabold text-felicio-ink">
                            {item.qty}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCartQty(item.id, item.qty + 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white"
                            aria-label="Aumentar"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-sm font-extrabold text-felicio-ink">
                          {formatBRL(item.price * item.qty)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!isCartEmpty && (
              <div className="border-t border-black/5 px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-felicio-ink/70">Subtotal</span>
                  <span className="font-extrabold text-felicio-ink">
                    {formatBRL(cartSubtotal)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href="/carrinho"
                    onClick={() => setMobileCartOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-felicio-pink/25 bg-white px-4 text-sm font-semibold text-felicio-ink/90 shadow-soft transition hover:bg-felicio-pink/10"
                  >
                    Ver carrinho
                  </Link>
                  <Link
                    href="/checkout"
                    onClick={() => setMobileCartOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-zinc-800"
                  >
                    Finalizar
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DesktopHeader({
  pathname,
  searchParams,
  hydrated,
  cartCount,
  wishlistCount,
  wishlistPulse,
  badgeClass,
  accountUser,
  firstName,
}: SharedHeaderProps) {
  return (
    <>
      <div className="hidden min-h-[74px] grid-cols-3 items-center lg:grid">
        <div />

        <div className="relative flex items-center justify-center overflow-visible">
          <div className="h-[44px]" />

          <Link
            href="/"
            className="absolute left-1/2 top-[-3.8rem] -translate-x-1/2 cursor-pointer"
            aria-label="Voltar para a home"
          >
            <Image
              src="/logo.svg"
              alt="Papelaria Felicio"
              width={392}
              height={196}
              className="h-[9.4rem] w-auto scale-105 select-none"
              priority
              unoptimized
            />
          </Link>

          <span className="absolute -top-10 left-1/2 hidden -translate-x-[146px] select-none text-xl text-felicio-lilac/70 sm:block">
            *
          </span>
          <span className="absolute -top-3 left-1/2 hidden translate-x-[142px] select-none text-lg text-felicio-mint/70 sm:block">
            *
          </span>
          <span className="absolute -bottom-5 left-1/2 hidden -translate-x-[26px] select-none text-base text-felicio-sun/70 sm:block">
            *
          </span>
        </div>

        <div className="relative z-20 flex items-center justify-end gap-1 sm:gap-4">
          <Link
            href="/produtos"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/70"
            aria-label="Buscar produtos"
          >
            <Icon name="search" />
          </Link>

          <Link
            href="/conta?tab=wishlist"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/70"
            aria-label="Favoritos"
          >
            <Icon name="heart" />
            {hydrated && wishlistCount > 0 && (
              <span
                className={[
                  badgeClass,
                  wishlistPulse
                    ? "animate-[felicio-badge-pop_520ms_ease-out]"
                    : "",
                ].join(" ")}
              >
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            )}
          </Link>

          <Link
            href="/conta"
            className="inline-flex h-10 items-center justify-center gap-1 rounded-full px-2 transition hover:bg-white/70 sm:gap-2 sm:px-2"
            aria-label="Minha conta"
          >
            <Icon name="user" />
            {hydrated && accountUser && (
              <span className="hidden max-w-[90px] truncate text-sm font-semibold text-felicio-ink/80 lg:block">
                Oi, {firstName}
              </span>
            )}
          </Link>

          <MiniCart
            trigger={
              <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/70">
                <Icon name="cart" />
                {hydrated && cartCount > 0 && (
                  <span className={badgeClass}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </div>
            }
          />
        </div>
      </div>

      <div className="relative hidden lg:block">
        <span className="pointer-events-none absolute -top-10 left-12 hidden select-none text-lg text-felicio-lilac/35 md:block">
          *
        </span>
        <span className="pointer-events-none absolute -top-2 left-28 hidden select-none text-sm text-felicio-mint/35 md:block">
          *
        </span>
        <span className="pointer-events-none absolute top-8 left-16 hidden select-none text-sm text-felicio-sun/35 md:block">
          *
        </span>

        <span className="pointer-events-none absolute -top-12 left-1/2 hidden -translate-x-[220px] select-none text-sm text-felicio-lilac/30 md:block">
          *
        </span>
        <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-[40px] select-none text-lg text-felicio-mint/30 md:block">
          *
        </span>
        <span className="pointer-events-none absolute top-6 left-1/2 hidden translate-x-[140px] select-none text-sm text-felicio-sun/30 md:block">
          *
        </span>

        <span className="pointer-events-none absolute -top-10 right-28 hidden select-none text-sm text-felicio-lilac/30 md:block">
          *
        </span>
        <span className="pointer-events-none absolute -top-2 right-14 hidden select-none text-lg text-felicio-mint/30 md:block">
          *
        </span>
        <span className="pointer-events-none absolute top-8 right-24 hidden select-none text-sm text-felicio-sun/30 md:block">
          *
        </span>
      </div>

      <div className="hidden pb-2 pt-1 sm:pt-2 lg:block">
        <div className="mx-auto w-full max-w-4xl">
          <div className="rounded-full border border-white/70 bg-white/58 px-1.5 py-1 shadow-soft sm:px-2">
            <nav className="flex items-center justify-start gap-1 overflow-x-auto sm:justify-between sm:gap-2">
              {navItems.map((item) => {
                const isActive = item.isActive(pathname, searchParams);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "whitespace-nowrap rounded-full px-3 py-1.5 text-[0.82rem] font-semibold transition sm:px-3.5 sm:text-[0.88rem]",
                      isActive
                        ? "bg-felicio-pink text-white shadow-soft"
                        : "text-felicio-ink/80 hover:bg-white/70",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { items, subtotal, removeItem, setQty, clear } = useCart();

  const [wishlistCount, setWishlistCount] = useState(0);
  const [wishlistPulse, setWishlistPulse] = useState(false);
  const [accountUser, setAccountUser] = useState<MeUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const mobileMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileCartPanelRef = useRef<HTMLDivElement | null>(null);

  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const locationSearch = useSyncExternalStore(
    subscribeToLocationSearch,
    getLocationSearchSnapshot,
    () => "",
  );
  const searchParams = useMemo(
    () => new URLSearchParams(locationSearch),
    [locationSearch],
  );

  const cartCount = items.reduce((acc, it) => acc + it.qty, 0);
  const firstName = useMemo(
    () => getFirstName(accountUser?.name),
    [accountUser],
  );
  const currentSearch = searchParams.get("q") ?? "";
  const badgeClass = useMemo(
    () =>
      "absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-felicio-pink px-1 text-[11px] font-extrabold text-white shadow-soft animate-[felicio-badge-pop_420ms_ease-out]",
    [],
  );

  async function refreshAccountState() {
    try {
      const payload = await apiMe();
      setAccountUser(payload?.ok ? payload.user : null);
    } catch {
      setAccountUser(null);
    }
  }

  useEffect(() => {
    let active = true;
    let pulseTimer: ReturnType<typeof setTimeout> | null = null;

    function triggerPulse() {
      setWishlistPulse(true);
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => setWishlistPulse(false), 520);
    }

    async function refreshWishlistCount() {
      try {
        const authRes = await fetch("/api/auth/me", { cache: "no-store" });
        const authData = await authRes.json().catch(() => ({}));

        if (authRes.ok && authData?.user) {
          const wishlistRes = await fetch("/api/account/wishlist", {
            cache: "no-store",
          });
          const wishlistData = await wishlistRes.json().catch(() => ({}));

          if (active && wishlistRes.ok && wishlistData?.ok) {
            setWishlistCount(
              Array.isArray(wishlistData.items) ? wishlistData.items.length : 0,
            );
            return;
          }
        }
      } catch {}

      if (active) {
        setWishlistCount(getLocalWishlistCount());
      }
    }

    function onWishlistUpdated(event: Event) {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        setWishlistCount(detail.count);
      } else {
        void refreshWishlistCount();
      }
      triggerPulse();
    }

    void refreshWishlistCount();
    const accountTimer = window.setTimeout(() => {
      void refreshAccountState();
    }, 0);
    window.addEventListener(
      WISHLIST_UPDATED_EVENT,
      onWishlistUpdated as EventListener,
    );
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, refreshAccountState);

    return () => {
      active = false;
      window.clearTimeout(accountTimer);
      if (pulseTimer) clearTimeout(pulseTimer);
      window.removeEventListener(
        WISHLIST_UPDATED_EVENT,
        onWishlistUpdated as EventListener,
      );
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, refreshAccountState);
    };
  }, []);

  const hasMobilePanelOpen =
    mobileMenuOpen || mobileSearchOpen || mobileCartOpen;

  useEffect(() => {
    if (!hasMobilePanelOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasMobilePanelOpen]);

  useEffect(() => {
    if (!hasMobilePanelOpen) return;

    function closePanels() {
      setMobileMenuOpen(false);
      setMobileSearchOpen(false);
      setMobileCartOpen(false);
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;

      const isInsideMenu =
        mobileMenuOpen && mobileMenuPanelRef.current?.contains(target);
      const isInsideSearch =
        mobileSearchOpen && mobileSearchPanelRef.current?.contains(target);
      const isInsideCart =
        mobileCartOpen && mobileCartPanelRef.current?.contains(target);

      if (isInsideMenu || isInsideSearch || isInsideCart) return;
      closePanels();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closePanels();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [hasMobilePanelOpen, mobileMenuOpen, mobileSearchOpen, mobileCartOpen]);

  const sharedProps: SharedHeaderProps = {
    pathname,
    searchParams,
    hydrated,
    cartCount,
    wishlistCount,
    wishlistPulse,
    badgeClass,
    accountUser,
    firstName,
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-transparent backdrop-blur-md">
      <div className="absolute inset-0 -z-10 bg-white/10" />

      <Container>
        <MobileHeader
          {...sharedProps}
          currentSearch={currentSearch}
          mobileMenuOpen={mobileMenuOpen}
          mobileSearchOpen={mobileSearchOpen}
          mobileCartOpen={mobileCartOpen}
          mobileMenuPanelRef={mobileMenuPanelRef}
          mobileSearchPanelRef={mobileSearchPanelRef}
          mobileCartPanelRef={mobileCartPanelRef}
          cartItems={items}
          cartSubtotal={subtotal}
          clearCart={clear}
          removeCartItem={removeItem}
          setCartQty={setQty}
          setMobileMenuOpen={setMobileMenuOpen}
          setMobileSearchOpen={setMobileSearchOpen}
          setMobileCartOpen={setMobileCartOpen}
        />
        <DesktopHeader {...sharedProps} />
      </Container>
    </header>
  );
}
