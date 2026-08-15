import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/src/components/providers/AuthProvider";
import { ToastProvider } from "@/src/components/providers/ToastProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Intervue — AI Interview Practice Platform",
  description:
    "Practice interviews with AI-powered feedback. Improve your skills and crack your dream role with Intervue.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
