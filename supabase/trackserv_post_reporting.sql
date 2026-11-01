-- Enables authenticated citizens to report community posts.
-- Five distinct reporters put a post and its author in the admin review queue.

alter table public.user_reports
  add column if not exists post_threshold_flagged boolean not null default false;

alter table public.profiles
  add column if not exists flagged_post_count integer not null default 0
    check (flagged_post_count >= 0);

create or replace function public.set_reported_post_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_post_id is not null then
    new.reporter_id := (select auth.uid());
    if new.reporter_id is null then
      raise exception 'Sign in before reporting a community post.';
    end if;

    select posts.user_id
      into new.reported_user_id
      from public.community_posts as posts
      where posts.id = new.target_post_id;

    if new.reported_user_id is null then
      raise exception 'The reported community post does not exist.';
    end if;

    if new.reported_user_id = new.reporter_id then
      raise exception 'You cannot report your own community post.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.target_post_id::text || ':' || new.reporter_id::text, 0)
    );

    if exists (
      select 1
      from public.user_reports as existing
      where existing.target_post_id = new.target_post_id
        and existing.reporter_id = new.reporter_id
        and existing.id is distinct from new.id
    ) then
      raise exception 'You have already reported this community post.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.set_reported_post_owner() from public;

drop trigger if exists set_reported_post_owner_before_write
  on public.user_reports;
create trigger set_reported_post_owner_before_write
  before insert or update of target_post_id on public.user_reports
  for each row
  execute function public.set_reported_post_owner();

create or replace function public.refresh_post_report_flag(target_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  threshold_met boolean;
begin
  select posts.user_id
    into owner_id
    from public.community_posts as posts
    where posts.id = target_post;

  if owner_id is null then
    return;
  end if;

  select count(distinct reports.reporter_id) >= 5
    into threshold_met
    from public.user_reports as reports
    where reports.target_post_id = target_post
      and reports.status in ('pending', 'under_review');

  update public.user_reports
    set post_threshold_flagged = coalesce(threshold_met, false)
    where target_post_id = target_post
      and post_threshold_flagged is distinct from coalesce(threshold_met, false);

  update public.profiles as profile
    set flagged_post_count = (
      select count(distinct reports.target_post_id)::integer
      from public.user_reports as reports
      join public.community_posts as posts on posts.id = reports.target_post_id
      where posts.user_id = profile.id
        and reports.post_threshold_flagged
    )
    where profile.id = owner_id;
end;
$$;

revoke all on function public.refresh_post_report_flag(uuid) from public;

create or replace function public.sync_post_report_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.target_post_id is not null then
    perform public.refresh_post_report_flag(old.target_post_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.target_post_id is not null then
    perform public.refresh_post_report_flag(new.target_post_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_post_report_flag() from public;

drop trigger if exists sync_post_report_flag_after_report
  on public.user_reports;
create trigger sync_post_report_flag_after_report
  after insert or update of status, target_post_id, reporter_id or delete
  on public.user_reports
  for each row
  execute function public.sync_post_report_flag();

-- Backfill existing reports when applying the migration.
do $$
declare
  post_record record;
begin
  for post_record in
    select distinct target_post_id
    from public.user_reports
    where target_post_id is not null
  loop
    perform public.refresh_post_report_flag(post_record.target_post_id);
  end loop;
end;
$$;

grant insert on public.user_reports to authenticated;

drop policy if exists "citizens can report community posts"
  on public.user_reports;
create policy "citizens can report community posts"
  on public.user_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and reported_user_id <> (select auth.uid())
    and target_post_id is not null
    and status = 'pending'
    and action_taken is null
    and reviewed_by is null
    and post_threshold_flagged = false
    and exists (
      select 1
      from public.community_posts as posts
      where posts.id = user_reports.target_post_id
        and posts.user_id = user_reports.reported_user_id
    )
  );
