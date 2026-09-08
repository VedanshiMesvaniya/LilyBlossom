-- Profiles: one row per auth.users row.
-- Username is generated client-side by lib/usernameGenerator.ts at
-- sign-up time; the UNIQUE constraint here is the final guarantee
-- under concurrent sign-ups.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  favorite_gl text,
  favorite_pairing text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on profiles (username);
