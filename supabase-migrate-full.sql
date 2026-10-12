-- =====================================================================
-- 轻盈计划 · Supabase 全量建表脚本（可重复执行，幂等）
-- 在 Supabase 控制台 → SQL Editor → New query 中整段执行一次即可。
-- 若之前已跑过旧版脚本，本脚本可安全覆盖：所有 create policy 前
-- 都先 drop，因此重复执行不会报 "policy already exists"。
-- =====================================================================

-- ---------- 1. 体重管理 ----------
create table if not exists plan_settings (
  user_id uuid primary key references auth.users on delete cascade,
  start_weight double precision,
  updated_at timestamptz not null default now()
);

create table if not exists weight_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  weight double precision not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  item_key text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date, item_key)
);

alter table plan_settings enable row level security;
alter table weight_entries enable row level security;
alter table checkins enable row level security;

drop policy if exists "own plan_settings" on plan_settings;
create policy "own plan_settings" on plan_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own weight_entries" on weight_entries;
create policy "own weight_entries" on weight_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own checkins" on checkins;
create policy "own checkins" on checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------- 2. 读书计划 ----------
create table if not exists reading_plans (
  user_id uuid primary key references auth.users on delete cascade,
  book_name text not null,
  purpose text,
  questions jsonb not null default '[]'::jsonb,
  start_date text not null,
  end_date text not null,
  total_pages integer not null,
  updated_at timestamptz not null default now()
);

create table if not exists reading_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  page integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists reading_summaries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  book_name text not null,
  purpose text,
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  reflection text,
  start_date text not null,
  end_date text not null,
  finished_date text not null,
  total_pages integer not null,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table reading_plans enable row level security;
alter table reading_entries enable row level security;
alter table reading_summaries enable row level security;

drop policy if exists "own reading_plans" on reading_plans;
create policy "own reading_plans" on reading_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reading_entries" on reading_entries;
create policy "own reading_entries" on reading_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reading_summaries" on reading_summaries;
create policy "own reading_summaries" on reading_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------- 3. 项目管理 ----------
create table if not exists projects (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  goal text,
  start_date text not null,
  end_date text not null,
  updated_at timestamptz not null default now()
);

create table if not exists project_todos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  estimate_hours double precision not null default 1,
  progress integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at text
);

create table if not exists project_progress_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  progress integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists project_task_summaries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  todo_id bigint,
  title text not null,
  estimate_hours double precision not null,
  started_date text not null,
  completed_date text not null,
  reflection text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
alter table project_todos enable row level security;
alter table project_progress_logs enable row level security;
alter table project_task_summaries enable row level security;

drop policy if exists "own projects" on projects;
create policy "own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own project_todos" on project_todos;
create policy "own project_todos" on project_todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own project_progress_logs" on project_progress_logs;
create policy "own project_progress_logs" on project_progress_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own project_task_summaries" on project_task_summaries;
create policy "own project_task_summaries" on project_task_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------- 4. 英语视频学习 ----------
create table if not exists video_plans (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  goal text,
  start_date text not null,
  end_date text not null,
  updated_at timestamptz not null default now()
);

create table if not exists video_todos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  estimate_hours double precision not null default 1,
  progress integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at text
);

create table if not exists video_progress_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  progress integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists video_task_summaries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  todo_id bigint,
  title text not null,
  estimate_hours double precision not null,
  started_date text not null,
  completed_date text not null,
  reflection text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table video_plans enable row level security;
alter table video_todos enable row level security;
alter table video_progress_logs enable row level security;
alter table video_task_summaries enable row level security;

drop policy if exists "own video_plans" on video_plans;
create policy "own video_plans" on video_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own video_todos" on video_todos;
create policy "own video_todos" on video_todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own video_progress_logs" on video_progress_logs;
create policy "own video_progress_logs" on video_progress_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own video_task_summaries" on video_task_summaries;
create policy "own video_task_summaries" on video_task_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------- 5. 体重阶段（新建 / 归档阶段任务） ----------
create table if not exists weight_phases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  start_date text not null,
  end_date text not null,
  start_weight double precision,
  goal_weight double precision not null default 65,
  -- active = 进行中；archived = 已归档
  status text not null default 'active',
  -- 归档时冻结的成果快照
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- 同一个用户同时只能有一个进行中的阶段
create unique index if not exists weight_phases_one_active_idx
  on weight_phases (user_id) where (status = 'active');

alter table weight_phases enable row level security;

drop policy if exists "own weight_phases" on weight_phases;
create policy "own weight_phases" on weight_phases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 给已有数据的老用户补一个「第 1 阶段」，沿用原来的计划区间（幂等）
-- 注意：null 必须显式转型，否则 Postgres 会推断成 text 并报 42804 类型不匹配。
insert into weight_phases (user_id, name, start_date, end_date, start_weight, goal_weight, status)
select ps.user_id, '第 1 阶段', '2026-07-28', '2026-09-15', ps.start_weight, 65, 'active'
from plan_settings ps
where not exists (
  select 1 from weight_phases wp where wp.user_id = ps.user_id
);

insert into weight_phases (user_id, name, start_date, end_date, start_weight, goal_weight, status)
select distinct we.user_id, '第 1 阶段', '2026-07-28', '2026-09-15', null::double precision, 65, 'active'
from weight_entries we
where not exists (
  select 1 from weight_phases wp where wp.user_id = we.user_id
);

insert into weight_phases (user_id, name, start_date, end_date, start_weight, goal_weight, status)
select distinct c.user_id, '第 1 阶段', '2026-07-28', '2026-09-15', null::double precision, 65, 'active'
from checkins c
where not exists (
  select 1 from weight_phases wp where wp.user_id = c.user_id
);
