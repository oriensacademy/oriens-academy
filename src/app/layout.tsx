import type { Metadata } from "next";
import { Inter, Manrope, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { CompassLoader } from "@/components/brand/CompassLoader";
import { AccountProvider } from "@/lib/auth/account-context";
import { CartProvider } from "@/lib/cart/cart-context";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-serif",
  display: "swap",
});

import { SITE_URL } from "@/lib/routes";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Oriens Academy",
  description: "International Exam Preparation & Academic Consultancy",
};

import { PublicSettingsProvider } from "@/lib/settings/public-settings-context";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${dmSerif.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.lang=location.pathname.split("/")[1]==="en"?"en":"tr";var th=localStorage.getItem("oriens-theme")||localStorage.getItem("oriens-theme-preview");if(th){document.documentElement.dataset.theme=th;}if(sessionStorage.getItem("oriens-loader-seen")==="1"||sessionStorage.getItem("oriens-language-transition")){document.documentElement.dataset.oriensLoaderSkip="1"}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <PublicSettingsProvider>
          <AccountProvider>
            <CartProvider>
              <CompassLoader>{children}</CompassLoader>
            </CartProvider>
          </AccountProvider>
        </PublicSettingsProvider>
      </body>
    </html>
  );
}
