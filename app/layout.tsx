import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Archivo_Black, Nunito, Poppins } from "next/font/google";
import { SupabaseProvider } from "@/lib/providers/supabase-provider";
import "./globals.css";

const displayFont = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const bodyFont = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const logoFont = Poppins({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: "600",
});

export const metadata: Metadata = {
  title: "PlusOne — Never go alone again.",
  description:
    "PlusOne pairs you with a verified, strictly-platonic event companion for weddings, galas, parties, and reunions. Launching in Salt Lake City — join the waitlist.",
  icons: {
    icon: "/brand/plusone-mark.svg",
    apple: "/brand/plusone-app-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${logoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
