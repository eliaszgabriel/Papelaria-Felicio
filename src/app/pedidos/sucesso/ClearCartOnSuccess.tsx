"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart/CartContext";

export default function ClearCartOnSuccess({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const { clear } = useCart();
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (clearedRef.current) return;
    clearedRef.current = true;
    clear();
  }, [clear, enabled]);

  return null;
}
