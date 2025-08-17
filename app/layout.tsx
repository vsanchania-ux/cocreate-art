import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoCreate Art — MVP",
  description: "Collaborative edge-to-edge drawing MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-white to-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
