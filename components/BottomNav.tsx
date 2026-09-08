import Link from "next/link";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/series", label: "Series" },
  { href: "/movies", label: "Movies" },
  { href: "/my-list", label: "My List" },
  { href: "/profile", label: "Profile" }
];

// Touch-friendly bottom navigation shown below the md breakpoint.
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-surface py-2 font-ui text-xs text-text-primary md:hidden">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className="flex-1 py-1 text-center hover:text-primary">
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
