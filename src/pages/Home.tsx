import { useMemo, useState } from 'react'
import {
  BookOpen,
  CloudUpload,
  Download,
  HeartHandshake,
  LogIn,
  LogOut,
  Scale,
} from 'lucide-react'
import { usePlanData } from '@/hooks/usePlanData'
import { dateKey } from '@/lib/plan'
import { supabaseConfigured } from '@/lib/supabase'
import Hero from '@/components/Hero'
import TodayCheckin from '@/components/TodayCheckin'
import WeightSection from '@/components/WeightSection'
import Footprint from '@/components/Footprint'
import ReadingSection from '@/components/ReadingSection'

export default function Home() {
  const today = useMemo(() => new Date(), [])
  const todayKey = dateKey(today)
  const [tab, setTab] = useState<'weight' | 'reading'>('weight')
  const {
    data,
    setStartWeight,
    setWeight,
    removeWeight,
    toggleCheck,
    exportJSON,
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasLegacyData,
    importLegacy,
    dismissLegacy,
    importPending,
  } = usePlanData()

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] pb-16">
      <Hero today={today} />

      {/* 功能切换 */}
      <div className="mx-auto mt-2 flex max-w-3xl justify-center px-5">
        <div className="inline-flex rounded-full border border-[#262626] bg-[#141414] p-1">
          <button
            type="button"
            onClick={() => setTab('weight')}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm transition-colors ${
              tab === 'weight'
                ? 'bg-[#F5F5F5] font-medium text-[#0A0A0A]'
                : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
            }`}
          >
            <Scale className="h-4 w-4" />
            体重管理
          </button>
          <button
            type="button"
            onClick={() => setTab('reading')}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm transition-colors ${
              tab === 'reading'
                ? 'bg-[#F5F5F5] font-medium text-[#0A0A0A]'
                : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            读书计划
          </button>
        </div>
      </div>

      {isLoading ? (
        <main className="mx-auto mt-10 max-w-3xl px-5 text-center">
          <p className="text-sm text-[#6E6E6E]">正在轻轻取出你的记录……</p>
        </main>
      ) : !isAuthenticated ? (
        <main className="mx-auto mt-6 max-w-3xl px-5">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-10 text-center shadow-softer">
            <p className="font-serif-sc text-lg text-[#F5F5F5]">
              登录后，你的体重和打卡会安全地保存在云端
            </p>
            <p className="text-sm text-[#A3A3A3]">
              手机、电脑随时打开，记录都在。
            </p>
            <button
              type="button"
              onClick={login}
              className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-[#F5F5F5] px-6 py-3 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0]"
            >
              <LogIn className="h-4 w-4" />
              使用 GitHub 账号登录
            </button>
            {!supabaseConfigured && (
              <p className="text-xs text-[#C0665F]">
                网站还没有连接云端数据库（缺少 Supabase 配置）
              </p>
            )}
            <p className="text-xs text-[#6E6E6E]">数据只属于你，别人看不到。</p>
          </div>
        </main>
      ) : (
        <>
          <main className="space-y-4">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-1">
              <p className="text-xs text-[#6E6E6E]">
                你好，
                {(user?.user_metadata?.user_name as string | undefined) ??
                  (user?.user_metadata?.full_name as string | undefined) ??
                  user?.email ??
                  '朋友'}{' '}
                · 记录已云端同步
              </p>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1 text-xs text-[#6E6E6E] transition-colors hover:text-[#F5F5F5]"
              >
                <LogOut className="h-3 w-3" />
                退出登录
              </button>
            </div>

            {hasLegacyData && (
              <div className="mx-auto max-w-3xl px-5">
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5 text-center shadow-softer">
                  <p className="text-sm text-[#A3A3A3]">
                    发现这台设备上还有云端同步之前的本机记录，要把它们搬进来吗？
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={importLegacy}
                      disabled={importPending}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#F5F5F5] px-5 py-2.5 text-sm text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0] disabled:opacity-60"
                    >
                      <CloudUpload className="h-4 w-4" />
                      {importPending ? '正在搬家……' : '导入本机记录'}
                    </button>
                    <button
                      type="button"
                      onClick={dismissLegacy}
                      className="text-xs text-[#6E6E6E] underline-offset-2 hover:underline"
                    >
                      不用了
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>

          {tab === 'reading' ? (
            <main>
              <ReadingSection today={today} userId={user?.id ?? ''} />
            </main>
          ) : (
            <>
              <main className="space-y-4">
                <TodayCheckin
                  todayKey={todayKey}
                  checkins={data.checkins}
                  weights={data.weights}
                  onToggle={toggleCheck}
                />

                <WeightSection
                  today={today}
                  data={data}
                  setStartWeight={setStartWeight}
                  setWeight={setWeight}
                  removeWeight={removeWeight}
                />

                <Footprint today={today} data={data} />
              </main>

              <footer className="mx-auto mt-8 max-w-3xl px-5">
                <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-6 text-center shadow-softer">
                  <button
                    type="button"
                    onClick={exportJSON}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#262626] bg-[#1C1C1C] px-5 py-2.5 text-sm text-[#A3A3A3] transition-colors hover:border-[#F5F5F5] hover:text-[#F5F5F5]"
                  >
                    <Download className="h-4 w-4" />
                    导出数据（JSON）
                  </button>
                  <p className="flex items-center gap-1.5 text-xs text-[#6E6E6E]">
                    <HeartHandshake className="h-3.5 w-3.5" />
                    数据只属于你，安安静静地同步在云端。
                  </p>
                </div>
                <p className="mt-6 text-center text-xs text-[#6E6E6E]">
                  轻盈计划 · 2026-07-28 → 2026-09-15 · 慢慢来，今天也很好
                </p>
              </footer>
            </>
          )}
        </>
      )}
    </div>
  )
}
