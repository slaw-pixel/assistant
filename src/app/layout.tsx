import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Assistant",
  description: "Market cockpit — betas, divergence, live feed",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
