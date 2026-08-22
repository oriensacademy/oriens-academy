import type { Metadata } from "next";
import { Inter, Manrope, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { CompassLoader } from "@/components/brand/CompassLoader";
import { AccountProvider } from "@/lib/auth/account-context";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://oriens-academy.com"),
  title: "Oriens Academy",
  description: "International Exam Preparation & Academic Consultancy",
};

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
            __html: `try{document.documentElement.lang=location.pathname.split("/")[1]==="en"?"en":"tr";if(sessionStorage.getItem("oriens-loader-seen")==="1"||sessionStorage.getItem("oriens-language-transition")){document.documentElement.dataset.oriensLoaderSkip="1"}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <AccountProvider><CompassLoader>{children}</CompassLoader></AccountProvider>
      </body>
    </html>
  );
}
