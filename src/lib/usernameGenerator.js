// Generates a unique, GL-themed display name for new accounts.
// Format: Adjective + Flower/Object, e.g. "VelvetLily", "MoonlitRose".
//
// Call generateUniqueUsername(supabase) once during sign-up. It checks
// the database for a collision before returning, and only appends a
// number after repeated collisions, per the "avoid random numbers
// unless necessary" rule.

const ADJECTIVES = [
  "Velvet", "Moonlit", "Blush", "Sakura", "Lavender", "Cherry", "Pink",
  "Soft", "Rosy", "Midnight", "Petal", "Silken", "Dusky", "Honeyed",
  "Gentle", "Starlit", "Dreamy", "Tender", "Frosted", "Amber"
];

const NOUNS = [
  "Lily", "Rose", "Muse", "Heart", "Orbit", "Starlight", "Moon",
  "Orchid", "Comet", "Petal", "Bloom", "Dream", "Glow", "Whisper",
  "Halo", "Ribbon", "Blossom", "Aria", "Ember", "Dawn"
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildCandidate(withSuffix) {
  const base = `${randomItem(ADJECTIVES)}${randomItem(NOUNS)}`;
  if (!withSuffix) return base;
  const suffix = Math.floor(10 + Math.random() * 90);
  return `${base}${suffix}`;
}

/**
 * Returns a username guaranteed not to collide with an existing row in
 * profiles.username at the moment it is generated. The database column
 * still needs a UNIQUE constraint as the final guarantee under race
 * conditions (see supabase/migrations/001_profiles.sql).
 */
export async function generateUniqueUsername(supabase, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Only start adding a number suffix after several plain collisions.
    const candidate = buildCandidate(attempt >= 8);

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Username uniqueness check failed: ${error.message}`);
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique username after multiple attempts.");
}
