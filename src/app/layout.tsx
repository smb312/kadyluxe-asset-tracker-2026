import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Inconsolata } from "next/font/google";
import "./globals.css";

const body = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});
const disp = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-disp",
});
const mono = Inconsolata({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "KadyLuxe — Asset Tracker",
  description: "Paid asset readiness tracker for KadyLuxe.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${disp.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
