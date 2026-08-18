import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const viewport = {
  // Lets the page use the full height as the browser's toolbar collapses, and
  // tints the browser's own bar to match rather than leaving a visible band.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#faf7f1",
};

export const metadata: Metadata = {
  title: {
    default: "Kappa Bakes - Premium San Sebastián Cheesecakes",
    // Any page setting its own title gets the brand in front of it.
    template: "Kappa Bakes - %s",
  },
  description:
    "Homemade. Premium. Baked with love. San Sebastián cheesecakes by the slice, collection only, Batley.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body
        className={`${display.variable} ${body.variable} flex min-h-[100dvh] flex-col bg-cream font-body text-ink antialiased`}
      >
        <Header />
        <div className="grow">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
