"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { emitCartAdd } from "@/lib/cartEvents";

export type CartItem = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  price: number;
  image?: string;
  stock?: number;
  variantKey?: string;
  colorName?: string;
  colorImage?: string;
  qty: number;
};

type CartContextType = {
  items: CartItem[];
  itemsCount: number;
  subtotal: number;
  cartReady: boolean;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "felicio_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
        setItems(
          parsed.map((item) => ({
            ...item,
            productId: String(item.productId || item.id || ""),
          })),
        );
      } catch {
        setItems([]);
      } finally {
        setCartReady(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!cartReady) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items.filter((item) => item.qty > 0)),
      );
    } catch {}
  }, [cartReady, items]);

  const addItem: CartContextType["addItem"] = (item, qty = 1) => {
    setItems((prev) => {
      const productId = String((item as CartItem).productId || item.id || "");
      const variantKey = String((item as CartItem).variantKey || "default");
      const lineId = `${productId}::${variantKey}`;
      const found = prev.find((p) => p.id === lineId);
      const nextStock = Number(item.stock ?? found?.stock ?? 0);

      if (!found) {
        const safeQty =
          Number.isFinite(nextStock) && nextStock > 0
            ? Math.min(Math.max(1, qty), nextStock)
            : Math.max(1, qty);
        return [
          ...prev,
          {
            ...item,
            id: lineId,
            productId,
            variantKey,
            image: item.colorImage || item.image,
            qty: safeQty,
          },
        ];
      }

      return prev.map((p) =>
        p.id === lineId
          ? {
              ...p,
              ...item,
              id: lineId,
              productId,
              variantKey,
              image: item.colorImage || item.image || p.image,
              qty:
                Number.isFinite(nextStock) && nextStock > 0
                  ? Math.min(p.qty + qty, nextStock)
                  : p.qty + qty,
            }
          : p,
      );
    });

    emitCartAdd({ title: item.title, qty });
  };

  const removeItem: CartContextType["removeItem"] = (id) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const setQty: CartContextType["setQty"] = (id, qty) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }

    const item = items.find((entry) => entry.id === id);
    const stockLimit = Number(item?.stock ?? 0);
    const safeQty = Math.max(
      1,
      Math.min(
        99,
        Number.isFinite(stockLimit) && stockLimit > 0 ? stockLimit : 99,
        Math.floor(qty || 1),
      ),
    );
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: safeQty } : p)),
    );
  };

  const clear: CartContextType["clear"] = () => setItems([]);

  const itemsCount = useMemo(
    () => items.reduce((acc, item) => acc + item.qty, 0),
    [items],
  );
  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.price * item.qty, 0),
    [items],
  );

  const value = {
    items,
    itemsCount,
    subtotal,
    cartReady,
    addItem,
    removeItem,
    setQty,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
