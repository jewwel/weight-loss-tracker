# 从零搭建一个「GitHub Pages + Supabase」的个人数据记录网站：架构、部署与踩坑全记录

> 本文以一个真实的减重打卡网站（体重记录 + 每日打卡）为例，完整记录如何用 **Vite + React + Supabase + GitHub Pages** 搭建一个免后端服务器、数据云端同步、支持 GitHub 账号登录的个人小站。重点不在"怎么写代码"，而在**开发部署全流程中真实踩过的坑**，以及 **GitHub 和 Supabase 之间互相需要配置的东西**——照着做，你也能搭一个类似的网站。

## 一、最终效果与整体架构

网站功能很简单：记录起始体重、每天填体重、每天三项打卡（运动 / 忌口 / 称重），数据按用户隔离存在云端，手机电脑都能访问。

技术选型：

| 层 | 方案 | 理由 |
|---|---|---|
| 前端 | Vite 7 + React 19 + TypeScript + Tailwind | 纯静态 SPA，构建产物直接丢 Pages |
| 数据库 + 认证 | Supabase（Postgres + Auth + RLS） | 免自建后端，自带 OAuth 登录和行级权限 |
| 托管 | GitHub Pages | 免费静态托管 |
| CI/CD | GitHub Actions | push 即部署 |

数据流：

```
浏览器 SPA ──supabase-js──> Supabase (Auth + Postgres, RLS 按 user_id 隔离)
     ▲
     └── GitHub OAuth 登录（三方跳转：站点 → Supabase → GitHub → Supabase → 站点）

GitHub push → Actions: npm ci → vite build → upload-pages-artifact → deploy-pages
```

**没有自己的后端服务器**（仓库里的 `api/`、`db/` 是另一套本地后端实验代码，Pages 部署完全用不到，构建时直接跑 `vite build` 即可）。这是这个架构最省心的地方：前端直连 Supabase，鉴权和数据隔离全部交给 RLS。

## 二、搭建步骤

### 2.1 Supabase 侧：建表 + 行级安全

在 Supabase 控制台 → SQL Editor 执行一次建表脚本。三张表：用户设置（起始体重）、体重记录、打卡记录：

```sql
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
  unique (user_id, date)          -- 注意这个唯一约束，后面的坑和它有关
);

-- 3. 每日打卡记录
create table if not exists checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  item_key text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date, item_key)
);

-- 4. 行级安全：每个人只能读写自己的数据
alter table plan_settings enable row level security;
alter table weight_entries enable row level security;
alter table checkins enable row level security;

create policy "own plan_settings" on plan_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weight_entries" on weight_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own checkins" on checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

RLS 是这个架构的安全基石：前端用的是 **anon key**（会打包进公开的前端代码里，任何人都能看到），之所以敢这么做，就是因为 RLS 保证 anon key 只能操作"当前登录用户自己的行"。**不开 RLS 等于把整张表裸奔到公网。**

### 2.2 GitHub ↔ Supabase 的互相配置（重点，最容易卡住的地方）

OAuth 登录涉及三方：你的网站、Supabase、GitHub。它们之间要互相登记，缺任何一环登录都会失败，而且 **Supabase 后台 Auth → Users 里不会有任何用户**——这是判断登录链路是否走通的最快方法。

**① GitHub 上创建 OAuth App**（给 Supabase 用）

- 位置：GitHub → 头像 → Settings → Developer settings → **OAuth Apps**（注意不是 GitHub Apps）→ New OAuth App
- `Homepage URL`：你的网站地址，如 `https://<用户名>.github.io/<仓库名>/`
- `Authorization callback URL`：**必须填 Supabase 的回调地址**，格式：
  `https://<项目ref>.supabase.co/auth/v1/callback`
  （这个地址在 Supabase 的 GitHub Provider 设置页里有显示，直接复制）
- 创建后拿到 `Client ID`，点 Generate a new client secret 拿到 `Client Secret`

**② Supabase 里启用 GitHub Provider**（把 ① 的凭证填进来）

- 位置：Supabase 控制台 → Authentication → Sign In / Providers → GitHub
- 打开 Enabled，填入 ① 的 `Client ID` 和 `Client Secret`

**③ Supabase 里配置跳转白名单**（让 Supabase 知道可以跳回你的网站）

- 位置：Authentication → Sign In / Up → URL Configuration
- `Site URL`：`https://<用户名>.github.io/<仓库名>/`
- `Redirect URLs`：加上 `https://<用户名>.github.io/<仓库名>/**`

记忆方法：**GitHub 要填 Supabase 的回调地址；Supabase 要填 GitHub 的 Client ID/Secret；Supabase 还要把你自己网站的地址加进白名单。** 三方两两登记，缺一不可。

**④ GitHub 仓库里配置 Secrets**（给构建用）

