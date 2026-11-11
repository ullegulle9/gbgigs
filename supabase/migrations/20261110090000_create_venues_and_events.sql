create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete restrict,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  ticket_url text,
  source_url text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (end_at is null or end_at >= start_at)
);

create index events_published_start_at_idx
  on public.events (start_at)
  where status = 'published';

create index events_venue_id_idx
  on public.events (venue_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger venues_set_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.venues enable row level security;
alter table public.events enable row level security;

create policy "Anyone can read published events"
  on public.events
  for select
  to anon, authenticated
  using (status = 'published');

create policy "Anyone can read venues with published events"
  on public.venues
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.events
      where events.venue_id = venues.id
        and events.status = 'published'
    )
  );
