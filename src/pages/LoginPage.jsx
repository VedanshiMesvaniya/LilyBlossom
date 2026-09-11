import { useState } from "react";
import {
  useNavigate,
  useSearchParams,
  Link
} from "react-router-dom";

import { supabase } from "../lib/supabaseClient.js";
import { sanitizeNextPath } from "../lib/sanitizeNextPath.js";

export function LoginPage() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const normalizedEmail =
        email.trim().toLowerCase();

      const {
        error: signInError
      } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (signInError) {
        const errorMessage =
          signInError.message.toLowerCase();

        if (
          errorMessage.includes("email not confirmed")
        ) {
          throw new Error(
            "Please confirm your email address before logging in."
          );
        }

        if (
          errorMessage.includes("invalid login credentials")
        ) {
          throw new Error(
            "Invalid email or password."
          );
        }

        throw signInError;
      }

      const next = sanitizeNextPath(searchParams.get("next"));

      navigate(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }


  async function handleForgotPassword() {
    setError(null);
    setMessage(null);

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(
        "Enter your email above first, then tap Forgot password."
      );
      return;
    }

    const {
      error: resetError
    } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo:
          `${window.location.origin}/login`
      }
    );

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage(
      "Password reset email sent. Please check your inbox."
    );
  }


  return (
    <div className="mx-auto max-w-sm px-4 py-16 font-ui">

      <h1 className="font-display text-3xl text-text-primary">
        Log in
      </h1>


      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4"
      >

        {/* EMAIL */}

        <div>
          <label
            className="block text-sm text-text-primary"
            htmlFor="email"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2"
          />
        </div>


        {/* PASSWORD */}

        <div>
          <label
            className="block text-sm text-text-primary"
            htmlFor="password"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2"
          />
        </div>


        {/* ERROR */}

        {error && (
          <div className="rounded-card border border-red-300 bg-red-50 px-3 py-2">
            <p className="text-sm text-red-600">
              {error}
            </p>
          </div>
        )}


        {/* SUCCESS */}

        {message && (
          <div className="rounded-card border border-border bg-surface px-3 py-2">
            <p className="text-sm text-text-primary">
              {message}
            </p>
          </div>
        )}


        {/* LOGIN */}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-4 py-2 text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {isSubmitting
            ? "Logging in..."
            : "Log in"}
        </button>

      </form>


      {/* FORGOT PASSWORD */}

      <button
        type="button"
        onClick={handleForgotPassword}
        className="mt-4 text-sm text-primary hover:text-primary-hover"
      >
        Forgot password?
      </button>


      {/* SIGNUP */}

      <p className="mt-4 text-sm text-text-muted">
        New here?{" "}

        <Link
          to="/signup"
          className="text-primary hover:text-primary-hover"
        >
          Create an account
        </Link>
      </p>

    </div>
  );
}
