create extension if not exists pgcrypto;

create table if not exists public.corner_projects (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  source_image_data text not null,
  space_type text not null default 'desk_corner',
  style_tags text[] not null default '{}',
  interest_tags text[] not null default '{}',
  budget_level text not null default 'medium' check (budget_level in ('low', 'medium', 'high')),
  scene_understanding jsonb,
  plan_output jsonb,
  background_url text,
  viewer_models jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists corner_projects_created_at_idx
  on public.corner_projects (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists corner_projects_set_updated_at on public.corner_projects;

create trigger corner_projects_set_updated_at
before update on public.corner_projects
for each row
execute function public.set_updated_at();
