import type { Metadata } from "next";
import { Inter, Manrope, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { CompassLoader } from "@/components/brand/CompassLoader";
import { AccountProvider } from "@/lib/auth/account-context";
import { CartProvider } from "@/lib/cart/cart-context";
import { RELEASE_VERSION } from "@/lib/release-version";

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
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
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
        <meta name="oriens-build-version" content={RELEASE_VERSION} />
        {/* Google tag (gtag.js) */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-GHH772JLM4"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-GHH772JLM4');`,
          }}
        />
        {/* End Google tag (gtag.js) */}
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5Z8NXLW7');`,
          }}
        />
        {/* End Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.lang=location.pathname.split("/")[1]==="en"?"en":"tr";var th=localStorage.getItem("oriens-theme")||localStorage.getItem("oriens-theme-preview");if(th){document.documentElement.dataset.theme=th;}if(sessionStorage.getItem("oriens-loader-seen")==="1"||sessionStorage.getItem("oriens-language-transition")){document.documentElement.dataset.oriensLoaderSkip="1"}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5Z8NXLW7"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
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
