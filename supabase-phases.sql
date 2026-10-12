-- =====================================================================
-- 轻盈计划 · 体重「阶段」功能升级脚本
-- 作用：新增 weight_phases 表，支持「新建体重目标阶段」并把当前阶段归档。
--
-- 使用方式：Supabase 控制台 → SQL Editor → New query → 整段粘贴 → Run
-- 可重复执行（幂等），不会动已有的体重 / 打卡数据。
-- =====================================================================

-- 1. 阶段表：一条记录 = 一个「体重目标追踪阶段」
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
  -- 归档时冻结的成果快照（结束体重 / 减重 / 打卡天数等）
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- 2. 同一个用户同时只能有一个进行中的阶段
create unique index if not exists weight_phases_one_active_idx
  on weight_phases (user_id) where (status = 'active');

-- 3. 行级安全：每个人只能读写自己的阶段
alter table weight_phases enable row level security;

drop policy if exists "own weight_phases" on weight_phases;
create policy "own weight_phases" on weight_phases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. 给已有数据的老用户补一个「第 1 阶段」，沿用原来的计划区间
--    （已经跑过本脚本的用户不会重复插入）
insert into weight_phases (user_id, name, start_date, end_date, start_weight, goal_weight, status)
select ps.user_id, '第 1 阶段', '2026-07-28', '2026-09-15', ps.start_weight, 65, 'active'
from plan_settings ps
where not exists (
  select 1 from weight_phases wp where wp.user_id = ps.user_id
);

-- 5. 有体重记录但没有 plan_settings 记录的用户，同样补一个
--    注意：start_weight 必须写成 null::double precision，否则 Postgres 会把裸 null
--    推断成 text，报 42804「column is of type double precision but expression is of type text」。
insert into weight_phases (user_id, name, start_date, end_date, start_weight, goal_weight, status)
select distinct we.user_id, '第 1 阶段', '2026-07-28', '2026-09-15', null::double precision, 65, 'active'
from weight_entries we
where not exists (
  select 1 from weight_phases wp where wp.user_id = we.user_id
);

-- 6. 有打卡记录但没有 plan_settings 记录的用户，也补一个
insert into weight_phases (user_id, name, start_date, end_date, start_weight, goal_weight, status)
select distinct c.user_id, '第 1 阶段', '2026-07-28', '2026-09-15', null::double precision, 65, 'active'
from checkins c
where not exists (
  select 1 from weight_phases wp where wp.user_id = c.user_id
);

-- 完成。回到网页刷新即可看到「当前阶段」卡片和「新建阶段」按钮。
