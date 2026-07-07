import type { Metadata, Viewport } from "next";
import { PwaInstall } from "@/components/pwa-install";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor Local Remote",
  description: "Control Cursor IDE from any device on your local network",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CLR",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overscroll-none">
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
