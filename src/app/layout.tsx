import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Newsreader } from "next/font/google";
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

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vibe Tracker",
  description:
    "Spotify Wrapped for developers. Turn GitHub pull request activity into a beautiful recap without reading your source code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body
        className={`${manrope.variable} ${newsreader.variable} ${ibmPlexMono.variable} bg-background text-foreground antialiased selection:bg-accent/20 selection:text-foreground`}
      >
        <TimezoneSync />
        {children}
      </body>
    </html>
  );
}
