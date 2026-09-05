"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAccount } from "@/lib/auth/account-context";
import type { CouponValidationSuccess } from "@/lib/coupons/types";
import { validateCartCoupon } from "@/lib/coupons/client";

export interface CartItem {
  packageId: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  isHydrated: boolean;
  couponCode: string | null;
  appliedCoupon: CouponValidationSuccess | null;
  couponError: string | null;
  applyCartCoupon: (
    code: string,
    packageIds: string[],
    locale?: "tr" | "en"
  ) => Promise<{ success: boolean; message: string }>;
  removeCartCoupon: () => void;
  addToCart: (packageId: string) => void;
  removeFromCart: (packageId: string) => void;
  removeItemsFromCart: (packageIds: string[]) => void;
  clearCart: () => void;
  isInCart: (packageId: string) => boolean;
}

const GUEST_SESSION_KEY = "oriens_guest_session_id";
const USER_CART_PREFIX = "oriens_cart_user_";
const GUEST_CART_PREFIX = "oriens_cart_guest_";
const COUPON_KEY_SUFFIX = "_coupon";

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
    localStorage.removeItem(`${key}${COUPON_KEY_SUFFIX}`);
    window.dispatchEvent(new CustomEvent("oriens:cart_updated", { detail: { key } }));
  } catch {
    // ignore
  }
}

function readCouponFromStorage(key: string): { code: string | null; coupon: CouponValidationSuccess | null } {
  if (typeof window === "undefined") return { code: null, coupon: null };
  try {
    const raw = localStorage.getItem(`${key}${COUPON_KEY_SUFFIX}`);
    if (!raw) return { code: null, coupon: null };
    const parsed = JSON.parse(raw);
    return {
      code: typeof parsed?.code === "string" ? parsed.code : null,
      coupon: parsed?.coupon && typeof parsed.coupon === "object" ? parsed.coupon : null,
    };
  } catch {
    return { code: null, coupon: null };
  }
}

function writeCouponToStorage(key: string, code: string | null, coupon: CouponValidationSuccess | null): void {
  if (typeof window === "undefined") return;
  try {
    const couponKey = `${key}${COUPON_KEY_SUFFIX}`;
    if (!code) {
      localStorage.removeItem(couponKey);
    } else {
      localStorage.setItem(couponKey, JSON.stringify({ code, coupon }));
    }
    window.dispatchEvent(new CustomEvent("oriens:cart_updated", { detail: { key } }));
  } catch {
    // ignore
  }
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isInitializing } = useAccount();
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationSuccess | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
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
        const guestCoupon = readCouponFromStorage(guestKey);
        const userKey = `${USER_CART_PREFIX}${currentUserId}`;
        const userItems = readCartFromStorage(userKey);
        const userCoupon = readCouponFromStorage(userKey);

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

          // Preserve guest coupon if set, otherwise user coupon
          const activeCoupon = guestCoupon.code ? guestCoupon : userCoupon;
          if (activeCoupon.code) {
            writeCouponToStorage(userKey, activeCoupon.code, activeCoupon.coupon);
            setCouponCode(activeCoupon.code);
            setAppliedCoupon(activeCoupon.coupon);
          } else {
            setCouponCode(null);
            setAppliedCoupon(null);
          }
        } else {
          setItems(userItems);
          setCouponCode(userCoupon.code);
          setAppliedCoupon(userCoupon.coupon);
        }
      } else if (prevUserId !== undefined && prevUserId !== null && currentUserId === null) {
        // Transition from Authenticated User -> Logged out (Guest)
        const newGuestId = resetGuestSessionId();
        const newGuestKey = `${GUEST_CART_PREFIX}${newGuestId}`;
        activeKeyRef.current = newGuestKey;
        setItems([]);
        setCouponCode(null);
        setAppliedCoupon(null);
        setCouponError(null);
      } else {
        // Normal load / refresh
        const stored = readCartFromStorage(currentKey);
        const storedCoupon = readCouponFromStorage(currentKey);
        setItems(stored);
        setCouponCode(storedCoupon.code);
        setAppliedCoupon(storedCoupon.coupon);
      }

      setIsHydrated(true);
    };

    queueMicrotask(syncCart);
  }, [user?.id, isInitializing]);

  // Multi-tab synchronization
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (!activeKeyRef.current) return;
      if (e.key === activeKeyRef.current || e.key === `${activeKeyRef.current}${COUPON_KEY_SUFFIX}`) {
        const updated = readCartFromStorage(activeKeyRef.current);
        const updatedCoupon = readCouponFromStorage(activeKeyRef.current);
        setItems(updated);
        setCouponCode(updatedCoupon.code);
        setAppliedCoupon(updatedCoupon.coupon);
      }
    };

    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && (detail.key === activeKeyRef.current || detail.key === `${activeKeyRef.current}${COUPON_KEY_SUFFIX}`)) {
        const updated = readCartFromStorage(activeKeyRef.current);
        const updatedCoupon = readCouponFromStorage(activeKeyRef.current);
        setItems(updated);
        setCouponCode(updatedCoupon.code);
        setAppliedCoupon(updatedCoupon.coupon);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("oriens:cart_updated", handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("oriens:cart_updated", handleCustomEvent);
    };
  }, []);

  const applyCartCoupon = useCallback(
    async (code: string, packageIds: string[], locale: "tr" | "en" = "tr") => {
      const cleanCode = code.trim().toUpperCase();
      if (!cleanCode) {
        const msg = locale === "tr" ? "Lütfen bir kupon kodu girin." : "Please enter a coupon code.";
        setCouponError(msg);
        return { success: false, message: msg };
      }

      setCouponError(null);
      const result = await validateCartCoupon(cleanCode, packageIds, user?.id, locale);

      if (result.valid) {
        setCouponCode(cleanCode);
        setAppliedCoupon(result);
        setCouponError(null);
        const key = activeKeyRef.current || getStorageKey(user?.id, getOrCreateGuestSessionId());
        writeCouponToStorage(key, cleanCode, result);
        return { success: true, message: "" };
      } else {
        setCouponError(result.message);
        return { success: false, message: result.message };
      }
    },
    [user?.id]
  );

  const removeCartCoupon = useCallback(() => {
    setCouponCode(null);
    setAppliedCoupon(null);
    setCouponError(null);
    const key = activeKeyRef.current || getStorageKey(user?.id, getOrCreateGuestSessionId());
    writeCouponToStorage(key, null, null);
  }, [user?.id]);

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
      if (updated.length === 0) {
        writeCouponToStorage(key, null, null);
        setCouponCode(null);
        setAppliedCoupon(null);
        setCouponError(null);
      }
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
      if (updated.length === 0) {
        writeCouponToStorage(key, null, null);
        setCouponCode(null);
        setAppliedCoupon(null);
        setCouponError(null);
      }
      return updated;
    });
  }, [user?.id]);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCode(null);
    setAppliedCoupon(null);
    setCouponError(null);
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
        couponCode,
        appliedCoupon,
        couponError,
        applyCartCoupon,
        removeCartCoupon,
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

