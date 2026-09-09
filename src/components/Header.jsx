import { Link } from "react-router-dom";
import { HeartLogo } from "./HeartLogo.jsx";
import { PRODUCT_NAME } from "../lib/constants.js";
import { useAuth } from "../hooks/useAuth.jsx";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/series", label: "Series" },
  { href: "/movies", label: "Movies" },
  { href: "/announcements", label: "Announcements" },
  { href: "/my-list", label: "My List" }
];

/**
 * Primary site header. Reads admin status straight from the auth
 * context instead of being passed a profile from a server layout,
 * since there is no server render anymore.
 */
export function Header() {
  const { isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <HeartLogo size={24} />
          <span className="font-display text-lg tracking-tight text-text-primary">
            {PRODUCT_NAME}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 font-ui text-sm text-text-primary md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} to={link.href} className="hover:text-primary">
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className="hover:text-primary">
              Admin
            </Link>
          )}
        </nav>

        <Link
          to="/profile"
          className="rounded-full bg-primary px-4 py-2 font-ui text-sm text-white hover:bg-primary-hover"
        >
          Profile
        </Link>
      </div>
    </header>
  );
}
