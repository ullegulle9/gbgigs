create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "Admins can read all venues"
  on public.venues
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can create venues"
  on public.venues
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update venues"
  on public.venues
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete venues"
  on public.venues
  for delete
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can read all events"
  on public.events
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can create events"
  on public.events
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update events"
  on public.events
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete events"
  on public.events
  for delete
  to authenticated
  using ((select public.is_admin()));
