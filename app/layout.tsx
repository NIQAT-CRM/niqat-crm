import "./globals.css";
import type { Metadata } from "next";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "نقاط CRM",
  description: "نظام إدارة عملاء نقاط",
  metadataBase: new URL("https://niqatcrm.com"),
  openGraph: {
    title: "نقاط CRM",
    description: "نظام إدارة عملاء نقاط",
    url: "https://niqatcrm.com",
    siteName: "نقاط CRM",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "نقاط CRM" }],
    locale: "ar_EG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "نقاط CRM",
    description: "نظام إدارة عملاء نقاط",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body>{children}</body>
    </html>
  );
}
