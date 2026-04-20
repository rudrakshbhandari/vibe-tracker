import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { TimezoneSync } from "@/components/timezone-sync";
import "./globals.css";

// Inline script: runs before first paint to set data-theme from localStorage (or system preference),
// eliminating flash of wrong theme on page load.
const ANTI_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('vt-theme');document.documentElement.setAttribute('data-theme',t==='dark'||t==='light'?t:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}})()` as const;

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vibe Tracker",
  description:
    "Track shipped additions and deletions from merged pull requests across repositories and time windows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTI_FLASH_SCRIPT }} />
      </head>
      <body
        className={`${manrope.variable} bg-background text-foreground antialiased selection:bg-accent/20 selection:text-foreground`}
      >
        <TimezoneSync />
        {children}
      </body>
    </html>
  );
}
