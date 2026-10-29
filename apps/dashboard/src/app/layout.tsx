import type { Metadata } from "next";
import Link from "next/link";
import "@passaparola/shared/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Passaparola Dashboard", template: "%s · Passaparola" },
  description: "Performance of creator Reels for Passaparola restaurants (prototype).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=DM+Sans:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        <header className="topbar">
          <div className="container topbar__inner">
            <Link className="brand" href="/dashboard">
              <span className="brand__mark" aria-hidden="true">P</span>
              Passaparola <small>Dashboard · prototype</small>
            </Link>
            <nav aria-label="Main">
              <Link href="/dashboard">Restaurants</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
