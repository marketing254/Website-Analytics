import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Launch Analytics · GA4",
  description: "Realtime and week-over-week analytics for launched websites",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%232563eb'/><rect x='22' y='62' width='12' height='18' rx='2' fill='white' opacity='0.55'/><rect x='42' y='42' width='12' height='38' rx='2' fill='white' opacity='0.78'/><rect x='62' y='22' width='12' height='58' rx='2' fill='white'/></svg>"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
