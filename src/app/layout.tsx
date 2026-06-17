import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ProgressBar, ProgressBarProvider } from "react-transition-progress";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MAQUIN Engineering Services",
    template: "%s · MAQUIN Engineering Services",
  },
  description:
    "Operations console for MAQUIN Engineering Services — projects, inventory, and finance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ProgressBarProvider>
            <ProgressBar className="bg-primary fixed top-0 left-0 z-[60] h-0.5 shadow-[0_0_8px_0_var(--primary)]" />
            {children}
          </ProgressBarProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
