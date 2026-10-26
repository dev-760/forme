import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./styles.css";

export const metadata: Metadata = {
  title: "FORME — Personal Wardrobe & Style Atelier",
  description: "A considered digital space to organize your wardrobe, curate outfits, and dress with intention.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/forme-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0d0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
