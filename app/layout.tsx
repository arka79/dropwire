import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Dropwire — browser-to-browser file transfer",
    template: "%s · Dropwire",
  },
  description:
    "Private, browser-to-browser file sharing. Create a temporary room, share the link, and files move directly between devices. No uploads, no accounts, no permanent storage.",
  applicationName: "Dropwire",
  keywords: [
    "peer to peer",
    "webrtc",
    "file transfer",
    "browser to browser",
    "private file sharing",
  ],
  openGraph: {
    title: "Dropwire — move files, not through us",
    description:
      "Private, browser-to-browser file sharing. No uploads. No accounts. No permanent storage.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c09" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeInit = `try{var t=localStorage.getItem("dropwire:theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(_){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
