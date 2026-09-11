import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../hooks/useAuth.jsx";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

function EditProfileForm({ profile, onSaved, onCancel }) {
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [favoriteGl, setFavoriteGl] = useState(profile.favorite_gl ?? "");
  const [favoritePairing, setFavoritePairing] = useState(profile.favorite_pairing ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      setError("Username must be 3-24 characters: letters, numbers, and underscores only.");
      return;
    }
    if (bio.length > 280) {
      setError("Bio must be 280 characters or fewer.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        username: trimmedUsername,
        bio: bio.trim() || null,
        favorite_gl: favoriteGl.trim() || null,
        favorite_pairing: favoritePairing.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", profile.id)
      .select()
      .single();

    setSaving(false);

    if (updateError) {
      // profiles.username has a unique constraint (001_profiles.sql);
      // Postgres reports a violation as code 23505.
      setError(
        updateError.code === "23505" ? "That username is already taken." : updateError.message
      );
      return;
    }

    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 font-ui">
      <div>
        <label className="block text-sm text-text-primary" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-text-primary"
        />
      </div>

      <div>
        <label className="block text-sm text-text-primary" htmlFor="bio">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={280}
          rows={3}
          className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-text-primary"
        />
        <p className="mt-1 text-xs text-text-muted">{bio.length}/280</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-text-primary" htmlFor="favorite-gl">
            Favorite GL
          </label>
          <input
            id="favorite-gl"
            value={favoriteGl}
            onChange={(event) => setFavoriteGl(event.target.value)}
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm text-text-primary" htmlFor="favorite-pairing">
            Favorite Pairing
          </label>
          <input
            id="favorite-pairing"
            value={favoritePairing}
            onChange={(event) => setFavoritePairing(event.target.value)}
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-text-primary"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-border px-4 py-2 text-sm text-text-primary hover:border-primary disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, refreshProfile, signOut } = useAuth();
  const [counts, setCounts] = useState({ watching: 0, watched: 0, plan_to_watch: 0, dropped: 0 });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let isMounted = true;

    supabase
      .from("user_media_status")
      .select("status")
      .eq("user_id", profile.id)
      .then(({ data }) => {
        if (!isMounted) return;
        const next = { watching: 0, watched: 0, plan_to_watch: 0, dropped: 0 };
        for (const row of data ?? []) next[row.status] = (next[row.status] ?? 0) + 1;
        setCounts(next);
      });

    return () => {
      isMounted = false;
    };
  }, [profile]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      if (signOut) {
        await signOut();
      } else {
        await supabase.auth.signOut();
      }
      navigate("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleSaved() {
    setEditing(false);
    setSavedMessage(true);
    await refreshProfile();
    setTimeout(() => setSavedMessage(false), 3000);
  }

  if (!profile) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const completionRate = total > 0 ? Math.round((counts.watched / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 font-ui">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-text-primary">{profile.username}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Member since {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="self-start rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:border-primary"
            >
              Edit profile
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="self-start rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </div>

      {savedMessage && <p className="mt-4 text-sm text-primary">Profile updated.</p>}

      {editing ? (
        <EditProfileForm profile={profile} onSaved={handleSaved} onCancel={() => setEditing(false)} />
      ) : (
        (profile.bio || profile.favorite_gl || profile.favorite_pairing) && (
          <div className="mt-6 space-y-1 text-sm text-text-primary">
            {profile.bio && <p>{profile.bio}</p>}
            {profile.favorite_gl && (
              <p className="text-text-muted">
                Favorite GL: <span className="text-text-primary">{profile.favorite_gl}</span>
              </p>
            )}
            {profile.favorite_pairing && (
              <p className="text-text-muted">
                Favorite Pairing: <span className="text-text-primary">{profile.favorite_pairing}</span>
              </p>
            )}
          </div>
        )
      )}

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["Watched", counts.watched],
          ["Watching", counts.watching],
          ["Plan to Watch", counts.plan_to_watch],
          ["Dropped", counts.dropped],
          ["Completion Rate", `${completionRate}%`]
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-border bg-surface p-4">
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="mt-1 text-xl text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
