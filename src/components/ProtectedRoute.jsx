import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

// Replaces the old server-side `redirect("/login?next=...")` pattern
// used in the my-list and profile pages, now that pages render only
// in the browser.
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) {
    const next = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

// Replaces the old server-side `requireAdmin()` check. Row Level
// Security is still the real boundary (see docs/ADMIN.md); this only
// controls whether the page renders in the browser.
export function RequireAdmin({ children }) {
  const { profile, loading, user } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (profile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-ui">
        <h1 className="font-display text-2xl text-text-primary">Admin access required</h1>
        <p className="mt-2 text-text-muted">
          This account does not have admin access. Ask an existing admin to set it up, see
          docs/SETUP.md.
        </p>
      </div>
    );
  }
  return children;
}
