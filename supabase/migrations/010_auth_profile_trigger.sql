-- ============================================================
-- Automatically create a profile whenever a new auth user
-- is created.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
  attempt integer := 0;
begin

  -- Get username from Supabase Auth metadata.
  base_username :=
    nullif(
      trim(new.raw_user_meta_data ->> 'username'),
      ''
    );

  -- Fallback username if metadata does not contain one.
  if base_username is null then
    base_username :=
      'Lily' ||
      substr(
        replace(new.id::text, '-', ''),
        1,
        8
      );
  end if;

  final_username := base_username;

  -- Make sure username is unique.
  while exists (
    select 1
    from public.profiles
    where username = final_username
  ) loop

    attempt := attempt + 1;

    final_username :=
      base_username ||
      floor(random() * 90 + 10)::integer::text;

    -- Final fallback using UUID.
    if attempt >= 20 then
      final_username :=
        base_username ||
        '_' ||
        substr(
          replace(new.id::text, '-', ''),
          1,
          8
        );

      exit;
    end if;

  end loop;

  -- Create the profile.
  insert into public.profiles (
    id,
    username
  )
  values (
    new.id,
    final_username
  );

  return new;
end;
$$;


-- The trigger function is only needed by PostgreSQL.
-- Do not allow anon/authenticated clients to execute it directly.
revoke execute
on function public.handle_new_user()
from public, anon, authenticated;


-- Remove old trigger if it exists.
drop trigger if exists on_auth_user_created on auth.users;


-- Create trigger.
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

