import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigate(searchParams.get("next") ?? "/");
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then tap Forgot password.");
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setError(resetError ? resetError.message : "Password reset email sent.");
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 font-ui">
      <h1 className="font-display text-3xl text-text-primary">Log in</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm text-text-primary" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-text-primary" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-text-muted">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-4 py-2 text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <button onClick={handleForgotPassword} className="mt-4 text-sm text-primary hover:text-primary-hover">
        Forgot password?
      </button>

      <p className="mt-4 text-sm text-text-muted">
        New here?{" "}
        <Link to="/signup" className="text-primary hover:text-primary-hover">
          Create an account
        </Link>
      </p>
    </div>
  );
}
