create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id),
  action text not null check (
    action in ('publish', 'unpublish', 'edit', 'merge', 'delete', 'approve', 'reject', 'crawler_run')
  ),
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_actions_admin on admin_actions (admin_id);
