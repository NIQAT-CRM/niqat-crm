import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Niqat CRM",
  description: "Niqat Customer Relationship Management",
  metadataBase: new URL("https://niqatcrm.com"),
  openGraph: {
    title: "Niqat CRM",
    description: "Niqat Customer Relationship Management",
    url: "https://niqatcrm.com",
    siteName: "Niqat CRM",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Niqat CRM" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Niqat CRM",
    description: "Niqat Customer Relationship Management",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
