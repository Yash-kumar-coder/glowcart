import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GlowCart — Scan your skin. Shop only what it needs.",
  description:
    "GlowCart uses three YouCam APIs — AI Skin Analysis, Skin Tone Analysis and Makeup VTO — to score your skin from one selfie, match your exact foundation shade, let you try it on, and build a shoppable routine matched to your concerns and budget.",
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="GlowCart home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-g.png" alt="" className="h-10 w-10 object-contain" />
      <span className="font-display text-[22px] font-semibold tracking-tight text-forest">
        GlowCart
      </span>
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-ink/8 bg-cream/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <Logo />
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/#how-it-works"
                className="hidden rounded-full px-3 py-2 text-sm font-semibold text-ink/70 transition-colors hover:text-forest sm:block"
              >
                How it works
              </Link>
              <Link
                href="/#concerns"
                className="hidden rounded-full px-3 py-2 text-sm font-semibold text-ink/70 transition-colors hover:text-forest sm:block"
              >
                What we measure
              </Link>
              <Link
                href="/scan"
                className="ml-1 rounded-full bg-forest px-4 py-2 text-sm font-bold text-cream transition-colors hover:bg-clay"
              >
                Start your scan
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="bg-forest text-cream">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <p className="font-display text-2xl font-semibold">GlowCart</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-cream/70">
                Scan your skin. Shop only what your skin actually needs.
                One selfie, twelve skin scores, and a routine built from
                your results — not from ads.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cream/50">
                Product
              </p>
              <ul className="mt-3 space-y-2 text-sm text-cream/80">
                <li>
                  <Link href="/scan" className="hover:text-cream">Skin scan</Link>
                </li>
                <li>
                  <Link href="/#how-it-works" className="hover:text-cream">How it works</Link>
                </li>
                <li>
                  <Link href="/#concerns" className="hover:text-cream">Skin concerns</Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cream/50">
                Built with
              </p>
              <p className="mt-3 text-sm leading-relaxed text-cream/80">
                YouCam AI Skin Analysis API by Perfect Corp, Next.js,
                TypeScript and Tailwind CSS.
              </p>
            </div>
          </div>
          <div className="border-t border-cream/15">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs leading-relaxed text-cream/50 sm:px-6 md:flex-row md:items-center md:justify-between">
              <p>
                GlowCart is a demo built for the YouCam API Skin AI &amp;
                eCommerce VTO Hackathon. Product catalog and checkout are
                illustrative.
              </p>
              <p>
                Skin scores are cosmetic guidance, not a medical diagnosis.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
