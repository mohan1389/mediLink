import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediLink — Your Medical Records, Simplified",
  description:
    "MediLink lets patients securely store medical records, share them with doctors, and track health vitals — all in one place.",
  keywords: ["medical records", "patient portal", "doctor sharing", "health tracking"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider signUpForceRedirectUrl="/onboarding" signInForceRedirectUrl="/">
      <html
        lang="en"
        className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-white text-slate-900">{children}</body>
      </html>
    </ClerkProvider>
  );
}
