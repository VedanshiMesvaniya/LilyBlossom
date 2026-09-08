import Link from "next/link";
import { HeartLogo } from "./HeartLogo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/series", label: "Series" },
  { href: "/movies", label: "Movies" },
  { href: "/announcements", label: "Announcements" },
  { href: "/my-list", label: "My List" }
];

/**
 * Primary site header. Admin link is added conditionally by the caller
 * once the signed-in profile's role is known (see app/layout.tsx),
 * so this component never has to guess a role on its own.
 */
export function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <HeartLogo size={24} />
          <span className="font-display text-lg tracking-tight text-text-primary">
            GL Tracker
          </span>
        </Link>

        <nav className="hidden items-center gap-6 font-ui text-sm text-text-primary md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-primary">
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="hover:text-primary">
              Admin
            </Link>
          )}
        </nav>

        <Link
          href="/profile"
          className="rounded-full bg-primary px-4 py-2 font-ui text-sm text-white hover:bg-primary-hover"
        >
          Profile
        </Link>
      </div>
    </header>
  );
}
