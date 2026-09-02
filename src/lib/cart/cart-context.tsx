"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAccount } from "@/lib/auth/account-context";

export interface CartItem {
  packageId: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  isHydrated: boolean;
  addToCart: (packageId: string) => void;
  removeFromCart: (packageId: string) => void;
  removeItemsFromCart: (packageIds: string[]) => void;
  clearCart: () => void;
  isInCart: (packageId: string) => boolean;
}

const GUEST_SESSION_KEY = "oriens_guest_session_id";
const USER_CART_PREFIX = "oriens_cart_user_";
const GUEST_CART_PREFIX = "oriens_cart_guest_";

function getOrCreateGuestSessionId(): string {
  if (typeof window === "undefined") return "guest_ssr";
  try {
    let id = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!id) {
      id = localStorage.getItem(GUEST_SESSION_KEY);
    }
    if (!id) {
      id = "g_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      try {
        sessionStorage.setItem(GUEST_SESSION_KEY, id);
      } catch {
        // ignore
      }
      try {
        localStorage.setItem(GUEST_SESSION_KEY, id);
      } catch {
        // ignore
      }
    }
    return id;
  } catch {
    return "guest_fallback";
  }
}

function resetGuestSessionId(): string {
  if (typeof window === "undefined") return "guest_ssr";
  const newId = "g_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  try {
    sessionStorage.setItem(GUEST_SESSION_KEY, newId);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(GUEST_SESSION_KEY, newId);
  } catch {
    // ignore
  }
  return newId;
}

function getStorageKey(userId: string | null | undefined, guestId: string): string {
  return userId ? `${USER_CART_PREFIX}${userId}` : `${GUEST_CART_PREFIX}${guestId}`;
}

function readCartFromStorage(key: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is CartItem =>
          typeof item === "object" && item !== null && typeof item.packageId === "string" && typeof item.quantity === "number"
      );
    }
  } catch {
    // ignore
  }
  return [];
}

function writeCartToStorage(key: string, items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("oriens:cart_updated", { detail: { key } }));
  } catch {
    // ignore
  }
}

function clearCartFromStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent("oriens:cart_updated", { detail: { key } }));
  } catch {
    // ignore
  }
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isInitializing } = useAccount();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const activeKeyRef = useRef<string>("");

  // Sync cart according to user authentication state
  useEffect(() => {
    if (isInitializing) return;

    const syncCart = () => {
      const currentUserId = user?.id || null;
      const prevUserId = prevUserIdRef.current;
      prevUserIdRef.current = currentUserId;

      const guestId = getOrCreateGuestSessionId();
      const currentKey = getStorageKey(currentUserId, guestId);
      activeKeyRef.current = currentKey;

      // Check if this is a login transition OR initial hydration with an authenticated user
      const isLoginOrInitialUser = (prevUserId === null || prevUserId === undefined) && currentUserId !== null;

      // Transition from Guest (null/undefined) -> Authenticated User
      if (isLoginOrInitialUser) {
        const guestKey = `${GUEST_CART_PREFIX}${guestId}`;
        const guestItems = readCartFromStorage(guestKey);
        const userKey = `${USER_CART_PREFIX}${currentUserId}`;
        const userItems = readCartFromStorage(userKey);

        if (guestItems.length > 0) {
          // Merge guest items into user cart, deduplicating by packageId
          const existingIds = new Set(userItems.map((i) => i.packageId));
          const merged = [...userItems];
          for (const gItem of guestItems) {
            if (!existingIds.has(gItem.packageId)) {
              merged.push(gItem);
              existingIds.add(gItem.packageId);
            }
          }
          writeCartToStorage(userKey, merged);
          clearCartFromStorage(guestKey);
          resetGuestSessionId();
          setItems(merged);
        } else {
          setItems(userItems);
        }
      } else if (prevUserId !== undefined && prevUserId !== null && currentUserId === null) {
        // Transition from Authenticated User -> Logged out (Guest)
        // Clean guest session without exposing previous user's cart
        const newGuestId = resetGuestSessionId();
        const newGuestKey = `${GUEST_CART_PREFIX}${newGuestId}`;
        activeKeyRef.current = newGuestKey;
        setItems([]);
      } else {
        // Normal load / refresh
        const stored = readCartFromStorage(currentKey);
        setItems(stored);
      }

      setIsHydrated(true);
    };

    queueMicrotask(syncCart);
  }, [user?.id, isInitializing]);

  // Multi-tab synchronization
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (!activeKeyRef.current) return;
      if (e.key === activeKeyRef.current) {
        const updated = readCartFromStorage(activeKeyRef.current);
        setItems(updated);
      }
    };

    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && detail.key === activeKeyRef.current) {
        const updated = readCartFromStorage(activeKeyRef.current);
        setItems(updated);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("oriens:cart_updated", handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("oriens:cart_updated", handleCustomEvent);
    };
  }, []);

  const addToCart = useCallback((packageId: string) => {
    const cleanId = packageId.trim();
    if (!cleanId) return;
    setItems((prev) => {
      if (prev.some((item) => item.packageId === cleanId)) return prev;
      const updated = [...prev, { packageId: cleanId, quantity: 1 }];
      const key = activeKeyRef.current || getStorageKey(user?.id, getOrCreateGuestSessionId());
      writeCartToStorage(key, updated);
      return updated;
    });
  }, [user?.id]);

  const removeFromCart = useCallback((packageId: string) => {
    const cleanId = packageId.trim();
    setItems((prev) => {
      const updated = prev.filter((item) => item.packageId !== cleanId);
      const key = activeKeyRef.current || getStorageKey(user?.id, getOrCreateGuestSessionId());
      writeCartToStorage(key, updated);
      return updated;
    });
  }, [user?.id]);

  const removeItemsFromCart = useCallback((packageIds: string[]) => {
    if (!packageIds || !packageIds.length) return;
    const toRemove = new Set(packageIds.map((id) => id.trim()).filter(Boolean));
    if (!toRemove.size) return;
    setItems((prev) => {
      const updated = prev.filter((item) => !toRemove.has(item.packageId));
      const key = activeKeyRef.current || getStorageKey(user?.id, getOrCreateGuestSessionId());
      writeCartToStorage(key, updated);
      return updated;
    });
  }, [user?.id]);

  const clearCart = useCallback(() => {
    setItems([]);
    const key = activeKeyRef.current || getStorageKey(user?.id, getOrCreateGuestSessionId());
    clearCartFromStorage(key);
  }, [user?.id]);

  const isInCart = useCallback((packageId: string) => {
    const cleanId = packageId.trim();
    return items.some((item) => item.packageId === cleanId);
  }, [items]);

  const cartCount = isHydrated ? items.length : 0;

  return (
    <CartContext.Provider
      value={{
        items: isHydrated ? items : [],
        cartCount,
        isHydrated,
        addToCart,
        removeFromCart,
        removeItemsFromCart,
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
