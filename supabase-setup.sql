-- 轻盈计划 · Supabase 建表脚本
-- 在 Supabase 控制台 → SQL Editor → New query 中整段执行一次即可

-- 1. 用户计划设置（每用户一行）
create table if not exists plan_settings (
  user_id uuid primary key references auth.users on delete cascade,
  start_weight double precision,
  updated_at timestamptz not null default now()
);

-- 2. 每日体重记录
create table if not exists weight_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  weight double precision not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- 3. 每日打卡记录（item_key: exercise / snackFree / weighed）
create table if not exists checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  item_key text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date, item_key)
);

-- 4. 开启行级安全：每个人只能读写自己的数据
alter table plan_settings enable row level security;
alter table weight_entries enable row level security;
alter table checkins enable row level security;

create policy "own plan_settings" on plan_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own weight_entries" on weight_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own checkins" on checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
