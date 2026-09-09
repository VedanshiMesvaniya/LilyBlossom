import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { generateUniqueUsername } from "../lib/usernameGenerator.js";

export function SignupPage() {
  const navigate = useNavigate();

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
      const normalizedEmail = email.trim().toLowerCase();

      if (password.length < 8) {
        throw new Error(
          "Password must be at least 8 characters long."
        );
      }

      const username = await generateUniqueUsername();

      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,

          options: {
            data: {
              username,
            },

            emailRedirectTo:
              `${window.location.origin}/login`,
          },
        });

      if (signUpError) {
        const errorMessage =
          signUpError.message.toLowerCase();

        if (
          errorMessage.includes("rate limit") ||
          errorMessage.includes("email rate limit")
        ) {
          throw new Error(
            "Supabase email rate limit reached. " +
            "For local development, disable Confirm Email " +
            "in Supabase Authentication → Providers → Email."
          );
        }

        if (
          errorMessage.includes("already registered") ||
          errorMessage.includes("already exists")
        ) {
          throw new Error(
            "An account with this email already exists. " +
            "Please log in instead."
          );
        }

        throw signUpError;
      }

      if (!data.user) {
        throw new Error(
          "Account creation failed. Please try again."
        );
      }

      /*
       * The profile is NOT inserted here.
       *
       * The PostgreSQL trigger creates it automatically:
       *
       * auth.users
       *      ↓
       * on_auth_user_created
       *      ↓
       * public.profiles
       */

      if (data.session) {
        navigate("/");
        return;
      }

      setMessage(
        "Account created successfully. " +
        "Please check your email and confirm your account " +
        "before logging in."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 font-ui">

      <h1 className="font-display text-3xl text-text-primary">
        Create your account
      </h1>

      <p className="mt-2 text-sm text-text-muted">
        We will generate a unique GL-themed username
        for you automatically.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4"
      >

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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2"
          />

          <p className="mt-1 text-xs text-text-muted">
            Minimum 8 characters.
          </p>
        </div>

        {error && (
          <div className="rounded-card border border-red-300 bg-red-50 px-3 py-2">
            <p className="text-sm text-red-600">
              {error}
            </p>
          </div>
        )}

        {message && (
          <div className="rounded-card border border-border bg-surface px-3 py-2">
            <p className="text-sm text-text-primary">
              {message}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-4 py-2 text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {isSubmitting
            ? "Creating account..."
            : "Sign up"}
        </button>

      </form>

      <p className="mt-4 text-sm text-text-muted">
        Already have an account?{" "}

        <Link
          to="/login"
          className="text-primary hover:text-primary-hover"
        >
          Log in
        </Link>
      </p>

    </div>
  );
}
