-- =====================================================================
-- aura.skin — staff invitations
-- ---------------------------------------------------------------------
-- Supports the invite-staff edge function: an owner-invited profile row
-- is inserted with is_active = false and stays that way until the
-- invited person actually accepts (sets a password and signs in). Before
-- that point the row exists (so the owner can see "invited, pending" in
-- the Staff list) but grants no access — is_staff() already requires
-- is_active, so no change needed there.
-- =====================================================================

alter table public.profiles add column if not exists invited_by uuid references auth.users(id);
alter table public.profiles add column if not exists invited_at timestamptz;
alter table public.profiles add column if not exists invite_accepted_at timestamptz;

-- Lets the invited user flip their own row active on first sign-in, without
-- opening self-promotion generally: SECURITY DEFINER, but scoped tightly —
-- only touches auth.uid()'s own row, only when it's a genuine pending
-- invite (invited_by set, not yet active, not yet accepted), and it can
-- only ever set is_active = true, never change role.
create or replace function public.accept_staff_invite()
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  result public.profiles;
begin
  update public.profiles
     set is_active = true,
         invite_accepted_at = now()
   where id = auth.uid()
     and invited_by is not null
     and is_active = false
     and invite_accepted_at is null
  returning * into result;

  if result.id is null then
    raise exception 'No pending invite for this account.';
  end if;

  return result;
end;
$$;

grant execute on function public.accept_staff_invite() to authenticated;
