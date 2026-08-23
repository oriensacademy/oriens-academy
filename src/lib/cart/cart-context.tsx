"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";

export interface CartItem {
  packageId: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  addToCart: (packageId: string) => void;
  removeFromCart: (packageId: string) => void;
  clearCart: () => void;
  isInCart: (packageId: string) => boolean;
}

const CART_STORAGE_KEY = "oriens_student_cart";

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          startTransition(() => {
            setItems(parsed);
          });
        }
      }
    } catch {
      // Ignore localStorage parse errors
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const saveItems = (newItems: CartItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
    } catch {
      // Ignore localStorage quota errors
    }
  };

  const addToCart = (packageId: string) => {
    const cleanId = packageId.trim();
    if (!cleanId) return;
    const existing = items.find((item) => item.packageId === cleanId);
    if (existing) return; // Keep 1 of each package in cart
    const updated = [...items, { packageId: cleanId, quantity: 1 }];
    saveItems(updated);
  };

  const removeFromCart = (packageId: string) => {
    const cleanId = packageId.trim();
    const updated = items.filter((item) => item.packageId !== cleanId);
    saveItems(updated);
  };

  const clearCart = () => {
    saveItems([]);
  };

  const isInCart = (packageId: string) => {
    const cleanId = packageId.trim();
    return items.some((item) => item.packageId === cleanId);
  };

  const cartCount = isHydrated ? items.length : 0;

  return (
    <CartContext.Provider
      value={{
        items: isHydrated ? items : [],
        cartCount,
        addToCart,
        removeFromCart,
        clearCart,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
