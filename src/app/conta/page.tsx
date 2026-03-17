"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { apiLogin, apiLogout, apiMe, apiRegister } from "@/lib/clientAuth";
import { isValidCPF, maskCPF, maskPhone as maskPhoneBR, maskCEP, onlyDigits } from "@/lib/validators";
import { emitWishlistUpdated } from "@/lib/wishlistEvents";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

type TabKey =
  | "home"
  | "profile"
  | "addresses"
  | "password"
  | "wishlist";

type Address = {
  id: string;
  label?: string | null;
  recipientName?: string | null;
  phone?: string | null;

  zip: string;
  street: string;
  number: string;
  complement?: string | null;
  district?: string | null;
  city: string;
  uf: string;

  isDefault: 0 | 1;
};

type WishlistProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  coverImage?: string | null;
  stock?: number | null;
  active?: 0 | 1;
};

type AccountUser = {
  id?: string | number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  hasPassword?: boolean;
};

type WishlistResponse = {
  ok?: boolean;
  items?: WishlistProduct[];
  contains?: boolean;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const WISHLIST_KEY = "pf_wishlist";

function getWishlistIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function setWishlistIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const nextIds = Array.from(new Set(ids));
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(nextIds));
  emitWishlistUpdated({ count: nextIds.length });
}

function ContaPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<AccountUser | null>(null);

  // auth UI
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [name, setName] = useState("");
  const [resetSending, setResetSending] = useState(false);

  // tabs
  const [tab, setTab] = useState<TabKey>("home");

  // notices
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // profile
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // password
  const [newPassword, setNewPassword] = useState(""); // set-password
  const [currentPassword, setCurrentPassword] = useState("");
  const [changePassword, setChangePassword] = useState("");

  // addresses
  const [addrLoading, setAddrLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrFormOpen, setAddrFormOpen] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrEditingId, setAddrEditingId] = useState<string | null>(null);

  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const [addrLabel, setAddrLabel] = useState("Entrega");
  const [addrRecipient, setAddrRecipient] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [addrComplement, setAddrComplement] = useState("");
  const [addrDistrict, setAddrDistrict] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrUf, setAddrUf] = useState("");
  const [addrDefault, setAddrDefault] = useState(true);

  // ── wishlist state ────────────────────────────────────────────────────
  const [wishlistIds, setWishlistIdsState] = useState<string[]>([]);
  const [wishLoading, setWishLoading] = useState(false);
  const [wishItems, setWishItems] = useState<WishlistProduct[]>([]);

  // ── CPF state (editável) ──────────────────────────────────────────────
  const [profileCpf, setProfileCpf] = useState("");
  const [profileCpfError, setProfileCpfError] = useState<string | null>(null);

  async function refreshMe() {
    const data = await apiMe();
    setMe(data.user);
    setLoading(false);

    if (data?.user) {
      setProfileName(data.user?.name || "");
      setProfilePhone(data.user?.phone ? maskPhoneBR(String(data.user.phone)) : "");
      setProfileCpf(data.user?.cpf ? maskCPF(String(data.user.cpf)) : "");
    }
  }

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const requestedMode = searchParams.get("mode");
    const requestedEmail = searchParams.get("email");

    if (requestedEmail) {
      setEmail(requestedEmail);
    }

    if (requestedMode === "login" || requestedMode === "register") {
      setMode(requestedMode);
    }

    if (!requestedTab) return;

    const validTabs: TabKey[] = [
      "home",
      "profile",
      "addresses",
      "password",
      "wishlist",
    ];

    if (validTabs.includes(requestedTab as TabKey)) {
      setTab(requestedTab as TabKey);
    }
  }, [searchParams]);

  // sync wishlist localStorage → banco ao carregar (se logado)
  useEffect(() => {
    async function syncWishlist() {
      if (!me) return;
      const localIds = getWishlistIds();
      if (!localIds.length) return;
      try {
        const res = await fetch("/api/account/wishlist/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: localIds }),
        });
        
        if (res.ok) {
          // limpa lista guest apenas após sucesso
          setWishlistIds([]);
          
          // se estiver na aba wishlist, recarrega do backend
          if (tab === "wishlist") {
            const wRes = await fetch("/api/account/wishlist", { cache: "no-store" });
            const wData = (await wRes.json().catch(() => ({}))) as WishlistResponse;
            if (wRes.ok && wData?.ok) {
              setWishItems(wData.items || []);
              setWishlistIdsState((wData.items || []).map((item) => String(item.id)));
            }
          }
        }
      } catch {}
    }
    syncWishlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  useEffect(() => {
    refreshMe();
  }, []);

  // quando entrar na aba "addresses", carrega
  useEffect(() => {
    if (!me) return;
    if (tab !== "addresses") return;
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, me?.id]);

  // carrega wishlist: banco (logado) ou localStorage (guest)
  useEffect(() => {
    async function loadWish() {
      if (tab !== "wishlist") return;

      setWishLoading(true);
      try {
        if (me) {
          // busca do banco
          const res = await fetch("/api/account/wishlist", { cache: "no-store" });
          const data = (await res.json().catch(() => ({}))) as WishlistResponse;
          if (res.ok && data?.ok) {
            setWishItems(data.items || []);
            setWishlistIdsState((data.items || []).map((item) => String(item.id)));
          } else {
            setWishItems([]);
          }
        } else {
          // guest: localStorage + /api/wishlist
          const ids = getWishlistIds();
          setWishlistIdsState(ids);
          if (!ids.length) { setWishItems([]); return; }
          const qs = encodeURIComponent(ids.join(","));
          const res = await fetch(`/api/wishlist?ids=${qs}`, { cache: "no-store" });
          const data = (await res.json().catch(() => ({}))) as WishlistResponse;
          if (res.ok && data?.ok) setWishItems(data.items || []);
          else setWishItems([]);
        }
      } catch {
        setWishItems([]);
      } finally {
        setWishLoading(false);
      }
    }
    loadWish();
  }, [tab, me]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const payload =
      mode === "register"
        ? await apiRegister({ email, password: loginPassword, name })
        : await apiLogin({ email, password: loginPassword });

    if (!payload?.ok) {
      setError(payload?.reason || payload?.error || "Erro.");
      return;
    }

    setLoginPassword("");

    if (mode === "register" || payload?.requiresVerification) {
      setMode("login");
      setNotice(
        payload?.emailDeliveryFailed
          ? "Conta criada. O email de verificação não saiu agora, mas você pode reenviar o link abaixo."
          : "Conta criada. Enviamos um link para confirmar seu email antes do primeiro login.",
      );
      return;
    }

    await refreshMe();
    setTab("home");
  }

  async function handleRequestPasswordReset() {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Informe seu email para receber o link de redefinição.");
      return;
    }

    setResetSending(true);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          data?.reason ||
            "Não consegui enviar o email de redefinição agora.",
        );
        return;
      }

      setNotice(
        "Se esse email existir na loja, enviamos um link para redefinir sua senha.",
      );
    } catch {
      setError("Não consegui enviar o email de redefinição agora.");
    } finally {
      setResetSending(false);
    }
  }

  async function handleResendVerificationEmail() {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Informe seu email para reenviar a verificação.");
      return;
    }

    setResetSending(true);
    try {
      const res = await fetch("/api/auth/request-email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          data?.reason || "Não consegui reenviar a verificação agora.",
        );
        return;
      }

      setNotice("Se esse email existir e ainda não estiver confirmado, enviamos um novo link.");
    } catch {
      setError("Não consegui reenviar a verificação agora.");
    } finally {
      setResetSending(false);
    }
  }

  async function onLogout() {
    await apiLogout();
    setEmail("");
    setLoginPassword("");
    setName("");

    setNewPassword("");
    setCurrentPassword("");
    setChangePassword("");

    setProfileName("");
    setProfilePhone("");
    setProfileCpf("");
    setProfileCpfError(null);

    setTab("home");
    setError(null);
    setNotice(null);

    setAddresses([]);
    setAddrFormOpen(false);
    setAddrEditingId(null);

    setWishItems([]);
    setWishlistIdsState([]);

    await refreshMe();
  }

  // ----------------------------
  // PROFILE
  // ----------------------------
  async function saveProfile() {
    setError(null);
    setNotice(null);
    setProfileCpfError(null);

    // validação front de CPF
    if (profileCpf) {
      const digits = profileCpf.replace(/\D/g, "");
      if (digits.length > 0 && digits.length !== 11) {
        setProfileCpfError("CPF deve ter 11 dígitos.");
        return;
      }
      if (digits.length === 11 && !isValidCPF(digits)) {
        setProfileCpfError("CPF inválido.");
        return;
      }
    }

    setProfileSaving(true);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name: profileName,
          phone: onlyDigits(profilePhone),
          cpf: onlyDigits(profileCpf) || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.href = "/conta"; return; }
      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Não consegui salvar seus dados agora.");
        return;
      }

      setNotice("Dados atualizados ✨");
      await refreshMe();
    } catch {
      setError("Erro de rede ao salvar.");
    } finally {
      setProfileSaving(false);
    }
  }

  // ----------------------------
  // PASSWORD
  // ----------------------------
  async function handleSetPassword() {
    setError(null);
    setNotice(null);

    if (!newPassword || newPassword.length < 6) {
      setError("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }

    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json().catch(() => ({}));
    if (!data?.ok) {
      setError(data?.reason || "Erro ao definir senha.");
      return;
    }

    setNewPassword("");
    setNotice("Senha criada com sucesso 💖");
    await refreshMe();
  }

  async function handleChangePassword() {
    setError(null);
    setNotice(null);

    if (!changePassword || changePassword.length < 6) {
      setError("A nova senha precisa ter no mínimo 6 caracteres.");
      return;
    }

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newPassword: changePassword,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!data?.ok) {
      setError(data?.reason || "Erro ao trocar senha.");
      return;
    }

    setCurrentPassword("");
    setChangePassword("");
    setNotice("Senha atualizada ✨");
    await refreshMe();
  }

  // ----------------------------
  // ADDRESSES
  // ----------------------------
  async function loadAddresses() {
    setAddrLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/account/addresses", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/conta";
        return;
      }

      if (!res.ok || !data?.ok) {
        setAddresses([]);
        setError("Não consegui carregar seus endereços.");
        return;
      }

      setAddresses(data.items || []);
    } catch {
      setAddresses([]);
      setError("Erro de rede ao carregar endereços.");
    } finally {
      setAddrLoading(false);
    }
  }

  function resetAddrForm() {
    setAddrEditingId(null);
    setAddrLabel("Entrega");
    setAddrRecipient(me?.name || "");
    setAddrPhone(me?.phone ? maskPhoneBR(String(me.phone)) : "");
    setAddrZip("");
    setAddrStreet("");
    setAddrNumber("");
    setAddrComplement("");
    setAddrDistrict("");
    setAddrCity("");
    setAddrUf("");
    setAddrDefault(true);
    setCepError(null);
  }

  function openCreateAddress() {
    setError(null);
    setNotice(null);
    resetAddrForm();
    setAddrFormOpen(true);
  }

  function openEditAddress(a: Address) {
    setError(null);
    setNotice(null);
    setAddrEditingId(a.id);
    setAddrLabel(a.label || "Entrega");
    setAddrRecipient(a.recipientName || me?.name || "");
    setAddrPhone(maskPhoneBR(a.phone || me?.phone || ""));
    setAddrZip(maskCEP(a.zip || ""));
    setAddrStreet(a.street || "");
    setAddrNumber(a.number || "");
    setAddrComplement(a.complement || "");
    setAddrDistrict(a.district || "");
    setAddrUf((a.uf || "").toUpperCase());
    setAddrCity(a.city || "");
    setAddrDefault(a.isDefault === 1);
    setAddrFormOpen(true);
    setCepError(null);
  }

  async function fetchCep(raw: string) {
    const d = onlyDigits(raw);
    if (d.length !== 8) return;

    setCepLoading(true);
    setCepError(null);

    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json().catch(() => null);

      if (!data || data?.erro) {
        setCepError("CEP não encontrado.");
        return;
      }

      const uf = String(data.uf ?? "").toUpperCase();
      setAddrStreet(data.logradouro ?? "");
      setAddrDistrict(data.bairro ?? "");
      setAddrUf(uf);
      setAddrCity(data.localidade ?? "");
    } catch {
      setCepError("Não consegui buscar o CEP agora.");
    } finally {
      setCepLoading(false);
    }
  }

  // cidades por UF (usa /api/geo/cities que você já criou)
  useEffect(() => {
    async function loadCities() {
      const uf = (addrUf || "").toUpperCase();
      if (!uf) {
        setCities([]);
        return;
      }

      setCitiesLoading(true);
      try {
        const res = await fetch(
          `/api/geo/cities?uf=${encodeURIComponent(uf)}`,
          {
            cache: "force-cache",
          },
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok && Array.isArray(data.cities)) {
          setCities(data.cities);
        } else {
          setCities([]);
        }
      } catch {
        setCities([]);
      } finally {
        setCitiesLoading(false);
      }
    }
    loadCities();
  }, [addrUf]);

  async function saveAddress() {
    setError(null);
    setNotice(null);

    const zip = onlyDigits(addrZip);
    const uf = (addrUf || "").toUpperCase();

    // ✅ validação dura
    if (zip.length !== 8)
      return setError("CEP inválido (precisa ter 8 números).");
    if (!addrStreet.trim()) return setError("Preencha a rua.");
    if (!addrNumber.trim()) return setError("Preencha o número da casa.");
    if (!addrDistrict.trim()) return setError("Preencha o bairro.");
    if (!uf) return setError("Selecione o UF.");
    if (!addrCity.trim()) return setError("Selecione a cidade.");

    setAddrSaving(true);

    try {
      if (!addrEditingId) {
        const res = await fetch("/api/account/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            label: addrLabel,
            recipientName: addrRecipient,
            phone: onlyDigits(addrPhone),
            zip,
            street: addrStreet,
            number: addrNumber,
            complement: addrComplement,
            district: addrDistrict,
            city: addrCity,
            uf,
            isDefault: addrDefault ? 1 : 0,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          window.location.href = "/conta";
          return;
        }
        if (!res.ok || !data?.ok) {
          setError("Não consegui salvar seu endereço.");
          return;
        }
      } else {
        const res = await fetch(
          `/api/account/addresses/${encodeURIComponent(addrEditingId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              label: addrLabel,
              recipientName: addrRecipient,
              phone: onlyDigits(addrPhone),
              zip,
              street: addrStreet,
              number: addrNumber,
              complement: addrComplement,
              district: addrDistrict,
              city: addrCity,
              uf,
            }),
          },
        );

        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          window.location.href = "/conta";
          return;
        }
        if (!res.ok || !data?.ok) {
          setError("Não consegui atualizar seu endereço.");
          return;
        }

        if (addrDefault) await setDefaultAddress(addrEditingId);
      }

      setNotice("Endereço salvo ✨");
      setAddrFormOpen(false);
      await loadAddresses();
    } catch {
      setError("Erro de rede ao salvar endereço.");
    } finally {
      setAddrSaving(false);
    }
  }

  async function setDefaultAddress(id: string) {
    try {
      await fetch(`/api/account/addresses/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ setDefault: true }),
      });
      await loadAddresses();
    } catch {}
  }

  async function deleteAddress(id: string) {
    if (!confirm("Remover este endereço?")) return;
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/account/addresses/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          cache: "no-store",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError("Não consegui remover.");
        return;
      }
      setNotice("Endereço removido.");
      await loadAddresses();
    } catch {
      setError("Erro de rede ao remover.");
    }
  }

  // wishlist: remover item
  async function removeWish(id: string) {
    if (me) {
      try {
        await fetch(`/api/account/wishlist/${encodeURIComponent(id)}`, { method: "DELETE" });
      } catch {}
    } else {
      const ids = getWishlistIds().filter((x) => x !== id);
      setWishlistIds(ids);
      setWishlistIdsState(ids);
    }
    setWishItems((prev) => prev.filter((p) => p.id !== id));
  }

  const heroTitle = useMemo(() => {
    if (me) return "Minha conta";
    return mode === "register" ? "Criar conta" : "Entrar";
  }, [me, mode]);

  const pageBg = "bg-transparent";
  const shellCard =
    "rounded-[26px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.70),rgba(255,255,255,0.52))] shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl";
  const innerCard =
    "rounded-[22px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.64),rgba(255,255,255,0.50))] shadow-[0_12px_30px_rgba(0,0,0,0.05)] backdrop-blur-md";

  const btnAccent =
    "cursor-pointer rounded-2xl px-5 py-3 font-semibold text-white " +
    "bg-[#F3A6B6] hover:bg-[#EC93A6] transition " +
    "shadow-[0_12px_32px_rgba(243,166,182,0.45)] " +
    "hover:-translate-y-[1px] active:translate-y-0 " +
    "focus:outline-none focus:ring-2 focus:ring-[#F3A6B6]/40";

  const btnOutline =
    "cursor-pointer rounded-2xl px-4 py-2 font-semibold text-[#9C3F5B] " +
    "border border-white/60 bg-white/62 " +
    "hover:bg-white/78 transition " +
    "shadow-[0_10px_22px_rgba(0,0,0,0.06)]";

  const navItemBase =
    "w-full cursor-pointer flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-3";
  const navItemOn =
    "border border-white/70 bg-white/78 text-[#1F1F1F] shadow-[0_10px_24px_rgba(0,0,0,0.05)]";
  const navItemOff =
    "border border-transparent text-black/60 hover:bg-white/44 hover:text-black";

  function TabTitle({ children }: { children: ReactNode }) {
    return (
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[#1F1F1F]">{children}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "min-h-[60vh] flex items-center justify-center px-4",
          pageBg,
        )}
      >
        <div className={cn("w-full max-w-lg p-5 sm:p-8", shellCard)}>
          <div className="h-7 w-44 rounded-xl bg-black/5 animate-pulse" />
          <div className="mt-6 space-y-3">
            <div className="h-12 rounded-2xl bg-black/5 animate-pulse" />
            <div className="h-12 rounded-2xl bg-black/5 animate-pulse" />
            <div className="h-12 rounded-2xl bg-black/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative px-4 py-8 sm:py-12", pageBg)}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(#000 0.6px, transparent 0.6px)",
          backgroundSize: "12px 12px",
        }}
      />

      <div className="mx-auto w-full max-w-6xl">
        <div className={cn("relative overflow-hidden", shellCard)}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[#F3A6B6]/60" />
          <div className="pointer-events-none absolute -top-20 -left-24 h-64 w-64 rounded-full bg-rose-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-28 h-72 w-72 rounded-full bg-amber-200/10 blur-3xl" />

          <div className="p-4 sm:p-10">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1F1F1F]">
                  {heroTitle}
                  <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#F3A6B6] align-middle" />
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/60">
                  {me
                    ? "Acesse seus dados, enderecos e preferencias."
                    : "Entre para acompanhar sua conta ou crie uma em segundos."}
                </p>
              </div>

              {me && (
                <button
                  onClick={onLogout}
                  className="cursor-pointer rounded-2xl px-4 py-2 border border-black/10 bg-white/50 hover:bg-[#FFFBF9] transition shadow-[0_10px_24px_rgba(0,0,0,0.06)] text-sm font-semibold text-black/70"
                >
                  Sair
                </button>
              )}
            </div>

            {notice && (
              <div className="mt-6 rounded-2xl border border-emerald-900/10 bg-emerald-50/60 p-4 text-sm text-emerald-800">
                {notice}
              </div>
            )}
            {error && (
              <div className="mt-6 rounded-2xl border border-rose-900/10 bg-rose-50/70 p-4 text-sm text-rose-800">
                {error}
              </div>
            )}

            {me ? (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-10 lg:grid-cols-12 lg:gap-8">
                {/* Sidebar */}
                <aside className="lg:col-span-4">
                  <div className={cn("p-2.5 sm:p-3", innerCard)}>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
                    <button
                      onClick={() => setTab("home")}
                      className={cn(
                        navItemBase,
                        tab === "home" ? navItemOn : navItemOff,
                      )}
                    >
                      <span>Minha conta</span>
                      <span className="text-black/35">›</span>
                    </button>

                    <Link
                      href="/meus-pedidos"
                      className={cn(navItemBase, "sm:mt-1", navItemOff)}
                    >
                      <span>Meus pedidos</span>
                      <span className="text-black/35">↗</span>
                    </Link>

                    <button
                      onClick={() => setTab("wishlist")}
                      className={cn(
                        navItemBase,
                        "sm:mt-1",
                        tab === "wishlist" ? navItemOn : navItemOff,
                      )}
                    >
                      <span>Lista de desejos</span>
                      <span className="text-black/35">›</span>
                    </button>

                    <button
                      onClick={() => setTab("password")}
                      className={cn(
                        navItemBase,
                        "sm:mt-1",
                        tab === "password" ? navItemOn : navItemOff,
                      )}
                    >
                      <span>Alterar senha</span>
                      <span className="text-black/35">›</span>
                    </button>

                    <button
                      onClick={() => setTab("home")}
                      className="hidden"
                    >
                      <span>Vouchers</span>
                      <span className="text-black/35">›</span>
                    </button>

                    <button
                      onClick={() => setTab("profile")}
                      className={cn(
                        navItemBase,
                        "sm:mt-1",
                        tab === "profile" ? navItemOn : navItemOff,
                      )}
                    >
                      <span>Dados pessoais</span>
                      <span className="text-black/35">›</span>
                    </button>

                    <button
                      onClick={() => setTab("addresses")}
                      className={cn(
                        navItemBase,
                        "sm:mt-1",
                        tab === "addresses" ? navItemOn : navItemOff,
                      )}
                    >
                      <span>Endereço de entrega</span>
                      <span className="text-black/35">›</span>
                    </button>

                    </div>

                    <div className="my-3 h-px w-full bg-black/5" />

                    <button
                      onClick={() => setTab("home")}
                      className="hidden"
                    >
                      <span>Privacidade de dados</span>
                      <span className="text-black/35">›</span>
                    </button>

                    <button
                      onClick={() => setTab("home")}
                      className="hidden"
                    >
                      <span>Código de segurança</span>
                      <span className="text-black/35">›</span>
                    </button>

                    <div className="mt-4 rounded-2xl border border-black/5 bg-white/70 p-4 text-xs text-black/60">
                      <div className="font-semibold text-black/70">
                        Logado como
                      </div>
                      <div className="mt-1 break-all">{me.email}</div>
                      <div className="hidden mt-3 rounded-2xl border border-dashed border-black/10 bg-white/80 px-3 py-3 leading-relaxed">
                        Recursos extras como vouchers, privacidade e seguranca ficam planejados para a proxima fase.
                      </div>
                    </div>

                    <button
                      onClick={onLogout}
                      className="mt-3 w-full cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold border border-black/10 bg-white/55 hover:bg-white transition"
                    >
                      Sair
                    </button>
                  </div>
                </aside>

                {/* Content */}
                <section className="lg:col-span-8">
                  <div className={cn("p-7", innerCard)}>
                    {tab === "home" && (
                      <>
                        <TabTitle>Resumo</TabTitle>
                        <div className="mt-3 h-px w-full bg-black/5" />

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="rounded-[22px] border border-black/5 bg-white/65 p-6">
                            <div className="text-sm font-semibold text-[#1F1F1F]">
                              Seus dados
                            </div>
                            <div className="mt-3 text-sm text-black/60">
                              <div className="flex items-start justify-between gap-4">
                                <span>Email</span>
                                <span className="font-medium text-[#1F1F1F] break-all">
                                  {me.email}
                                </span>
                              </div>
                              <div className="mt-2 flex items-start justify-between gap-4">
                                <span>Nome</span>
                                <span className="font-medium text-[#1F1F1F]">
                                  {me.name || "—"}
                                </span>
                              </div>
                              <div className="mt-2 flex items-start justify-between gap-4">
                                <span>Telefone</span>
                                <span className="font-medium text-[#1F1F1F]">
                                  {me.phone
                                    ? maskPhoneBR(String(me.phone))
                                    : "—"}
                                </span>
                              </div>
                              <div className="mt-2 flex items-start justify-between gap-4">
                                <span>CPF</span>
                                <span className="font-medium text-[#1F1F1F]">
                                  {me.cpf ? maskCPF(String(me.cpf)) : "—"}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => setTab("profile")}
                              className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#9C3F5B]"
                            >
                              Editar dados <span>→</span>
                            </button>
                          </div>

                          <div className="rounded-[22px] border border-black/5 bg-white/65 p-6">
                            <div className="text-sm font-semibold text-[#1F1F1F]">
                              Entrega
                            </div>
                            <p className="mt-2 text-xs text-black/60 leading-relaxed">
                              Gerencie seu endereço padrão para o checkout
                              preencher automaticamente.
                            </p>
                            <button
                              onClick={() => setTab("addresses")}
                              className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#9C3F5B]"
                            >
                              Ver endereços <span>→</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Link
                            href="/meus-pedidos"
                            className="cursor-pointer rounded-[22px] border border-black/5 bg-[#FFFCFA] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_42px_rgba(0,0,0,0.08)] transition"
                          >
                            <div className="text-sm font-semibold text-[#1F1F1F]">
                              Meus pedidos
                            </div>
                            <div className="mt-2 text-xs text-black/60">
                              Acompanhe status, rastreio e detalhes.
                            </div>
                            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#9C3F5B]">
                              Abrir <span>→</span>
                            </div>
                          </Link>

                          <a
                            href="mailto:suporte@papelariafelicio.com"
                            className="cursor-pointer rounded-[22px] border border-black/5 bg-[#FFFCFA] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_42px_rgba(0,0,0,0.08)] transition"
                          >
                            <div className="text-sm font-semibold text-[#1F1F1F]">
                              Suporte
                            </div>
                            <div className="mt-2 text-xs text-black/60">
                              Precisa de ajuda? Fale com a gente.
                            </div>
                            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#9C3F5B]">
                              Contatar <span>→</span>
                            </div>
                          </a>
                        </div>
                      </>
                    )}

                    {tab === "profile" && (
                      <>
                        <TabTitle>Dados pessoais</TabTitle>
                        <div className="mt-3 h-px w-full bg-black/5" />

                        <div className="mt-6 grid grid-cols-1 gap-3">
                          <div className="rounded-[22px] border border-black/5 bg-white/65 p-6">
                            <label className="text-xs font-semibold text-black/60 tracking-wide">
                              EMAIL
                            </label>
                            <input
                              value={me.email || ""}
                              readOnly
                              className="mt-3 w-full rounded-2xl border border-black/10 bg-white/60 px-4 py-3 outline-none opacity-90 cursor-not-allowed"
                            />

                            <label className="mt-5 block text-xs font-semibold text-black/60 tracking-wide">
                              CPF
                            </label>
                            <input
                              value={profileCpf}
                              onChange={(e) => {
                                setProfileCpf(maskCPF(e.target.value));
                                setProfileCpfError(null);
                              }}
                              inputMode="numeric"
                              maxLength={14}
                              placeholder="000.000.000-00"
                              className={`mt-3 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 ${profileCpfError ? "border-rose-400 bg-rose-50/50" : "border-black/10 bg-white/80"}`}
                            />
                            {profileCpfError && (
                              <p className="mt-1 text-xs text-rose-600 font-semibold">{profileCpfError}</p>
                            )}

                            <label className="mt-5 block text-xs font-semibold text-black/60 tracking-wide">
                              NOME
                            </label>
                            <input
                              value={profileName}
                              onChange={(e) => setProfileName(e.target.value)}
                              className="mt-3 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                              placeholder="Seu nome"
                            />

                            <label className="mt-5 block text-xs font-semibold text-black/60 tracking-wide">
                              TELEFONE (WhatsApp)
                            </label>
                            <input
                              value={profilePhone}
                              onChange={(e) =>
                                setProfilePhone(maskPhoneBR(e.target.value))
                              }
                              maxLength={15}
                              inputMode="tel"
                              className="mt-3 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                              placeholder="(11) 99999-9999"
                            />

                            <div className="mt-5 flex items-center justify-end gap-2">
                              <button
                                onClick={() => setTab("home")}
                                className={btnOutline}
                              >
                                Voltar
                              </button>
                              <button
                                onClick={saveProfile}
                                disabled={profileSaving}
                                className={cn(
                                  btnAccent,
                                  profileSaving &&
                                    "opacity-60 cursor-not-allowed",
                                )}
                              >
                                {profileSaving ? "Salvando..." : "Salvar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {tab === "wishlist" && (
                      <>
                        <TabTitle>Lista de desejos</TabTitle>
                        <div className="mt-3 h-px w-full bg-black/5" />

                        <div className="mt-6">
                          {wishLoading ? (
                            <div className="text-sm text-black/60">
                              Carregando…
                            </div>
                          ) : wishlistIds.length === 0 ? (
                            <div className="rounded-[22px] border border-black/5 bg-white/65 p-6 text-sm text-black/60">
                              Você ainda não favoritou nenhum produto 💖
                              <div className="mt-3">
                                <Link
                                  href="/"
                                  className="text-[#9C3F5B] font-semibold underline underline-offset-4"
                                >
                                  Ver produtos
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {wishItems.map((p) => (
                                <div
                                  key={p.id}
                                  className="rounded-[22px] border border-black/5 bg-white/65 p-5"
                                >
                                  <div className="flex gap-3">
                                    {p.coverImage ? (
                                      <Image
                                        src={p.coverImage}
                                        alt={p.name}
                                        width={64}
                                        height={64}
                                        className="h-16 w-16 rounded-2xl border border-black/5 object-cover"
                                        unoptimized
                                      />
                                    ) : (
                                      <div className="h-16 w-16 rounded-2xl bg-black/5 border border-black/5" />
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-semibold text-[#1F1F1F] truncate">
                                        {p.name}
                                      </div>
                                      <div className="mt-1 text-xs text-black/55 truncate">
                                        /{p.slug}
                                      </div>
                                      <div className="mt-2 text-sm font-extrabold text-[#1F1F1F]">
                                        {formatBRL(Number(p.price || 0))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex items-center justify-between gap-2">
                                    <Link
                                      href={`/produtos/${encodeURIComponent(p.slug)}`}
                                      className={cn(btnOutline, "px-4 py-2")}
                                    >
                                      Ver produto
                                    </Link>
                                    <button
                                      onClick={() => removeWish(p.id)}
                                      className="rounded-2xl px-4 py-2 font-semibold text-rose-700 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition shadow-[0_10px_26px_rgba(0,0,0,0.06)]"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {tab === "addresses" && (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <TabTitle>Endereço de entrega</TabTitle>
                          <button
                            onClick={openCreateAddress}
                            className={btnAccent}
                          >
                            Novo endereço
                          </button>
                        </div>
                        <div className="mt-3 h-px w-full bg-black/5" />

                        {addrLoading ? (
                          <div className="mt-6 text-sm text-black/60">
                            Carregando endereços…
                          </div>
                        ) : (
                          <div className="mt-6 space-y-3">
                            {addresses.length === 0 && (
                              <div className="rounded-[22px] border border-black/5 bg-white/65 p-6 text-sm text-black/60">
                                Você ainda não salvou nenhum endereço.
                              </div>
                            )}

                            {addresses.map((a) => (
                              <div
                                key={a.id}
                                className="rounded-[22px] border border-black/5 bg-white/65 p-6"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-semibold text-[#1F1F1F]">
                                        {a.label || "Endereço"}
                                      </div>
                                      {a.isDefault === 1 && (
                                        <span className="inline-flex items-center rounded-full border border-emerald-900/10 bg-emerald-50/70 px-3 py-1 text-[11px] font-extrabold text-emerald-800">
                                          Padrão ✨
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-2 text-sm text-black/60 break-words">
                                      {a.street}, {a.number}
                                      {a.complement ? ` • ${a.complement}` : ""}
                                      <div className="mt-1">
                                        {a.district ? `${a.district} • ` : ""}
                                        {a.city} - {a.uf}
                                      </div>
                                      <div className="mt-1 text-xs text-black/45">
                                        CEP: {maskCEP(String(a.zip || ""))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex flex-col gap-2">
                                    {a.isDefault !== 1 && (
                                      <button
                                        onClick={() => setDefaultAddress(a.id)}
                                        className={btnOutline}
                                      >
                                        Tornar padrão
                                      </button>
                                    )}
                                    <button
                                      onClick={() => openEditAddress(a)}
                                      className={btnOutline}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => deleteAddress(a.id)}
                                      className="rounded-2xl px-4 py-2 font-semibold text-rose-700 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition shadow-[0_10px_26px_rgba(0,0,0,0.06)]"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Form */}
                        {addrFormOpen && (
                          <div className="mt-6 rounded-[22px] border border-black/5 bg-white/65 p-6">
                            <div className="text-sm font-semibold text-[#1F1F1F]">
                              {addrEditingId
                                ? "Editar endereço"
                                : "Novo endereço"}
                            </div>
                            <div className="mt-3 h-px w-full bg-black/5" />

                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                value={addrLabel}
                                onChange={(e) => setAddrLabel(e.target.value)}
                                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                                placeholder="Apelido (Casa, Trabalho...)"
                              />

                              <label className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black/70">
                                <input
                                  type="checkbox"
                                  checked={addrDefault}
                                  onChange={(e) =>
                                    setAddrDefault(e.target.checked)
                                  }
                                />
                                Definir como padrão
                              </label>

                              <input
                                value={addrRecipient}
                                onChange={(e) =>
                                  setAddrRecipient(e.target.value)
                                }
                                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                                placeholder="Destinatário"
                              />

                              <input
                                value={addrPhone}
                                onChange={(e) =>
                                  setAddrPhone(maskPhoneBR(e.target.value))
                                }
                                maxLength={15}
                                inputMode="tel"
                                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                                placeholder="Telefone (WhatsApp)"
                              />

                              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <input
                                    value={addrZip}
                                    onChange={(e) => {
                                      const v = maskCEP(e.target.value);
                                      setAddrZip(v);
                                      setCepError(null);
                                    }}
                                    onBlur={() => fetchCep(addrZip)}
                                    maxLength={9}
                                    inputMode="numeric"
                                    className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                                    placeholder="CEP"
                                  />
                                  <div className="mt-1 min-h-[16px] text-[11px]">
                                    {cepLoading ? (
                                      <span className="text-black/50">
                                        Buscando CEP…
                                      </span>
                                    ) : cepError ? (
                                      <span className="text-rose-700 font-semibold">
                                        {cepError}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <input
                                  value={addrStreet}
                                  onChange={(e) =>
                                    setAddrStreet(e.target.value)
                                  }
                                  className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                                  placeholder="Rua / Avenida"
                                />
                              </div>

                              <input
                                value={addrNumber}
                                onChange={(e) => setAddrNumber(e.target.value)}
                                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                                placeholder="Número (obrigatório)"
                              />

                              <input
                                value={addrComplement}
                                onChange={(e) =>
                                  setAddrComplement(e.target.value)
                                }
                                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                                placeholder="Complemento"
                              />

                              <input
                                value={addrDistrict}
                                onChange={(e) =>
                                  setAddrDistrict(e.target.value)
                                }
                                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                                placeholder="Bairro (obrigatório)"
                              />

                              <select
                                value={addrUf}
                                onChange={(e) => {
                                  setAddrUf(e.target.value);
                                  setAddrCity("");
                                }}
                                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none"
                              >
                                <option value="">UF</option>
                                {UFS.map((uf) => (
                                  <option key={uf} value={uf}>
                                    {uf}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={addrCity}
                                onChange={(e) => setAddrCity(e.target.value)}
                                disabled={!addrUf || citiesLoading}
                                className={cn(
                                  "rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none",
                                  (!addrUf || citiesLoading) &&
                                    "opacity-70 cursor-not-allowed",
                                )}
                              >
                                <option value="">
                                  {!addrUf
                                    ? "Selecione o UF primeiro"
                                    : citiesLoading
                                      ? "Carregando cidades..."
                                      : "Cidade"}
                                </option>
                                {cities.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="mt-5 flex items-center justify-end gap-2">
                              <button
                                onClick={() => setAddrFormOpen(false)}
                                className={btnOutline}
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={saveAddress}
                                disabled={addrSaving}
                                className={cn(
                                  btnAccent,
                                  addrSaving && "opacity-60 cursor-not-allowed",
                                )}
                              >
                                {addrSaving ? "Salvando..." : "Salvar"}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {tab === "password" && (
                      <>
                        <TabTitle>Alterar senha</TabTitle>
                        <div className="mt-3 h-px w-full bg-black/5" />

                        <div className="mt-6 space-y-4">
                          {me.hasPassword === false ? (
                            <div className="rounded-[22px] border border-rose-900/10 bg-rose-50/60 p-6">
                              <div className="text-sm font-semibold text-[#1F1F1F]">
                                Crie sua senha
                              </div>
                              <p className="mt-2 text-xs text-black/60 leading-relaxed">
                                Sua conta já existe porque você comprou. Agora
                                crie uma senha para entrar quando quiser.
                              </p>

                              <input
                                className="mt-4 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                                placeholder="Nova senha (mín. 6)"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />

                              <button
                                onClick={handleSetPassword}
                                className={cn("mt-5 w-full", btnAccent)}
                              >
                                Salvar senha
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-[22px] border border-black/5 bg-white/65 p-6">
                              <div className="text-sm font-semibold text-[#1F1F1F]">
                                Trocar senha
                              </div>
                              <div className="mt-1 text-xs text-black/60">
                                Altere sua senha com segurança.
                              </div>

                              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                  className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                                  placeholder="Senha atual"
                                  type="password"
                                  value={currentPassword}
                                  onChange={(e) =>
                                    setCurrentPassword(e.target.value)
                                  }
                                />
                                <input
                                  className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                                  placeholder="Nova senha (mín. 6)"
                                  type="password"
                                  value={changePassword}
                                  onChange={(e) =>
                                    setChangePassword(e.target.value)
                                  }
                                />
                              </div>

                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={handleChangePassword}
                                  className={btnOutline}
                                >
                                  Atualizar senha
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                  </div>
                </section>
              </div>
            ) : (
              // Não logado
              <div className="mt-10 max-w-xl">
                <div className="inline-flex rounded-2xl border border-black/5 bg-white/65 p-1 shadow-[0_10px_25px_rgba(0,0,0,0.06)]">
                  <button
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setNotice(null);
                    }}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm transition font-semibold",
                      mode === "login"
                        ? "bg-white shadow-sm"
                        : "text-black/60 hover:text-black",
                    )}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setMode("register");
                      setError(null);
                      setNotice(null);
                    }}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm transition font-semibold",
                      mode === "register"
                        ? "bg-white shadow-sm"
                        : "text-black/60 hover:text-black",
                    )}
                  >
                    Criar conta
                  </button>
                </div>

                <form
                  onSubmit={onSubmit}
                  className="mt-6 grid grid-cols-1 gap-4"
                >
                  {mode === "register" && (
                    <div className={cn("p-6", innerCard)}>
                      <label className="text-xs font-semibold text-black/60 tracking-wide">
                        SEU NOME
                      </label>
                      <input
                        className="mt-3 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                        placeholder="Ex: Elias"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  )}

                  <div className={cn("p-6", innerCard)}>
                    <label className="text-xs font-semibold text-black/60 tracking-wide">
                      EMAIL
                    </label>
                    <input
                      className="mt-3 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                      placeholder="seuemail@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className={cn("p-6", innerCard)}>
                    <label className="text-xs font-semibold text-black/60 tracking-wide">
                      SENHA
                    </label>
                    <input
                      className="mt-3 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                      placeholder="••••••"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                    <p className="mt-3 text-xs text-black/50">
                      Mínimo de 6 caracteres.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-rose-900/10 bg-rose-50/70 p-4 text-sm text-rose-800 shadow-sm">
                      {error}
                    </div>
                  )}

                  <button className={btnAccent}>
                    {mode === "register" ? "Criar conta" : "Entrar"}
                  </button>

                  {mode === "login" && (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleRequestPasswordReset}
                        disabled={resetSending}
                        className="cursor-pointer text-left text-sm font-semibold text-[#9C3F5B] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resetSending ? "Enviando link..." : "Esqueci minha senha"}
                      </button>

                      <button
                        type="button"
                        onClick={handleResendVerificationEmail}
                        disabled={resetSending}
                        className="cursor-pointer text-left text-sm font-semibold text-[#9C3F5B] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resetSending ? "Enviando..." : "Reenviar verificação de email"}
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-black/55">
                    Dica: se você já comprou, use o mesmo email do pedido e
                    entre.
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-black/45">
          Papelaria Felicio • Área do cliente
        </div>
      </div>
    </div>
  );
}

function ContaPageFallback() {
  return (
    <div className="min-h-[60vh] px-4 py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-[26px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.70),rgba(255,255,255,0.52))] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          <div className="h-7 w-44 animate-pulse rounded-xl bg-black/5" />
          <div className="mt-6 space-y-3">
            <div className="h-12 animate-pulse rounded-2xl bg-black/5" />
            <div className="h-12 animate-pulse rounded-2xl bg-black/5" />
            <div className="h-12 animate-pulse rounded-2xl bg-black/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContaPage() {
  return (
    <Suspense fallback={<ContaPageFallback />}>
      <ContaPageContent />
    </Suspense>
  );
}
