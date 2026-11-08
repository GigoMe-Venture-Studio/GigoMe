-- Part 2: languages used at work (optional).
--
--   * jobs.languages: any of en, it, es, fr, de, zh, ar, other. Stored
--     sorted, without repeats. Empty means the employer didn't say.
--   * Separate from italian_level (how much Italian is needed), which stays.
--   * Everyone who can read a job reads its languages; owners write them.

alter table public.jobs
  add column languages text[] not null default '{}'
    constraint jobs_languages_values check (
      languages <@ array['en', 'it', 'es', 'fr', 'de', 'zh', 'ar', 'other']::text[]
    );

create index jobs_languages_idx on public.jobs using gin (languages);

create function public.job_languages_tidy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.languages := coalesce(array(select distinct l from unnest(new.languages) l order by l), '{}');
  return new;
end;
$$;

create trigger job_languages_tidy
  before insert or update of languages on public.jobs
  for each row execute function public.job_languages_tidy();

revoke all on function public.job_languages_tidy() from public, anon, authenticated;
-- Trigger only, no grants.

grant select (languages) on table public.jobs to anon, authenticated;
grant insert (languages) on table public.jobs to authenticated;
grant update (languages) on table public.jobs to authenticated;
