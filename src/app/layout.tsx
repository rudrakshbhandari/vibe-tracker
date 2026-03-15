import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import { TimezoneSync } from "@/components/timezone-sync";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
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
    <html lang="en">
      <body
        className={`${manrope.variable} ${newsreader.variable} bg-background text-foreground antialiased selection:bg-accent/20 selection:text-foreground`}
      >
        <TimezoneSync />
        {children}
      </body>
    </html>
  );
}
