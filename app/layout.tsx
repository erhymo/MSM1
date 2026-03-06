import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";
import { AuthProvider } from "@/lib/firebase/auth-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MSM1",
  description: "Desktop-first trading analysis dashboard for MSM1.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}