- 位置：仓库 → Settings → Secrets and variables → Actions
- 添加两个：`VITE_SUPABASE_URL`（`https://<项目ref>.supabase.co`）和 `VITE_SUPABASE_ANON_KEY`（Supabase → Project Settings → API 里的 anon public key）
- 注意：Vite 的环境变量是**构建期内联**进 JS 的，所以改了 Secret 之后必须重新跑一次部署才生效

### 2.3 前端：Supabase 客户端

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
```

`detectSessionInUrl: true` 很关键：OAuth 跳转回来时，token 在 URL 的 hash 里，supabase-js 会自动捡起来完成登录。

登录跳转注意带上 `BASE_URL`（项目页的 base 路径，见后面的坑 4）：

```ts
supabase.auth.signInWithOAuth({
  provider: 'github',
  options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
})
```

### 2.4 GitHub Actions 部署 workflow

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci --include=dev
      - run: ./node_modules/.bin/vite build --base=/${{ github.event.repository.name }}/
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/public
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

另外：仓库 Settings → Pages → **Source 必须选 "GitHub Actions"**（不是 "Deploy from a branch"）。

## 三、踩坑实录（本文最有价值的部分）

### 坑 1：package-lock.json 混入私有镜像地址，CI 装出残缺 node_modules ★最隐蔽

**现象**：CI 里 `npm ci` 看似跑完，下一步却报 `ls: cannot access 'node_modules/.bin/': No such file or directory`、`vite: No such file or directory`（exit 127）。

**根因**：本地开发时 npm 配过私有镜像（`npm.mirrors.msh.team`），生成的 `package-lock.json` 里有 **176 个包的 `resolved` 下载地址指向这个镜像**。这个镜像后来挂掉了（DNS 都解析不了），于是：

- CI 上这 176 个包拉不下来，`node_modules` 装成半成品，连 `.bin` 目录都没建出来
- 本地同样中招：反复安装中断，`node_modules` 里全是 `.acorn-RPtvtUzC` 这种 npm 中断残留的临时目录

**排查方法**，一行脚本统计 lockfile 里的下载源：

```bash
node -e "
const lock = require('./package-lock.json');
const hosts = {};
for (const v of Object.values(lock.packages))
  if (v && v.resolved) { const h = new URL(v.resolved).host; hosts[h] = (hosts[h]||0)+1; }
