-- ============================================================================
-- User approval workflow: every new signup starts as 'pending' and must be
-- approved by an admin before they can use the app. Existing users (already
-- in production) are backfilled to 'approved' so nobody already using the
-- app gets locked out.
-- ============================================================================
alter table public.profiles
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected'));

update public.profiles set approval_status = 'approved' where approval_status = 'pending';

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
on public.profiles for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- admin_list_users: returns every user with their email (not otherwise
-- readable from the client), profile, and current role, for the admin user
-- management screen. Access is gated inside the function itself.
-- ============================================================================
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  username text,
  avatar_url text,
  created_at timestamptz,
  approval_status text,
  role public.app_role
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.full_name,
      p.username,
      p.avatar_url,
      p.created_at,
      p.approval_status,
      coalesce(
        (select ur.role from public.user_roles ur where ur.user_id = u.id order by ur.role limit 1),
        'student'::public.app_role
      )
    from auth.users u
    join public.profiles p on p.id = u.id
    order by p.created_at desc;
end;
$$;
