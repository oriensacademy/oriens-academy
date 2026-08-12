"use client";

import { createContext, useContext } from "react";

/**
 * True once the compass loader has started (or finished) revealing the
 * page. Above-the-fold entrance animations (Hero) key off this instead of
 * `whileInView`, since they're already in the viewport and would otherwise
 * play out hidden behind the loader overlay. Defaults to `true` so any
 * component using this hook still renders correctly outside the provider.
 */
const LoaderRevealContext = createContext(true);

export function LoaderRevealProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return (
    <LoaderRevealContext.Provider value={value}>{children}</LoaderRevealContext.Provider>
  );
}

export function useLoaderReveal() {
  return useContext(LoaderRevealContext);
}
