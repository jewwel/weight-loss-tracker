import { useMemo } from 'react'
import { CloudUpload, Download, HeartHandshake, LogIn, LogOut } from 'lucide-react'
import { usePlanData } from '@/hooks/usePlanData'
import { dateKey } from '@/lib/plan'
import { supabaseConfigured } from '@/lib/supabase'
import Hero from '@/components/Hero'
import TodayCheckin from '@/components/TodayCheckin'
import WeightSection from '@/components/WeightSection'
import Footprint from '@/components/Footprint'

export default function Home() {
  const today = useMemo(() => new Date(), [])
  const todayKey = dateKey(today)
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
    <div className="min-h-[100dvh] bg-[#FBF7EF] pb-16">
      <Hero today={today} />

      {isLoading ? (
        <main className="mx-auto mt-10 max-w-3xl px-5 text-center">
          <p className="text-sm text-[#B4ABA0]">正在轻轻取出你的记录……</p>
        </main>
      ) : !isAuthenticated ? (
        <main className="mx-auto mt-6 max-w-3xl px-5">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-6 py-10 text-center shadow-softer">
            <p className="font-serif-sc text-lg text-[#6B6156]">
              登录后，你的体重和打卡会安全地保存在云端
            </p>
            <p className="text-sm text-[#A79C8E]">
              手机、电脑随时打开，记录都在。
            </p>
            <button
              type="button"
              onClick={login}
              className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-[#E8967A] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#DE8468]"
            >
              <LogIn className="h-4 w-4" />
              使用 GitHub 账号登录
            </button>
            {!supabaseConfigured && (
              <p className="text-xs text-[#D9A08B]">
                网站还没有连接云端数据库（缺少 Supabase 配置）
              </p>
            )}
            <p className="text-xs text-[#C9BFB2]">数据只属于你，别人看不到。</p>
          </div>
        </main>
      ) : (
        <>
          <main className="space-y-4">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-1">
              <p className="text-xs text-[#B4ABA0]">
                你好，{(user?.user_metadata?.user_name as string | undefined) ?? (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? '朋友'} · 记录已云端同步
              </p>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1 text-xs text-[#C9BFB2] transition-colors hover:text-[#E8967A]"
              >
                <LogOut className="h-3 w-3" />
                退出登录
              </button>
            </div>

            {hasLegacyData && (
              <div className="mx-auto max-w-3xl px-5">
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-[#F0E2D2] bg-[#FFF8F0] px-6 py-5 text-center shadow-softer">
                  <p className="text-sm text-[#8A7F72]">
                    发现这台设备上还有云端同步之前的本机记录，要把它们搬进来吗？
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={importLegacy}
                      disabled={importPending}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#E8967A] px-5 py-2.5 text-sm text-white transition-colors hover:bg-[#DE8468] disabled:opacity-60"
                    >
                      <CloudUpload className="h-4 w-4" />
                      {importPending ? '正在搬家……' : '导入本机记录'}
                    </button>
                    <button
                      type="button"
                      onClick={dismissLegacy}
                      className="text-xs text-[#B4ABA0] underline-offset-2 hover:underline"
                    >
                      不用了
                    </button>
                  </div>
                </div>
              </div>
            )}

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
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-6 py-6 text-center shadow-softer">
              <button
                type="button"
                onClick={exportJSON}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#E4D8C8] bg-white px-5 py-2.5 text-sm text-[#8A7F72] transition-colors hover:border-[#E8967A] hover:text-[#E8967A]"
              >
                <Download className="h-4 w-4" />
                导出数据（JSON）
              </button>
              <p className="flex items-center gap-1.5 text-xs text-[#B4ABA0]">
                <HeartHandshake className="h-3.5 w-3.5" />
                数据只属于你，安安静静地同步在云端。
              </p>
            </div>
            <p className="mt-6 text-center text-xs text-[#C9BFB2]">
              轻盈计划 · 2026-07-28 → 2026-09-15 · 慢慢来，今天也很好
            </p>
          </footer>
        </>
      )}
    </div>
  )
}
