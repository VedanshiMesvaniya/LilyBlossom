import type { Metadata } from "next";
import { Playfair_Display, Quicksand } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { getCurrentProfile } from "@/lib/auth/session";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap"
});

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap"
});

export const metadata: Metadata = {
  title: "GL Tracker",
  description: "A dedicated Girls' Love (GL) media catalog and personal watch tracker.",
  icons: { icon: "/favicon.svg" }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the profile here (rather than in Header) keeps the "is this
  // user an admin" check in one server-side place.
  const profile = await getCurrentProfile().catch(() => null);

  return (
    <html lang="en" className={`${playfair.variable} ${quicksand.variable}`}>
      <body className="flex min-h-screen flex-col font-ui">
        <Header isAdmin={profile?.role === "admin"} />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
