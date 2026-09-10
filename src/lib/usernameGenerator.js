// Generates a GL-themed username for a new account.
//
// Example:
// VelvetLily
// MoonlitRose
// SakuraBloom

const ADJECTIVES = [
  "Velvet",
  "Moonlit",
  "Blush",
  "Sakura",
  "Lavender",
  "Cherry",
  "Pink",
  "Soft",
  "Rosy",
  "Midnight",
  "Petal",
  "Silken",
  "Dusky",
  "Honeyed",
  "Gentle",
  "Starlit",
  "Dreamy",
  "Tender",
  "Frosted",
  "Amber"
];

const NOUNS = [
  "Lily",
  "Rose",
  "Muse",
  "Heart",
  "Orbit",
  "Starlight",
  "Moon",
  "Orchid",
  "Comet",
  "Petal",
  "Bloom",
  "Dream",
  "Glow",
  "Whisper",
  "Halo",
  "Ribbon",
  "Blossom",
  "Aria",
  "Ember",
  "Dawn"
];


function randomItem(items) {
  return items[
    Math.floor(Math.random() * items.length)
  ];
}


/**
 * Generate a GL-themed username.
 *
 * The database trigger is responsible for making
 * the username unique.
 */
export function generateUsername() {
  return `${randomItem(ADJECTIVES)}${randomItem(NOUNS)}`;
}


/**
 * Kept for compatibility with existing imports.
 *
 * This function does not insert anything into the database.
 * It simply generates a username.
 */
export async function generateUniqueUsername() {
  return generateUsername();
}
