-- Durable moderation feedback for profile timelines and admin moderation actions.

create table if not exists public.profile_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists profile_activity_user_created_at_idx
  on public.profile_activity (user_id, created_at desc);

alter table public.profile_activity enable row level security;
grant select, insert on public.profile_activity to authenticated;

drop policy if exists "users and admins can read profile activity"
  on public.profile_activity;
create policy "users and admins can read profile activity"
  on public.profile_activity
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_trackserv_admin())
  );

drop policy if exists "admins can add profile activity"
  on public.profile_activity;
create policy "admins can add profile activity"
  on public.profile_activity
  for insert
  to authenticated
  with check ((select public.is_trackserv_admin()));

create or replace function public.record_service_report_status_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    insert into public.profile_activity (user_id, actor_id, event_type, message)
    values (
      new.user_id,
      (select auth.uid()),
      'service_report',
      'Your service report status was updated to "' ||
        pg_catalog.replace(new.status::text, '_', ' ') || '".'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.record_service_report_status_activity() from public, anon, authenticated;
drop trigger if exists record_service_report_status_activity on public.reports;
create trigger record_service_report_status_activity
  after update of status on public.reports
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_service_report_status_activity();

create or replace function public.get_community_report_counts(p_user_id uuid default null)
returns table (reported_user_id uuid, reporter_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_trackserv_admin()) then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  return query
    select reports.reported_user_id, count(distinct reports.reporter_id)
    from public.user_reports as reports
    where reports.target_post_id is not null
      and reports.reported_user_id is not null
      and (p_user_id is null or reports.reported_user_id = p_user_id)
    group by reports.reported_user_id;
end;
$$;

revoke all on function public.get_community_report_counts(uuid) from public, anon;
grant execute on function public.get_community_report_counts(uuid) to authenticated;

create or replace function public.review_community_post(
  p_target_post_id uuid,
  p_action text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter_ids uuid[];
  reporter_id uuid;
  review_status text;
  activity_message text;
  post_title text;
  changed_count integer;
begin
  if not (select public.is_trackserv_admin()) then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  if p_action is null or p_action not in ('review', 'dismiss', 'remove') then
    raise exception 'Choose a valid moderation action.';
  end if;

  if p_action = 'review' then
    select array_agg(distinct reports.reporter_id)
      into reporter_ids
      from public.user_reports as reports
      where reports.target_post_id = p_target_post_id
        and reports.status = 'pending';
    review_status := 'under_review';
  else
    select array_agg(distinct reports.reporter_id)
      into reporter_ids
      from public.user_reports as reports
      where reports.target_post_id = p_target_post_id
        and reports.status in ('pending', 'under_review');
    review_status := case when p_action = 'dismiss' then 'dismissed' else 'actioned' end;
  end if;

  if coalesce(cardinality(reporter_ids), 0) = 0 then
    raise exception 'There are no open reports to update for this post.';
  end if;

  select coalesce(posts.title, 'a community post')
    into post_title
    from public.community_posts as posts
    where posts.id = p_target_post_id;
  post_title := coalesce(post_title, 'a community post');

  if p_action = 'remove' then
    update public.community_posts
      set status = 'removed'
      where id = p_target_post_id;
  end if;

  if p_action = 'review' then
    update public.user_reports
      set status = review_status,
          reviewed_at = now(),
          reviewed_by = (select auth.uid())
      where target_post_id = p_target_post_id
        and status = 'pending';
    activity_message := 'Your report about "' || post_title || '" is now being reviewed by a moderator.';
  else
    update public.user_reports
      set status = review_status,
          action_taken = case when p_action = 'remove' then 'post_removed' else action_taken end,
          reviewed_at = now(),
          reviewed_by = (select auth.uid())
      where target_post_id = p_target_post_id
        and status in ('pending', 'under_review');
    activity_message := case
      when p_action = 'dismiss'
        then 'A moderator reviewed the community post you reported and dismissed the report.'
      else 'A moderator reviewed the community post you reported and removed it.'
    end;
  end if;
  get diagnostics changed_count = row_count;

  foreach reporter_id in array reporter_ids loop
    insert into public.profile_activity (user_id, actor_id, event_type, message)
    values (
      reporter_id,
      (select auth.uid()),
      'community_report',
      activity_message
    );
  end loop;

  return changed_count;
end;
$$;

revoke all on function public.review_community_post(uuid, text) from public, anon;
grant execute on function public.review_community_post(uuid, text) to authenticated;

create or replace function public.review_account_report(
  p_report_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  target_reporter_id uuid;
  target_role text;
begin
  if not (select public.is_trackserv_admin()) then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('dismiss', 'account_suspension') then
    raise exception 'Choose a valid account-report action.';
  end if;

  select reports.reported_user_id, reports.reporter_id
    into target_user_id, target_reporter_id
    from public.user_reports as reports
    where reports.id = p_report_id
      and reports.status in ('pending', 'under_review')
    for update;
  if not found then
    raise exception 'The account report is no longer open.';
  end if;

  if p_action = 'account_suspension' then
    select profiles.role
      into target_role
      from public.profiles as profiles
      where profiles.id = target_user_id;
    if target_role is null then
      raise exception 'The reported account could not be found.';
    end if;
    if target_role = 'admin' then
      raise exception 'Administrator accounts cannot be deactivated from this action.'
        using errcode = '42501';
    end if;

    update public.profiles
      set is_suspended = true
      where id = target_user_id;
    update public.user_reports
      set status = 'actioned',
          action_taken = 'account_suspension',
          reviewed_at = now(),
          reviewed_by = (select auth.uid())
      where id = p_report_id;

    insert into public.profile_activity (user_id, actor_id, event_type, message)
    values (
      target_user_id,
      (select auth.uid()),
      'moderation_feedback',
      'An administrator deactivated your account after reviewing a report.'
    );
    if target_reporter_id is not null then
      insert into public.profile_activity (user_id, actor_id, event_type, message)
      values (
        target_reporter_id,
        (select auth.uid()),
        'moderation_feedback',
        'A moderator reviewed your account report and deactivated the reported account.'
      );
    end if;
  else
    update public.user_reports
      set status = 'dismissed',
          reviewed_at = now(),
          reviewed_by = (select auth.uid())
      where id = p_report_id;

    if target_reporter_id is not null then
      insert into public.profile_activity (user_id, actor_id, event_type, message)
      values (
        target_reporter_id,
        (select auth.uid()),
        'moderation_feedback',
        'A moderator reviewed and dismissed the account report you submitted.'
      );
    end if;
  end if;
end;
$$;

revoke all on function public.review_account_report(uuid, text) from public, anon;
grant execute on function public.review_account_report(uuid, text) to authenticated;
