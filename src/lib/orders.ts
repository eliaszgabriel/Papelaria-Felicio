export type OrderStatus = "aguardando_pagamento" | "pago" | "enviado";

export type OrderItem = {
  id: string;
  slug?: string;
  title: string;
  price: number;       // legado (localStorage)
  unitPrice?: number;  // campo do banco de dados
  qty: number;
  image?: string;
};

export type OrderStatusEvent = {
  status: OrderStatus;
  at: number; // Date.now()
  by: "system" | "admin" | "customer";
};

export type Order = {
  id: string;
  createdAt: number;

  paymentMethod:
    | "whatsapp_pix"
    | "pix_auto"
    | "card_stripe"
    | "card_mercadopago";

  status: OrderStatus;
  statusHistory?: OrderStatusEvent[];
  customer: {
    name: string;
    whats: string;
    email?: string;
    cpf?: string;
  };

  address?: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    uf?: string;
  };

  items: OrderItem[];
  trackingCode?: string | null;
  trackingCarrier?: string | null;
  trackingUrl?: string | null;
  invoice?: {
    url: string;
    filename: string;
    uploadedAt?: number | null;
    sentAt?: number | null;
  } | null;

  subtotal: number;
  shippingAmount?: number;
  total: number;

  // ✅ gateway-ready
  payment?: {
    method:
      | "whatsapp_pix"
      | "pix_auto"
      | "card_stripe"
      | "card_mercadopago";
    provider?:
      | "manual"
      | "gateway"
      | "pushinpay"
      | "stripe"
      | "mercadopago";

    pixCopiaECola?: string;

    // futuro gateway
    qrText?: string;
    txId?: string;
    expiresAt?: number;
    checkoutUrl?: string;
    stripeSessionId?: string;
    stripePaymentIntentId?: string | null;
    mercadoPagoPreferenceId?: string;
    mercadoPagoPaymentId?: string | number | null;
    mercadoPagoPaymentMethodId?: string | null;
    installments?: number | null;
    paymentStatus?: string | null;
    qrBase64?: string | null;
    pushinpayTransactionId?: string;
    endToEndId?: string | null;
  };
};

const KEY = "felicio_orders_v1";

export function getOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: Order) {
  const orders = getOrders();

  const withHistory: Order = {
    ...order,
    statusHistory:
      order.statusHistory && order.statusHistory.length > 0
        ? order.statusHistory
        : [{ status: order.status, at: order.createdAt, by: "system" }],
  };

  orders.unshift(withHistory);
  localStorage.setItem(KEY, JSON.stringify(orders));
}

export function getOrderById(orderId: string): Order | null {
  const id = String(orderId).trim();
  const orders = getOrders();
  return orders.find((o) => String(o.id).trim() === id) ?? null;
}

export function updateOrderStatus(orderId: string, status: OrderStatus) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return;

  const current = orders[idx];
  const history = Array.isArray(current.statusHistory)
    ? current.statusHistory
    : [
        {
          status: current.status,
          at: current.createdAt,
          by: "system" as const,
        },
      ];

  // evita duplicar o mesmo status seguido
  const last = history[history.length - 1];
  const nextHistory =
    last?.status === status
      ? history
      : [...history, { status, at: Date.now(), by: "admin" as const }];

  orders[idx] = {
    ...current,
    status,
    statusHistory: nextHistory,
  };

  localStorage.setItem(KEY, JSON.stringify(orders));
}

// ✅ Passo 7: atualizar dados de pagamento sem sobrescrever tudo
export function updateOrderPayment(
  orderId: string,
  patch: Partial<NonNullable<Order["payment"]>>,
) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return;

  const current = orders[idx];

  const nextPayment: NonNullable<Order["payment"]> = {
    method: current.payment?.method ?? current.paymentMethod,
    ...(current.payment ?? {}),
    ...patch,
  };

  orders[idx] = {
    ...current,
    payment: nextPayment,
  };

  localStorage.setItem(KEY, JSON.stringify(orders));
}

export function clearOrders() {
  localStorage.removeItem(KEY);
}
