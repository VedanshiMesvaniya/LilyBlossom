import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function submitSearch(event) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-primary">
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

        <form onSubmit={submitSearch} className="hidden max-w-xs flex-1 sm:block">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search GL titles..."
            aria-label="Search GL titles"
            className="w-full rounded-full border border-border bg-background px-3 py-1.5 font-ui text-sm text-text-primary focus:border-primary focus:outline-none"
          />
        </form>

        <Link
          to="/profile"
          className="shrink-0 rounded-full bg-primary px-4 py-2 font-ui text-sm text-white hover:bg-primary-hover"
        >
          Profile
        </Link>
      </div>
    </header>
  );
}
