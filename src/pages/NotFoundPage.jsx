import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center font-ui">
      <h1 className="font-display text-3xl text-text-primary">Page not found</h1>
      <p className="mt-2 text-text-muted">That page does not exist.</p>
      <Link to="/" className="mt-6 inline-block text-primary hover:text-primary-hover">
        Back to home
      </Link>
    </div>
  );
}
