"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useCart } from "@/components/cart/CartContext";
import Container from "@/components/layout/Container";
import { apiMe, type MeUser } from "@/lib/clientAuth";
import {
  isValidCPF,
  maskCEP,
  maskCPF,
  maskPhone,
  onlyDigits,
} from "@/lib/validators";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const checkoutSteps = [
  {
    eyebrow: "01",
    title: "Dados",
    description: "Quem vai receber.",
  },
  {
    eyebrow: "02",
    title: "Entrega",
    description: "Endereço e frete.",
  },
  {
    eyebrow: "03",
    title: "Pagamento",
    description: "Pix ou cartão.",
  },
];

export default function CheckoutClient() {
  const { items, itemsCount, subtotal, clear, cartReady } = useCart();
  const [accountUser, setAccountUser] = useState<MeUser | null>(null);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [name, setName] = useState("");
  const [whats, setWhats] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");

  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [complement, setComplement] = useState("");

  const [touched, setTouched] = useState({
    name: false,
    whats: false,
    cep: false,
    number: false,
    cpf: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [needsAccountLogin, setNeedsAccountLogin] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [cepFound, setCepFound] = useState(false);
  const [addressLocked, setAddressLocked] = useState(false);
  const [shippingPrice, setShippingPrice] = useState(0);
  const [shippingDeadline, setShippingDeadline] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [mercadoPagoEnabled, setMercadoPagoEnabled] = useState(false);
  const [mercadoPagoWebhookReady, setMercadoPagoWebhookReady] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "pix_auto" | "card_mercadopago"
  >("pix_auto");

  const nameOk = name.trim().length >= 3;
  const whatsOk = onlyDigits(whats).length >= 10;
  const cpfOk = isValidCPF(cpf);
  const cepOk = onlyDigits(cep).length === 8;
  const numberOk = number.trim().length > 0;
  const isEmpty = cartReady && itemsCount === 0;

  const total = useMemo(
    () => subtotal + shippingPrice,
    [shippingPrice, subtotal],
  );
  const firstName = useMemo(() => {
    const raw = accountUser?.name || accountUser?.email || "";
    return raw.trim().split(/\s+/)[0] || "cliente";
  }, [accountUser]);

  const checkoutReady =
    nameOk &&
    whatsOk &&
    cpfOk &&
    cepOk &&
    Boolean(street.trim()) &&
    Boolean(city.trim()) &&
    Boolean(uf.trim()) &&
    Boolean(number.trim()) &&
    Boolean(shippingDeadline) &&
    !shippingLoading &&
    !shippingError;

  useEffect(() => {
    (async () => {
      try {
        const meData = await apiMe();
        const user = meData?.user;

        if (!user) {
          try {
            const savedEmail = localStorage.getItem("felicio_customer_email");
            if (savedEmail && !email.trim()) {
              setEmail(savedEmail);
            }
          } catch {}
          return;
        }

        setAccountUser(user);

        if (user.name && !name.trim()) setName(String(user.name));
        if (user.email && !email.trim()) setEmail(String(user.email));
        if (user.phone && !whats.trim())
          setWhats(maskPhone(String(user.phone)));
        if (user.cpf && !cpf.trim()) setCpf(maskCPF(String(user.cpf)));

        const addrRes = await fetch("/api/account/addresses?default=1", {
          cache: "no-store",
        });
        const addrData = await addrRes.json().catch(() => ({}));
        const address = addrData?.items?.[0];
        if (!address) return;

        if (!cep.trim() && address.zip) setCep(maskCEP(String(address.zip)));
        if (!street.trim() && address.street) setStreet(String(address.street));
        if (!number.trim() && address.number) setNumber(String(address.number));
        if (!complement.trim() && address.complement) {
          setComplement(String(address.complement));
        }
        if (!district.trim() && address.district) {
          setDistrict(String(address.district));
        }
        if (!city.trim() && address.city) setCity(String(address.city));
        if (!uf.trim() && address.uf) setUf(String(address.uf).toUpperCase());

        if (String(address.zip ?? "").replace(/\D/g, "").length === 8) {
          setCepFound(true);
          setAddressLocked(true);
        }
      } catch {
        // Silencioso por ser apenas preenchimento automatico.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/payments/stripe/status", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!alive) return;

        setMercadoPagoEnabled(Boolean(data?.mercadoPago?.checkoutReady));
        setMercadoPagoWebhookReady(Boolean(data?.mercadoPago?.webhookReady));
      } catch {
        if (!alive) return;
        setMercadoPagoEnabled(false);
        setMercadoPagoWebhookReady(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const digits = onlyDigits(cep);

    if (digits.length === 8) {
      void calculateShipping();
      return;
    }

    setShippingPrice(0);
    setShippingDeadline("");
    setShippingError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, subtotal]);

  async function fetchCep(rawCep: string) {
    const digits = onlyDigits(rawCep);
    if (digits.length !== 8) return;

    setCepLoading(true);
    setCepError("");

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();

      if (data?.erro) {
        setCepError("CEP não encontrado.");
        setCepFound(false);
        setAddressLocked(false);
        return;
      }

      setStreet(data.logradouro ?? "");
      setDistrict(data.bairro ?? "");
      setCity(data.localidade ?? "");
      setUf(data.uf ?? "");
      setCepFound(true);
      setAddressLocked(true);
    } catch {
      setCepError("Não consegui buscar o CEP agora.");
      setCepFound(false);
      setAddressLocked(false);
    } finally {
      setCepLoading(false);
    }
  }

  async function calculateShipping() {
    const digits = onlyDigits(cep);

    setShippingError("");
    setShippingDeadline("");
    setShippingPrice(0);

    if (digits.length !== 8) {
      setShippingError("Digite um CEP valido para calcular o frete.");
      return;
    }

    setShippingLoading(true);

    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: digits,
          subtotal,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setShippingPrice(0);
        setShippingDeadline("");
        setShippingError(data?.error || "Erro ao calcular frete");
        return;
      }

      setShippingPrice(data.price);
      setShippingDeadline(data.deadline);
    } catch {
      setShippingPrice(0);
      setShippingDeadline("");
      setShippingError("Não consegui calcular o frete agora.");
    } finally {
      setShippingLoading(false);
    }
  }

  async function finish() {
    setTouched({ name: true, whats: true, cep: true, number: true, cpf: true });
    if (!checkoutReady) return;

    const localOrderId = `FEL-${Date.now()}`;

    const order = {
      id: localOrderId,
      createdAt: Date.now(),
      paymentMethod,
      customer: {
        name: name.trim(),
        whats: whats.trim(),
        email: email.trim() || undefined,
        cpf: onlyDigits(cpf) || undefined,
      },
      address: {
        cep: onlyDigits(cep) || undefined,
        street: street.trim() || undefined,
        number: number.trim() || undefined,
        complement: complement.trim() || undefined,
        district: district.trim() || undefined,
        city: city.trim() || undefined,
        uf: uf.trim() || undefined,
      },
      items: items.map((item) => ({
        productId: String(item.id),
        qty: item.qty,
        price: item.price,
      })),
      shipping: shippingPrice,
      status: "aguardando_pagamento" as const,
    };

    setError(null);
    setNeedsAccountLogin(false);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });

      const data = await res.json().catch(() => null);
      const createdOrderId = data?.orderId || localOrderId;

      if (!res.ok) {
        const errorMsg =
          data?.error || data?.reason || "Não foi possível criar o pedido";

        if (errorMsg === "insufficient_stock") {
          setError(`Produto "${data?.productId}" sem estoque suficiente.`);
        } else if (errorMsg === "product_not_found") {
          setError(`Produto "${data?.productId}" não encontrado.`);
        } else if (errorMsg === "product_inactive") {
          setError(`Produto "${data?.productId}" não está mais disponível.`);
        } else if (errorMsg === "account_login_required") {
          setNeedsAccountLogin(true);
          setError(
            data?.reason ||
              "Esse email já está vinculado a uma conta. Entre com sua senha ou recupere o acesso para continuar.",
          );
        } else {
          setError(`Erro ao criar pedido: ${errorMsg}`);
        }

        return;
      }

      if (order.customer.email) {
        localStorage.setItem("felicio_customer_email", order.customer.email);
      }
      if (data?.orderAccessToken) {
        localStorage.setItem(
          "felicio_order_access_token",
          data.orderAccessToken,
        );
      }

      if (paymentMethod === "card_mercadopago" && data?.checkoutUrl) {
        window.location.href = String(data.checkoutUrl);
        return;
      }

      clear();
      const accessParam = data?.orderAccessToken
        ? `&access=${encodeURIComponent(String(data.orderAccessToken))}`
        : "";
      window.location.href = `/pedidos/sucesso?id=${encodeURIComponent(createdOrderId)}${accessParam}`;
    } catch (unknownError: unknown) {
      console.error("Falha ao criar pedido:", unknownError);
      setError("Erro de conexão. Tente novamente.");
    }
  }

  if (!hydrated || !cartReady) {
    return (
      <main>
        <Container>
          <div className="pt-8 pb-14 sm:pt-10 sm:pb-16">
            <div className="h-9 w-40 animate-pulse rounded-2xl bg-white/65" />
            <div className="mt-3 h-5 w-72 animate-pulse rounded-xl bg-white/50" />
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <div className="h-64 animate-pulse rounded-3xl bg-white/65" />
                <div className="h-72 animate-pulse rounded-3xl bg-white/60" />
              </div>
              <div className="lg:col-span-4">
                <div className="h-80 animate-pulse rounded-3xl bg-white/70" />
              </div>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  if (isEmpty) {
    return (
      <main>
        <Container>
          <div className="pt-10 pb-16">
            <h1 className="text-2xl font-extrabold text-felicio-ink">
              Checkout
            </h1>
            <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-6 lg:sticky lg:top-24">
              <p className="text-felicio-ink/80">
                Seu carrinho está vazio. Bora escolher algo fofo?
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex items-center justify-center rounded-full border border-felicio-pink/25 bg-white px-5 py-3 text-sm font-semibold text-felicio-ink/90 shadow-soft transition hover:border-felicio-pink/40 hover:bg-felicio-pink/10 hover:shadow-[0_12px_34px_rgba(0,0,0,0.12)]"
              >
                Ver produtos
              </Link>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main>
      <Container>
        <div className="pt-8 pb-14 sm:pt-10 sm:pb-16">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-felicio-ink sm:text-3xl">
                Checkout
              </h1>
              <p className="mt-1 text-sm text-felicio-ink/70">
                Só mais um passo para concluir seu pedido.
              </p>
            </div>

            <Link
              href="/carrinho"
              className="text-sm font-semibold text-felicio-ink/70 underline underline-offset-4 hover:text-felicio-ink"
            >
              Voltar ao carrinho
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3 xl:gap-4">
            {checkoutSteps.map((step, index) => (
              <div
                key={step.title}
                className={[
                  "rounded-full border px-3.5 py-2 shadow-soft backdrop-blur-sm sm:px-5 sm:py-3",
                  index === 2
                    ? "border-felicio-pink/18 bg-[linear-gradient(135deg,rgba(255,241,246,0.95),rgba(255,255,255,0.94))]"
                    : "border-white/75 bg-white/88",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-xl  px-1 text-[12px] font-extrabold uppercase tracking-[0.2em] text-felicio-ink/65">
                    {step.eyebrow}
                  </div>
                  <div>
                    <div className="text-[0.8rem] font-extrabold text-felicio-ink">
                      {step.title}
                    </div>
                    <div className="text-[0.64rem] text-felicio-ink/58">
                      {step.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[28px] border border-white/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,245,248,0.84))] p-4 shadow-soft sm:mt-6 sm:p-5">
            {accountUser ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-felicio-ink/45">
                    Conta conectada
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-felicio-ink">
                    Comprando como {firstName}
                  </div>
                  <div className="text-sm text-felicio-ink/60">
                    Seus dados podem ser preenchidos automaticamente para você
                    revisar e concluir mais rápido.
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="rounded-full border border-felicio-pink/20 bg-felicio-pink/10 px-3 py-1 text-[11px] font-extrabold text-felicio-ink/75">
                    Dados salvos ativos
                  </div>
                  <Link
                    href="/conta"
                    className="inline-flex items-center justify-center rounded-full border border-felicio-pink/20 bg-white/92 px-4 py-2 text-sm font-semibold text-felicio-ink transition hover:border-felicio-pink/35 hover:bg-felicio-pink/8"
                  >
                    Abrir minha conta
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-felicio-ink/45">
                    Compra rapida
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-felicio-ink">
                    Continue como visitante ou entre na sua conta
                  </div>
                  <div className="text-sm text-felicio-ink/60">
                    Se você já comprou por aqui, entrar com o mesmo email ajuda
                    a puxar seus dados salvos.
                  </div>
                  {email.trim() && (
                    <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-felicio-pink/20 bg-felicio-pink/10 px-3 py-1 text-[11px] font-extrabold text-felicio-ink/75">
                      Email reconhecido: {email}
                    </div>
                  )}
                </div>

                <Link
                  href="/conta"
                  className="inline-flex items-center justify-center rounded-full border border-felicio-pink/20 bg-white/92 px-4 py-2 text-sm font-semibold text-felicio-ink transition hover:border-felicio-pink/35 hover:bg-felicio-pink/8"
                >
                  Entrar ou criar conta
                </Link>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-12 lg:gap-6">
            <div className="space-y-6 lg:col-span-8">
              <section className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-soft backdrop-blur-sm sm:p-6">
                <h2 className="text-base font-extrabold text-felicio-ink">
                  Seus dados
                </h2>
                <p className="mt-1 text-sm text-felicio-ink/60">
                  Confirme quem vai receber o pedido e como podemos falar com
                  você.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onBlur={() =>
                        setTouched((state) => ({ ...state, name: true }))
                      }
                      placeholder="Nome completo"
                      className={[
                        "w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition",
                        touched.name && !nameOk
                          ? "border-felicio-pink/60"
                          : "border-black/10",
                        "focus:border-felicio-pink/40",
                      ].join(" ")}
                    />
                    {touched.name && !nameOk && (
                      <p className="mt-1 text-[11px] font-semibold text-felicio-pink">
                        Me diga seu nome para confirmar direitinho.
                      </p>
                    )}
                  </div>

                  <div>
                    <input
                      value={whats}
                      onChange={(event) =>
                        setWhats(maskPhone(event.target.value))
                      }
                      onBlur={() =>
                        setTouched((state) => ({ ...state, whats: true }))
                      }
                      placeholder="WhatsApp"
                      className={[
                        "w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition",
                        touched.whats && !whatsOk
                          ? "border-felicio-pink/60"
                          : "border-black/10",
                        "focus:border-felicio-pink/40",
                      ].join(" ")}
                    />
                    {touched.whats && !whatsOk && (
                      <p className="mt-1 text-[11px] font-semibold text-felicio-pink">
                        Coloque com DDD (ex: 11999999999).
                      </p>
                    )}
                  </div>

                  <div>
                    <input
                      value={cpf}
                      onChange={(event) => setCpf(maskCPF(event.target.value))}
                      onBlur={() =>
                        setTouched((state) => ({ ...state, cpf: true }))
                      }
                      placeholder="CPF (000.000.000-00)"
                      className={[
                        "w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition",
                        touched.cpf && !cpfOk
                          ? "border-felicio-pink/60"
                          : "border-black/10",
                        "focus:border-felicio-pink/40",
                      ].join(" ")}
                    />
                    {touched.cpf && !cpfOk && (
                      <p className="mt-1 text-[11px] font-semibold text-felicio-pink">
                        CPF precisa ter 11 digitos.
                      </p>
                    )}
                  </div>

                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="E-mail"
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-felicio-pink/40 sm:col-span-2"
                  />
                </div>

                <p className="mt-3 text-[11px] text-felicio-ink/55">
                  Seus dados serao usados apenas para contato e entrega.
                </p>
              </section>

              <section className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-soft backdrop-blur-sm sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-felicio-ink">
                    Endereço de entrega
                  </h2>

                  {cepFound && (
                    <button
                      type="button"
                      onClick={() => setAddressLocked((value) => !value)}
                      className="text-xs font-semibold text-felicio-ink/70 underline underline-offset-4 hover:text-felicio-ink"
                    >
                      {addressLocked ? "Editar endereço" : "Travar endereço"}
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <input
                      value={cep}
                      onChange={(event) => setCep(maskCEP(event.target.value))}
                      onBlur={() => {
                        setTouched((state) => ({ ...state, cep: true }));
                        void fetchCep(cep);
                      }}
                      placeholder="CEP"
                      className={[
                        "w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition",
                        touched.cep && !cepOk
                          ? "border-felicio-pink/60"
                          : "border-black/10",
                        "focus:border-felicio-pink/40",
                      ].join(" ")}
                    />

                    <div className="mt-1 min-h-[16px]">
                      {cepLoading ? (
                        <p className="text-[11px] text-zinc-500">
                          Buscando CEP...
                        </p>
                      ) : cepError ? (
                        <p className="text-[11px] font-semibold text-felicio-pink">
                          {cepError}
                        </p>
                      ) : touched.cep && !cepOk ? (
                        <p className="text-[11px] font-semibold text-felicio-pink">
                          CEP deve ter 8 numeros.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {cepFound && !cepLoading && !cepError && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-felicio-mint/25 bg-felicio-mint/20 px-3 py-1 text-[11px] font-extrabold text-felicio-ink/80">
                      <span>Endereço encontrado</span>
                      <span className="text-felicio-sun/80">OK</span>
                    </div>
                  )}

                  <input
                    value={street}
                    onChange={(event) => setStreet(event.target.value)}
                    readOnly={addressLocked}
                    placeholder="Rua / Avenida"
                    className={[
                      "rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-felicio-pink/40",
                      addressLocked ? "cursor-not-allowed opacity-90" : "",
                    ].join(" ")}
                  />

                  <div>
                    <input
                      value={number}
                      onChange={(event) => setNumber(event.target.value)}
                      onBlur={() =>
                        setTouched((state) => ({ ...state, number: true }))
                      }
                      placeholder="Numero"
                      className={[
                        "w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition",
                        touched.number && !numberOk
                          ? "border-felicio-pink/60"
                          : "border-black/10",
                        "focus:border-felicio-pink/40",
                      ].join(" ")}
                    />
                    {touched.number && !numberOk && (
                      <p className="mt-1 text-[11px] font-semibold text-felicio-pink">
                        Informe o numero da casa.
                      </p>
                    )}
                  </div>

                  <input
                    value={complement}
                    onChange={(event) => setComplement(event.target.value)}
                    placeholder="Complemento (apto, bloco, casa, etc.)"
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-felicio-pink/40 sm:col-span-2"
                  />

                  <input
                    value={district}
                    onChange={(event) => setDistrict(event.target.value)}
                    readOnly={addressLocked}
                    placeholder="Bairro"
                    className={[
                      "rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-felicio-pink/40",
                      addressLocked ? "cursor-not-allowed opacity-90" : "",
                    ].join(" ")}
                  />

                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    readOnly={addressLocked}
                    placeholder="Cidade"
                    className={[
                      "rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-felicio-pink/40",
                      addressLocked ? "cursor-not-allowed opacity-90" : "",
                    ].join(" ")}
                  />

                  <input
                    value={uf}
                    onChange={(event) =>
                      setUf(event.target.value.toUpperCase())
                    }
                    readOnly={addressLocked}
                    placeholder="UF"
                    className={[
                      "rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-felicio-pink/40",
                      addressLocked ? "cursor-not-allowed opacity-90" : "",
                    ].join(" ")}
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-soft backdrop-blur-sm sm:p-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-felicio-ink">
                      Pagamento
                    </h2>
                    <p className="text-sm text-felicio-ink/60">
                      Escolha a forma que fica mais confortavel para concluir sua compra.
                    </p>
                  </div>

                  <div className="mt-1 rounded-full border border-felicio-mint/25 bg-felicio-mint/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-felicio-ink/70">
                    {paymentMethod === "pix_auto"
                      ? "Pix selecionado"
                      : "Cartão selecionado"}
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/70 bg-white/78 p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/45">
                    Como funciona
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-felicio-ink/64">
                    {paymentMethod === "card_mercadopago"
                      ? "Ao finalizar, você segue para o ambiente seguro do Mercado Pago para escolher o cartão e concluir por lá."
                      : "Ao finalizar, o pedido gera o Pix na hora com QR Code e copia e cola para pagamento."}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("pix_auto")}
                    className={[
                      "rounded-[28px] border px-5 py-5 text-left transition",
                      paymentMethod === "pix_auto"
                        ? "border-felicio-mint/35 bg-[linear-gradient(180deg,rgba(220,252,231,0.65),rgba(255,255,255,0.9))] shadow-soft"
                        : "border-black/10 bg-white/80 hover:border-felicio-mint/30",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-extrabold text-felicio-ink">
                        Pix
                      </div>
                      <span className="rounded-full border border-felicio-mint/25 bg-white/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/55">
                        Rápido
                      </span>
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-felicio-ink/62">
                      Gere o QR Code, pague na hora e receba a confirmação
                      automática do pedido.
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-felicio-ink/60">
                      <span className="rounded-full border border-black/8 bg-white/80 px-3 py-1">
                        QR Code na hora
                      </span>
                      <span className="rounded-full border border-black/8 bg-white/80 px-3 py-1">
                        Confirmação automática
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!mercadoPagoEnabled}
                    onClick={() => setPaymentMethod("card_mercadopago")}
                    className={[
                      "rounded-[28px] border px-5 py-5 text-left transition",
                      mercadoPagoEnabled
                        ? paymentMethod === "card_mercadopago"
                          ? "border-felicio-pink/35 bg-[linear-gradient(180deg,rgba(253,242,248,0.92),rgba(255,255,255,0.9))] shadow-soft"
                          : "border-black/10 bg-white/80 hover:border-felicio-pink/25"
                        : "border-dashed border-black/10 bg-white/70 opacity-75",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-extrabold text-felicio-ink">
                        Cartão de crédito
                      </div>
                      <span className="rounded-full border border-black/10 bg-white/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/55">
                        {mercadoPagoEnabled
                          ? mercadoPagoWebhookReady
                            ? "Ativo"
                            : "Quase pronto"
                          : "Indisponível"}
                      </span>
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-felicio-ink/62">
                      {mercadoPagoEnabled
                        ? "Você será redirecionado para o checkout seguro do Mercado Pago para concluir no cartão e escolher as parcelas."
                        : "Assim que o Mercado Pago estiver 100% pronto, essa opção fica liberada automaticamente."}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-felicio-ink/60">
                      <span className="rounded-full border border-black/8 bg-white/80 px-3 py-1">
                        Ambiente seguro
                      </span>
                      <span className="rounded-full border border-black/8 bg-white/80 px-3 py-1">
                        Parcelamento
                      </span>
                    </div>
                  </button>
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <div className="space-y-4 rounded-[30px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,248,250,0.8))] p-4 shadow-soft backdrop-blur-sm sm:p-5 lg:sticky lg:top-24 lg:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-felicio-ink/45">
                      Revisao final
                    </div>
                    <h2 className="mt-2 text-xl font-extrabold text-felicio-ink">
                      Resumo do pedido
                    </h2>
                  </div>

                  <div className="rounded-full border border-felicio-pink/18 bg-felicio-pink/8 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/65">
                    {itemsCount} item{itemsCount > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="mt-3 space-y-1 rounded-2xl border border-black/5 bg-white/80 p-3 text-xs text-zinc-700">
                  <div>
                    <span className="font-semibold">Nome:</span>{" "}
                    {name || <span className="text-zinc-400">-</span>}
                  </div>

                  <div>
                    <span className="font-semibold">WhatsApp:</span>{" "}
                    {whats || <span className="text-zinc-400">-</span>}
                  </div>

                  {cepFound ? (
                    <div className="pt-1 text-zinc-600">
                      <span className="font-semibold">Entrega:</span>{" "}
                      {[street, number, district, city, uf]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  ) : (
                    <div className="pt-1 italic text-zinc-400">
                      Preencha seus dados para confirmar.
                    </div>
                  )}
                </div>

                {cepFound && !numberOk && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-felicio-pink/30 bg-felicio-pink/10 px-3 py-2 text-xs font-semibold text-felicio-ink">
                    <span>!</span>
                    <span>Falta o numero da casa para concluir.</span>
                  </div>
                )}

                {checkoutReady && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-felicio-mint/25 bg-felicio-mint/20 px-3 py-1 text-[11px] font-extrabold text-felicio-ink/80">
                    <span>Pronto para envio</span>
                    <span className="text-felicio-sun/80">OK</span>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {items.map((item) => (
                    <div
                      key={`${item.id}-${item.slug}`}
                      className="rounded-[24px] border border-black/5 bg-white p-3.5 shadow-[0_10px_26px_rgba(0,0,0,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-felicio-ink">
                            {item.title}
                          </div>
                          <div className="mt-1 text-xs text-felicio-ink/55">
                            {formatBRL(item.price)} por unidade
                          </div>
                        </div>

                        <div className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/55">
                          {item.qty}x
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-felicio-ink/65">
                        <span>Total deste item</span>
                        <span className="text-sm font-extrabold text-felicio-ink">
                          {formatBRL(item.price * item.qty)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-felicio-ink/70">Subtotal</span>
                    <span className="text-zinc-600">{formatBRL(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-felicio-ink/70">Frete</span>
                    <span className="text-felicio-ink">
                      {shippingLoading
                        ? "Calculando..."
                        : shippingPrice === 0
                          ? "Grátis"
                          : formatBRL(shippingPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-felicio-pink/20 pt-2">
                    <span className="text-felicio-ink/70">Total</span>
                    <span className="text-felicio-pink">
                      {formatBRL(total)}
                    </span>
                  </div>
                </div>

                {shippingDeadline && (
                  <div className="text-xs text-felicio-ink/60">
                    Prazo estimado: {shippingDeadline}
                  </div>
                )}

                {shippingError && (
                  <div className="text-xs font-semibold text-red-600">
                    {shippingError}
                  </div>
                )}

                <div className="mt-4 rounded-3xl border border-white/70 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-extrabold text-felicio-ink/80">
                      Pagamento escolhido
                    </div>
                    <span className="rounded-full border border-felicio-pink/20 bg-felicio-pink/8 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-felicio-ink/70">
                      {paymentMethod === "pix_auto" ? "Pix" : "Cartão"}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-felicio-ink/62">
                    {paymentMethod === "card_mercadopago"
                      ? mercadoPagoEnabled
                        ? "Você conclui no ambiente seguro do Mercado Pago e o pedido fica registrado aqui para acompanhamento."
                        : "O cartão ainda não está liberado para este pedido."
                      : "O Pix aparece logo depois do pedido, com QR Code e copia e cola para pagar na hora."}
                  </p>
                </div>

                <div className="rounded-[26px] border border-felicio-pink/14 bg-[linear-gradient(180deg,rgba(255,245,248,0.95),rgba(255,255,255,0.9))] p-4">
                  <div className="text-sm font-extrabold text-felicio-ink">
                    Antes de concluir
                  </div>
                  <div className="mt-2 space-y-2 text-xs leading-relaxed text-felicio-ink/62">
                    <div>
                      Confira nome, WhatsApp e endereço para evitar atraso na
                      entrega.
                    </div>
                    <div>
                      Se escolher Pix, o QR Code aparece logo depois da
                      confirmação do pedido.
                    </div>
                    <div>
                      Se escolher cartão, você segue para um ambiente seguro
                      antes da aprovação final do pagamento.
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {error}
                    {needsAccountLogin && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/conta?mode=login&email=${encodeURIComponent(email.trim())}`}
                          className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3.5 py-2 text-xs font-extrabold text-red-800 transition hover:bg-red-100"
                        >
                          Entrar na conta
                        </Link>
                        <Link
                          href={`/conta?mode=login&email=${encodeURIComponent(email.trim())}`}
                          className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-100"
                        >
                          Recuperar acesso
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => void finish()}
                  disabled={!checkoutReady}
                  className={[
                    "mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-extrabold",
                    "bg-gradient-to-r from-felicio-pink/70 to-felicio-lilac/70 text-white",
                    "transition-all duration-200",
                    checkoutReady
                      ? "hover:brightness-105 hover:shadow-[0_16px_40px_rgba(244,114,182,0.35)]"
                      : "cursor-not-allowed opacity-50 hover:brightness-100 hover:shadow-none",
                  ].join(" ")}
                >
                  {checkoutReady
                    ? paymentMethod === "card_mercadopago"
                      ? "Ir para pagamento"
                      : "Gerar Pix do pedido"
                    : "Complete seus dados"}
                </button>

                <p className="mt-3 text-[11px] text-zinc-600">
                    {paymentMethod === "card_mercadopago"
                      ? "Ao finalizar, você será redirecionado para o checkout seguro do Mercado Pago."
                      : "Se preferir, você ainda pode voltar e trocar para cartão antes de gerar o Pix."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