console.log(hosts);"
# { 'registry.npmjs.org': 533, 'npm.mirrors.msh.team': 176 }  ← 混合源就是问题
```

**修复**：把 `resolved` 的 host 统一改回官方源。`integrity` 是内容哈希、与下载源无关，不用动：

```bash
node -e "
const fs = require('fs');
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
for (const v of Object.values(lock.packages))
  if (v?.resolved?.startsWith('https://npm.mirrors.msh.team/'))
    v.resolved = v.resolved.replace('https://npm.mirrors.msh.team/', 'https://registry.npmjs.org/');
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');"
```

改完本地跑 `npm ci` 验证通过再提交。**教训：换过 npm registry 镜像后，提交 lockfile 前检查 `resolved` 域名是否统一。**

### 坑 2："The operation was canceled" 不是错误，是被取消

**现象**：`npm ci` 跑了 24 秒，报 `Error: The operation was canceled`。

**根因**：workflow 里有 `concurrency: { group: pages, cancel-in-progress: true }`——连续 push 两次（或 push 后又手动触发）时，新 run 会把正在跑的旧 run 直接取消。被取消的 run 日志就长这样，看起来像 npm 出错了，其实不是。

**应对**：先看 Actions 列表里是不是同时有多个 run，以最新一个的结果为准。这个配置对 Pages 部署是合理的（旧部署没必要跑完），别急着改。

### 坑 3：网站一直是旧构建，现象和代码对不上

**现象**：线上页面没有登录入口，填的数据不进数据库；但代码里明明有登录逻辑。

**根因**：坑 1 + 坑 2 导致最近几次部署全部失败/被取消，Pages 一直在服务**最后一次成功的旧构建**（纯 localStorage 版本）。用户填的数据全写在浏览器本地，Supabase 里自然什么都没有，Auth → Users 也没有用户。

**教训**：排查"线上行为和代码不符"类问题，**第一步先确认线上跑的是哪个版本**（比如页面特征、构建时间），能省掉大量无效排查。

### 坑 4：项目页的 base 路径

部署到 `用户名.github.io/仓库名/` 这种**项目页**时，必须给 vite 传 `--base=/仓库名/`，否则资源 404、页面空白。两个细节：

- 不能用 `npm run build -- --base=...`：参数会被追加到 build 脚本里 `vite build && esbuild ...` 的**最后一条命令**（esbuild）后面，vite 根本收不到。要么直接调 `./node_modules/.bin/vite build --base=...`，要么把 Pages 需要的构建拆成独立 script。
- 前端所有需要拼 URL 的地方（比如 OAuth 的 `redirectTo`）都要带上 `import.meta.env.BASE_URL`。

如果仓库名就是 `用户名.github.io`（用户页），则不需要 `--base`。

### 坑 5：vite 在 devDependencies 里，CI 上"找不到 vite"

GitHub Actions 的 runner 环境里，`npm ci` 可能受 `NODE_ENV=production` 或 omit 配置影响跳过 devDependencies，而 `vite`、`typescript` 通常都在 devDependencies 里。对策是显式 `npm ci --include=dev`（Pages 只需要静态产物，没必要为了部署把构建工具挪进 dependencies）。

### 坑 6：upsert 不写 onConflict，第二次写入必失败 ★最低调的逻辑 bug

**现象**：同一天第一次填体重成功，之后再改就写不进库了；打卡只能点亮，再也改不动。

**根因**：表的主键是自增 `id`，业务唯一约束是 `(user_id, date)`。supabase-js 的 `upsert` **默认按主键判断冲突**，payload 里没有 `id`，于是每次都当新行 INSERT，撞上唯一约束报 409。

**修复**：显式指定冲突列：

```ts
supabase.from('weight_entries').upsert(
  { user_id: userId, date: key, weight: w },
  { onConflict: 'user_id,date' },          // 对应表上的唯一约束
)
supabase.from('checkins').upsert(
  { user_id: userId, date: key, item_key: item, done: newValue },
  { onConflict: 'user_id,date,item_key' },
)
```

**规律：upsert 的 onConflict 必须和表上的唯一约束对齐，主键是自增 id 时尤其要小心。**

### 坑 7：`.then(() => {})` 吞掉所有错误，排查时两眼一抹黑

原代码所有写库操作都是 `.then(() => {})`——表不存在、RLS 拦截、唯一键冲突，任何失败都无声无息，页面上一切如常。这让坑 6 存在了很久都没被发现。

**教训：任何"发了请求但不关心结果"的地方，至少把错误打出来**：

```ts
.then(({ error }) => {
  if (error) console.error('[sync] 保存体重失败:', error.message)
})
```

配合浏览器 F12 → Network 筛选 `supabase`，看 REST 请求的状态码：`401/403` 是登录态或 RLS 问题，`404` 是表没建，`409` 是唯一键冲突。

### 坑 8：未登录不写库的设计，要用 Auth → Users 反推

代码设计上未登录时 `if (!userId) return`（不写库也不写 localStorage），且未登录界面只有登录按钮、没有输入框。所以"能填数据但库里没有"这个反馈其实自相矛盾——真相是坑 3（用户在旧构建上填的）。

**排查这类"数据没存上"的问题，推荐顺序**：Supabase Auth → Users 有没有用户（登录通没通）→ 浏览器 Console 有没有报错 → Network 里 REST 请求的状态码 → Table Editor 有没有行。自上而下，每一步都能排除一大类原因。

## 四、一个加分项：旧数据迁移

这个网站的前身是纯 localStorage 版本。升级后加了一个一次性迁移：登录后检测 localStorage 里的旧数据，提示用户一键 upsert 到云端（迁移的 upsert 同样要带 `onConflict`，否则重复导入会撞唯一键），导入成功后清掉 localStorage。如果你的项目也有类似的"从本地存储升级到云端"路径，这个模式可以直接抄。

## 五、上线 Checklist

按顺序过一遍，基本不会漏：

- [ ] Supabase：三张表建好了，RLS 开启了，策略是 `auth.uid() = user_id`
- [ ] GitHub OAuth App：callback URL 填的是 `https://<项目ref>.supabase.co/auth/v1/callback`
- [ ] Supabase GitHub Provider：Enabled，填了 Client ID / Secret
- [ ] Supabase URL Configuration：Redirect URLs 包含 `https://<用户名>.github.io/<仓库名>/**`
- [ ] GitHub 仓库 Secrets：`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [ ] 仓库 Settings → Pages → Source = GitHub Actions
- [ ] `package-lock.json` 的 `resolved` 域名统一（没有私有镜像残留）
- [ ] workflow：`npm ci --include=dev`、`vite build --base=/仓库名/`、artifact 路径与 `build.outDir` 一致
- [ ] push 后别重复触发，等一个 run 跑完（`cancel-in-progress` 会取消旧 run）
- [ ] 部署后：页面出现登录入口 → 登录成功 → Auth → Users 出现你的账号 → 填一条数据 → Table Editor 能看到行

## 六、总结

这套「Vite SPA + Supabase + GitHub Pages」的组合，零服务器、零成本（免费额度内），就拿到了数据库、OAuth 登录、行级权限、自动部署四件套，非常适合个人小工具。真正费时间的从来不是写代码，而是：

1. **三方配置互相登记**（GitHub OAuth App ↔ Supabase Provider ↔ 跳转白名单），漏一个就登录失败；
2. **构建链路的一致性**（lockfile 下载源、devDependencies、base 路径、产物路径），错一个就部署失败；
3. **防御性写代码**（upsert 带 onConflict、错误要暴露），省一个就线上出玄学 bug。

把这些坑提前知道，照着 Checklist 走，从零到上线一两个小时足够。
