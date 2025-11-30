import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ContableAR - Sistema de Contabilidad Argentino",
  description: "Sistema completo de contabilidad para Argentina",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className={inter.className}>
          {children}
          <Toaster position="top-right" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
